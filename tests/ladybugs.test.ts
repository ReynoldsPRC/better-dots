import { describe, expect, it } from 'vitest';
import { applyMove, extendPath, parseLevel, type ColorId, type GameState } from '../src/rules';
import { at, cells, game } from './helpers';

const bug = (r: number, c: number, color: ColorId, spots?: number) =>
  ({ r, c, type: 'ladybug' as const, color, ...(spots ? { spots } : {}) });
const findBug = (s: GameState) => {
  const i = s.cells.findIndex((p) => p?.kind === 'ladybug');
  return i < 0 ? null : { i, p: s.cells[i] as Extract<NonNullable<GameState['cells'][number]>, { kind: 'ladybug' }> };
};

describe('ladybugs', () => {
  it('connect like a dot of their color', () => {
    const s = game(['000', '121', '212'], { pieces: [bug(0, 1, 0)] });
    expect(extendPath(s, cells(s, [0, 0]), at(s, 0, 1))).toEqual(cells(s, [0, 0], [0, 1]));
  });

  it('cleared with spots left: lose a spot, change color, and fly to a dot elsewhere', () => {
    const s = game(['000', '121', '212'], { pieces: [bug(0, 1, 0)], colors: [0, 1, 2] });
    const id = findBug(s)!.p.id;
    const { state, result } = applyMove(s, cells(s, [0, 0], [0, 1], [0, 2]));
    const b = findBug(state)!;
    expect(b.p.id).toBe(id);
    expect(b.p.spots).toBe(2);
    expect(b.p.color).not.toBe(0);
    const fly = result.events.find((e) => e.kind === 'fly');
    expect(fly?.kind === 'fly' && fly.moves[0].from).toBe(at(s, 0, 1));
    // Only the two dots left the board; the ladybug stayed.
    expect(result.steps[0].cells).toEqual(cells(s, [0, 0], [0, 2]));
  });

  it('removed on its last spot, counting toward the ladybug goal', () => {
    const s = game(['000', '121', '212'], { pieces: [bug(0, 1, 0, 1)], goals: [{ type: 'ladybugs', count: 1 }] });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1], [0, 2]));
    expect(findBug(state)).toBeNull();
    expect(state.status).toBe('won');
  });

  it('a loop around it makes it a bomb, removed whatever its spots', () => {
    const s = game(['0000', '0120', '0000', '1212'], { pieces: [bug(1, 1, 1, 3)], colors: [1, 2], goals: [{ type: 'ladybugs', count: 1 }] });
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const { state, result } = applyMove(s, ring);
    const blast = result.steps.find((x) => x.kind === 'blast')!;
    expect(blast.sources.map((x) => x.cell)).toContain(at(s, 1, 1));
    expect(state.goals[0].progress).toBe(1);
  });

  it('a bomb or beam counts as a clear: one spot lost', () => {
    const s = game(['00000', '01022', '00002', '12121'], { pieces: [bug(1, 3, 2, 3)], colors: [1, 2] });
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const { state } = applyMove({ ...s, bombRadius: 2 }, ring);
    expect(findBug(state)!.p.spots).toBe(2);
  });

  it('loses at most one spot per move', () => {
    // The loop hits it, then the gem the loop sets off beams down its column and reaches it again.
    const s = game(['0000', '0011', '2121'], {
      pieces: [bug(0, 1, 0, 3), { r: 2, c: 1, type: 'gem', color: 0, shape: 'column' }], colors: [0, 1, 2],
    });
    const { state, result } = applyMove(s, cells(s, [0, 0], [0, 1], [1, 1], [1, 0], [0, 0]));
    const beam = result.steps.find((x) => x.kind === 'blast')!;
    expect(beam.sources[0].type).toBe('column');
    expect(findBug(state)!.p.spots).toBe(2);
  });

  it('each ladybug flies once, even if it lands on a cell checked later', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = game(['000', '121', '212'], { pieces: [bug(0, 1, 0)], colors: [0, 1, 2] }, seed);
      const fly = applyMove(s, cells(s, [0, 0], [0, 1], [0, 2])).result.events.find((e) => e.kind === 'fly');
      expect(fly?.kind === 'fly' && fly.moves.length).toBe(1);
    }
  });

  it('flights are seeded: same seed, same landing cell', () => {
    const level = { pieces: [bug(0, 1, 0)], colors: [0, 1, 2] as ColorId[] };
    const a = game(['000', '121', '212'], level, 5);
    const b = game(['000', '121', '212'], level, 5);
    const pa = applyMove(a, cells(a, [0, 0], [0, 1], [0, 2])).result.events.find((e) => e.kind === 'fly');
    const pb = applyMove(b, cells(b, [0, 0], [0, 1], [0, 2])).result.events.find((e) => e.kind === 'fly');
    expect(pa).toEqual(pb);
  });

  it('level files: ladybugs and ladybug goals are checked', () => {
    const base = { seed: 1, moves: 5, colors: [0, 1], layout: ['..', '..'] };
    expect(parseLevel({ ...base, pieces: [bug(0, 0, 1, 2)], goals: [{ type: 'ladybugs', count: 1 }] }, 'x').pieces).toEqual([bug(0, 0, 1, 2)]);
    expect(() => parseLevel({ ...base, pieces: [bug(0, 0, 1, 5)], goals: [{ type: 'ladybugs', count: 1 }] }, 'x')).toThrow(/spots/);
    expect(() => parseLevel({ ...base, pieces: [bug(0, 0, 1)], goals: [{ type: 'ladybugs', count: 2 }] }, 'x')).toThrow(/only has 1/);
  });
});
