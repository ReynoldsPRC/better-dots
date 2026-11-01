// Building and checking a connection: the line the player drags.
// A path is a list of cell indices. A closed loop ends on a cell that already
// appears earlier in the path.
import { canCross, isCell, toRC } from './board';
import type { ColorId, GameState } from './types';

export function connectableColor(s: GameState, i: number): ColorId | null {
  if (!isCell(s, i)) return null;
  const p = s.cells[i];
  return p && (p.kind === 'dot' || p.kind === 'ladybug') ? p.color : null;
}

/** Can the line step from a to b? Same color, orthogonally adjacent, no wall between. */
export function canLink(s: GameState, a: number, b: number): boolean {
  const ca = connectableColor(s, a);
  return ca !== null && ca === connectableColor(s, b) && canCross(s, a, b);
}

export function isLoopClosed(path: readonly number[]): boolean {
  if (path.length < 2) return false;
  return path.indexOf(path[path.length - 1]) < path.length - 1;
}

/**
 * The path after the finger reaches `cell`. Returns the same array if
 * nothing changes. Moving back onto the previous cell shortens the line.
 */
export function extendPath(s: GameState, path: readonly number[], cell: number): readonly number[] {
  if (path.length === 0) return connectableColor(s, cell) === null ? path : [cell];
  const last = path[path.length - 1];
  if (cell === last) return path;
  if (path.length >= 2 && cell === path[path.length - 2]) return path.slice(0, -1);
  if (isLoopClosed(path)) return path;
  if (!canLink(s, last, cell)) return path;
  // Revisiting an earlier cell closes a loop. The grid is bipartite, so any
  // adjacent earlier cell other than the previous one makes a cycle of 4+.
  return [...path, cell];
}

/** A path that applyMove will accept. */
export function isValidPath(s: GameState, path: readonly number[]): boolean {
  if (path.length < 2) return false;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    if (i > 0 && !canLink(s, path[i - 1], cell)) return false;
    if (seen.has(cell)) {
      if (i !== path.length - 1 || cell === path[i - 2]) return false;
    }
    seen.add(cell);
  }
  return connectableColor(s, path[0]) !== null;
}

/**
 * Cells strictly inside a closed loop. Crossing-number test with a ray
 * toward +column; edges are unit segments between cell centers, so the
 * half-open row rule handles rays that pass through vertices.
 */
export function enclosedCells(s: GameState, path: readonly number[]): number[] {
  if (!isLoopClosed(path)) return [];
  const loop = path.slice(path.indexOf(path[path.length - 1]));
  const onLoop = new Set(loop);
  const verticalEdges: [number, number, number][] = []; // [col, rowLo, rowHi]
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (let k = 0; k < loop.length - 1; k++) {
    const [r1, c1] = toRC(s, loop[k]);
    const [r2, c2] = toRC(s, loop[k + 1]);
    if (c1 === c2) verticalEdges.push([c1, Math.min(r1, r2), Math.max(r1, r2)]);
    minR = Math.min(minR, r1); maxR = Math.max(maxR, r1);
    minC = Math.min(minC, c1); maxC = Math.max(maxC, c1);
  }
  const inside: number[] = [];
  for (let r = minR + 1; r < maxR; r++) {
    for (let c = minC + 1; c < maxC; c++) {
      const i = r * s.cols + c;
      if (onLoop.has(i)) continue;
      let crossings = 0;
      for (const [ec, lo, hi] of verticalEdges) if (ec > c && lo <= r && r < hi) crossings++;
      if (crossings % 2 === 1) inside.push(i);
    }
  }
  return inside;
}

/**
 * A 2x2 square the player could close right now, as a loop path (first cell
 * repeated at the end), or null. The first one in board order, so the hint is stable.
 */
export function hintSquare(s: GameState): number[] | null {
  for (let r = 0; r + 1 < s.rows; r++) {
    for (let c = 0; c + 1 < s.cols; c++) {
      const a = r * s.cols + c;
      const ring = [a, a + 1, a + s.cols + 1, a + s.cols, a];
      if (ring.slice(1).every((b, k) => canLink(s, ring[k], b))) return ring;
    }
  }
  return null;
}
