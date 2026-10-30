// Where the board sits on screen, and which cell a point is over.
import { config } from '../config';

export interface Layout {
  x0: number;
  y0: number;
  cell: number;
  rows: number;
  cols: number;
}

/** Fits the board into the area between the top and bottom insets. */
export function computeLayout(
  width: number, height: number, rows: number, cols: number, top: number, bottom: number,
): Layout {
  const margin = Math.min(width, height) * config.board.margin;
  const availW = width - 2 * margin;
  const availH = height - top - bottom - 2 * margin;
  const cell = Math.max(1, Math.min(availW / cols, availH / rows, config.board.maxCell));
  return {
    x0: (width - cell * cols) / 2,
    y0: top + margin + (availH - cell * rows) / 2,
    cell,
    rows,
    cols,
  };
}

/** Center of a (possibly fractional) row/col position, in CSS pixels. */
export function toScreen(l: Layout, r: number, c: number): [number, number] {
  return [l.x0 + (c + 0.5) * l.cell, l.y0 + (r + 0.5) * l.cell];
}

/** The cell whose dot is under the point, or null if the point isn't close to a center. */
export function cellAt(l: Layout, x: number, y: number): number | null {
  const fc = (x - l.x0) / l.cell - 0.5;
  const fr = (y - l.y0) / l.cell - 0.5;
  const c = Math.round(fc);
  const r = Math.round(fr);
  if (r < 0 || r >= l.rows || c < 0 || c >= l.cols) return null;
  if (Math.hypot(fc - c, fr - r) > config.input.hitRadius) return null;
  return r * l.cols + c;
}
