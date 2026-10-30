// Game state transitions: setup, moves, gravity, refill, reshuffle, goals.
// Every function here is pure: it returns new state and never mutates input.
import { config } from '../config';
import { canCross, cellsAround, toIndex } from './board';
import { enclosedCells, isLoopClosed, isValidPath } from './path';
import { Rng, seedRng } from './rng';
import type { ClearStep, ColorId, GameState, GoalState, LevelDef, MoveResult, Piece } from './types';

export interface GameOptions {
  /** Seed for refills and reshuffles. Defaults to continuing from the level seed. */
  playSeed?: number;
  bombRadius?: number;
}

/**
 * Builds the starting board. The layout comes from the level seed, so a level
 * always opens the same way; refills follow `playSeed`.
 */
export function createGame(level: LevelDef, opts: GameOptions = {}): GameState {
  const rows = level.layout.length;
  const cols = Math.max(...level.layout.map((row) => row.length));
  const playable: boolean[] = [];
  const cells: (Piece | null)[] = [];
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

  const { wallRight, wallDown } = placeWalls(level, rows, cols);

  const boardRng = new Rng(seedRng(level.seed));
  for (let i = 0; i < cells.length; i++) {
    if (playable[i] && cells[i] === null) cells[i] = { kind: 'dot', id: nextId++, color: boardRng.pick(level.colors) };
  }

  const state: GameState = {
    rows,
    cols,
    playable,
    wallRight,
    wallDown,
    cells,
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

export function movesLeft(s: GameState): number {
  return s.moveLimit + s.extraMoves - s.movesUsed;
}

export function goalDone(g: GoalState): boolean {
  return g.progress >= g.goal.count;
}

/** True if any two adjacent dots share a color. */
export function hasMove(s: GameState, cells: readonly (Piece | null)[] = s.cells): boolean {
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      const i = toIndex(s, r, c);
      const a = cells[i];
      if (!a || a.kind !== 'dot') continue;
      for (const j of [c + 1 < s.cols ? i + 1 : -1, r + 1 < s.rows ? i + s.cols : -1]) {
        if (j < 0 || !canCross(s, i, j)) continue;
        const b = cells[j];
        if (b && b.kind === 'dot' && b.color === a.color) return true;
      }
    }
  }
  return false;
}

/**
 * Moves the regular dots around until a legal move exists. Other pieces stay
 * put. If shuffling alone can't do it, recolors one dot to match a neighbor.
 */
function reshuffleUntilPlayable(s: GameState, cells: (Piece | null)[], rng: Rng): (Piece | null)[] {
  if (hasMove(s, cells)) return cells;
  const spots = cells.flatMap((p, i) => (p && p.kind === 'dot' ? [i] : []));
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
      out[b] = { ...(out[b] as Piece), color: (out[a] as Piece).color };
      return out;
    }
  }
  return out;
}

/** Dots fall to the lowest open cells of their column; new dots fill from the top. */
function settle(s: GameState, cells: (Piece | null)[], rng: Rng, nextId: number) {
  const out = cells.slice();
  const spawned: number[] = [];
  for (let c = 0; c < s.cols; c++) {
    const slots: number[] = [];
    for (let r = 0; r < s.rows; r++) {
      const i = toIndex(s, r, c);
      if (s.playable[i]) slots.push(i);
    }
    const pieces = slots.map((i) => out[i]).filter((p): p is Piece => p !== null);
    const empty = slots.length - pieces.length;
    slots.forEach((i, k) => {
      if (k < empty) {
        const id = nextId++;
        spawned.push(id);
        out[i] = { kind: 'dot', id, color: rng.pick(s.colors) };
      } else {
        out[i] = pieces[k - empty];
      }
    });
  }
  return { cells: out, spawned, nextId };
}

/** Plays one move. Throws if the game is over or the path isn't legal. */
export function applyMove(s: GameState, path: readonly number[]): { state: GameState; result: MoveResult } {
  if (s.status !== 'playing') throw new Error(`applyMove: game is ${s.status}`);
  if (!isValidPath(s, path)) throw new Error(`applyMove: invalid path ${JSON.stringify(path)}`);

  const cells = s.cells.slice();
  const color = (cells[path[0]] as Piece).color;
  const loop = isLoopClosed(path);
  const collected = [0, 0, 0, 0, 0];
  const steps: ClearStep[] = [];
  const clear = (i: number) => {
    const p = cells[i];
    if (!p) return;
    cells[i] = null;
    if (p.kind === 'dot') collected[p.color]++;
  };

  // Stage 1: the line, or for a loop every dot of its color.
  const first = loop
    ? cells.flatMap((p, i) => (p && p.kind === 'dot' && p.color === color ? [i] : []))
    : [...new Set(path)].sort((a, b) => a - b);
  // Pieces enclosed by a loop that aren't its color become bombs.
  const bombs = loop ? enclosedCells(s, path).filter((i) => cells[i] && !first.includes(i)) : [];
  first.forEach(clear);
  steps.push({ kind: loop ? 'loop' : 'line', cells: first, sources: [] });

  // Stage 2: bombs explode together, clearing themselves and their surroundings.
  if (bombs.length > 0) {
    const hit = new Set<number>(bombs);
    for (const b of bombs) for (const j of cellsAround(s, b, s.bombRadius)) if (cells[j]) hit.add(j);
    const blast = [...hit].sort((a, b) => a - b);
    blast.forEach(clear);
    steps.push({ kind: 'bomb', cells: blast, sources: bombs });
  }

  const rng = new Rng(s.rng);
  const settled = settle(s, cells, rng, s.nextId);
  const goals = s.goals.map((g) => ({ goal: g.goal, progress: g.progress + collected[g.goal.color] }));
  const next: GameState = {
    ...s,
    cells: settled.cells,
    nextId: settled.nextId,
    movesUsed: s.movesUsed + 1,
    goals,
  };
  if (goals.length > 0 && goals.every(goalDone)) next.status = 'won';
  else if (movesLeft(next) <= 0) next.status = 'lost';

  let shuffled = false;
  if (next.status === 'playing' && !hasMove(next)) {
    next.cells = reshuffleUntilPlayable(next, next.cells, rng);
    shuffled = true;
  }
  next.rng = rng.state;

  return {
    state: next,
    result: { path: path.slice(), color, loop, steps, settled: settled.cells, spawned: settled.spawned, shuffled },
  };
}

/** The assist: more moves after running out. Marks the attempt as assisted. */
export function addMoves(s: GameState, n: number = config.assist.moves): GameState {
  return { ...s, extraMoves: s.extraMoves + n, assisted: true, status: s.status === 'lost' ? 'playing' : s.status };
}
