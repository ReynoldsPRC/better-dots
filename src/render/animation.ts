// Replays a move's events as a timeline: clear stages pop in sequence, then
// falls, sinks, and (if the board was stuck) a reshuffle. Each event lasts a
// set time; the board snapshot each event carries says where pieces end up.
import { config } from '../config';
import type { BlastType, Cells, ColorId, GameState, Layers, MoveEvent, MoveResult, Piece } from '../rules';
import { ease } from './easing';

export interface SpriteFrame {
  id: number;
  piece: Piece;
  r: number;
  c: number;
  scale: number;
  alpha: number;
}

export interface Frame {
  sprites: SpriteFrame[];
  /** Board-wide loop pulse. */
  pulse: { color: ColorId; alpha: number } | null;
  /** Expanding rings where bombs go off; progress runs 0..1. */
  blasts: { r: number; c: number; type: BlastType; progress: number }[];
  /** Cell layers as of this moment. */
  layers: Layers;
  /** Cells whose layers just changed, with 0..1 progress, for a brief flash. */
  changed: { cell: number; progress: number }[];
  done: boolean;
}

interface Segment {
  start: number;
  dur: number;
  event: MoveEvent;
  before: Cells;
  /** Per piece id: fall duration (fall events only). */
  fallMs?: Map<number, number>;
}

type Pos = [number, number];

function positions(cells: Cells, cols: number): Map<number, Pos> {
  const m = new Map<number, Pos>();
  cells.forEach((p, i) => p && m.set(p.id, [Math.floor(i / cols), i % cols]));
  return m;
}

export class MoveAnimation {
  private readonly segments: Segment[] = [];
  private readonly cols: number;
  private readonly color: ColorId;
  private readonly startLayers: Layers;
  readonly end: number;

  constructor(prev: GameState, result: MoveResult, _next: GameState, readonly start: number) {
    this.cols = prev.cols;
    this.startLayers = prev.layers;
    this.color = result.color;
    const { popMs } = config.clear;
    const { speed, minMs, settleMs } = config.fall;
    let t = 0;
    let before = prev.cells;
    for (const event of result.events) {
      const seg: Segment = { start: t, dur: 0, event, before };
      switch (event.kind) {
        case 'clear':
          seg.dur = Math.max(config.cascade.stepMs, popMs, event.step.kind === 'blast' ? config.bomb.explodeMs : 0);
          break;
        case 'fall': {
          const from = positions(before, this.cols);
          seg.fallMs = new Map();
          let longest = 0;
          event.board.forEach((p, i) => {
            if (!p) return;
            const toRow = Math.floor(i / this.cols);
            const fromRow = from.get(p.id)?.[0] ?? event.spawnFrom[p.id] ?? toRow;
            const d = toRow - fromRow;
            const ms = d <= 0 ? 0 : Math.max(minMs, (1000 * d) / speed);
            seg.fallMs!.set(p.id, ms);
            longest = Math.max(longest, ms);
          });
          seg.dur = longest > 0 ? longest + settleMs : 0;
          break;
        }
        case 'sink':
          seg.dur = config.anchor.sinkMs;
          break;
        case 'layers':
          seg.dur = config.ice.crackMs;
          break;
        case 'shuffle':
          seg.dur = config.shuffle.delayMs + config.shuffle.moveMs;
          break;
      }
      this.segments.push(seg);
      t += seg.dur;
      before = event.board;
    }
    this.end = start + t;
  }

