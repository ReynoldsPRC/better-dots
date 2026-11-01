import { describe, expect, it } from 'vitest';
import { applyMove, extendPath, hasMove, isValidPath, parseLevel, type GameState } from '../src/rules';
import { at, cells, game } from './helpers';

const iceAt = (s: GameState, r: number, c: number) => s.layers.ice[at(s, r, c)];

describe('ice', () => {
  it('dots on ice connect like any other', () => {
    const s = game(['000', '111'], { ice: ['.1.', '...'] });
    expect(extendPath(s, [], at(s, 0, 1))).toEqual([at(s, 0, 1)]);
    expect(isValidPath(s, cells(s, [0, 0], [0, 1], [0, 2]))).toBe(true);
  });

  it('never blocks falling: the dot on it falls out and is replaced from above; the ice stays with the cell', () => {
    const s = game(['21', '11', '02', '30', '31', '20'], { ice: ['..', '..', '2.', '..', '..', '..'], colors: [0, 1, 2, 3] });
    const iced = s.cells[at(s, 2, 0)]!.id;
    const top = s.cells[at(s, 0, 0)]!.id;
    const { state, result } = applyMove(s, cells(s, [3, 0], [4, 0]));
    expect(state.cells[at(s, 4, 0)]!.id).toBe(iced);
    expect(state.cells[at(s, 2, 0)]!.id).toBe(top);
    expect(state.cells.every((p) => p !== null)).toBe(true);
    expect(result.spawned).toHaveLength(2);
    // Clears below it aren't clears on it.
    expect(iceAt(state, 2, 0)).toBe(2);
  });

  it('adjacent and diagonal clears do nothing to it', () => {
    const s = game(['000', '010', '222'], { ice: ['...', '.3.', '...'], colors: [0, 2] });
    const { state, result } = applyMove(s, cells(s, [0, 0], [0, 1], [0, 2]));
    expect(iceAt(state, 1, 1)).toBe(3);
    expect(result.events.some((e) => e.kind === 'layers')).toBe(false);
  });

  it('clearing the dot on it is one hit', () => {
    const s = game(['000', '111', '222'], { ice: ['...', '.2.', '...'], colors: [0, 2] });
    const { state, result } = applyMove(s, cells(s, [1, 0], [1, 1], [1, 2]));
    expect(iceAt(state, 1, 1)).toBe(1);
    const ev = result.events.find((e) => e.kind === 'layers');
    expect(ev && ev.kind === 'layers' && ev.cells).toEqual([at(s, 1, 1)]);
  });

  it('breaking it all the way through counts toward the ice goal', () => {
    const s = game(['000', '111', '222'], { ice: ['...', '.1.', '...'], goals: [{ type: 'ice', count: 1 }], colors: [0, 2] });
    const { state } = applyMove(s, cells(s, [1, 0], [1, 1], [1, 2]));
    expect(iceAt(state, 1, 1)).toBe(0);
    expect(state.goals[0].progress).toBe(1);
    expect(state.status).toBe('won');
  });

  it('a loop of the iced dot\'s color clears it and hits the ice, even off the path', () => {
    const s = game(['00', '00', '12', '02'], { ice: ['..', '..', '..', '2.'] });
    const { state, result } = applyMove(s, cells(s, [0, 0], [0, 1], [1, 1], [1, 0], [0, 0]));
    expect(result.steps[0].cells).toContain(at(s, 3, 0));
    expect(iceAt(state, 3, 0)).toBe(1);
  });

  it('an iced dot enclosed by a loop becomes a bomb: one hit', () => {
    const s = game(['000', '010', '000', '121'], { ice: ['...', '.3.', '...', '...'], colors: [1, 2] });
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const { state, result } = applyMove(s, ring);
    expect(result.steps.map((x) => x.kind)).toEqual(['loop', 'blast']);
    expect(iceAt(state, 1, 1)).toBe(2);
  });

  it('each blast source reaching it is a hit, so two bombs in one wave are two hits', () => {
    const s = game(['0000', '0310', '0000', '1212'], { ice: ['....', '.2..', '....', '....'], goals: [{ type: 'ice', count: 1 }], colors: [1, 2] });
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const { state } = applyMove(s, ring);
    expect(iceAt(state, 1, 1)).toBe(0);
    expect(state.goals[0].progress).toBe(1);
  });

  it('a blast clears the dot on it and hits the ice', () => {
    const s = game(['00000', '02010', '00000', '33433'], { ice: ['.....', '...2.', '.....', '.....'], colors: [3, 4] });
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const icedId = s.cells[at(s, 1, 3)]!.id;
    const { state } = applyMove({ ...s, bombRadius: 2 }, ring);
    expect(iceAt(state, 1, 3)).toBe(1);
    expect(state.cells[at(s, 1, 3)]!.id).not.toBe(icedId);
  });

  it('a blast hits ice over a cell with no dot (frozen fire)', () => {
    const s = game(['.000', '2010', '2000', '1212'], { fire: ['x...', '....', '....', '....'], ice: ['1...', '....', '....', '....'] });
    const ring = cells(s, [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 2], [2, 1], [1, 1], [0, 1]);
    const { state } = applyMove({ ...s, bombRadius: 2 }, ring);
    expect(iceAt(state, 0, 0)).toBe(0);
    expect(state.layers.fire[at(s, 0, 0)]).toBe(true);
  });

  it('iced dots count as moves and are shuffled like any other', () => {
    expect(hasMove(game(['00', '12'], { ice: ['11', '..'], colors: [1, 2] }))).toBe(true);
    // A board of nothing but iced random dots still opens with a move.
    for (let seed = 1; seed <= 10; seed++) {
      const s = game(['..', '..'], { ice: ['11', '11'], colors: [1, 2], seed });
      expect(hasMove(s)).toBe(true);
      expect(s.layers.ice).toEqual([1, 1, 1, 1]);
    }
  });

  it('level files: ice grids and ice goals are checked', () => {
    const base = { id: 'testlvl', seed: 1, moves: 5, colors: [0, 1], layout: ['..', '.-'] };
    const goal = (count: number) => [{ type: 'ice', count }];
    expect(parseLevel({ ...base, ice: ['12', '..'], goals: goal(2) }, 'x').ice).toEqual(['12', '..']);
    expect(() => parseLevel({ ...base, ice: ['12', '..'], goals: goal(3) }, 'x')).toThrow(/only has 2/);
    expect(() => parseLevel({ ...base, ice: ['12'], goals: goal(1) }, 'x')).toThrow(/same rows/);
    expect(() => parseLevel({ ...base, ice: ['14', '..'], goals: goal(1) }, 'x')).toThrow(/"4"/);
    expect(() => parseLevel({ ...base, ice: ['..', '.1'], goals: goal(1) }, 'x')).toThrow(/not a cell/);
  });
});
