// Game state transitions: setup, moves, gravity, refill, reshuffle, goals.
// Every exported function is pure: it returns new state and never mutates input.
import { config } from '../config';
import { canCross, cellsAround, toIndex } from './board';
import { connectableColor, enclosedCells, isLoopClosed, isValidPath } from './path';
import { Rng, seedRng } from './rng';
import type {
  BlastSource, Cells, ClearKind, ClearStep, ColorId, Facing, GameState, GoalState, Layers, LevelDef, MoveEvent, MoveResult, Piece, PowerUp, Tally,
} from './types';

export interface GameOptions {
  /** Seed for refills and reshuffles. Defaults to continuing from the level seed. */
  playSeed?: number;
  bombRadius?: number;
}

// --- setup -------------------------------------------------------------------

/**
 * Builds the starting board. The layout comes from the level seed, so a level
 * always opens the same way; refills follow `playSeed`.
 */
export function createGame(level: LevelDef, opts: GameOptions = {}): GameState {
  const rows = level.layout.length;
  const cols = Math.max(...level.layout.map((row) => row.length));
  const playable: boolean[] = [];
  const cells: Cells = [];
  let nextId = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = level.layout[r][c] ?? '';
      if (ch === '-') {
        playable.push(false);
        cells.push(null);
      } else if (ch === '.') {
        playable.push(true);
        cells.push(null);
      } else if (/^[0-4]$/.test(ch)) {
        playable.push(true);
        cells.push({ kind: 'dot', id: nextId++, color: Number(ch) as ColorId });
      } else {
        throw new Error(`level ${level.label}: bad layout character ${JSON.stringify(ch)} at row ${r}, col ${c}`);
      }
    }
  }

  for (const p of level.pieces ?? []) {
    const i = p.r * cols + p.c;
    if (!playable[i]) throw new Error(`level ${level.label}: piece at row ${p.r}, col ${p.c} is not on a cell`);
    cells[i] =
      p.type === 'anchor' ? { kind: 'anchor', id: nextId++ } :
      p.type === 'gem' ? { kind: 'gem', id: nextId++, color: p.color, shape: p.shape } :
      { kind: 'ladybug', id: nextId++, color: p.color, spots: p.spots ?? 3, facing: p.facing ?? 'up' };
  }

  const { wallRight, wallDown } = placeWalls(level, rows, cols);

  const boardRng = new Rng(seedRng(level.seed));
  const burningAtStart = (i: number) => (level.fire?.[Math.floor(i / cols)]?.[i % cols] ?? '.') === 'x';
  /** Cells the level left to chance ('.'); the opening shuffle may only move these. */
  const random = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    if (playable[i] && cells[i] === null && !burningAtStart(i)) {
      cells[i] = { kind: 'dot', id: nextId++, color: boardRng.pick(level.colors) };
      random.add(i);
    }
  }

  const ice = cells.map((_, i) => {
    const ch = level.ice?.[Math.floor(i / cols)]?.[i % cols] ?? '.';
    const n = ch === '.' ? 0 : Number(ch);
    if (n > 0 && !playable[i]) throw new Error(`level ${level.label}: ice on a missing cell at index ${i}`);
    return n;
  });

  const charAt = (g: string[] | undefined, i: number) => g?.[Math.floor(i / cols)]?.[i % cols] ?? '.';
  const marked = (g: string[] | undefined) => cells.map((_, i) => charAt(g, i) === 'x');
  const water = marked(level.water);
  // Slime: '1' or '2' hits left; 'x' means 2.
  const slime = cells.map((_, i) => ({ '1': 1, '2': 2, x: 2 })[charAt(level.slime, i)] ?? 0);
  const fire = marked(level.fire);

  const startAnchors = cells.filter((p) => p?.kind === 'anchor').length;
  const state: GameState = {
    rows,
    cols,
    playable,
    wallRight,
    wallDown,
    cells,
    layers: { ice, water, slime, fire },
    colors: level.colors.slice(),
    rng: 0,
    nextId,
    moveLimit: level.moves,
    extraMoves: 0,
    movesUsed: 0,
    assisted: false,
    goals: level.goals.map((goal) => ({ goal: { ...goal }, progress: 0 })),
    status: 'playing',
    bombRadius: opts.bombRadius ?? config.bomb.radius,
    anchorDrops: level.anchorDrops ?? 0,
    anchorTarget: level.maxOnBoard ?? Math.max(1, startAnchors),
    anchorDelay: level.dropDelay ?? 0,
    anchorWait: level.dropDelay ?? 0,
  };
  // At the start only the randomly filled cells are shuffled; dots the level placed stay put.
  state.cells = reshuffleUntilPlayable(state, state.cells, boardRng, (i) => random.has(i));
  if (!hasMove(state)) throw new Error(`level ${level.label}: the fixed dots leave no opening move`);
  state.rng = opts.playSeed === undefined ? boardRng.state : seedRng(opts.playSeed);
  return state;
}

