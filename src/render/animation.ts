// Turns one move's result into a timeline: clear stages pop in sequence,
// then everything falls, then (if the board was stuck) dots swap places.
import { config } from '../config';
import type { ClearKind, ColorId, GameState, MoveResult, Piece } from '../rules';
import { ease } from './easing';

export interface SpriteFrame {
  id: number;
  color: ColorId;
  r: number;
  c: number;
  scale: number;
}

export interface Frame {
  sprites: SpriteFrame[];
  /** Board-wide loop pulse. */
  pulse: { color: ColorId; alpha: number } | null;
  /** Expanding rings where bombs go off; progress runs 0..1. */
  blasts: { r: number; c: number; progress: number }[];
  done: boolean;
}

interface Sprite {
  id: number;
  color: ColorId;
  from: [number, number];
  mid: [number, number] | null;
  to: [number, number] | null;
  popAt: number | null;
  fallMs: number;
}

export class MoveAnimation {
  private readonly sprites: Sprite[] = [];
  private readonly stages: { at: number; kind: ClearKind; color: ColorId; sources: [number, number][] }[] = [];
  private readonly fallStart: number;
  private readonly shuffleStart: number | null;
  readonly end: number;

  constructor(prev: GameState, result: MoveResult, next: GameState, readonly start: number) {
    const rc = (i: number): [number, number] => [Math.floor(i / prev.cols), i % prev.cols];
    const { stepMs } = config.cascade;
    const { popMs, loopPulseMs } = config.clear;

    const popAt = new Map<number, number>();
    let clearEnd = 0;
    result.steps.forEach((step, k) => {
      const at = k * stepMs;
      for (const i of step.cells) {
        const p = prev.cells[i];
        if (p) popAt.set(p.id, at);
      }
      this.stages.push({ at, kind: step.kind, color: result.color, sources: step.sources.map(rc) });
      const tail = step.kind === 'bomb' ? config.bomb.explodeMs : step.kind === 'loop' ? loopPulseMs : popMs;
      clearEnd = Math.max(clearEnd, at + Math.max(popMs, tail));
    });
    this.fallStart = clearEnd;

    const where = (cells: readonly (Piece | null)[]) => {
      const m = new Map<number, number>();
      cells.forEach((p, i) => p && m.set(p.id, i));
      return m;
    };
    const midAt = where(result.settled);
    const endAt = where(next.cells);

    // New dots start stacked just above the board, keeping their spacing.
    const spawnOffset = new Map<number, number>();
    const spawned = new Set(result.spawned);
    for (let c = 0; c < prev.cols; c++) {
      let lowest = -1;
      for (let r = 0; r < prev.rows; r++) {
        const p = result.settled[r * prev.cols + c];
        if (p && spawned.has(p.id)) lowest = r;
      }
      spawnOffset.set(c, lowest + 1);
    }

    const { speed, minMs, settleMs } = config.fall;
    let fallEnd = this.fallStart;
    const fallMs = (from: number, to: number) => {
      const d = to - from;
      return d <= 0 ? 0 : Math.max(minMs, (1000 * d) / speed);
    };

    prev.cells.forEach((p, i) => {
      if (!p) return;
      const mi = midAt.get(p.id);
      const from = rc(i);
      const mid = mi === undefined ? null : rc(mi);
      const ms = mid ? fallMs(from[0], mid[0]) : 0;
      if (ms > 0) fallEnd = Math.max(fallEnd, this.fallStart + ms + settleMs);
      this.sprites.push({ id: p.id, color: p.color, from, mid, to: mid && rcOrNull(endAt.get(p.id)), popAt: popAt.get(p.id) ?? null, fallMs: ms });
    });
    for (const id of result.spawned) {
      const mi = midAt.get(id)!;
      const p = result.settled[mi]!;
      const mid = rc(mi);
      const from: [number, number] = [mid[0] - spawnOffset.get(mid[1])!, mid[1]];
      const ms = fallMs(from[0], mid[0]);
      fallEnd = Math.max(fallEnd, this.fallStart + ms + settleMs);
      this.sprites.push({ id, color: p.color, from, mid, to: rcOrNull(endAt.get(id)), popAt: null, fallMs: ms });
    }

    function rcOrNull(i: number | undefined): [number, number] | null {
      return i === undefined ? null : rc(i);
    }

    this.shuffleStart = result.shuffled ? fallEnd + config.shuffle.delayMs : null;
    this.end = start + (this.shuffleStart === null ? fallEnd : this.shuffleStart + config.shuffle.moveMs);
  }

  frame(now: number): Frame {
    const t = now - this.start;
    const { popMs, loopPulseMs, loopPulseAlpha } = config.clear;
    const { settleMs, settleBounce, easing } = config.fall;
    const sprites: SpriteFrame[] = [];

    for (const s of this.sprites) {
      if (s.popAt !== null) {
        if (t < s.popAt) {
          sprites.push({ id: s.id, color: s.color, r: s.from[0], c: s.from[1], scale: 1 });
        } else if (t < s.popAt + popMs) {
          const p = (t - s.popAt) / popMs;
          // A quick swell, then shrink away.
          const scale = p < 0.25 ? 1 + 0.6 * p : (1.15 * (1 - p)) / 0.75;
          sprites.push({ id: s.id, color: s.color, r: s.from[0], c: s.from[1], scale });
        }
        continue;
      }
      const mid = s.mid!;
      let r = s.from[0];
      let c = s.from[1];
      const ft = t - this.fallStart;
      if (ft >= 0) {
        if (s.fallMs > 0 && ft < s.fallMs) {
          r = s.from[0] + (mid[0] - s.from[0]) * ease(easing, ft / s.fallMs);
        } else {
          r = mid[0];
          c = mid[1];
          const st = ft - s.fallMs;
          if (s.fallMs > 0 && st < settleMs) r -= settleBounce * Math.sin(Math.PI * (st / settleMs));
        }
      }
      if (this.shuffleStart !== null && t >= this.shuffleStart && s.to) {
        const p = ease('easeInOutQuad', (t - this.shuffleStart) / config.shuffle.moveMs);
        r = mid[0] + (s.to[0] - mid[0]) * p;
        c = mid[1] + (s.to[1] - mid[1]) * p;
      }
      sprites.push({ id: s.id, color: s.color, r, c, scale: 1 });
    }

    let pulse: Frame['pulse'] = null;
    const blasts: Frame['blasts'] = [];
    for (const st of this.stages) {
      const lt = t - st.at;
      if (lt < 0) continue;
      if (st.kind === 'loop' && lt < loopPulseMs) {
        pulse = { color: st.color, alpha: loopPulseAlpha * (1 - lt / loopPulseMs) };
      }
      if (st.kind === 'bomb' && lt < config.bomb.explodeMs) {
        for (const [r, c] of st.sources) blasts.push({ r, c, progress: lt / config.bomb.explodeMs });
      }
    }

    return { sprites, pulse, blasts, done: now >= this.end };
  }
}
