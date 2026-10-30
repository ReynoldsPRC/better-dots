// Shared rule types. Cells are addressed by a flat index: r * cols + c.
import type { RngState } from './rng';

/** Index into the global palette (max 5 colors per board). */
export type ColorId = 0 | 1 | 2 | 3 | 4;
export const MAX_COLORS = 5;

/** A regular dot. */
export interface Dot {
  kind: 'dot';
  /** Stable identity so the render layer can follow a piece as it falls. */
  id: number;
  color: ColorId;
}

/** Not connectable; falls; sinks (and counts) on reaching the bottom of its column. */
export interface Anchor {
  kind: 'anchor';
  id: number;
}

export type GemShape = 'column' | 'cross';

/**
 * Not connectable; falls. Goes off when a loop of its color is made, or when
 * a blast or beam reaches it: a column gem clears its column, a cross gem its
 * row and column.
 */
export interface Gem {
  kind: 'gem';
  id: number;
  color: ColorId;
  shape: GemShape;
}

/**
 * Connectable like a dot of its current color. Each clear costs a spot; with
 * spots left it changes color and flies to a random cell. Cleared on its last
 * spot, or at once if a loop encloses it.
 */
export interface Ladybug {
  kind: 'ladybug';
  id: number;
  color: ColorId;
  spots: number;
}

export type Piece = Dot | Anchor | Gem | Ladybug;
export type Cells = (Piece | null)[];

/** A wall on one side of cell (r, c). */
export interface Wall {
  r: number;
  c: number;
  side: 'up' | 'down' | 'left' | 'right';
}

/** A piece placed by the level file (dots go in the layout instead). */
export type PlacedPiece =
  | { r: number; c: number; type: 'anchor' }
  | { r: number; c: number; type: 'gem'; color: ColorId; shape: GemShape }
  | { r: number; c: number; type: 'ladybug'; color: ColorId; spots?: number };

export type Goal =
  | { type: 'collect'; color: ColorId; count: number }
  | { type: 'anchors'; count: number }
  | { type: 'ice'; count: number }
  /** Water every cell. */
  | { type: 'flood' }
  | { type: 'gems'; count: number }
  | { type: 'ladybugs'; count: number }
  /** Clean every slimed cell. */
  | { type: 'slime' }
  /** Put out every fire. */
  | { type: 'fire' };

/** Per-cell layers, separate from the pieces. */
export interface Layers {
  /** Ice thickness, 0-3. A frozen cell's piece is locked in place and can't be connected. */
  ice: number[];
  /** Watered cells. Water under ice is dormant until the ice breaks. */
  water: boolean[];
  /** Slimed cells. Slime under ice is dormant until the ice breaks. */
  slime: boolean[];
  /** Burning cells: they hold no piece and gravity stops at them. Fire under ice is dormant. */
  fire: boolean[];
}

export interface GoalState {
  goal: Goal;
  /** For counted goals: how many so far. */
  progress: number;
}

export type Status = 'playing' | 'won' | 'lost';

/** A level as the rules see it. Level JSON files are parsed into this. */
export interface LevelDef {
  /** Stable id from the level file ("id"). Saves are keyed on it, so it survives renumbering. */
  id: string;
  /** Positional name, e.g. "1-3" or "c4-2". Comes from the file's place in the levels folder; shown to the player. */
  label: string;
  name?: string;
  seed: number;
  moves: number;
  colors: ColorId[];
  /** One string per row: '.' random dot, '0'-'4' a dot of that color, '-' no cell. */
  layout: string[];
  /** Barriers on cell edges. Lines can't cross them; falling dots can. */
  walls?: Wall[];
  /** Non-dot pieces at the start. */
  pieces?: PlacedPiece[];
  /** How many more anchors drop in from the top over the level. */
  anchorDrops?: number;
  /** Ice thickness per cell: one string per row, '.' none or '1'-'3'. */
  ice?: string[];
  /** Watered cells at the start: one string per row, '.' dry or 'x' watered. */
  water?: string[];
  /** Slimed cells at the start: one string per row, '.' clean or 'x' slimed. */
  slime?: string[];
  /** Burning cells at the start: one string per row, '.' or 'x' burning. */
  fire?: string[];
  goals: Goal[];
  /** Most moves used that still earns 2 or 3 stars. Set from bot results. */
  stars?: { two: number; three: number };
}

export interface GameState {
  rows: number;
  cols: number;
  /** false = no cell here. */
  playable: boolean[];
  /** Wall on the right / bottom edge of each cell. */
  wallRight: boolean[];
  wallDown: boolean[];
  cells: Cells;
  layers: Layers;
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
  /** Anchors still to drop in from the top. */
  anchorDrops: number;
  /** A new anchor drops in when fewer than this many are on the board. */
  anchorTarget: number;
}

/** What one move achieved, for goal progress. */
export interface Tally {
  collected: number[];
  anchors: number;
  /** Ice cells broken all the way through. */
  ice: number;
  /** Gems set off. */
  gems: number;
  /** Ladybugs removed. */
  ladybugs: number;
}

export type ClearKind = 'line' | 'loop' | 'blast';
export type BlastType = 'bomb' | GemShape;

export interface BlastSource {
  cell: number;
  type: BlastType;
  color?: ColorId;
}

/** One stage of a move's cascade. Stages resolve (and animate) in order. */
export interface ClearStep {
  kind: ClearKind;
  /** Cells whose pieces were removed in this stage, ascending. */
  cells: number[];
  /** What went off in a blast stage (empty for line and loop). Gems carry their color. */
  sources: BlastSource[];
}

/**
 * What a move did, in order, for the render layer to replay. Each event
 * carries the board as it stands after that event.
 */
export type MoveEvent = { board: Cells } & (
  | { kind: 'clear'; step: ClearStep }
  /** Gravity and refill. `spawnFrom` gives each new piece's starting row (above the board or under a blocker). */
  | { kind: 'fall'; spawnFrom: Record<number, number> }
  /** Anchors that reached the bottom and were removed. */
  | { kind: 'sink'; cells: number[] }
  /** Ladybugs flying off after a hit, each swapping places with the dot where it lands. */
  | { kind: 'fly'; moves: { from: number; to: number }[] }
  /** Cell layers changed (ice cracked, ...). `layers` is the new state; `cells` are the ones that changed. */
  | { kind: 'layers'; layers: Layers; cells: number[] }
  | { kind: 'shuffle' }
);

export interface MoveResult {
  path: number[];
  color: ColorId;
  loop: boolean;
  events: MoveEvent[];
  /** The clear stages, in order (a view over `events`). */
  steps: ClearStep[];
  /** Board after the move settled and hazards spread, before any reshuffle. */
  settled: Cells;
  /** Ids of every piece that entered this move. */
  spawned: number[];
  /** True if the board had no legal move and was reshuffled. */
  shuffled: boolean;
}
