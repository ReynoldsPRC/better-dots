import { describe, expect, it } from 'vitest';
import { applyMove, goalRemaining, parseLevel, type GameState } from '../src/rules';
import { at, cells, game } from './helpers';

const slimed = (s: GameState) => s.layers.slime.flatMap((x, i) => (x ? [i] : []));

describe('slime', () => {
  it('two hits clean a cell: each clear of the dot on it is one', () => {
    const s = game(['001', '212', '121'], { slime: ['2..', '...', '...'], goals: [{ type: 'slime' }] });
    const once = applyMove(s, cells(s, [0, 0], [0, 1])).state;
    expect(once.layers.slime[at(s, 0, 0)]).toBe(1);
    expect(goalRemaining(once, once.goals[0])).toBe(1);
    // A cell with one hit left is cleaned by one more.
    const t = game(['001', '212', '121'], { slime: ['1..', '...', '...'], goals: [{ type: 'slime' }] });
    const done = applyMove(t, cells(t, [0, 0], [0, 1])).state;
    expect(slimed(done)).toEqual([]);
    expect(done.status).toBe('won');
  });

  it('"x" in a level file means two hits', () => {
    const s = game(['001', '212', '121'], { slime: ['x..', '...', '...'] });
    expect(s.layers.slime[0]).toBe(2);
  });

  it('adjacent clears do nothing to it', () => {
    const s = game(['100', '212', '121'], { slime: ['x..', '...', '...'] });
    const { state } = applyMove(s, cells(s, [0, 1], [0, 2]));
    expect(state.layers.slime[0]).toBe(2);
  });

  it('each blast source reaching it is a hit', () => {
    const s = game(['000', '010', '000', '121'], { slime: ['...', '.x.', '...', '...'], colors: [1, 2] });
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const { state } = applyMove(s, ring);
    expect(state.layers.slime[at(s, 1, 1)]).toBe(1);
  });

  it('a hit on an iced slimed cell goes to the ice', () => {
    const s = game(['001', '212', '121'], { slime: ['x..', '...', '...'], ice: ['1..', '...', '...'] });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1]));
    expect(state.layers.ice[0]).toBe(0);
    expect(state.layers.slime[0]).toBe(2);
  });

  it('a region that took no hit spreads to one neighboring cell, at full thickness, after the board settles', () => {
    const s = game(['121', '212', '003'], { slime: ['1..', '...', '...'] });
    const { state, result } = applyMove(s, cells(s, [2, 0], [2, 1]));
    const now = slimed(state);
    expect(now).toHaveLength(2);
    expect(now).toContain(at(s, 0, 0));
    const grown = now.find((i) => i !== at(s, 0, 0))!;
    expect([at(s, 0, 1), at(s, 1, 0)]).toContain(grown);
    expect(state.layers.slime[grown]).toBe(2);
    const kinds = result.events.map((e) => e.kind);
    expect(kinds.lastIndexOf('layers')).toBeGreaterThan(kinds.indexOf('fall'));
  });

  it('only regions that took a hit hold still; each other region spreads by one', () => {
    // Two regions: {(0,0)} is hit; {(0,2)} is not. And a two-cell region in the bottom row grows by one cell, not two.
    const s = game(['001', '212', '121'], { slime: ['x.x', '...', 'xx.'] });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1]));
    const now = slimed(state);
    expect(now).toContain(at(s, 0, 2));
    expect(now.filter((i) => [at(s, 0, 1), at(s, 1, 2)].includes(i))).toHaveLength(1);
    expect(now.filter((i) => [at(s, 1, 0), at(s, 1, 1), at(s, 2, 2)].includes(i))).toHaveLength(1);
    expect(now).toHaveLength(6);
  });

  it('spreads onto cells holding pieces, but not onto water or ice', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = game(['1.2', '212', '303'], {
        slime: ['x..', '...', '...'], water: ['...', 'x..', '...'], pieces: [{ r: 0, c: 1, type: 'anchor' }], seed,
      }, seed);
      // The only eligible neighbor of (0,0) is the anchor's cell; (1,0) is watered.
      const { state } = applyMove(s, cells(s, [0, 2], [1, 2]));
      expect(slimed(state)).toEqual([at(s, 0, 0), at(s, 0, 1)]);
    }
  });

  it('slime under ice is dormant: it neither spreads nor gets cleaned until the ice breaks', () => {
    const s = game(['121', '212', '003'], { slime: ['x..', '...', '...'], ice: ['2..', '...', '...'] });
    const { state } = applyMove(s, cells(s, [2, 0], [2, 1]));
    expect(slimed(state)).toEqual([at(s, 0, 0)]);
  });

  it('dormant slime still counts toward the goal', () => {
    const s = game(['121', '212', '003'], { slime: ['x..', '...', '...'], ice: ['2..', '...', '...'], goals: [{ type: 'slime' }] });
    expect(goalRemaining(s, s.goals[0])).toBe(1);
  });

  it('spreading is seeded', () => {
    const level = { slime: ['.x.', '...', '...'] };
    const a = applyMove(game(['121', '212', '003'], level, 9), [6, 7]).state;
    const b = applyMove(game(['121', '212', '003'], level, 9), [6, 7]).state;
    expect(slimed(a)).toEqual(slimed(b));
  });

  it('level files: slime grids and slime goals are checked', () => {
    const base = { id: 'testlvl', seed: 1, moves: 5, colors: [0, 1], layout: ['..', '..'] };
    expect(parseLevel({ ...base, slime: ['x.', '..'], goals: [{ type: 'slime' }] }, 'x').slime).toEqual(['x.', '..']);
    expect(parseLevel({ ...base, slime: ['12', '..'], goals: [{ type: 'slime' }] }, 'x').slime).toEqual(['12', '..']);
    expect(() => parseLevel({ ...base, slime: ['3.', '..'], goals: [{ type: 'slime' }] }, 'x')).toThrow(/"3"/);
    expect(() => parseLevel({ ...base, goals: [{ type: 'slime' }] }, 'x')).toThrow(/needs some starting/);
  });
});