  frame(now: number): Frame {
    const t = now - this.start;
    const done = now >= this.end;
    const seg = this.segments.find((s) => t < s.start + s.dur) ?? null;
    const sprites = seg && !done ? this.spritesFor(seg, t - seg.start) : this.still(this.segments.at(-1)?.event.board ?? []);

    let pulse: Frame['pulse'] = null;
    const blasts: Frame['blasts'] = [];
    let layers = this.startLayers;
    const changed: Frame['changed'] = [];
    for (const s of this.segments) {
      if (s.event.kind === 'layers' && t >= s.start) {
        layers = s.event.layers;
        const p = (t - s.start) / s.dur;
        if (p < 1) for (const cell of s.event.cells) changed.push({ cell, progress: p });
      }
      if (s.event.kind !== 'clear') continue;
      const lt = t - s.start;
      if (lt < 0) continue;
      const step = s.event.step;
      if (step.kind === 'loop' && lt < config.clear.loopPulseMs) {
        pulse = { color: this.color, alpha: config.clear.loopPulseAlpha * (1 - lt / config.clear.loopPulseMs) };
      }
      if (step.kind === 'blast' && lt < config.bomb.explodeMs) {
        for (const src of step.sources) {
          blasts.push({ r: Math.floor(src.cell / this.cols), c: src.cell % this.cols, type: src.type, progress: lt / config.bomb.explodeMs });
        }
      }
    }
    return { sprites, pulse, blasts, layers, changed, done };
  }

  private still(cells: Cells): SpriteFrame[] {
    return cells.flatMap((p, i) =>
      p ? [{ id: p.id, piece: p, r: Math.floor(i / this.cols), c: i % this.cols, scale: 1, alpha: 1 }] : [],
    );
  }

  private spritesFor(seg: Segment, lt: number): SpriteFrame[] {
    const { event, before } = seg;
    const cols = this.cols;
    switch (event.kind) {
      case 'clear': {
        // Pieces gone after this stage pop; the rest stay put (and show their new state).
        const after = positions(event.board, cols);
        const p = Math.min(1, lt / config.clear.popMs);
        const scale = p < 0.25 ? 1 + 0.6 * p : (1.15 * (1 - p)) / 0.75;
        const out = this.still(event.board);
        before.forEach((piece, i) => {
          if (piece && !after.has(piece.id) && scale > 0) {
            out.push({ id: piece.id, piece, r: Math.floor(i / cols), c: i % cols, scale, alpha: 1 });
          }
        });
        return out;
      }
      case 'fall': {
        const from = positions(before, cols);
        const { settleMs, settleBounce, easing } = config.fall;
        return event.board.flatMap((piece, i) => {
          if (!piece) return [];
          const toR = Math.floor(i / cols);
          const c = i % cols;
          const fromR = from.get(piece.id)?.[0] ?? event.spawnFrom[piece.id] ?? toR;
          const ms = seg.fallMs!.get(piece.id) ?? 0;
          let r = toR;
          if (ms > 0 && lt < ms) r = fromR + (toR - fromR) * ease(easing, lt / ms);
          else if (ms > 0 && lt - ms < settleMs) r = toR - settleBounce * Math.sin(Math.PI * ((lt - ms) / settleMs));
          return [{ id: piece.id, piece, r, c, scale: 1, alpha: 1 }];
        });
      }
      case 'sink': {
        const p = ease('easeInQuad', lt / config.anchor.sinkMs);
        const out = this.still(event.board);
        for (const i of event.cells) {
          const piece = before[i];
          if (piece) out.push({ id: piece.id, piece, r: Math.floor(i / cols) + 0.6 * p, c: i % cols, scale: 1 - 0.3 * p, alpha: 1 - p });
        }
        return out;
      }
      case 'layers':
        return this.still(event.board);
      case 'shuffle': {
        const from = positions(before, cols);
        const p = ease('easeInOutQuad', (lt - config.shuffle.delayMs) / config.shuffle.moveMs);
        return event.board.flatMap((piece, i) => {
          if (!piece) return [];
          const [r0, c0] = from.get(piece.id) ?? [Math.floor(i / cols), i % cols];
          const r1 = Math.floor(i / cols);
          const c1 = i % cols;
          return [{ id: piece.id, piece, r: r0 + (r1 - r0) * p, c: c0 + (c1 - c0) * p, scale: 1, alpha: 1 }];
        });
      }
    }
  }
}
