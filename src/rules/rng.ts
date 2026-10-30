// Seeded RNG (mulberry32). The whole generator state is one 32-bit integer,
// so it can live inside plain rule state, be saved, and be replayed exactly.

export type RngState = number;

export function seedRng(seed: number | string): RngState {
  if (typeof seed === 'number') return seed >>> 0;
  // FNV-1a hash so string seeds ("level-3") work too.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Returns a float in [0, 1) and the next state. Pure. */
export function nextFloat(state: RngState): [number, RngState] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Returns an integer in [0, n) and the next state. Pure. */
export function nextInt(state: RngState, n: number): [number, RngState] {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError(`nextInt: n must be a positive integer, got ${n}`);
  const [f, s] = nextFloat(state);
  return [Math.floor(f * n), s];
}

/**
 * Mutable convenience wrapper for code that draws many numbers in a row
 * (refills, shuffles). Read `.state` back out to store it in rule state.
 */
export class Rng {
  constructor(public state: RngState) {}

  float(): number {
    const [v, s] = nextFloat(this.state);
    this.state = s;
    return v;
  }

  int(n: number): number {
    const [v, s] = nextInt(this.state, n);
    this.state = s;
    return v;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick: empty array');
    return items[this.int(items.length)];
  }

  /** Fisher–Yates; returns a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