/** Converts level walls (any side of a cell) to right/down edge flags. */
function placeWalls(level: LevelDef, rows: number, cols: number) {
  const wallRight: boolean[] = new Array(rows * cols).fill(false);
  const wallDown: boolean[] = new Array(rows * cols).fill(false);
  for (const w of level.walls ?? []) {
    const [r, c, flags] =
      w.side === 'right' ? [w.r, w.c, wallRight] :
      w.side === 'left' ? [w.r, w.c - 1, wallRight] :
      w.side === 'down' ? [w.r, w.c, wallDown] :
      [w.r - 1, w.c, wallDown];
    const inside = r >= 0 && c >= 0 && r < rows && c < cols && (flags === wallRight ? c + 1 < cols : r + 1 < rows);
    if (!inside) throw new Error(`level ${level.label}: wall ${JSON.stringify(w)} is not between two cells`);
    flags[r * cols + c] = true;
  }
  return { wallRight, wallDown };
}

// --- queries -----------------------------------------------------------------

export function movesLeft(s: GameState): number {
  return s.moveLimit + s.extraMoves - s.movesUsed;
}

/** How much of a goal is left (0 when met). */
export function goalRemaining(s: GameState, g: GoalState): number {
  switch (g.goal.type) {
    case 'flood':
      return s.playable.filter((p, i) => p && !s.layers.water[i]).length;
    case 'slime':
      return s.layers.slime.filter((n) => n > 0).length;
    case 'fire':
      return s.layers.fire.filter(Boolean).length;
    default:
      return Math.max(0, g.goal.count - g.progress);
  }
}

export function goalDone(s: GameState, g: GoalState): boolean {
  return goalRemaining(s, g) === 0;
}

/** True if any two adjacent cells could start a line. */
export function hasMove(s: GameState, cells: Cells = s.cells): boolean {
  const view = cells === s.cells ? s : { ...s, cells };
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      const i = toIndex(s, r, c);
      const a = connectableColor(view, i);
      if (a === null) continue;
      for (const j of [c + 1 < s.cols ? i + 1 : -1, r + 1 < s.rows ? i + s.cols : -1]) {
        if (j >= 0 && canCross(s, i, j) && connectableColor(view, j) === a) return true;
      }
    }
  }
  return false;
}

/** Cells that never move: their pieces stay put and gravity stops at them. */
function isFixed(s: GameState, i: number): boolean {
  return s.layers.fire[i];
}

function cloneLayers(l: Layers): Layers {
  return { ice: l.ice.slice(), water: l.water.slice(), slime: l.slime.slice(), fire: l.fire.slice() };
}

/**
 * Moves the regular dots around until a legal move exists. Other pieces stay
 * put. If shuffling alone can't do it, recolors one dot to match a neighbor.
 * Only dots on cells where `movable` holds are shuffled or recolored.
 */
function reshuffleUntilPlayable(s: GameState, cells: Cells, rng: Rng, movable: (i: number) => boolean = () => true): Cells {
  if (hasMove(s, cells)) return cells;
  const spots = cells.flatMap((p, i) => (p?.kind === 'dot' && !isFixed(s, i) && movable(i) ? [i] : []));
  let out = cells;
  for (let attempt = 0; attempt < 100; attempt++) {
    out = cells.slice();
    const dots = rng.shuffle(spots.map((i) => cells[i]));
    spots.forEach((i, k) => (out[i] = dots[k]));
    if (hasMove(s, out)) return out;
  }
  // Recolor a shuffled dot to match any connectable neighbor (shuffled or not).
  const view = { ...s, cells: out };
  for (const b of spots) {
    for (const a of cellsAround(s, b, 1)) {
      const color = canCross(s, a, b) ? connectableColor(view, a) : null;
      if (color !== null) {
        out[b] = { ...(out[b] as Extract<Piece, { kind: 'dot' }>), color };
        return out;
      }
    }
  }
  return out;
}

// --- one move ------------------------------------------------------------------

