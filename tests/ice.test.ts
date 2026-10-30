import { describe, expect, it } from 'vitest';
import { applyMove, extendPath, hasMove, isValidPath, parseLevel, type GameState } from '../src/rules';
import { at, cells, colorOf, game } from './helpers';

const iceAt = (s: GameState, r: number, c: number) => s.layers.ice[at(s, r, c)];

describe('ice', () => {
  it('frozen dots cannot be part of a line', () => {
    const s = game(['000', '111'], { ice: ['.1.', '...'] });
    expect(extendPath(s, [], at(s, 0, 1))).toEqual([]);
    expect(extendPath(s, cells(s, [0, 0]), at(s, 0, 1))).toEqual(cells(s, [0, 0]));
    expect(isValidPath(s, cells(s, [0, 0], [0, 1]))).toBe(false);
  });

  it('frozen dots stay put; dots above stack on them; cells below refill from under the ice', () => {
    const s = game(['2', '1', '0', '0', '0'], { ice: ['.', '.', '2', '.', '.'], colors: [0] });
    const frozen = s.cells[at(s, 2, 0)]!.id;
    const { state, result } = applyMove(s, cells(s, [3, 0], [4, 0]));
    expect(state.cells[at(s, 2, 0)]!.id).toBe(frozen);
    expect(state.cells[at(s, 1, 0)]!.id).toBe(s.cells[at(s, 1, 0)]!.id);
    const fall = result.events.find((e) => e.kind === 'fall');
    if (fall?.kind !== 'fall') throw new Error('no fall');
    expect(Object.keys(fall.spawnFrom)).toHaveLength(2);
    for (const row of Object.values(fall.spawnFrom)) expect(row).toBeGreaterThanOrEqual(1);
  });

  it('loses one layer per move when a neighboring cell clears, however many do', () => {
    const s = game(['000', '010', '222'], { ice: ['...', '.3.', '...'], colors: [0, 2] });
    const { state, result } = applyMove(s, cells(s, [0, 0], [0, 1], [0, 2]));
    expect(iceAt(state, 1, 1)).toBe(2);
    const ev = result.events.find((e) => e.kind === 'layers');
    expect(ev && ev.kind === 'layers' && ev.cells).toEqual([at(s, 1, 1)]);
  });

  it('diagonal clears do not crack it', () => {
    const s = game(['00.', '.1.', '...'], { ice: ['...', '..2', '...'], colors: [2, 3] });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1]));
    expect(iceAt(state, 1, 2)).toBe(2);
  });

  it('breaking frees the dot and counts toward the ice goal', () => {
    const s = game(['000', '111', '222'], { ice: ['...', '.1.', '...'], goals: [{ type: 'ice', count: 1 }], colors: [0, 2] });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1], [0, 2]));
    expect(iceAt(state, 1, 1)).toBe(0);
    expect(state.goals[0].progress).toBe(1);
    expect(state.status).toBe('won');
  });

  it('frozen dots of the loop color are not cleared, and frozen dots inside a loop are not bombs', () => {
    const s = game(['0000', '0310', '0000', '1212'], { ice: ['....', '.11.', '....', '....'], colors: [1, 2] });
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const { state, result } = applyMove(s, ring);
    expect(result.steps.map((x) => x.kind)).toEqual(['loop']);
    // The frozen dots stay, each losing one layer.
    expect(iceAt(state, 1, 1)).toBe(0);
    expect(iceAt(state, 1, 2)).toBe(0);
  });

  it('a blast reaching a frozen cell cracks it without clearing its dot', () => {
    const s = game(['00000', '02010', '00000', '33433'], { ice: ['.....', '...2.', '.....', '.....'], colors: [3, 4] });
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const frozenId = s.cells[at(s, 1, 3)]!.id;
    const { state } = applyMove({ ...s, bombRadius: 2 }, ring);
    expect(iceAt(state, 1, 3)).toBe(1);
    expect(state.cells[at(s, 1, 3)]!.id).toBe(frozenId);
  });

  it('frozen dots do not count as moves and stay put in a reshuffle', () => {
    // The frozen 0s can't pair, so the bottom row must; "12" or "21" gets fixed up.
    for (let seed = 1; seed <= 10; seed++) {
      const s = game(['00', '..'], { ice: ['11', '..'], colors: [1, 2], seed });
      expect(hasMove(s)).toBe(true);
      expect(s.layers.ice).toEqual([1, 1, 0, 0]);
      expect([colorOf(s.cells[0]), colorOf(s.cells[1])]).toEqual([0, 0]);
      expect(colorOf(s.cells[2])).toBe(colorOf(s.cells[3]));
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
