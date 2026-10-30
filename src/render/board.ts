// Draws the board: background, connection line, dots, and effects.
import { config } from '../config';
import { connectableColor, type ColorId, type GameState, type Layers, type Piece } from '../rules';
import type { Surface, Theme } from './canvas';
import type { Frame, LayerChange, SpriteFrame } from './animation';
import { ease } from './easing';
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
  drawWater(ctx, layout, state, frame?.layers ?? state.layers, frame?.changed ?? [], theme);

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

  // Gem beams, under the dots: a band along the column (and row, for cross gems) that narrows as it fades.
  for (const b of frame?.blasts ?? []) {
    if (b.type === 'bomb') continue;
    const [x, y] = toScreen(layout, b.r, b.c);
    const w = cell * config.gem.beamWidth * (1 - 0.6 * b.progress);
    ctx.fillStyle = withAlpha(colorOf(theme, b.color ?? 0), config.gem.beamAlpha * (1 - b.progress));
    ctx.fillRect(x - w / 2, layout.y0, w, layout.rows * cell);
    if (b.type === 'cross') ctx.fillRect(layout.x0, y - w / 2, layout.cols * cell, w);
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

  drawIce(ctx, layout, state, frame?.layers ?? state.layers, frame?.changed ?? [], theme);

  for (const b of frame?.blasts ?? []) {
    const [x, y] = toScreen(layout, b.r, b.c);
    if (b.type !== 'bomb') continue;
    ctx.strokeStyle = withAlpha(config.ink[theme], 0.5 * (1 - b.progress));
    ctx.lineWidth = cell * 0.08;
    ctx.beginPath();
    ctx.arc(x, y, radius + cell * (state.bombRadius + 0.2) * b.progress, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Ice over its cell: a pale tile whose look follows thickness. 3 is fresh,
 * 2 cracked, 1 nearly broken. Cells that just changed flash briefly.
 */
function drawIce(
  ctx: CanvasRenderingContext2D, layout: Layout, s: GameState, layers: Layers,
  changed: LayerChange[], theme: Theme,
) {
  const { cell, x0, y0 } = layout;
  const t = config.ice;
  const size = cell * t.scale;
  const pad = (cell - size) / 2;
  const flash = new Map(changed.filter((c) => c.layer === 'ice').map((c) => [c.cell, c.progress]));
  for (let i = 0; i < layers.ice.length; i++) {
    const n = layers.ice[i];
    const f = flash.get(i);
    if (n === 0 && f === undefined) continue;
    const x = x0 + (i % s.cols) * cell + pad;
    const y = y0 + Math.floor(i / s.cols) * cell + pad;
    if (n === 0) {
      // Just broke: a fading shell.
      ctx.globalAlpha = 1 - f!;
      ctx.fillStyle = t.fill[theme][1];
      ctx.beginPath();
      ctx.roundRect(x - size * 0.06 * f!, y - size * 0.06 * f!, size * (1 + 0.12 * f!), size * (1 + 0.12 * f!), cell * t.radius);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.fillStyle = t.fill[theme][n];
    ctx.strokeStyle = t.edge[theme];
    ctx.lineWidth = cell * t.crackWidth;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, cell * t.radius);
    ctx.fill();
    ctx.stroke();
    // Cracks: more of them as the ice thins.
    ctx.beginPath();
    const crack = (pts: [number, number][]) => {
      ctx.moveTo(x + pts[0][0] * size, y + pts[0][1] * size);
      for (const [px, py] of pts.slice(1)) ctx.lineTo(x + px * size, y + py * size);
    };
    if (n <= 2) crack([[0.08, 0.3], [0.35, 0.42], [0.5, 0.28], [0.72, 0.4]]);
    if (n <= 1) {
      crack([[0.35, 0.42], [0.42, 0.7], [0.3, 0.92]]);
      crack([[0.72, 0.4], [0.92, 0.66]]);
      crack([[0.5, 0.28], [0.58, 0.06]]);
    }
    ctx.stroke();
    if (f !== undefined) {
      ctx.fillStyle = withAlpha('#FFFFFF', 0.5 * (1 - f));
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, cell * t.radius);
      ctx.fill();
    }
  }
}

/** Watered cells: a soft tile under the dots. New water spreads in from the center. */
function drawWater(
  ctx: CanvasRenderingContext2D, layout: Layout, s: GameState, layers: Layers, changed: LayerChange[], theme: Theme,
) {
  const { cell, x0, y0 } = layout;
  const t = config.water;
  const grow = new Map(changed.filter((c) => c.layer === 'water').map((c) => [c.cell, c.progress]));
  ctx.fillStyle = t.fill[theme];
  for (let i = 0; i < layers.water.length; i++) {
    if (!layers.water[i]) continue;
    const g = grow.has(i) ? ease('easeOutCubic', grow.get(i)!) : 1;
    const size = cell * t.scale * (0.3 + 0.7 * g);
    const x = x0 + (i % s.cols + 0.5) * cell - size / 2;
    const y = y0 + (Math.floor(i / s.cols) + 0.5) * cell - size / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, cell * t.radius);
    ctx.fill();
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
    case 'gem':
      return drawGem(ctx, x, y, r, piece.color, piece.shape === 'cross', opts);
  }
}

/**
 * Gems: a tall bar (column gem) or a square (cross gem) in the gem's color,
 * with a pale inset and an etched line or cross showing which way it fires.
 */
function drawGem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: ColorId, cross: boolean, opts: DrawOptions) {
  const s = r * config.gem.scale;
  const w = cross ? s * 1.6 : s * 1.1;
  const h = s * 1.6;
  ctx.save();
  ctx.fillStyle = colorOf(opts.theme, color);
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, s * 0.28);
  ctx.fill();
  ctx.fillStyle = withAlpha('#FFFFFF', 0.28);
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + s * 0.18, y - h / 2 + s * 0.18, w - s * 0.36, h - s * 0.36, s * 0.16);
  ctx.fill();
  ctx.strokeStyle = withAlpha('#FFFFFF', 0.85);
  ctx.lineWidth = s * 0.14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2 + s * 0.3);
  ctx.lineTo(x, y + h / 2 - s * 0.3);
  if (cross) {
    ctx.moveTo(x - w / 2 + s * 0.3, y);
    ctx.lineTo(x + w / 2 - s * 0.3, y);
  }
  ctx.stroke();
  ctx.restore();
  if (opts.colorblind) {
    // Symbol in a small disc so it reads over the etched line.
    ctx.fillStyle = colorOf(opts.theme, color);
    ctx.beginPath();
    ctx.arc(x, y, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    drawSymbol(ctx, x, y, s * 0.3, color, config.background[opts.theme]);
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