/** Mutable scratch space for resolving one move. */
class Move {
  readonly cells: Cells;
  readonly rng: Rng;
  nextId: number;
  anchorDrops: number;
  /** An anchor already dropped in this move. */
  private anchorDropped = false;
  readonly layers: Layers;
  readonly events: MoveEvent[] = [];
  readonly tally: Tally = { collected: [0, 0, 0, 0, 0], anchors: 0, ice: 0, gems: 0, ladybugs: 0 };
  /** Ladybugs already hit this move (by id): each loses at most one spot per move. */
  private readonly bugsHit = new Set<number>();
  /** Bombs left by ladybugs removed on their last spot; they go off in the next wave. */
  private bugBombs: BlastSource[] = [];
  /** Burning cells put out this move. */
  private readonly fireOut = new Set<number>();
  /** Active burning cells a blast reached this move; they go out with the layer reactions. */
  private readonly fireBlasted = new Set<number>();
  /** Gems already set off this move (by piece id), so each goes off once. */
  private readonly triggered = new Set<number>();
  /** Gems set off during the current blast wave; they fire in the next. */
  private nextWave: BlastSource[] = [];
  /** Cells whose piece was cleared this move (ice, water, fire, and slime react to these). */
  readonly cleared = new Set<number>();
  /** Hits on iced cells this move, applied once the cascade ends. */
  private readonly iceHits = new Map<number, number>();
  /** Hits on slimed cells this move, applied once the cascade ends. */
  private readonly slimeHits = new Map<number, number>();
  /** Active slime regions as the move began; each spreads only if none of its cells was hit. */
  private readonly slimeRegions: number[][];
  /** Active fire regions as the move began; each spreads only if none of its cells went out. */
  private readonly fireRegions: number[][];

  constructor(readonly s: GameState) {
    this.cells = s.cells.slice();
    this.layers = cloneLayers(s.layers);
    this.rng = new Rng(s.rng);
    this.nextId = s.nextId;
    this.anchorDrops = s.anchorDrops;
    this.slimeRegions = regions(s, (i) => s.layers.slime[i] > 0 && s.layers.ice[i] === 0);
    this.fireRegions = regions(s, (i) => s.layers.fire[i] && s.layers.ice[i] === 0);
  }

  /** The board as it stands mid-move, for rule queries. */
  view(): GameState {
    return { ...this.s, cells: this.cells, layers: this.layers };
  }

  emit(e: DistributiveOmit<MoveEvent, 'board'>): void {
    this.events.push({ ...e, board: this.cells.slice() } as MoveEvent);
  }

  /** One hit on the ice over cell i, if there is any. */
  hitIce(i: number): void {
    if (this.layers.ice[i] > 0) this.iceHits.set(i, (this.iceHits.get(i) ?? 0) + 1);
  }

  /** One hit on cell i's layers: the ice if it's iced (it holds what's under it dormant), else the slime. */
  hitCell(i: number): void {
    if (this.layers.ice[i] > 0) this.hitIce(i);
    else if (this.layers.slime[i] > 0) this.slimeHits.set(i, (this.slimeHits.get(i) ?? 0) + 1);
  }

  /** A blast source reaching cell i: one hit on its layers, and active fire there goes out. */
  blastCell(i: number): void {
    if (this.layers.fire[i] && this.layers.ice[i] === 0) this.fireBlasted.add(i);
    this.hitCell(i);
  }

  /**
   * Clears one cell. Returns true if a piece was removed. An anchor leaves by
   * sinking or to a blast, which counts it; a gem on ice is protected. A
   * clear hits the cell's ice or slime, unless `layerHit` is false (blasts
   * hit layers per source instead).
   */
  clear(i: number, layerHit = true, blast = false): boolean {
    const p = this.cells[i];
    if (!p) return false;
    if (p.kind === 'anchor') {
      if (!blast) return false;
      this.cells[i] = null;
      this.cleared.add(i);
      this.tally.anchors++;
      return true;
    }
    if (p.kind === 'gem' && this.layers.ice[i] > 0) return false;
    if (p.kind === 'ladybug') {
      if (this.bugsHit.has(p.id)) return false;
      if (layerHit) this.hitCell(i);
      return this.hitLadybug(i, p);
    }
    this.cells[i] = null;
    this.cleared.add(i);
    if (layerHit) this.hitCell(i);
    if (p.kind === 'dot') this.tally.collected[p.color]++;
    return true;
  }

