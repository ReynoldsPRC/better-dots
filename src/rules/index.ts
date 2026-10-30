// Game rules: pure, deterministic, no DOM or rendering code.
// Rendering and input layers read this state; they never change rules directly.

export * from './rng';

/** Index into the level's color list (max 5 colors per board). */
export type ColorId = 0 | 1 | 2 | 3 | 4;
export const MAX_COLORS = 5;
