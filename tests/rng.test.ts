import { describe, expect, it } from 'vitest';
import { Rng, nextFloat, nextInt, seedRng } from '../src/rules';

describe('seeded rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(seedRng(42));
    const b = new Rng(seedRng(42));
    const seqA = Array.from({ length: 50 }, () => a.float());
    const seqB = Array.from({ length: 50 }, () => b.float());
    expect(seqA).toEqual(seqB);
  });

  it('differs for different seeds', () => {
    const a = new Rng(seedRng(1));
    const b = new Rng(seedRng(2));
    expect(a.float()).not.toEqual(b.float());
  });

  it('hashes string seeds deterministically', () => {
    expect(seedRng('level-3')).toBe(seedRng('level-3'));
    expect(seedRng('level-3')).not.toBe(seedRng('level-4'));
  });

  it('can resume from a saved state', () => {
    const a = new Rng(seedRng(7));
    a.float();
    a.float();
    const resumed = new Rng(a.state);
    expect(resumed.float()).toBe(a.float());
  });

  it('pure functions match the wrapper', () => {
    const s0 = seedRng(99);
    const [v1, s1] = nextFloat(s0);
    const [v2] = nextInt(s1, 10);
    const r = new Rng(s0);
    expect(r.float()).toBe(v1);
    expect(r.int(10)).toBe(v2);
  });

  it('produces floats in [0,1) and ints in range', () => {
    const r = new Rng(seedRng(123));
    for (let i = 0; i < 10_000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(5);
      expect(Number.isInteger(n) && n >= 0 && n < 5).toBe(true);
    }
  });

  it('is roughly uniform', () => {
    const r = new Rng(seedRng(5));
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 50_000; i++) counts[r.int(5)]++;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(500);
  });

  it('rejects bad int ranges', () => {
    expect(() => nextInt(1, 0)).toThrow(RangeError);
    expect(() => nextInt(1, 2.5)).toThrow(RangeError);
  });

  it('shuffle is a deterministic permutation', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = new Rng(seedRng(3)).shuffle(items);
    const b = new Rng(seedRng(3)).shuffle(items);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
