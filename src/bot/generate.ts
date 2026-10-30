// Level generator: builds candidate levels from parameters, then lets the bot
// set the goal size, move limit, and star cutoffs. Seeded and pure.
import { parseLevel, Rng, seedRng, type ColorId, type Goal, type LevelDef, type PlacedPiece, type Wall } from '../rules';
import { analyzeLevel, tuneFromStats, type LevelStats } from './bot';
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
  /** Gem goal: this many gems (a share of them cross gems) in the board's colors; set them all off. */
  gems?: { count: number; crossShare: number };
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
    const shape = rng.float() < p.gems!.crossShare ? 'cross' : 'column';
    out.push({ r, c, type: 'gem', color: palette[k % palette.length], shape });
    k++;
  }
  for (let k = 0, guard = 0; k < (p.ladybugs ?? 0) && guard < 500; guard++) {
    const r = rng.int(p.rows);
    const c = rng.int(p.cols);
    if (!free(r, c)) continue;
    taken.add(r * p.cols + c);
    out.push({ r, c, type: 'ladybug', color: palette[(k + 1) % palette.length] });
    k++;
  }
  return out;
}

/** Mirrored ice; avoids the top row so new dots always have somewhere to land. */
function placeIce(p: GenParams, layout: string[], cells: number, rng: Rng): string[] | undefined {
  if (!p.ice || cells <= 0) return undefined;
  const grid = layout.map((row) => [...row].map(() => '.'));
  const [lo, hi] = p.ice.thickness;
  let placed = 0;
  for (let guard = 0; placed < cells && guard < 500; guard++) {
    const r = 1 + rng.int(p.rows - 1);
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

/** Mirrored water sources; `underIce` of them (in pairs) get 1-2 layers of ice on top. */
function placeWater(p: GenParams, layout: string[], rng: Rng): { water?: string[]; waterIce?: string[] } {
  if (!p.water) return {};
  const water = layout.map((row) => [...row].map(() => '.'));
  const ice = layout.map((row) => [...row].map(() => '.'));
  let placed = 0;
  let frozen = 0;
  for (let guard = 0; placed < p.water.sources && guard < 500; guard++) {
    const r = rng.int(p.rows);
    const c = rng.int(Math.ceil(p.cols / 2));
    const m = mirrorCol(p.cols, c);
    if (layout[r][c] === '-' || water[r][c] !== '.') continue;
    water[r][c] = water[r][m] = 'x';
    if (frozen < (p.water.underIce ?? 0) && r > 0) {
      ice[r][c] = ice[r][m] = String(1 + rng.int(2));
      frozen += c === m ? 1 : 2;
    }
    placed += c === m ? 1 : 2;
  }
  return { water: water.map((r) => r.join('')), waterIce: frozen > 0 ? ice.map((r) => r.join('')) : undefined };
}

function mergeIce(a: string[] | undefined, b: string[], layout: string[]): string[] {
  return layout.map((row, r) => [...row].map((_, c) => (b[r][c] !== '.' ? b[r][c] : a?.[r][c] ?? '.')).join(''));
}

/** Builds one candidate, or null if the bot couldn't make it fit the target. */
export function generateCandidate(p: GenParams, seed: number, name?: string): Candidate | null {
  const rng = new Rng(seedRng(seed));
  const palette = rng.shuffle([0, 1, 2, 3, 4] as ColorId[]).slice(0, p.colors).sort((a, b) => a - b);
  const layout = makeLayout(p, rng);
  const walls = makeWalls(p, layout, rng);
  const goalColors = rng.shuffle(palette).slice(0, p.collectGoals).sort((a, b) => a - b);
  const runs = p.runs ?? 40;
  const pieces = placePieces(p, layout, rng.shuffle(palette), rng);
  const iceSeed = rng.int(1_000_000);
  const { water, waterIce } = placeWater(p, layout, rng);

  const build = (count: number, moves: number): LevelDef => {
    const goals: Goal[] = goalColors.map((color): Goal => ({ type: 'collect', color, count: Math.max(MIN_COLLECT, count) }));
    let ice = p.ice ? placeIce(p, layout, Math.min(p.ice.max, Math.round(count * p.ice.perSize)), new Rng(seedRng(iceSeed))) : undefined;
    const iceCount = ice ? ice.join('').replace(/\./g, '').length : 0;
    if (iceCount > 0) goals.unshift({ type: 'ice', count: iceCount });
    if (p.gems?.count) goals.unshift({ type: 'gems', count: p.gems.count });
    if (p.ladybugs) goals.unshift({ type: 'ladybugs', count: p.ladybugs });
    if (water) {
      goals.unshift({ type: 'flood' });
      // Freeze over some sources (hazards under ice).
      if (waterIce) ice = mergeIce(ice, waterIce, layout);
    }
    let anchorDrops: number | undefined;
    if (p.anchors) {
      anchorDrops = Math.max(0, Math.round(count * p.anchors.dropsPerSize));
      goals.unshift({ type: 'anchors', count: p.anchors.start + anchorDrops });
    }
    return parseLevel({
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
      if (!t2) return null;
      return { level: { ...level, moves: t2.moves, stars: t2.stars }, bot: botNote(check, t2.moves) };
    }
    const needed = Number.isFinite(stats.p75) ? stats.p75 : hi * 2;
    count = Math.max(3, Math.round((count * mid) / needed));
    level = build(count, hi);
    stats = analyzeLevel(level, runs, seed + pass + 1);
  }
  return null;
}

/** Summary stored in the level file. Win rate is at the given move limit. */
export function botNote(stats: LevelStats, moves: number): BotNote {
  const wins = stats.movesNeeded.filter((m) => m <= moves).length;
  return { runs: stats.runs, winRate: Math.round((wins / stats.runs) * 100) / 100, median: stats.median, p10: stats.p10 };
}
