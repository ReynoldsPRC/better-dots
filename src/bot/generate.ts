// Level generator: builds candidate levels from parameters, then lets the bot
// set the goal size, move limit, and star cutoffs. Seeded and pure.
import { parseLevel, Rng, seedRng, type ColorId, type Goal, type LevelDef, type PlacedPiece, type Wall } from '../rules';
import { analyzeLevel, isLuckHeavy, tuneFromStats, type LevelStats, type Tuning } from './bot';
import type { BotNote } from './format';

export interface GenParams {
  rows: number;
  cols: number;
  /** How many dot colors the board uses. */
  colors: number;
  /** Missing cells, placed in mirrored pairs (shaped boards). */
  holes?: number;
  /** Walls, placed in mirrored pairs. */
  walls?: number;
  /** How many collect-color goals. */
  collectGoals: number;
  /** Anchor goal: anchors on the board at the start, plus drops that scale with goal size. */
  anchors?: { start: number; dropsPerSize: number };
  /**
   * Ice on about `perSize` x goal-size cells (mirrored pairs, capped at `max`), thickness
   * in the given range; the goal is to break it all.
   */
  ice?: { perSize: number; max: number; thickness: [number, number] };
  /** Gem goal: this many gems (a share of them cross gems, the rest row or column evenly) in the board's colors; set them all off. */
  gems?: { count: number; crossShare: number };
  /** Slime goal: this many slimed cells to start (mirrored), `underIce` of them frozen over. */
  slime?: { cells: number; underIce?: number };
  /** Fire goal: this many burning cells to start (mirrored), `underIce` of them frozen over. */
  fire?: { cells: number; underIce?: number };
  /** Ladybug goal: this many three-spot ladybugs; clear them all. */
  ladybugs?: number;
  /** Flood goal: this many watered cells to start (mirrored), `underIce` of them frozen over. */
  water?: { sources: number; underIce?: number };
  /** The move limit should land in this range. */
  targetMoves: [number, number];
  /** Bot runs per measurement. */
  runs?: number;
}

export interface Candidate {
  level: LevelDef;
  bot: BotNote;
}

/** Smaller collect goals aren't worth showing. */
const MIN_COLLECT = 8;

const mirrorCol = (cols: number, c: number) => cols - 1 - c;

function connected(layout: string[]): boolean {
  const rows = layout.length;
  const cols = layout[0].length;
  const cells: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (layout[r][c] !== '-') cells.push(r * cols + c);
  if (cells.length === 0) return false;
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / cols);
    const c = i % cols;
    for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols || layout[rr][cc] === '-') continue;
      const j = rr * cols + cc;
      if (!seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === cells.length;
}

function makeLayout(p: GenParams, rng: Rng): string[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const grid = Array.from({ length: p.rows }, () => Array<string>(p.cols).fill('.'));
    let placed = 0;
    let guard = 0;
    while (placed < (p.holes ?? 0) && guard++ < 500) {
      const r = rng.int(p.rows);
      const c = rng.int(Math.ceil(p.cols / 2));
      if (grid[r][c] === '-') continue;
      grid[r][c] = '-';
      grid[r][mirrorCol(p.cols, c)] = '-';
      placed += c === mirrorCol(p.cols, c) ? 1 : 2;
    }
    const layout = grid.map((row) => row.join(''));
    // Every column needs a cell so refills have somewhere to land, and the board must be one piece.
    const columnsOk = [...Array(p.cols).keys()].every((c) => layout.some((row) => row[c] !== '-'));
    if (columnsOk && connected(layout)) return layout;
  }
  return Array.from({ length: p.rows }, () => '.'.repeat(p.cols));
}

function makeWalls(p: GenParams, layout: string[], rng: Rng): Wall[] {
  const walls: Wall[] = [];
  const key = (w: Wall) => `${w.r},${w.c},${w.side}`;
  const have = new Set<string>();
  const cell = (r: number, c: number) => r >= 0 && c >= 0 && r < p.rows && c < p.cols && layout[r][c] !== '-';
  let guard = 0;
  while (walls.length < (p.walls ?? 0) && guard++ < 500) {
    const r = rng.int(p.rows);
    const c = rng.int(Math.ceil(p.cols / 2));
    const side = rng.float() < 0.5 ? 'right' : 'down';
    const w: Wall = { r, c, side };
    const [r2, c2] = side === 'right' ? [r, c + 1] : [r + 1, c];
    if (!cell(r, c) || !cell(r2, c2) || have.has(key(w))) continue;
    const m: Wall = side === 'right' ? { r, c: mirrorCol(p.cols, c + 1), side } : { r, c: mirrorCol(p.cols, c), side };
    for (const x of [w, m]) {
      if (!have.has(key(x))) {
        have.add(key(x));
        walls.push(x);
      }
    }
  }
  return walls;
}

