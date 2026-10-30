// Game state transitions: setup, moves, gravity, refill, reshuffle, goals.
// Every exported function is pure: it returns new state and never mutates input.
import { config } from '../config';
import { canCross, cellsAround, toIndex } from './board';
import { connectableColor, enclosedCells, isLoopClosed, isValidPath } from './path';
import { Rng, seedRng } from './rng';
import type {
  BlastSource, Cells, ClearKind, ClearStep, ColorId, GameState, GoalState, Layers, LevelDef, MoveEvent, MoveResult, Piece, Tally,
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
        throw new Error(`level ${level.id}: bad layout character ${JSON.stringify(ch)} at row ${r}, col ${c}`);
      }
    }
  }

  for (const p of level.pieces ?? []) {
    const i = p.r * cols + p.c;
    if (!playable[i]) throw new Error(`level ${level.id}: piece at row ${p.r}, col ${p.c} is not on a cell`);
    cells[i] =
      p.type === 'anchor' ? { kind: 'anchor', id: nextId++ } :
      p.type === 'gem' ? { kind: 'gem', id: nextId++, color: p.color, shape: p.shape } :
      { kind: 'ladybug', id: nextId++, color: p.color, spots: p.spots ?? 3 };
  }

  const { wallRight, wallDown } = placeWalls(level, rows, cols);

  const boardRng = new Rng(seedRng(level.seed));
  const burningAtStart = (i: number) => (level.fire?.[Math.floor(i / cols)]?.[i % cols] ?? '.') === 'x';
  for (let i = 0; i < cells.length; i++) {
    if (playable[i] && cells[i] === null && !burningAtStart(i)) cells[i] = { kind: 'dot', id: nextId++, color: boardRng.pick(level.colors) };
  }

  const ice = cells.map((_, i) => {
    const ch = level.ice?.[Math.floor(i / cols)]?.[i % cols] ?? '.';
    const n = ch === '.' ? 0 : Number(ch);
    if (n > 0 && !playable[i]) throw new Error(`level ${level.id}: ice on a missing cell at index ${i}`);
    return n;
  });

  const marked = (g: string[] | undefined) => cells.map((_, i) => (g?.[Math.floor(i / cols)]?.[i % cols] ?? '.') === 'x');
  const water = marked(level.water);
  const slime = marked(level.slime);
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
    anchorTarget: Math.max(1, startAnchors),
  };
  state.cells = reshuffleUntilPlayable(state, state.cells, boardRng);
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
    if (!inside) throw new Error(`level ${level.id}: wall ${JSON.stringify(w)} is not between two cells`);
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
      return s.layers.slime.filter(Boolean).length;
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
  return s.layers.ice[i] > 0 || s.layers.fire[i];
}

function cloneLayers(l: Layers): Layers {
  return { ice: l.ice.slice(), water: l.water.slice(), slime: l.slime.slice(), fire: l.fire.slice() };
}

/**
 * Moves the regular dots around until a legal move exists. Other pieces stay
 * put. If shuffling alone can't do it, recolors one dot to match a neighbor.
 */
