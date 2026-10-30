// Shared rule types. Cells are addressed by a flat index: r * cols + c.
import type { RngState } from './rng';

/** Index into the global palette (max 5 colors per board). */
export type ColorId = 0 | 1 | 2 | 3 | 4;
export const MAX_COLORS = 5;

/** A regular dot. Later mechanics (anchors, gems, ladybugs) add more piece kinds. */
export interface Dot {
  kind: 'dot';
  /** Stable identity so the render layer can follow a piece as it falls. */
  id: number;
  color: ColorId;
}

export type Piece = Dot;

export type Goal = { type: 'collect'; color: ColorId; count: number };

export interface GoalState {
  goal: Goal;
  progress: number;
}

export type Status = 'playing' | 'won' | 'lost';

/** A level as the rules see it. Level JSON files are parsed into this. */
export interface LevelDef {
  id: string;
  seed: number;
  moves: number;
  colors: ColorId[];
  /** One string per row: '.' random dot, '0'-'4' a dot of that color. */
  layout: string[];
  goals: Goal[];
}

export interface GameState {
  rows: number;
  cols: number;
  /** false = no cell here. */
  playable: boolean[];
  cells: (Piece | null)[];
  /** Colors that can appear on this board. */
  colors: ColorId[];
  rng: RngState;
  nextId: number;
  moveLimit: number;
  /** Moves added by the assist. */
  extraMoves: number;
  movesUsed: number;
  assisted: boolean;
  goals: GoalState[];
  status: Status;
  /** Bomb blast radius in cells (1 = the 8 neighbors). */
  bombRadius: number;
}

export type ClearKind = 'line' | 'loop' | 'bomb';

/** One stage of a move's cascade. Stages resolve (and animate) in order. */
export interface ClearStep {
  kind: ClearKind;
  /** Cells whose pieces were removed in this stage, ascending. */
  cells: number[];
  /** Cells that exploded (bomb stages only). */
  sources: number[];
}

export interface MoveResult {
  path: number[];
  color: ColorId;
  loop: boolean;
  steps: ClearStep[];
  /** Board after gravity and refill, before any reshuffle. */
  settled: (Piece | null)[];
  /** Ids of dots that entered from the top. */
  spawned: number[];
  /** True if the board had no legal move and was reshuffled. */
  shuffled: boolean;
}
