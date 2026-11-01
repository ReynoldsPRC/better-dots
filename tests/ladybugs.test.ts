import { describe, expect, it } from 'vitest';
import { applyMove, extendPath, parseLevel, type ColorId, type Facing, type GameState } from '../src/rules';
import { at, cells, game } from './helpers';

const bug = (r: number, c: number, color: ColorId, spots?: number, facing?: Facing) =>
  ({ r, c, type: 'ladybug' as const, color, ...(spots ? { spots } : {}), ...(facing ? { facing } : {}) });
const bugs = (s: GameState) => s.cells.flatMap((p, i) => (p?.kind === 'ladybug' ? [{ i, p }] : []));
const findBug = (s: GameState) => bugs(s)[0] ?? null;

describe('ladybugs', () => {
  it('connect like a dot of their color', () => {
    const s = game(['000', '121', '212'], { pieces: [bug(0, 1, 0)] });
    expect(extendPath(s, cells(s, [0, 0]), at(s, 0, 1))).toEqual(cells(s, [0, 0], [0, 1]));
  });

  it('cleared with spots left: lose a spot, change color, and stay put', () => {
    const s = game(['000', '121', '212'], { pieces: [bug(0, 1, 0)], colors: [0, 1, 2] });
    const id = findBug(s)!.p.id;
    const { state, result } = applyMove(s, cells(s, [0, 0], [0, 1], [0, 2]));
    const b = findBug(state)!;
    expect(b.p.id).toBe(id);
    expect(b.p.spots).toBe(2);
    expect(b.p.color).not.toBe(0);
    expect(b.i).toBe(at(s, 0, 1));
    // Hit this move, so it doesn't walk.
    expect(result.events.some((e) => e.kind === 'walk')).toBe(false);
    // Only the two dots left the board.
    expect(result.steps[0].cells).toEqual(cells(s, [0, 0], [0, 2]));
  });

  it('a hit on an iced cell also hits the ice', () => {
    const s = game(['.0', '11'], { pieces: [bug(0, 0, 0)], ice: ['2.', '11'], colors: [0, 1, 2] });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1]));
    expect(state.layers.ice[at(s, 0, 0)]).toBe(1);
  });

  it('removed on its last spot, counting toward the goal and leaving a bomb that goes off that move', () => {
    const s = game(['000', '121', '212'], { pieces: [bug(0, 1, 0, 1)], goals: [{ type: 'ladybugs', count: 1 }] });
    const { state, result } = applyMove(s, cells(s, [0, 0], [0, 1], [0, 2]));
    expect(findBug(state)).toBeNull();
    expect(state.status).toBe('won');
    const blast = result.steps.find((x) => x.kind === 'blast')!;
    expect(blast.sources).toEqual([{ cell: at(s, 0, 1), type: 'bomb' }]);
    expect(blast.cells).toEqual(expect.arrayContaining(cells(s, [1, 0], [1, 1], [1, 2])));
  });

  it('a loop around it does nothing to it', () => {
    const s = game(['0000', '0100', '0000', '1212'], { pieces: [bug(1, 1, 1, 3)], colors: [1, 2], goals: [{ type: 'ladybugs', count: 1 }] });
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const { state, result } = applyMove(s, ring);
    expect(result.steps.map((x) => x.kind)).toEqual(['loop']);
    expect(findBug(state)!.p.spots).toBe(3);
    expect(state.goals[0].progress).toBe(0);
  });

  it('a bomb or beam counts as a hit: one spot lost', () => {
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

  it('when not hit, walks one cell the way it faces, swapping with what is there; ice stays with its cell', () => {
    const s = game(['000', '121', '212'], { pieces: [bug(2, 1, 1, 3, 'up')], ice: ['...', '.1.', '...'] });
    const passed = s.cells[at(s, 1, 1)]!.id;
    const { state, result } = applyMove(s, cells(s, [0, 0], [0, 1], [0, 2]));
    expect(findBug(state)!.i).toBe(at(s, 1, 1));
    expect(state.cells[at(s, 2, 1)]!.id).toBe(passed);
    expect(state.layers.ice[at(s, 1, 1)]).toBe(1);
    const walk = result.events.find((e) => e.kind === 'walk');
    expect(walk?.kind === 'walk' && walk.moves).toEqual([{ from: at(s, 2, 1), to: at(s, 1, 1) }]);
  });

  it('turns clockwise instead when the way ahead is off the board', () => {
    const s = game(['3.33', '1210', '2100'], { pieces: [bug(0, 1, 2, 3, 'up')] });
    const { state } = applyMove(s, cells(s, [2, 2], [2, 3]));
    expect(findBug(state)).toMatchObject({ i: at(s, 0, 1), p: { facing: 'right' } });
  });

  it('another ladybug or a gem ahead turns it too; ladybugs act in board order', () => {
    const s = game(['0000', '1212', '2121'], { pieces: [bug(1, 0, 1, 3, 'right'), bug(1, 1, 2, 3, 'right')] });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1], [0, 2], [0, 3]));
    // The first is blocked by the second (which hasn't moved yet) and turns; the second walks on.
    expect(bugs(state).map(({ i, p }) => [i, p.facing])).toEqual([[at(s, 1, 0), 'down'], [at(s, 1, 2), 'right']]);
    const t = game(['0000', '1212', '2121'], { pieces: [bug(1, 1, 1, 3, 'left'), { r: 1, c: 0, type: 'gem', color: 2, shape: 'row' }] });
    const after = applyMove(t, cells(t, [0, 0], [0, 1], [0, 2], [0, 3])).state;
    expect(findBug(after)).toMatchObject({ i: at(t, 1, 1), p: { facing: 'up' } });
  });

  it('level files: ladybugs and ladybug goals are checked', () => {
    const base = { id: 'testlvl', seed: 1, moves: 5, colors: [0, 1], layout: ['..', '..'] };
    expect(parseLevel({ ...base, pieces: [bug(0, 0, 1, 2)], goals: [{ type: 'ladybugs', count: 1 }] }, 'x').pieces).toEqual([bug(0, 0, 1, 2)]);
    expect(parseLevel({ ...base, pieces: [bug(0, 0, 1, 2, 'left')], goals: [{ type: 'ladybugs', count: 1 }] }, 'x').pieces).toEqual([bug(0, 0, 1, 2, 'left')]);
    expect(() => parseLevel({ ...base, pieces: [{ ...bug(0, 0, 1), facing: 'north' }], goals: [{ type: 'ladybugs', count: 1 }] }, 'x')).toThrow(/facing/);
    expect(() => parseLevel({ ...base, pieces: [bug(0, 0, 1, 5)], goals: [{ type: 'ladybugs', count: 1 }] }, 'x')).toThrow(/spots/);
    expect(() => parseLevel({ ...base, pieces: [bug(0, 0, 1)], goals: [{ type: 'ladybugs', count: 2 }] }, 'x')).toThrow(/only has 1/);
  });
});
