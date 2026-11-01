import { describe, expect, it } from 'vitest';
import { applyMove, goalRemaining, parseLevel, type GameState } from '../src/rules';
import { at, cells, game } from './helpers';

const wet = (s: GameState) =>
  Array.from({ length: s.rows }, (_, r) =>
    Array.from({ length: s.cols }, (_, c) => (s.layers.water[at(s, r, c)] ? 'x' : '.')).join(''),
  );

describe('water', () => {
  it('a line touching water floods its whole length', () => {
    const s = game(['x000', '1212', '2121'].map((r) => r.replace('x', '1')), { water: ['x...', '....', '....'] });
    const { state } = applyMove(s, cells(s, [0, 1], [0, 2], [0, 3]));
    expect(wet(state)).toEqual(['xxxx', '....', '....']);
  });

  it('a line that does not touch water stays dry', () => {
    const s = game(['1000', '2121', '1212'], { water: ['x...', '....', '....'] });
    const { state } = applyMove(s, cells(s, [0, 2], [0, 3]));
    expect(wet(state)).toEqual(['x...', '....', '....']);
  });

  it('diagonal contact does not count', () => {
    const s = game(['1212', '2001', '1212'], { water: ['x...', '....', '....'] });
    const { state } = applyMove(s, cells(s, [1, 1], [1, 2]));
    expect(wet(state)).toEqual(['x...', '....', '....']);
  });

  it('every way of clearing counts, so a loop floods the cleared cells connected to water', () => {
    const s = game(['0012', '0021', '1212', '0201'], { water: ['....', '....', '....', 'x...'] });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1], [1, 1], [1, 0], [0, 0]));
    // The loop also clears (3,0); it touches the starting water. The square's cells aren't connected to it.
    expect(wet(state)[3][0]).toBe('x');
    expect(wet(state)[0]).toBe('....');
  });

  it('the flood goal counts dry cells left', () => {
    const s = game(['00', '11'], { water: ['x.', '..'], goals: [{ type: 'flood' }] });
    expect(goalRemaining(s, s.goals[0])).toBe(3);
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1]));
    expect(goalRemaining(state, state.goals[0])).toBe(2);
  });

  it('flooding every cell wins', () => {
    const s = game(['00', '00'], { water: ['x.', '..'], goals: [{ type: 'flood' }] });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1], [1, 1], [1, 0], [0, 0]));
    expect(state.status).toBe('won');
  });

  it('water under ice is dormant until the ice breaks', () => {
    const s = game(['1000', '2121', '1212'], { water: ['x...', '....', '....'], ice: ['2...', '....', '....'] });
    const first = applyMove(s, cells(s, [0, 1], [0, 2], [0, 3])).state;
    expect(first.layers.ice[0]).toBe(2);
    expect(wet(first)).toEqual(['x...', '....', '....']);
  });

  it('does not flood an iced cell, even when its dot clears', () => {
    const s = game(['1000', '2121', '1212'], { water: ['x...', '....', '....'], ice: ['.2..', '....', '....'] });
    const { state } = applyMove(s, cells(s, [0, 1], [0, 2], [0, 3]));
    expect(state.layers.ice[1]).toBe(1);
    expect(wet(state)).toEqual(['x...', '....', '....']);
  });

  it('once the ice breaks, that water spreads like any other', () => {
    const s = game(['1100', '2233', '1212'], { water: ['x...', '....', '....'], ice: ['1...', '....', '....'] });
    const broke = applyMove(s, cells(s, [0, 0], [0, 1])).state;
    expect(broke.layers.ice[0]).toBe(0);
    // The breaking move itself didn't flood: the water was still under ice while that line cleared.
    expect(wet(broke)[0]).toBe('x...');
    // Next move, a line touching it floods.
    const next = applyMove(broke, cells(broke, [1, 0], [1, 1])).state;
    expect(wet(next)[1]).toBe('xx..');
  });

  it('level files: water grids and flood goals are checked', () => {
    const base = { id: 'testlvl', seed: 1, moves: 5, colors: [0, 1], layout: ['..', '..'] };
    expect(parseLevel({ ...base, water: ['x.', '..'], goals: [{ type: 'flood' }] }, 'x').water).toEqual(['x.', '..']);
    expect(() => parseLevel({ ...base, goals: [{ type: 'flood' }] }, 'x')).toThrow(/needs some starting/);
    expect(() => parseLevel({ ...base, water: ['w.', '..'], goals: [{ type: 'flood' }] }, 'x')).toThrow(/"w"/);
  });
});
