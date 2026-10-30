// Generator settings per world. Each preset maps a candidate's position in a
// batch (0..1, easy to hard) to generator parameters, so a batch ramps up.
import type { GenParams } from './generate';

export type Preset = (t: number) => GenParams;

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

export const presets: Record<number, Preset> = {
  // World 1: core rules.
  1: (t) => ({
    rows: lerp(6, 7, t), cols: lerp(6, 7, t), colors: lerp(3, 5, t),
    collectGoals: lerp(1, 3, t), targetMoves: [lerp(12, 22, t), lerp(18, 32, t)],
  }),
  // World 2: shaped boards.
  2: (t) => ({
    rows: 7, cols: lerp(6, 7, t), colors: lerp(3, 5, t), holes: lerp(4, 10, t),
    collectGoals: lerp(1, 3, t), targetMoves: [lerp(14, 22, t), lerp(20, 32, t)],
  }),
  // World 3: walls.
  3: (t) => ({
    rows: lerp(6, 7, t), cols: lerp(6, 7, t), colors: lerp(3, 5, t), walls: lerp(4, 12, t), holes: lerp(0, 4, t),
    collectGoals: lerp(1, 3, t), targetMoves: [lerp(14, 22, t), lerp(20, 32, t)],
  }),
  // World 4: anchors.
  4: (t) => ({
    rows: lerp(6, 7, t), cols: lerp(6, 7, t), colors: lerp(3, 5, t), holes: lerp(0, 4, t), walls: lerp(0, 4, t),
    collectGoals: lerp(0, 1, t), anchors: { start: lerp(1, 3, t), dropsPerSize: 1 / 6 },
    targetMoves: [lerp(12, 20, t), lerp(18, 30, t)],
  }),
  // World 5: ice.
  5: (t) => ({
    rows: lerp(6, 7, t), cols: lerp(6, 7, t), colors: lerp(3, 5, t), holes: lerp(0, 4, t), walls: lerp(0, 2, t),
    collectGoals: lerp(0, 1, t), ice: { perSize: 0.6, max: 16, thickness: [1, lerp(1, 3, t)] },
    targetMoves: [lerp(10, 20, t), lerp(18, 30, t)],
  }),
  // World 6: water (some sources frozen over later on).
  6: (t) => ({
    rows: lerp(6, 7, t), cols: lerp(6, 7, t), colors: lerp(3, 5, t), holes: lerp(0, 4, t),
    collectGoals: 0, water: { sources: lerp(1, 4, t), underIce: t > 0.6 ? 2 : 0 },
    targetMoves: [lerp(6, 18, t), lerp(16, 34, t)],
  }),
  // World 7: gems.
  7: (t) => ({
    rows: lerp(6, 7, t), cols: lerp(6, 7, t), colors: t < 0.2 ? 3 : t < 0.85 ? 4 : 5, holes: lerp(0, 4, t),
    collectGoals: t < 0.3 ? 0 : 1, gems: { count: lerp(2, 6, t), crossShare: 0.35 },
    targetMoves: [lerp(6, 18, t), lerp(14, 30, t)],
  }),
};
