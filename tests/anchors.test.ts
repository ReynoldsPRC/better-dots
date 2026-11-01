import { describe, expect, it } from 'vitest';
import { applyMove, createGame, extendPath, hasMove, parseLevel, type GameState, type LevelDef } from '../src/rules';
import { at, cells, game } from './helpers';

const anchorAt = (s: GameState, r: number, c: number) => s.cells[at(s, r, c)]?.kind === 'anchor';
const countAnchors = (s: GameState) => s.cells.filter((p) => p?.kind === 'anchor').length;

describe('anchors', () => {
  const level = (extra: Partial<LevelDef> = {}): LevelDef => ({
    id: 't', label: 't', seed: 1, moves: 20, colors: [0, 1, 2, 3], layout: ['.1', '00', '00', '23'],
    pieces: [{ r: 0, c: 0, type: 'anchor' }], goals: [{ type: 'anchors', count: 1 }], ...extra,
  });

  it('are not connectable', () => {
    const s = createGame(level());
    expect(extendPath(s, [], at(s, 0, 0))).toEqual([]);
    expect(extendPath(s, cells(s, [0, 1]), at(s, 0, 0))).toEqual(cells(s, [0, 1]));
  });

  it('fall with gravity', () => {
    const s = createGame(level());
    const { state } = applyMove(s, cells(s, [1, 0], [2, 0]));
    expect(anchorAt(state, 2, 0)).toBe(true);
  });

  it('sink at the bottom of their column and count toward the goal', () => {
    const s = createGame({ ...level(), layout: ['.1', '00', '00'] });
    const { state, result } = applyMove(s, cells(s, [1, 0], [2, 0]));
    expect(countAnchors(state)).toBe(0);
    expect(result.events.map((e) => e.kind)).toEqual(['clear', 'fall', 'sink', 'fall']);
    expect(state.goals[0].progress).toBe(1);
    expect(state.status).toBe('won');
    state.cells.forEach((p) => expect(p).not.toBeNull());
  });

  it('the bottom is the lowest cell of the column, even on shaped boards', () => {
    const s = createGame({ ...level(), layout: ['.1', '00', '0-'], pieces: [{ r: 0, c: 0, type: 'anchor' }] });
    const { state } = applyMove(s, cells(s, [1, 0], [2, 0]));
    expect(countAnchors(state)).toBe(0);
  });

  it('are not hurt by bombs and do not become bombs', () => {
    const s = game(['0000', '0..0', '0000', '1212'], {
      pieces: [{ r: 1, c: 1, type: 'anchor' }, { r: 3, c: 0, type: 'anchor' }], colors: [1, 2],
    });
    // Fill the middle (1,2) with a non-zero dot so it becomes a bomb next to the anchor.
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const { result } = applyMove({ ...s, bombRadius: 2 }, ring);
    const blast = result.steps.find((st) => st.kind === 'blast')!;
    expect(blast.sources.map((x) => x.cell)).toEqual([at(s, 1, 2)]);
    expect(blast.cells).not.toContain(at(s, 1, 1));
    expect(blast.cells).not.toContain(at(s, 3, 0));
  });

  it('drop in from the top until the level runs out', () => {
    const lvl = { ...level({ anchorDrops: 2, goals: [{ type: 'anchors' as const, count: 3 }] }), layout: ['.1', '00', '00'] };
    let s = createGame(lvl);
    const first = applyMove(s, cells(s, [1, 0], [2, 0]));
    s = first.state;
    expect(s.anchorDrops).toBe(1);
    expect(countAnchors(s)).toBe(1);
    // A dropped anchor enters at the top of a column.
    const spawnedAnchor = first.result.spawned.find((id) => s.cells.some((p) => p?.id === id && p.kind === 'anchor'));
    expect(spawnedAnchor).toBeDefined();
  });

  it('an anchor on an iced bottom cell still sinks, and the ice stays', () => {
    const s = createGame(level({
      layout: ['121', '001', '.21'], pieces: [{ r: 2, c: 0, type: 'anchor' }], ice: ['...', '...', '2..'],
    }));
    const next = applyMove(s, cells(s, [0, 2], [1, 2])).state;
    expect(next.goals[0].progress).toBe(1);
    expect(next.layers.ice[at(s, 2, 0)]).toBe(2);
  });

  it('stay put when a stuck board is reshuffled', () => {
    // Two colors on a 3x2 area get stuck for some seeds.
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame({
        id: 't', label: 't', seed, moves: 9, colors: [0, 1], goals: [], layout: ['...', '...', '...'],
        pieces: [{ r: 0, c: 2, type: 'anchor' }, { r: 1, c: 2, type: 'anchor' }, { r: 2, c: 2, type: 'anchor' }],
      });
      expect(hasMove(s)).toBe(true);
      for (const r of [0, 1, 2]) expect(anchorAt(s, r, 2)).toBe(true);
    }
  });

  it('level files: pieces and anchor goals are checked', () => {
    const base = { id: 'testlvl', seed: 1, moves: 5, colors: [0, 1], layout: ['..', '..'], goals: [{ type: 'anchors', count: 2 }] };
    expect(() => parseLevel({ ...base, pieces: [{ r: 0, c: 0, type: 'anchor' }] }, 'x')).toThrow(/only has 1/);
    expect(parseLevel({ ...base, pieces: [{ r: 0, c: 0, type: 'anchor' }], anchorDrops: 1 }, 'x').anchorDrops).toBe(1);
    expect(() => parseLevel({ ...base, pieces: [{ r: 5, c: 0, type: 'anchor' }] }, 'x')).toThrow(/cell of the layout/);
    expect(() => parseLevel({ ...base, pieces: [{ r: 0, c: 0, type: 'boat' }] }, 'x')).toThrow(/unknown type/);
  });
});