  /**
   * A ladybug loses a spot and changes color, or on its last spot is removed
   * and leaves a bomb on its cell. The cell counts as cleared either way.
   * Returns true if it was removed.
   */
  private hitLadybug(i: number, p: Extract<Piece, { kind: 'ladybug' }>): boolean {
    this.bugsHit.add(p.id);
    this.cleared.add(i);
    if (p.spots <= 1) {
      this.cells[i] = null;
      this.tally.ladybugs++;
      this.bugBombs.push({ cell: i, type: 'bomb' });
      return true;
    }
    const others = this.s.colors.filter((c) => c !== p.color);
    const color = others.length > 0 ? this.rng.pick(others) : p.color;
    this.cells[i] = { ...p, spots: p.spots - 1, color };
    return false;
  }

  /**
   * After the board settles, each ladybug that took no hit this move (in
   * board order) steps one cell the way it faces, swapping with a dot, an
   * anchor, or an empty cell there. Off the board, a missing cell, a wall, a
   * burning cell, a gem, or another ladybug turns it clockwise instead.
   * Settles again if anything moved.
   */
  walk(): void {
    const { s, cells, layers } = this;
    const moves: { from: number; to: number }[] = [];
    let turned = false;
    const walkers = cells.flatMap((p) => (p?.kind === 'ladybug' && !this.bugsHit.has(p.id) ? [p.id] : []));
    for (const id of walkers) {
      const i = cells.findIndex((p) => p?.id === id);
      const bug = cells[i] as Extract<Piece, { kind: 'ladybug' }>;
      const j = ahead(s, i, bug.facing);
      const there = j >= 0 ? cells[j] : undefined;
      const open = j >= 0 && canCross(s, i, j) && !layers.fire[j] && (there === null || there?.kind === 'dot' || there?.kind === 'anchor');
      if (!open) {
        cells[i] = { ...bug, facing: CLOCKWISE[bug.facing] };
        turned = true;
        continue;
      }
      cells[i] = there ?? null;
      cells[j] = bug;
      moves.push({ from: i, to: j });
    }
    if (moves.length > 0 || turned) this.emit({ kind: 'walk', moves });
    if (moves.length > 0) this.settle();
  }

  /** Sets off the gem at i (if there is one, unfrozen and not yet set off). */
  trigger(i: number): BlastSource | null {
    const p = this.cells[i];
    if (p?.kind !== 'gem' || this.layers.ice[i] > 0 || this.triggered.has(p.id)) return null;
    this.triggered.add(p.id);
    this.tally.gems++;
    return { cell: i, type: p.shape, color: p.color };
  }

  stage(kind: ClearKind, cells: Iterable<number>, sources: ClearStep['sources'] = []): void {
    const all = [...new Set(cells)].sort((a, b) => a - b);
    if (kind === 'blast') {
      for (const i of all) {
        const src = this.trigger(i);
        if (src) this.nextWave.push(src);
      }
    }
    const removed = all.filter((i) => this.clear(i, kind !== 'blast', kind === 'blast'));
    this.emit({ kind: 'clear', step: { kind, cells: removed, sources } });
  }

  /** Cells a blast source reaches, including its own. Walls don't stop blasts or beams. */
  private reach(src: BlastSource): number[] {
    const s = this.s;
    const r = Math.floor(src.cell / s.cols);
    const c = src.cell % s.cols;
    if (src.type === 'bomb') return [src.cell, ...cellsAround(s, src.cell, s.bombRadius)];
    const out: number[] = [];
    if (src.type !== 'row') for (let rr = 0; rr < s.rows; rr++) out.push(rr * s.cols + c);
    if (src.type !== 'column') for (let cc = 0; cc < s.cols; cc++) out.push(r * s.cols + cc);
    return out.filter((i) => s.playable[i]);
  }

