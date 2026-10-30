// Canvas setup. Reads state, draws it; owns no game rules.

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
