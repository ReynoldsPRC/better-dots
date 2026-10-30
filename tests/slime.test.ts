import { describe, expect, it } from 'vitest';
import { applyMove, goalRemaining, parseLevel, type GameState } from '../src/rules';
import { at, cells, game } from './helpers';

const slimed = (s: GameState) => s.layers.slime.flatMap((x, i) => (x ? [i] : []));

describe('slime', () => {
  it('clearing a dot on a slimed cell cleans it', () => {
    const s = game(['001', '212', '121'], { slime: ['x..', '...', '...'], goals: [{ type: 'slime' }] });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1]));
    expect(slimed(state)).toEqual([]);
    expect(state.status).toBe('won');
  });

  it('spreads to one neighboring clean cell when a move cleans none', () => {
    const s = game(['121', '212', '003'], { slime: ['x..', '...', '...'] });
    const { state, result } = applyMove(s, cells(s, [2, 0], [2, 1]));
    const now = slimed(state);
    expect(now).toHaveLength(2);
    expect(now).toContain(at(s, 0, 0));
    expect([at(s, 0, 1), at(s, 1, 0)]).toContain(now.find((i) => i !== at(s, 0, 0)));
    // It happens after the board settles: the last layers event comes after the fall.
    const kinds = result.events.map((e) => e.kind);
    expect(kinds.lastIndexOf('layers')).toBeGreaterThan(kinds.indexOf('fall'));
  });

  it('does not spread on a move that cleaned some', () => {
    const s = game(['001', '212', '121'], { slime: ['x.x', '...', '...'].map((r) => r) });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1]));
    expect(slimed(state)).toEqual([at(s, 0, 2)]);
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
    expect(() => parseLevel({ ...base, goals: [{ type: 'slime' }] }, 'x')).toThrow(/needs some starting/);
  });
});