  /**
   * End-of-cascade layer effects, in order:
   * - Water: cleared cells touching active water become watered, and the flood
   *   carries on through every connected cleared cell.
   * - Active fire next to a cleared cell, or reached by a blast, goes out.
   * - Slime and ice lose one layer per hit this move: each clear on the cell
   *   and each blast source reaching it. A hit on an iced cell goes to the ice.
   *   Hazards under broken ice wake up from then on (water and slime were
   *   still frozen while this move's cells cleared).
   */
  react(): void {
    const { s, layers } = this;
    const changed: number[] = [];

    // Ice blocks water: an iced cell neither floods nor carries the flood on.
    const wet = (i: number) => layers.water[i] && layers.ice[i] === 0;
    const floodable = (i: number) => this.cleared.has(i) && !layers.water[i] && layers.ice[i] === 0;
    const queue = [...this.cleared].filter((i) => floodable(i) && orthogonal(s, i).some(wet));
    const flooded = new Set(queue);
    while (queue.length > 0) {
      const i = queue.shift()!;
      for (const j of orthogonal(s, i)) {
        if (floodable(j) && !flooded.has(j)) {
          flooded.add(j);
          queue.push(j);
        }
      }
    }
    for (const i of [...flooded].sort((a, b) => a - b)) {
      layers.water[i] = true;
      changed.push(i);
    }

    // Fire: a clear next to active fire, or a blast on it, puts it out; the cell then refills.
    const burningNow = layers.fire.flatMap((f, i) => (f && layers.ice[i] === 0 ? [i] : []));
    for (const i of burningNow) {
      if (this.fireBlasted.has(i) || orthogonal(s, i).some((j) => this.cleared.has(j))) {
        layers.fire[i] = false;
        this.fireOut.add(i);
        changed.push(i);
      }
    }

    for (const [i, hits] of [...this.slimeHits].sort((a, b) => a[0] - b[0])) {
      layers.slime[i] = Math.max(0, layers.slime[i] - hits);
      changed.push(i);
    }

    for (const [i, hits] of [...this.iceHits].sort((a, b) => a[0] - b[0])) {
      layers.ice[i] = Math.max(0, layers.ice[i] - hits);
      if (layers.ice[i] === 0) this.tally.ice++;
      changed.push(i);
    }
    if (changed.length > 0) this.emit({ kind: 'layers', layers: cloneLayers(layers), cells: changed });
  }

  /** Line or loop, then any chain of blasts it sets off. */
  cascade(path: readonly number[], color: ColorId, loop: boolean): void {
    const s = this.s;
    const view = this.view();
    const first = loop ? this.cells.flatMap((_, i) => (connectableColor(view, i) === color ? [i] : [])) : path;
    // Dots enclosed by a loop that aren't its color become bombs (a ladybug in there is left alone).
    const bombs = loop ? enclosedCells(s, path).filter((i) => this.cells[i]?.kind === 'dot' && !first.includes(i)) : [];
    // A loop sets off every gem of its color; they fire with the bombs. A frozen one's ice takes a hit instead.
    const gems = loop
      ? this.cells.flatMap((p, i) => {
          if (p?.kind !== 'gem' || p.color !== color) return [];
          const src = this.trigger(i);
          if (!src) this.hitIce(i);
          return src ? [src] : [];
        })
      : [];
    this.stage(loop ? 'loop' : 'line', first);
    this.waves([...bombs.map((cell): BlastSource => ({ cell, type: 'bomb' })), ...gems]);
  }

  /** Ladybug bombs waiting to go off, taken from the queue. */
  private takeBugBombs(): BlastSource[] {
    const out = this.bugBombs;
    this.bugBombs = [];
    return out;
  }

  /**
   * Blast waves: each fires together; gems a wave reaches, and bombs left by
   * ladybugs it removes, fire in the next one. Bombs left by ladybugs the
   * line or loop removed join the first wave.
   */
  waves(start: BlastSource[]): void {
    let sources = [...start, ...this.takeBugBombs()].sort((a, b) => a.cell - b.cell);
    while (sources.length > 0) {
      const hit = new Set<number>();
      for (const src of sources) {
        // Each source is one hit on any ice it reaches, whatever the cell holds.
        for (const j of new Set(this.reach(src))) {
          this.blastCell(j);
          hit.add(j);
        }
      }
      this.nextWave = [];
      this.stage('blast', hit, sources);
      sources = [...this.nextWave, ...this.takeBugBombs()].sort((a, b) => a.cell - b.cell);
    }
  }

