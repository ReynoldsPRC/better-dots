// Canvas render layer. Reads state, draws it; owns no game rules.
import { config } from '../config';

export type Theme = 'light' | 'dark';

export interface Surface {
  ctx: CanvasRenderingContext2D;
  /** Size in CSS pixels. */
  width: number;
  height: number;
}

/** Sizes the canvas backing store to the device pixel ratio for crisp dots. */
export function fitCanvas(canvas: HTMLCanvasElement): Surface {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

/** Placeholder screen for the empty shell: the name and the five colors. */
export function drawEmpty({ ctx, width, height }: Surface, theme: Theme, colorCount = 5): void {
  ctx.fillStyle = config.background[theme];
  ctx.fillRect(0, 0, width, height);

  const palette = config.palette[theme];
  const cell = Math.min(width, height) * (1 - 2 * config.board.margin) / 6;
  const r = (cell * config.board.dotScale) / 2;
  const cy = height / 2;
  const x0 = width / 2 - ((colorCount - 1) * cell) / 2;
  for (let i = 0; i < colorCount; i++) {
    ctx.fillStyle = palette[i];
    ctx.beginPath();
    ctx.arc(x0 + i * cell, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = config.ink[theme];
  ctx.font = `600 ${Math.round(cell * 0.4)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('better dots', width / 2, cy - cell * 1.2);
}