function reshuffleUntilPlayable(s: GameState, cells: Cells, rng: Rng): Cells {
  if (hasMove(s, cells)) return cells;
  const spots = cells.flatMap((p, i) => (p?.kind === 'dot' && !isFixed(s, i) ? [i] : []));
  let out = cells;
  for (let attempt = 0; attempt < 100; attempt++) {
    out = cells.slice();
    const dots = rng.shuffle(spots.map((i) => cells[i]));
    spots.forEach((i, k) => (out[i] = dots[k]));
    if (hasMove(s, out)) return out;
  }
  for (const a of spots) {
    const b = spots.find((j) => canCross(s, a, j));
    if (b !== undefined) {
      const color = (out[a] as Extract<Piece, { kind: 'dot' }>).color;
      out[b] = { ...(out[b] as Extract<Piece, { kind: 'dot' }>), color };
      return out;
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
  readonly layers: Layers;
  readonly events: MoveEvent[] = [];
  readonly tally: Tally = { collected: [0, 0, 0, 0, 0], anchors: 0, ice: 0, gems: 0, ladybugs: 0 };
  /** Ladybugs already hit this move (by id): each loses at most one spot per move. */
  private readonly bugsHit = new Set<number>();
  /** Ladybugs that lost a spot and will fly once the cascade settles. */
  private readonly toFly = new Set<number>();
  /** Bomb cells this wave: a ladybug there is removed whatever its spots. */
  private bombCells = new Set<number>();
  /** Slimed cells cleaned this move. */
  slimeCleaned = 0;
  /** Fires put out this move. */
  fireOut = 0;
  /** Gems already set off this move (by piece id), so each goes off once. */
  private readonly triggered = new Set<number>();
  /** Gems set off during the current blast wave; they fire in the next. */
  private nextWave: BlastSource[] = [];
  /** Cells whose piece was cleared this move (ice, water, fire, and slime react to these). */
  readonly cleared = new Set<number>();
  /** Cells a blast reached, cleared or not. */
  readonly blasted = new Set<number>();

  constructor(readonly s: GameState) {
    this.cells = s.cells.slice();
    this.layers = cloneLayers(s.layers);
    this.rng = new Rng(s.rng);
    this.nextId = s.nextId;
    this.anchorDrops = s.anchorDrops;
  }

  /** The board as it stands mid-move, for rule queries. */
  view(): GameState {
    return { ...this.s, cells: this.cells, layers: this.layers };
  }

  emit(e: DistributiveOmit<MoveEvent, 'board'>): void {
    this.events.push({ ...e, board: this.cells.slice() } as MoveEvent);
  }

  /**
   * Clears one cell. Returns true if a piece was removed. Ice protects its
   * piece; anchors only leave by sinking.
   */
  clear(i: number): boolean {
    const p = this.cells[i];
    if (!p || p.kind === 'anchor' || this.layers.ice[i] > 0) return false;
    if (p.kind === 'ladybug') return this.hitLadybug(i, p);
    this.cells[i] = null;
    this.cleared.add(i);
    if (p.kind === 'dot') this.tally.collected[p.color]++;
    return true;
  }

  /**
   * A ladybug loses a spot and changes color (it flies later), or is removed
   * on its last spot or when it's a bomb. The cell counts as cleared either way.
   * Returns true if it was removed.
   */
  private hitLadybug(i: number, p: Extract<Piece, { kind: 'ladybug' }>): boolean {
    if (this.bugsHit.has(p.id)) return false;
    this.bugsHit.add(p.id);
    this.cleared.add(i);
    if (p.spots <= 1 || this.bombCells.has(i)) {
      this.cells[i] = null;
      this.tally.ladybugs++;
      return true;
    }
    const others = this.s.colors.filter((c) => c !== p.color);
    const color = others.length > 0 ? this.rng.pick(others) : p.color;
    this.cells[i] = { ...p, spots: p.spots - 1, color };
    this.toFly.add(p.id);
    return false;
  }

  /** Ladybugs that lost a spot fly to random cells, swapping with the dots there. */
  fly(): void {
    if (this.toFly.size === 0) return;
    const moves: { from: number; to: number }[] = [];
    // Fly each once, in board order as of now (a ladybug can land on a later cell).
    const flying = this.cells.flatMap((p) => (p?.kind === 'ladybug' && this.toFly.has(p.id) ? [p.id] : []));
    for (const id of flying) {
      const i = this.cells.findIndex((p) => p?.id === id);
      const spots = this.cells.flatMap((q, j) => (q?.kind === 'dot' && this.layers.ice[j] === 0 && j !== i ? [j] : []));
      if (spots.length === 0) continue;
      const to = this.rng.pick(spots);
      [this.cells[i], this.cells[to]] = [this.cells[to], this.cells[i]];
      moves.push({ from: i, to });
    }
    if (moves.length > 0) this.emit({ kind: 'fly', moves });
  }

  /** Sets off the gem at i (if there is one, unfrozen and not yet set off). */
  private trigger(i: number): BlastSource | null {
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
        this.blasted.add(i);
        const src = this.trigger(i);
        if (src) this.nextWave.push(src);
      }
    }
    const removed = all.filter((i) => this.clear(i));
    this.emit({ kind: 'clear', step: { kind, cells: removed, sources } });
  }

  /** Cells a blast source reaches, including its own. Walls don't stop blasts or beams. */
  private reach(src: BlastSource): number[] {
    const s = this.s;
    const r = Math.floor(src.cell / s.cols);
    const c = src.cell % s.cols;
    if (src.type === 'bomb') return [src.cell, ...cellsAround(s, src.cell, s.bombRadius)];
    const out: number[] = [];
    for (let rr = 0; rr < s.rows; rr++) out.push(rr * s.cols + c);
    if (src.type === 'cross') for (let cc = 0; cc < s.cols; cc++) out.push(r * s.cols + cc);
    return out.filter((i) => s.playable[i]);
  }

  /**
   * End-of-cascade layer effects, in order:
   * - Water: cleared cells touching active water become watered, and the flood
   *   carries on through every connected cleared cell.
   * - Active fire next to a cleared cell goes out.
   * - Slime on a cleared cell is cleaned.
   * - Ice loses one layer if a cell next to it was cleared or a blast reached it
   *   (one layer per move at most). Hazards under it wake up from then on.
   */
  react(): void {
    const { s, layers } = this;
    const changed: number[] = [];

    const wet = (i: number) => layers.water[i] && layers.ice[i] === 0;
    const queue = [...this.cleared].filter((i) => !layers.water[i] && orthogonal(s, i).some(wet));
    const flooded = new Set(queue);
    while (queue.length > 0) {
      const i = queue.shift()!;
      for (const j of orthogonal(s, i)) {
        if (this.cleared.has(j) && !layers.water[j] && !flooded.has(j)) {
          flooded.add(j);
          queue.push(j);
        }
      }
    }
    for (const i of [...flooded].sort((a, b) => a - b)) {
      layers.water[i] = true;
      changed.push(i);
    }

    // Fire: clearing a cell next to active fire puts it out; the cell then refills.
    const burningNow = layers.fire.flatMap((f, i) => (f && layers.ice[i] === 0 ? [i] : []));
    for (const i of burningNow) {
      if (orthogonal(s, i).some((j) => this.cleared.has(j))) {
        layers.fire[i] = false;
        this.fireOut++;
        changed.push(i);
      }
    }

    // Slime: clearing a piece on a slimed cell cleans it.
    for (const i of [...this.cleared].sort((a, b) => a - b)) {
      if (layers.slime[i] && layers.ice[i] === 0) {
        layers.slime[i] = false;
        this.slimeCleaned++;
        changed.push(i);
      }
    }

    for (let i = 0; i < layers.ice.length; i++) {
      if (layers.ice[i] === 0) continue;
      const near = this.blasted.has(i) || orthogonal(s, i).some((j) => this.cleared.has(j));
      if (!near) continue;
      layers.ice[i]--;
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
    // Dots and ladybugs enclosed by a loop that aren't its color become bombs (frozen ones are protected).
    const bombs = loop
      ? enclosedCells(s, path).filter((i) => {
          const k = this.cells[i]?.kind;
          return (k === 'dot' || k === 'ladybug') && this.layers.ice[i] === 0 && !first.includes(i);
        })
      : [];
    // A loop sets off every gem of its color; they fire with the bombs.
    const gems = loop
      ? this.cells.flatMap((p, i) => (p?.kind === 'gem' && p.color === color ? [this.trigger(i)!].filter(Boolean) : []))
      : [];
    this.stage(loop ? 'loop' : 'line', first);

    // Each wave fires together; gems a wave reaches fire in the next one.
    let sources: BlastSource[] = [...bombs.map((cell): BlastSource => ({ cell, type: 'bomb' })), ...gems].sort((a, b) => a.cell - b.cell);
    while (sources.length > 0) {
      const hit = new Set<number>();
      for (const src of sources) for (const j of this.reach(src)) hit.add(j);
      this.nextWave = [];
      this.bombCells = new Set(sources.filter((x) => x.type === 'bomb').map((x) => x.cell));
      this.stage('blast', hit, sources);
      sources = this.nextWave.sort((a, b) => a.cell - b.cell);
    }
  }

  /**
   * After the board settles, ignored hazards grow (seeded picks):
   * - Fire, if none went out this move, spreads to one neighboring cell and
   *   destroys its dot (cells with other pieces are safe).
   * - Slime, if none was cleaned this move, spreads to one neighboring clean cell.
   */
  spread(): void {
    const { s, layers, cells } = this;
    const unfrozen = (i: number) => layers.ice[i] === 0;
    const pickNext = (layer: boolean[], ok: (j: number) => boolean): number | null => {
      const options = new Set<number>();
      for (let i = 0; i < layer.length; i++) {
        if (!layer[i] || !unfrozen(i)) continue;
        for (const j of orthogonal(s, i)) if (!layer[j] && unfrozen(j) && ok(j)) options.add(j);
      }
      return options.size === 0 ? null : this.rng.pick([...options].sort((a, b) => a - b));
    };
    if (this.fireOut === 0) {
      const target = pickNext(layers.fire, (j) => cells[j] === null || cells[j]!.kind === 'dot');
      if (target !== null) {
        layers.fire[target] = true;
        cells[target] = null;
        this.emit({ kind: 'layers', layers: cloneLayers(layers), cells: [target] });
      }
    }
    if (this.slimeCleaned === 0) {
      const target = pickNext(layers.slime, (j) => !layers.fire[j]);
      if (target !== null) {
        layers.slime[target] = true;
        this.emit({ kind: 'layers', layers: cloneLayers(layers), cells: [target] });
      }
    }
  }

  /** Lowest cell of a column, where anchors sink. */
  private bottomOf(c: number): number {
    for (let r = this.s.rows - 1; r >= 0; r--) if (this.s.playable[r * this.s.cols + c]) return r * this.s.cols + c;
    return -1;
  }

  /**
   * Gravity and refill. Each column splits into runs between fixed cells;
   * pieces fall to the bottom of their run, and empty tops refill. New pieces
   * in the top run fall in from above the board; in lower runs (under a fixed
   * cell) they appear in place.
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

    // At most one anchor drops in per fall, at the top of a seeded column.
    let anchorSlot = -1;
    const onBoard = cells.filter((p) => p?.kind === 'anchor').length;
    if (this.anchorDrops > 0 && onBoard < s.anchorTarget) {
      const tops = slots.filter((x, k) => x.top && (k === 0 || slots[k - 1].i % s.cols !== x.i % s.cols));
      if (tops.length > 0) anchorSlot = tops[rng.int(tops.length)].i;
    }
    const spawnFrom: Record<number, number> = {};
    for (const slot of slots) {
      const id = this.nextId++;
      if (slot.i === anchorSlot) {
        cells[slot.i] = { kind: 'anchor', id };
        this.anchorDrops--;
      } else {
        cells[slot.i] = { kind: 'dot', id, color: rng.pick(s.colors) };
      }
      spawnFrom[id] = slot.startRow;
    }
    this.emit({ kind: 'fall', spawnFrom });
  }

  /** Falls, sinks anchors that reached the bottom, and repeats until nothing sinks. */
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
  m.fly();
  m.settle();
  m.spread();
  const settled = m.cells.slice();

  const next: GameState = {
    ...s,
    cells: m.cells,
    layers: m.layers,
    nextId: m.nextId,
    anchorDrops: m.anchorDrops,
    movesUsed: s.movesUsed + 1,
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
      path: path.slice(),
      color,
      loop,
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