  /**
   * After the board settles, ignored hazards grow (seeded picks). Each region
   * is taken as the move began, and grows by one neighboring cell only if
   * none of its cells was hit this move:
   * - Fire spreads onto a cell that isn't burning or iced, destroying a dot or
   *   anchor there (counted toward nothing). Gems and ladybugs stop it. Water
   *   and slime stay under the new fire.
   * - Slime spreads at full thickness onto a cell that isn't slimed, iced,
   *   watered, or burning. Pieces and empty cells don't stop it.
   */
  spread(): void {
    const { s, layers, cells } = this;
    const grow = (regs: number[][], hit: (i: number) => boolean, ok: (j: number) => boolean): number[] => {
      // Two regions never take the same cell.
      const out: number[] = [];
      for (const region of regs) {
        if (region.some(hit)) continue;
        const options = new Set<number>();
        for (const i of region) for (const j of orthogonal(s, i)) if (ok(j) && !out.includes(j)) options.add(j);
        if (options.size === 0) continue;
        out.push(this.rng.pick([...options].sort((a, b) => a - b)));
      }
      return out;
    };

    const burnable = (j: number) => {
      const k = cells[j]?.kind;
      return !layers.fire[j] && layers.ice[j] === 0 && (k === undefined || k === 'dot' || k === 'anchor');
    };
    const burned = grow(this.fireRegions, (i) => this.fireOut.has(i), burnable);
    for (const j of burned) {
      layers.fire[j] = true;
      cells[j] = null;
    }
    if (burned.length > 0) this.emit({ kind: 'layers', layers: cloneLayers(layers), cells: burned });

    const slimeable = (j: number) => layers.slime[j] === 0 && layers.ice[j] === 0 && !layers.water[j] && !layers.fire[j];
    const slimed = grow(this.slimeRegions, (i) => this.slimeHits.has(i), slimeable);
    for (const j of slimed) layers.slime[j] = 2;
    if (slimed.length > 0) this.emit({ kind: 'layers', layers: cloneLayers(layers), cells: slimed });
  }

  /** Lowest cell of a column, where anchors sink. */
  private bottomOf(c: number): number {
    for (let r = this.s.rows - 1; r >= 0; r--) if (this.s.playable[r * this.s.cols + c]) return r * this.s.cols + c;
    return -1;
  }

  /**
   * Gravity and refill. Each column splits into runs between fixed cells;
   * pieces fall to the bottom of their run, and empty tops refill. New pieces
   * in the top run fall in from above the board; under a burning cell they
   * appear in place. Ice never stops a fall.
   */
  fall(): void {
    const { cells, rng } = this;
    const s = this.view();
    const slots: { i: number; startRow: number; top: boolean }[] = [];
    for (let c = 0; c < s.cols; c++) {
      let run: number[] = [];
      let boundary = -1;
      const flush = () => {
        const pieces = run.map((i) => cells[i]).filter((p): p is Piece => p !== null);
        const empty = run.length - pieces.length;
        const lowestNew = empty > 0 ? Math.floor(run[empty - 1] / s.cols) : 0;
        run.forEach((i, k) => {
          if (k < empty) {
            cells[i] = null;
            // From above the board in the top run; in place (they appear) under a fixed cell.
            const row = Math.floor(i / s.cols);
            slots.push({ i, startRow: boundary === -1 ? row - (lowestNew - boundary) : row, top: boundary === -1 });
          } else {
            cells[i] = pieces[k - empty];
          }
        });
        run = [];
      };
      for (let r = 0; r < s.rows; r++) {
        const i = r * s.cols + c;
        if (!s.playable[i]) continue;
        if (isFixed(s, i)) {
          flush();
          boundary = r;
        } else {
          run.push(i);
        }
      }
      flush();
    }

    // At most one anchor drops in per move, at the top of a seeded column, once the wait is over.
    let anchorSlot = -1;
    const onBoard = cells.filter((p) => p?.kind === 'anchor').length;
    if (this.anchorDrops > 0 && !this.anchorDropped && onBoard < s.anchorTarget && s.anchorWait === 0) {
      const tops = slots.filter((x, k) => x.top && (k === 0 || slots[k - 1].i % s.cols !== x.i % s.cols));
      if (tops.length > 0) anchorSlot = tops[rng.int(tops.length)].i;
    }
    const spawnFrom: Record<number, number> = {};
    for (const slot of slots) {
      const id = this.nextId++;
      if (slot.i === anchorSlot) {
        cells[slot.i] = { kind: 'anchor', id };
        this.anchorDrops--;
        this.anchorDropped = true;
      } else {
        cells[slot.i] = { kind: 'dot', id, color: rng.pick(s.colors) };
      }
      spawnFrom[id] = slot.startRow;
    }
    this.emit({ kind: 'fall', spawnFrom });
  }

