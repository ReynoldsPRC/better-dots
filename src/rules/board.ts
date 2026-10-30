// Grid geometry: indexing, adjacency, neighbors.

export interface Grid {
  rows: number;
  cols: number;
  playable: boolean[];
}

export function toIndex(g: Grid, r: number, c: number): number {
  return r * g.cols + c;
}

export function toRC(g: Grid, i: number): [number, number] {
  return [Math.floor(i / g.cols), i % g.cols];
}

export function isCell(g: Grid, i: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < g.rows * g.cols && g.playable[i];
}

/** Orthogonally adjacent playable cells. */
export function areAdjacent(g: Grid, a: number, b: number): boolean {
  if (!isCell(g, a) || !isCell(g, b)) return false;
  const [ra, ca] = toRC(g, a);
  const [rb, cb] = toRC(g, b);
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

/** Playable cells within Chebyshev distance `radius`, excluding `i` itself. */
export function cellsAround(g: Grid, i: number, radius: number): number[] {
  const [r, c] = toRC(g, i);
  const out: number[] = [];
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= g.rows || cc < 0 || cc >= g.cols) continue;
      const j = toIndex(g, rr, cc);
      if (g.playable[j]) out.push(j);
    }
  }
  return out;
}