/** Places the level's starting pieces (anchors in the top rows, away from the bottom). */
function placePieces(p: GenParams, layout: string[], palette: ColorId[], rng: Rng): PlacedPiece[] {
  const out: PlacedPiece[] = [];
  const taken = new Set<number>();
  const free = (r: number, c: number) => layout[r][c] !== '-' && !taken.has(r * p.cols + c);
  const anchors = p.anchors?.start ?? 0;
  for (let guard = 0; out.length < anchors && guard < 500; guard++) {
    const r = rng.int(Math.max(1, Math.floor(p.rows / 2)));
    const c = rng.int(p.cols);
    if (!free(r, c)) continue;
    taken.add(r * p.cols + c);
    out.push({ r, c, type: 'anchor' });
  }
  const gems = p.gems?.count ?? 0;
  for (let k = 0, guard = 0; k < gems && guard < 500; guard++) {
    const r = rng.int(p.rows);
    const c = rng.int(p.cols);
    if (!free(r, c)) continue;
    taken.add(r * p.cols + c);
    const shape = rng.float() < p.gems!.crossShare ? 'cross' : rng.float() < 0.5 ? 'row' : 'column';
    out.push({ r, c, type: 'gem', color: palette[k % palette.length], shape });
    k++;
  }
  for (let k = 0, guard = 0; k < (p.ladybugs ?? 0) && guard < 500; guard++) {
    const r = rng.int(p.rows);
    const c = rng.int(p.cols);
    if (!free(r, c)) continue;
    taken.add(r * p.cols + c);
    out.push({ r, c, type: 'ladybug', color: palette[(k + 1) % palette.length], facing: rng.pick(['up', 'down', 'left', 'right'] as const) });
    k++;
  }
  return out;
}

/** Mirrored ice. */
function placeIce(p: GenParams, layout: string[], cells: number, rng: Rng): string[] | undefined {
  if (!p.ice || cells <= 0) return undefined;
  const grid = layout.map((row) => [...row].map(() => '.'));
  const [lo, hi] = p.ice.thickness;
  let placed = 0;
  for (let guard = 0; placed < cells && guard < 500; guard++) {
    const r = rng.int(p.rows);
    const c = rng.int(Math.ceil(p.cols / 2));
    const m = mirrorCol(p.cols, c);
    if (layout[r][c] === '-' || grid[r][c] !== '.') continue;
    const n = String(lo + rng.int(hi - lo + 1));
    grid[r][c] = n;
    grid[r][m] = n;
    placed += c === m ? 1 : 2;
  }
  return grid.map((row) => row.join(''));
}

/** A mirrored cell layer (water or slime); `underIce` of those cells (in pairs) get 1-2 layers of ice on top. */
function placeLayer(
  spec: { count: number; underIce?: number } | undefined, p: GenParams, layout: string[], rng: Rng,
): { cells?: string[]; ice?: string[] } {
  if (!spec || spec.count <= 0) return {};
  const marks = layout.map((row) => [...row].map(() => '.'));
  const ice = layout.map((row) => [...row].map(() => '.'));
  let placed = 0;
  let frozen = 0;
  for (let guard = 0; placed < spec.count && guard < 500; guard++) {
    const r = rng.int(p.rows);
    const c = rng.int(Math.ceil(p.cols / 2));
    const m = mirrorCol(p.cols, c);
    if (layout[r][c] === '-' || marks[r][c] !== '.') continue;
    marks[r][c] = marks[r][m] = 'x';
    if (frozen < (spec.underIce ?? 0) && r > 0) {
      ice[r][c] = ice[r][m] = String(1 + rng.int(2));
      frozen += c === m ? 1 : 2;
    }
    placed += c === m ? 1 : 2;
  }
  return { cells: marks.map((r) => r.join('')), ice: frozen > 0 ? ice.map((r) => r.join('')) : undefined };
}

function mergeIce(a: string[] | undefined, b: string[], layout: string[]): string[] {
  return layout.map((row, r) => [...row].map((_, c) => (b[r][c] !== '.' ? b[r][c] : a?.[r][c] ?? '.')).join(''));
}

/** Builds one candidate, or null if the bot couldn't make it fit the target (or the level can't be built). */
export function generateCandidate(p: GenParams, seed: number, name?: string): Candidate | null {
  try {
    return tryCandidate(p, seed, name);
  } catch {
    return null;
  }
}