  /** Falls, sinks anchors that reached the bottom (ice or not), and repeats until nothing sinks. */
  settle(): void {
    for (let pass = 0; pass < 50; pass++) {
      this.fall();
      const sunk: number[] = [];
      for (let c = 0; c < this.s.cols; c++) {
        const b = this.bottomOf(c);
        if (b >= 0 && this.cells[b]?.kind === 'anchor') sunk.push(b);
      }
      if (sunk.length === 0) return;
      for (const i of sunk) this.cells[i] = null;
      this.tally.anchors += sunk.length;
      this.emit({ kind: 'sink', cells: sunk });
    }
  }
}

const CLOCKWISE: Record<Facing, Facing> = { up: 'right', right: 'down', down: 'left', left: 'up' };

/** The cell one step from i the given way, or -1 off the board. */
function ahead(s: GameState, i: number, facing: Facing): number {
  const r = Math.floor(i / s.cols);
  const c = i % s.cols;
  if (facing === 'up') return r > 0 ? i - s.cols : -1;
  if (facing === 'down') return r + 1 < s.rows ? i + s.cols : -1;
  if (facing === 'left') return c > 0 ? i - 1 : -1;
  return c + 1 < s.cols ? i + 1 : -1;
}

/** Orthogonally connected groups of cells where `inside` holds, each sorted, in board order. */
function regions(s: GameState, inside: (i: number) => boolean): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let i = 0; i < s.cells.length; i++) {
    if (seen.has(i) || !s.playable[i] || !inside(i)) continue;
    const group = [i];
    seen.add(i);
    for (let k = 0; k < group.length; k++) {
      for (const j of orthogonal(s, group[k])) {
        if (!seen.has(j) && inside(j)) {
          seen.add(j);
          group.push(j);
        }
      }
    }
    out.push(group.sort((a, b) => a - b));
  }
  return out;
}

