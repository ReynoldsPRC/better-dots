// Draws the board: background, connection line, dots, and effects.
import { config } from '../config';
import { connectableColor, type ColorId, type GameState, type Piece } from '../rules';
import type { Surface, Theme } from './canvas';
import type { Frame, SpriteFrame } from './animation';
import { toScreen, type Layout } from './layout';

export interface DrawOptions {
  theme: Theme;
  colorblind: boolean;
}

export interface DragView {
  path: readonly number[];
  /** Finger position in CSS pixels, or null when the line shouldn't trail it. */
  finger: [number, number] | null;
  /** When the last dot joined the line (for the ripple). */
  addedAt: number;
  loop: boolean;
}

export function colorOf(theme: Theme, color: ColorId): string {
  return config.palette[theme][color];
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return hex + a;
}

export function drawScene(
  { ctx, width, height }: Surface,
  layout: Layout,
  state: GameState,
  frame: Frame | null,
  drag: DragView | null,
  opts: DrawOptions,
  now: number,
): void {
  const { theme } = opts;
  const { cell } = layout;
  const radius = (cell * config.board.dotScale) / 2;
  ctx.fillStyle = config.background[theme];
  ctx.fillRect(0, 0, width, height);

  drawTerrain(ctx, layout, state, theme);

  const dragColor = drag && drag.path.length > 0 ? connectableColor(state, drag.path[0]) : null;

  // Board-wide tints: the loop pulse after a move, a faint wash while a loop is held.
  if (frame?.pulse) {
    ctx.fillStyle = withAlpha(colorOf(theme, frame.pulse.color), frame.pulse.alpha);
    ctx.fillRect(0, 0, width, height);
  } else if (drag?.loop && dragColor !== null) {
    ctx.fillStyle = withAlpha(colorOf(theme, dragColor), config.line.loopTint);
    ctx.fillRect(0, 0, width, height);
  }

  // Connection line, under the dots.
  if (drag && dragColor !== null && drag.path.length > 0) {
    ctx.strokeStyle = colorOf(theme, dragColor);
    ctx.lineWidth = cell * config.line.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    drag.path.forEach((i, k) => {
      const [x, y] = toScreen(layout, Math.floor(i / state.cols), i % state.cols);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (drag.finger && !drag.loop) ctx.lineTo(drag.finger[0], drag.finger[1]);
    ctx.stroke();
  }

  // Dots. New dots slide in from above the board, so clip to its top edge.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, layout.y0, width, height - layout.y0);
  ctx.clip();
  const sprites: SpriteFrame[] = frame
    ? frame.sprites
    : state.cells.flatMap((p, i) =>
        p ? [{ id: p.id, piece: p, r: Math.floor(i / state.cols), c: i % state.cols, scale: 1, alpha: 1 }] : [],
      );
  for (const s of sprites) {
    if (s.scale <= 0 || s.alpha <= 0) continue;
    const [x, y] = toScreen(layout, s.r, s.c);
    ctx.globalAlpha = s.alpha;
    drawPiece(ctx, s.piece, x, y, radius * s.scale, opts);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Ripple from the dot that most recently joined the line.
  if (drag && dragColor !== null && drag.path.length > 0) {
    const p = (now - drag.addedAt) / config.select.ringMs;
    if (p >= 0 && p < 1) {
      const last = drag.path[drag.path.length - 1];
      const [x, y] = toScreen(layout, Math.floor(last / state.cols), last % state.cols);
      ctx.fillStyle = withAlpha(colorOf(theme, dragColor), config.select.ringAlpha * (1 - p));
      ctx.beginPath();
      ctx.arc(x, y, radius * (1 + (config.select.ringScale - 1) * p), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const b of frame?.blasts ?? []) {
    const [x, y] = toScreen(layout, b.r, b.c);
    ctx.strokeStyle = withAlpha(config.ink[theme], 0.5 * (1 - b.progress));
    ctx.lineWidth = cell * 0.08;
    ctx.beginPath();
    ctx.arc(x, y, radius + cell * (state.bombRadius + 0.2) * b.progress, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Cell tiles (shaped boards only) and walls. */
function drawTerrain(ctx: CanvasRenderingContext2D, layout: Layout, s: GameState, theme: Theme) {
  const { cell, x0, y0 } = layout;
  const t = config.terrain;
  if (s.playable.some((p) => !p)) {
    ctx.fillStyle = withAlpha(config.ink[theme], t.tileAlpha);
    const size = cell * t.tileScale;
    const pad = (cell - size) / 2;
    for (let i = 0; i < s.playable.length; i++) {
      if (!s.playable[i]) continue;
      const r = Math.floor(i / s.cols);
      const c = i % s.cols;
      ctx.beginPath();
      ctx.roundRect(x0 + c * cell + pad, y0 + r * cell + pad, size, size, cell * t.tileRadius);
      ctx.fill();
    }
  }
  ctx.strokeStyle = withAlpha(config.ink[theme], t.wallAlpha);
  ctx.lineWidth = cell * t.wallThickness;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const inset = cell * t.wallInset;
  for (let i = 0; i < s.playable.length; i++) {
    const r = Math.floor(i / s.cols);
    const c = i % s.cols;
    if (s.wallRight[i]) {
      const x = x0 + (c + 1) * cell;
      ctx.moveTo(x, y0 + r * cell + inset);
      ctx.lineTo(x, y0 + (r + 1) * cell - inset);
    }
    if (s.wallDown[i]) {
      const y = y0 + (r + 1) * cell;
      ctx.moveTo(x0 + c * cell + inset, y);
      ctx.lineTo(x0 + (c + 1) * cell - inset, y);
    }
  }
  ctx.stroke();
}

export function drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, x: number, y: number, r: number, opts: DrawOptions) {
  switch (piece.kind) {
    case 'dot':
      return drawDot(ctx, x, y, r, piece.color, opts);
    case 'anchor':
      return drawAnchor(ctx, x, y, r, config.ink[opts.theme]);
  }
}

/** An anchor: ring, shank, stock, and curved arms. Drawn in ink so it never reads as a dot color. */
function drawAnchor(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ink: string) {
  const s = r * config.anchor.scale;
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = s * 0.24;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y - s * 0.78, s * 0.22, 0, Math.PI * 2);
  ctx.moveTo(x, y - s * 0.56);
  ctx.lineTo(x, y + s * 0.9);
  ctx.moveTo(x - s * 0.42, y - s * 0.28);
  ctx.lineTo(x + s * 0.42, y - s * 0.28);
  ctx.moveTo(x + s * 0.8 * Math.cos(0.12 * Math.PI), y + s * 0.1 + s * 0.8 * Math.sin(0.12 * Math.PI));
  ctx.arc(x, y + s * 0.1, s * 0.8, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: ColorId, opts: DrawOptions) {
  ctx.fillStyle = colorOf(opts.theme, color);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (opts.colorblind) drawSymbol(ctx, x, y, r * config.colorblind.symbolScale, color, config.background[opts.theme]);
}

/** Colorblind symbols, one per color: triangle, bar, plus, ring, diamond. */
export function drawSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: ColorId, ink: string) {
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = s * 0.38;
  ctx.lineCap = 'round';
  ctx.beginPath();
  switch (color) {
    case 0: // triangle
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.92, y + s * 0.65);
      ctx.lineTo(x - s * 0.92, y + s * 0.65);
      ctx.closePath();
      ctx.fill();
      break;
    case 1: // bar
      ctx.moveTo(x - s * 0.8, y);
      ctx.lineTo(x + s * 0.8, y);
      ctx.stroke();
      break;
    case 2: // plus
      ctx.moveTo(x - s * 0.8, y);
      ctx.lineTo(x + s * 0.8, y);
      ctx.moveTo(x, y - s * 0.8);
      ctx.lineTo(x, y + s * 0.8);
      ctx.stroke();
      break;
    case 3: // ring
      ctx.lineWidth = s * 0.3;
      ctx.arc(x, y, s * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 4: // diamond
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.75, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.75, y);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}
