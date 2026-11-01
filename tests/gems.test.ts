import { describe, expect, it } from 'vitest';
import { applyMove, extendPath, parseLevel, type GameState, type GemShape, type ColorId } from '../src/rules';
import { at, cells, game } from './helpers';

const gem = (r: number, c: number, color: ColorId, shape: GemShape) => ({ r, c, type: 'gem' as const, color, shape });
const square = (s: GameState) => cells(s, [0, 0], [0, 1], [1, 1], [1, 0], [0, 0]);

describe('gems', () => {
  it('are not connectable', () => {
    const s = game(['00.', '00.', '121'], { pieces: [gem(0, 2, 0, 'column')] });
    expect(extendPath(s, [], at(s, 0, 2))).toEqual([]);
    expect(extendPath(s, cells(s, [0, 1]), at(s, 0, 2))).toEqual(cells(s, [0, 1]));
  });

  it('a loop of its color sets it off: a column gem clears its column', () => {
    const s = game(['0011', '0022', '1213', '2121'], { pieces: [gem(1, 2, 0, 'column')] });
    const { state, result } = applyMove(s, square(s));
    const blast = result.steps.find((x) => x.kind === 'blast')!;
    expect(blast.sources).toEqual([{ cell: at(s, 1, 2), type: 'column', color: 0 }]);
    expect(blast.cells).toEqual(cells(s, [0, 2], [1, 2], [2, 2], [3, 2]));
    expect(state.cells.some((p) => p?.kind === 'gem')).toBe(false);
  });

  it('a cross gem clears its row and column', () => {
    const s = game(['0011', '0022', '1213', '2121'], { pieces: [gem(2, 2, 0, 'cross')] });
    const { result } = applyMove(s, square(s));
    const blast = result.steps.find((x) => x.kind === 'blast')!;
    // Row 2 and column 2 (the square's cells in them are already gone).
    expect(blast.cells).toEqual(cells(s, [0, 2], [1, 2], [2, 0], [2, 1], [2, 2], [2, 3], [3, 2]));
  });

  it('a loop of another color leaves it alone', () => {
    const s = game(['0011', '0022', '1213', '2121'], { pieces: [gem(1, 2, 1, 'column')] });
    const { result } = applyMove(s, square(s));
    expect(result.steps.map((x) => x.kind)).toEqual(['loop']);
  });

  it('a beam that reaches another gem sets it off in the next wave', () => {
    const s = game(['0011', '0022', '1213', '2121'], { pieces: [gem(0, 2, 0, 'column'), gem(3, 2, 1, 'cross')] });
    const { state, result } = applyMove(s, square(s));
    const waves = result.steps.filter((x) => x.kind === 'blast');
    expect(waves.map((w) => w.sources.map((x) => x.type))).toEqual([['column'], ['cross']]);
    // The second wave clears row 3.
    expect(waves[1].cells).toEqual(cells(s, [3, 0], [3, 1], [3, 3]));
    expect(state.goals).toEqual([]);
  });

  it('a bomb that reaches a gem sets it off', () => {
    const s = game(['000.', '010.', '000.', '2123'], { pieces: [gem(1, 3, 2, 'column')], colors: [2, 3] });
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const { result } = applyMove({ ...s, bombRadius: 2 }, ring);
    const waves = result.steps.filter((x) => x.kind === 'blast');
    expect(waves.map((w) => w.sources.map((x) => x.type))).toEqual([['bomb'], ['column']]);
  });

  it('each gem goes off once, and counts toward the gem goal', () => {
    const s = game(['0011', '0022', '1213', '2121'], {
      pieces: [gem(0, 2, 0, 'cross'), gem(1, 2, 0, 'cross')], goals: [{ type: 'gems', count: 2 }],
    });
    const { state, result } = applyMove(s, square(s));
    const fired = result.steps.flatMap((x) => x.sources).length;
    expect(fired).toBe(2);
    expect(state.goals[0].progress).toBe(2);
    expect(state.status).toBe('won');
  });

  it('frozen gems are protected; a trigger hits their ice instead', () => {
    const s = game(['0011', '0022', '1213', '2121'], { pieces: [gem(3, 3, 0, 'column')], ice: ['....', '....', '....', '...2'] });
    const { state, result } = applyMove(s, square(s));
    expect(result.steps.map((x) => x.kind)).toEqual(['loop']);
    expect(state.layers.ice[at(s, 3, 3)]).toBe(1);
    expect(state.cells[at(s, 3, 3)]?.kind).toBe('gem');
  });

  it('gems fall with gravity', () => {
    const s = game(['.2', '11', '22'], { pieces: [gem(0, 0, 0, 'column')], colors: [0, 1, 2] });
    const { state } = applyMove(s, cells(s, [1, 0], [1, 1]));
    expect(state.cells[at(s, 1, 0)]?.kind).toBe('gem');
  });

  it('level files: gems and gem goals are checked', () => {
    const base = { id: 'testlvl', seed: 1, moves: 5, colors: [0, 1], layout: ['..', '..'] };
    const ok = parseLevel({ ...base, pieces: [gem(0, 0, 1, 'cross')], goals: [{ type: 'gems', count: 1 }] }, 'x');
    expect(ok.pieces).toEqual([gem(0, 0, 1, 'cross')]);
    expect(() => parseLevel({ ...base, pieces: [gem(0, 0, 3, 'cross')], goals: [{ type: 'gems', count: 1 }] }, 'x')).toThrow(/gem color/);
    expect(() => parseLevel({ ...base, pieces: [{ ...gem(0, 0, 1, 'cross'), shape: 'star' }], goals: [{ type: 'gems', count: 1 }] }, 'x')).toThrow(/shape/);
    expect(() => parseLevel({ ...base, pieces: [gem(0, 0, 1, 'cross')], goals: [{ type: 'gems', count: 2 }] }, 'x')).toThrow(/only has 1/);
  });
});