/** Orthogonal neighbors on the board (walls don't matter here). */
function orthogonal(s: GameState, i: number): number[] {
  const c = i % s.cols;
  const out: number[] = [];
  if (i >= s.cols) out.push(i - s.cols);
  if (i + s.cols < s.cells.length) out.push(i + s.cols);
  if (c > 0) out.push(i - 1);
  if (c + 1 < s.cols) out.push(i + 1);
  return out.filter((j) => s.playable[j]);
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function progressFor(g: GoalState, t: Tally): number {
  switch (g.goal.type) {
    case 'collect':
      return t.collected[g.goal.color];
    case 'anchors':
      return t.anchors;
    case 'ice':
      return t.ice;
    case 'flood':
    case 'slime':
    case 'fire':
      return 0;
    case 'gems':
      return t.gems;
    case 'ladybugs':
      return t.ladybugs;
  }
}

/** Plays one move. Throws if the game is over or the path isn't legal. */
export function applyMove(s: GameState, path: readonly number[]): { state: GameState; result: MoveResult } {
  if (s.status !== 'playing') throw new Error(`applyMove: game is ${s.status}`);
  if (!isValidPath(s, path)) throw new Error(`applyMove: invalid path ${JSON.stringify(path)}`);

  const color = connectableColor(s, path[0])!;
  const loop = isLoopClosed(path);
  const m = new Move(s);
  m.cascade(path, color, loop);
  m.react();
  m.settle();
  m.spread();
  m.walk();
  return finish(s, m, { path: path.slice(), color, loop, usesMove: true });
}

/** Regular dots a shuffle may move: not on burning cells. */
function shufflable(s: GameState, cells: Cells = s.cells): number[] {
  return cells.flatMap((p, i) => (p?.kind === 'dot' && !isFixed(s, i) ? [i] : []));
}

/** Can this power-up be used on this board right now? */
export function canUsePowerUp(s: GameState, p: PowerUp): boolean {
  if (s.status !== 'playing') return false;
  if (p.kind === 'colorBurst') return s.colors.includes(p.color);
  if (p.kind === 'shuffler') return shufflable(s).length >= 2;
  const i = p.cell;
  if (!Number.isInteger(i) || i < 0 || i >= s.cells.length || !s.playable[i]) return false;
  // Sure Shot can aim at any cell: it's the row and column that matter.
  if (p.kind === 'sureShot') return true;
  if (s.layers.ice[i] > 0) return true;
  if (s.layers.fire[i]) return true;
  const k = s.cells[i]?.kind;
  return k === 'dot' || k === 'ladybug' || k === 'gem';
}

/**
 * Uses a power-up. Costs no move and doesn't mark the attempt assisted. Its
 * clears count like any other (goals, ice, water, fire, slime, ladybugs), and
 * the board settles and refills, but hazards don't spread and ladybugs don't
 * walk: it isn't a move. Throws if it can't be used (see canUsePowerUp).
 */
export function applyPowerUp(s: GameState, p: PowerUp): { state: GameState; result: MoveResult } {
  if (!canUsePowerUp(s, p)) throw new Error(`applyPowerUp: can't use ${JSON.stringify(p)} now`);
  const m = new Move(s);
  let color: ColorId = 0;
  if (p.kind === 'shuffler') {
    const spots = shufflable(s);
    const dots = m.rng.shuffle(spots.map((i) => m.cells[i]));
    spots.forEach((i, k) => (m.cells[i] = dots[k]));
    const board = reshuffleUntilPlayable(s, m.cells, m.rng);
    m.cells.splice(0, m.cells.length, ...board);
    m.emit({ kind: 'shuffle' });
    return finish(s, m, { path: [], color, loop: false, usesMove: false });
  }
  if (p.kind === 'colorBurst') {
    color = p.color;
    m.cascade([], color, true);
  } else {
    const i = p.cell;
    const piece = s.cells[i];
    if (piece && 'color' in piece) color = piece.color;
    if (p.kind === 'sureShot') {
      m.waves([{ cell: i, type: 'cross', color }]);
    } else if (m.layers.ice[i] > 0) {
      // On ice: one hit, and the dot stays.
      m.hitIce(i);
    } else if (m.layers.fire[i]) {
      m.layers.fire[i] = false;
      m.emit({ kind: 'layers', layers: cloneLayers(m.layers), cells: [i] });
    } else if (piece?.kind === 'gem') {
      m.waves([m.trigger(i)!]);
    } else if (piece?.kind === 'dot' && m.layers.slime[i] > 0) {
      // On slime: one hit, and the dot stays.
      m.hitCell(i);
    } else {
      m.stage('line', [i]);
      m.waves([]);
    }
  }
  m.react();
  m.settle();
  return finish(s, m, { path: [], color, loop: p.kind === 'colorBurst', usesMove: false });
}

/**
 * The drop wait after a move: it counts down while the board has fewer
 * anchors than it holds (and more are to come), and starts over once full.
 */
function nextAnchorWait(s: GameState, cells: Cells): number {
  const onBoard = cells.filter((p) => p?.kind === 'anchor').length;
  return onBoard < s.anchorTarget ? Math.max(0, s.anchorWait - 1) : s.anchorDelay;
}

/** Builds the next state and the result from a resolved move or power-up. */
function finish(
  s: GameState, m: Move, r: { path: number[]; color: ColorId; loop: boolean; usesMove: boolean },
): { state: GameState; result: MoveResult } {
  const settled = m.cells.slice();
  const next: GameState = {
    ...s,
    cells: m.cells,
    layers: m.layers,
    nextId: m.nextId,
    anchorDrops: m.anchorDrops,
    movesUsed: s.movesUsed + (r.usesMove ? 1 : 0),
    anchorWait: r.usesMove ? nextAnchorWait(s, m.cells) : s.anchorWait,
    goals: s.goals.map((g) => ({ goal: g.goal, progress: g.progress + progressFor(g, m.tally) })),
  };
  if (next.goals.length > 0 && next.goals.every((g) => goalDone(next, g))) next.status = 'won';
  else if (movesLeft(next) <= 0) next.status = 'lost';

  let shuffled = false;
  if (next.status === 'playing' && !hasMove(next)) {
    const board = reshuffleUntilPlayable(next, next.cells, m.rng);
    m.cells.splice(0, m.cells.length, ...board);
    next.cells = m.cells;
    m.emit({ kind: 'shuffle' });
    shuffled = true;
  }
  next.rng = m.rng.state;

  const spawned: number[] = [];
  for (const e of m.events) if (e.kind === 'fall') spawned.push(...Object.keys(e.spawnFrom).map(Number));
  return {
    state: next,
    result: {
      path: r.path,
      color: r.color,
      loop: r.loop,
      events: m.events,
      steps: m.events.flatMap((e) => (e.kind === 'clear' ? [e.step] : [])),
      settled,
      spawned,
      shuffled,
    },
  };
}

/** The assist: more moves after running out. Marks the attempt as assisted. */
export function addMoves(s: GameState, n: number = config.assist.moves): GameState {
  return { ...s, extraMoves: s.extraMoves + n, assisted: true, status: s.status === 'lost' ? 'playing' : s.status };
}