function tryCandidate(p: GenParams, seed: number, name?: string): Candidate | null {
  const rng = new Rng(seedRng(seed));
  const palette = rng.shuffle([0, 1, 2, 3, 4] as ColorId[]).slice(0, p.colors).sort((a, b) => a - b);
  const layout = makeLayout(p, rng);
  const walls = makeWalls(p, layout, rng);
  const goalColors = rng.shuffle(palette).slice(0, p.collectGoals).sort((a, b) => a - b);
  const runs = p.runs ?? 40;
  const piecePalette = rng.shuffle(palette);
  const pieceSeed = rng.int(1_000_000);
  const iceSeed = rng.int(1_000_000);
  const layerSeed = rng.int(1_000_000);
  // The goal-size lever: obstacle counts scale with `count` relative to where it starts,
  // so worlds without collect goals converge instead of just reseeding.
  const count0 = p.collectGoals > 0 ? 12 : 18;
  const cellCount = layout.join('').replace(/-/g, '').length;
  const scaled = (n: number | undefined, count: number, cap: number) =>
    n ? Math.min(Math.max(1, cap), Math.max(1, Math.round((n * count) / count0))) : 0;
  const layer = (spec: { count: number; underIce?: number } | undefined, count: number, cap: number, k: number) =>
    placeLayer(spec && { ...spec, count: scaled(spec.count, count, cap) }, p, layout, new Rng(seedRng(layerSeed + k)));

  const build = (count: number, moves: number): LevelDef => {
    const pieceCap = Math.floor(cellCount / 6);
    const pieces = placePieces({
      ...p,
      gems: p.gems && { ...p.gems, count: scaled(p.gems.count, count, pieceCap) },
      ladybugs: scaled(p.ladybugs, count, pieceCap),
    }, layout, piecePalette, new Rng(seedRng(pieceSeed)));
    const { cells: water, ice: waterIce } = layer(p.water && { count: p.water.sources, underIce: p.water.underIce }, count, cellCount / 2, 1);
    const { cells: slime, ice: slimeIce } = layer(p.slime && { count: p.slime.cells, underIce: p.slime.underIce }, count, cellCount / 2, 2);
    const { cells: fire, ice: fireIce } = layer(p.fire && { count: p.fire.cells, underIce: p.fire.underIce }, count, cellCount / 3, 3);
    const goals: Goal[] = goalColors.map((color): Goal => ({ type: 'collect', color, count: Math.max(MIN_COLLECT, count) }));
    let ice = p.ice ? placeIce(p, layout, Math.min(p.ice.max, Math.round(count * p.ice.perSize)), new Rng(seedRng(iceSeed))) : undefined;
    const iceCount = ice ? ice.join('').replace(/\./g, '').length : 0;
    if (iceCount > 0) goals.unshift({ type: 'ice', count: iceCount });
    const gems = pieces.filter((x) => x.type === 'gem').length;
    const bugs = pieces.filter((x) => x.type === 'ladybug').length;
    if (gems) goals.unshift({ type: 'gems', count: gems });
    if (bugs) goals.unshift({ type: 'ladybugs', count: bugs });
    if (water) goals.unshift({ type: 'flood' });
    if (slime) goals.unshift({ type: 'slime' });
    if (fire) goals.unshift({ type: 'fire' });
    // Freeze over some hazard cells (hazards under ice).
    for (const extra of [waterIce, slimeIce, fireIce]) if (extra) ice = mergeIce(ice, extra, layout);
    let anchorDrops: number | undefined;
    if (p.anchors) {
      anchorDrops = Math.max(0, Math.round(count * p.anchors.dropsPerSize));
      goals.unshift({ type: 'anchors', count: p.anchors.start + anchorDrops });
    }
    return parseLevel({
      // The levels script swaps in a fresh random id when it writes the file.
      id: 'candidate',
      ...(name ? { name } : {}),
      seed: rng.int(1_000_000),
      moves,
      colors: palette,
      layout,
      ...(walls.length ? { walls } : {}),
      ...(pieces.length ? { pieces } : {}),
      ...(anchorDrops ? { anchorDrops } : {}),
      ...(ice ? { ice } : {}),
      ...(water ? { water } : {}),
      ...(slime ? { slime } : {}),
      ...(fire ? { fire } : {}),
      goals,
    }, 'candidate');
  };

  // Measure with a starting goal size, then scale it so the bot's needs land mid-range.
  const [lo, hi] = p.targetMoves;
  const mid = (lo + hi) / 2;
  let count = p.collectGoals > 0 ? 12 : 18;
  let level = build(count, hi);
  let stats: LevelStats = analyzeLevel(level, runs, seed);
  for (let pass = 0; pass < 3; pass++) {
    const tuned = tuneFromStats(stats);
    if (tuned && tuned.moves >= lo && tuned.moves <= hi) {
      // Re-measure with more runs and fresh seeds before settling the numbers.
      const check = analyzeLevel(level, runs * 2, seed + 1000);
      const t2 = tuneFromStats(check);
      if (!t2 || isLuckHeavy(check)) return null;
      return { level: { ...level, moves: t2.moves, stars: t2.stars }, bot: botNote(check, t2) };
    }
    const needed = Number.isFinite(stats.p75) ? stats.p75 : hi * 2;
    count = Math.max(3, Math.round((count * mid) / needed));
    level = build(count, hi);
    stats = analyzeLevel(level, runs, seed + pass + 1);
  }
  return null;
}

/** Summary stored in the level file. Win rate is at the tuned move limit. */
export function botNote(stats: LevelStats, t: Tuning): BotNote {
  const wins = stats.movesNeeded.filter((m) => m <= t.moves).length;
  return {
    runs: stats.runs, winRate: Math.round((wins / stats.runs) * 100) / 100, median: stats.median, p10: stats.p10,
    ...(t.oneTier ? { oneTier: true } : {}),
  };
}
