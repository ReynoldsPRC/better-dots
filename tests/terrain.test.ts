import { describe, expect, it } from 'vitest';
import {
  applyMove, createGame, extendPath, hasMove, isValidPath, parseLevel, type LevelDef, type Wall,
} from '../src/rules';
import { at, cells, colorOf, colors, game } from './helpers';

const withWalls = (layout: string[], walls: Wall[], extra: Partial<LevelDef> = {}) => game(layout, { walls, ...extra });

describe('walls', () => {
  const BOARD = ['0011', '2233', '0101'];

  it('a line cannot cross a wall', () => {
    const s = withWalls(BOARD, [{ r: 0, c: 0, side: 'right' }]);
    const path = cells(s, [0, 0]);
    expect(extendPath(s, path, at(s, 0, 1))).toBe(path);
    expect(isValidPath(s, cells(s, [0, 0], [0, 1]))).toBe(false);
    // The other pair on that row is unaffected.
    expect(isValidPath(s, cells(s, [0, 2], [0, 3]))).toBe(true);
  });

  it('a wall can be given from either side', () => {
    const a = withWalls(BOARD, [{ r: 0, c: 1, side: 'left' }]);
    const b = withWalls(BOARD, [{ r: 0, c: 0, side: 'right' }]);
    expect(a.wallRight).toEqual(b.wallRight);
    const up = withWalls(['01', '01', '23'], [{ r: 1, c: 0, side: 'up' }]);
    const down = withWalls(['01', '01', '23'], [{ r: 0, c: 0, side: 'down' }]);
    expect(up.wallDown).toEqual(down.wallDown);
    expect(isValidPath(up, cells(up, [0, 0], [1, 0]))).toBe(false);
    expect(isValidPath(up, cells(up, [0, 1], [1, 1]))).toBe(true);
  });

  it('works on a one-column board (vertical neighbors differ by one index)', () => {
    const s = withWalls(['0', '0', '0'], [{ r: 0, c: 0, side: 'down' }]);
    expect(isValidPath(s, [0, 1])).toBe(false);
    expect(isValidPath(s, [1, 2])).toBe(true);
  });

  it('a loop cannot close across a wall', () => {
    const s = withWalls(['00', '00'], [{ r: 0, c: 0, side: 'down' }]);
    const open = cells(s, [0, 0], [0, 1], [1, 1], [1, 0]);
    expect(isValidPath(s, open)).toBe(true);
    expect(extendPath(s, open, at(s, 0, 0))).toBe(open);
  });

  it('pairs split by walls are not moves, so the board is reshuffled', () => {
    // A wall separates the fixed 0s, so the random cell below must become a 0 to pair with (0,0).
    for (let seed = 1; seed <= 10; seed++) {
      const level: LevelDef = {
        id: 't', label: 't', seed, moves: 5, colors: [0, 1], goals: [],
        layout: ['00', '.-'], walls: [{ r: 0, c: 0, side: 'right' }],
      };
      const s = createGame(level);
      expect(hasMove(s)).toBe(true);
      expect(colors(s)).toEqual(['00', '0-']);
    }
  });

  it('walls do not affect falling', () => {
    const s = withWalls(['1', '2', '0', '0'], [{ r: 1, c: 0, side: 'down' }]);
    const top = s.cells[0]!.id;
    const { state } = applyMove(s, cells(s, [2, 0], [3, 0]));
    expect(state.cells[at(s, 2, 0)]!.id).toBe(top);
  });

  it('rejects walls that are not between two cells', () => {
    const base = { id: 'testlvl', seed: 1, moves: 5, colors: [0], layout: ['..'], goals: [{ type: 'collect', color: 0, count: 1 }] };
    expect(() => parseLevel({ ...base, walls: [{ r: 0, c: 1, side: 'right' }] }, 'x')).toThrow(/between two cells/);
    expect(() => parseLevel({ ...base, walls: [{ r: 0, c: 0, side: 'diagonal' }] }, 'x')).toThrow(/side/);
    expect(parseLevel({ ...base, walls: [{ r: 0, c: 0, side: 'right' }] }, 'x').walls).toHaveLength(1);
  });
});

describe('shaped boards', () => {
  it('"-" cells hold no dot and are never filled', () => {
    const s = game(['0-0', '0-0', '000']);
    expect(colors(s)).toEqual(['0-0', '0-0', '000']);
    let st = s;
    for (let k = 0; k < 5; k++) {
      st = applyMove(st, cells(st, [2, 0], [2, 1], [2, 2])).state;
      expect(st.cells[at(st, 0, 1)]).toBeNull();
      expect(st.cells[at(st, 1, 1)]).toBeNull();
      if (colorOf(st.cells[at(st, 2, 0)]) !== colorOf(st.cells[at(st, 2, 1)])) break;
    }
  });

  it('dots fall past empty cells', () => {
    const s = game(['1', '-', '-', '0', '0']);
    const top = s.cells[0]!.id;
    const { state, result } = applyMove(s, cells(s, [3, 0], [4, 0]));
    expect(state.cells[at(s, 4, 0)]!.id).toBe(top);
    expect(state.cells[at(s, 1, 0)]).toBeNull();
    expect(result.spawned).toHaveLength(2);
    expect(state.cells[0]).not.toBeNull();
    expect(state.cells[at(s, 3, 0)]).not.toBeNull();
  });

  it('a line cannot jump over an empty cell', () => {
    const s = game(['0-0', '1-1', '1-1']);
    expect(extendPath(s, cells(s, [0, 0]), at(s, 0, 2))).toEqual(cells(s, [0, 0]));
  });

  it('a loop around an empty cell still clears its color', () => {
    const s = game(['000', '0-0', '000', '121']);
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const { result } = applyMove(s, ring);
    expect(result.loop).toBe(true);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].cells).toHaveLength(8);
  });

  it('parses "-" in level files and rejects an all-empty layout', () => {
    const base = { id: 'testlvl', seed: 1, moves: 5, colors: [0], goals: [{ type: 'collect', color: 0, count: 1 }] };
    expect(parseLevel({ ...base, layout: ['.-.', '...'] }, 'x').layout).toEqual(['.-.', '...']);
    expect(() => parseLevel({ ...base, layout: ['--'] }, 'x')).toThrow(/no cells/);
  });
});

describe('random play on a shaped, walled board', () => {
  const level: LevelDef = {
    id: 'shape', label: 'shape', seed: 5, moves: 1000, colors: [0, 1, 2, 3], goals: [],
    layout: ['-....-', '......', '..--..', '......', '-....-'],
    walls: [{ r: 1, c: 2, side: 'right' }, { r: 3, c: 1, side: 'down' }, { r: 0, c: 3, side: 'down' }],
  };

  it('keeps every playable cell full, holes empty, and a legal move available', () => {
    for (let seed = 1; seed <= 15; seed++) {
      let s = createGame(level, { playSeed: seed });
      for (let k = 0; k < 50; k++) {
        const moves: number[][] = [];
        for (let i = 0; i < s.cells.length; i++) for (const j of [i + 1, i + s.cols]) if (isValidPath(s, [i, j])) moves.push([i, j]);
        expect(moves.length).toBeGreaterThan(0);
        s = applyMove(s, moves[(seed * 7 + k * 13) % moves.length]).state;
        s.cells.forEach((p, i) => expect(p === null).toBe(!s.playable[i]));
        expect(hasMove(s)).toBe(true);
      }
    }
  });
});
