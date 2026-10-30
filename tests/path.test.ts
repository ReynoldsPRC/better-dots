import { describe, expect, it } from 'vitest';
import { enclosedCells, extendPath, isLoopClosed, isValidPath } from '../src/rules';
import { cells, game } from './helpers';

const BOARD = [
  '0012',
  '0012',
  '3312',
  '0000',
];

describe('extendPath (dragging)', () => {
  const s = game(BOARD);
  const p = (...rc: [number, number][]) => cells(s, ...rc);

  it('starts on any dot', () => {
    expect(extendPath(s, [], p([0, 0])[0])).toEqual(p([0, 0]));
  });

  it('extends to an adjacent dot of the same color', () => {
    expect(extendPath(s, p([0, 0]), p([0, 1])[0])).toEqual(p([0, 0], [0, 1]));
    expect(extendPath(s, p([0, 0]), p([1, 0])[0])).toEqual(p([0, 0], [1, 0]));
  });

  it('ignores a different color', () => {
    const path = p([0, 1]);
    expect(extendPath(s, path, p([0, 2])[0])).toBe(path);
  });

  it('never connects diagonally', () => {
    const path = p([0, 0]);
    expect(extendPath(s, path, p([1, 1])[0])).toBe(path);
  });

  it('ignores cells that are not adjacent', () => {
    const path = p([3, 0]);
    expect(extendPath(s, path, p([3, 2])[0])).toBe(path);
  });

  it('shortens when dragging back along the line', () => {
    const path = p([3, 0], [3, 1], [3, 2]);
    expect(extendPath(s, path, p([3, 1])[0])).toEqual(p([3, 0], [3, 1]));
  });

  it('closes a loop on revisiting an earlier dot', () => {
    const path = p([0, 0], [0, 1], [1, 1], [1, 0]);
    const closed = extendPath(s, path, p([0, 0])[0]);
    expect(closed).toEqual(p([0, 0], [0, 1], [1, 1], [1, 0], [0, 0]));
    expect(isLoopClosed(closed)).toBe(true);
  });

  it('cannot extend past a closed loop, but can back out of it', () => {
    const closed = p([0, 1], [0, 0], [1, 0], [1, 1], [0, 1]);
    expect(extendPath(s, closed, p([2, 1])[0])).toBe(closed);
    expect(extendPath(s, closed, p([1, 1])[0])).toEqual(p([0, 1], [0, 0], [1, 0], [1, 1]));
  });
});

describe('isValidPath', () => {
  const s = game(BOARD);
  const p = (...rc: [number, number][]) => cells(s, ...rc);

  it('needs at least two dots', () => {
    expect(isValidPath(s, p([0, 0]))).toBe(false);
    expect(isValidPath(s, p([0, 0], [0, 1]))).toBe(true);
  });

  it('rejects gaps, diagonals, mixed colors, and repeats', () => {
    expect(isValidPath(s, p([3, 0], [3, 2]))).toBe(false);
    expect(isValidPath(s, p([0, 0], [1, 1]))).toBe(false);
    expect(isValidPath(s, p([0, 1], [0, 2]))).toBe(false);
    expect(isValidPath(s, p([3, 0], [3, 1], [3, 0]))).toBe(false);
    expect(isValidPath(s, p([0, 0], [0, 1], [1, 1], [1, 0], [0, 0], [0, 1]))).toBe(false);
  });

  it('accepts a closed loop', () => {
    expect(isValidPath(s, p([0, 0], [0, 1], [1, 1], [1, 0], [0, 0]))).toBe(true);
  });
});

describe('enclosedCells', () => {
  it('finds the cell inside a ring', () => {
    const s = game(['000', '010', '000']);
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    expect(enclosedCells(s, ring)).toEqual(cells(s, [1, 1]));
  });

  it('a 2x2 square encloses nothing', () => {
    const s = game(['00', '00']);
    expect(enclosedCells(s, cells(s, [0, 0], [0, 1], [1, 1], [1, 0], [0, 0]))).toEqual([]);
  });

  it('handles an irregular loop and ignores the tail before it', () => {
    const s = game([
      '00000',
      '01100',
      '00100',
      '00000',
    ]);
    // Tail (3,0), then a loop through (2,1) that pinches in: (1,1), (1,2), (2,2) are inside.
    const path = cells(s,
      [3, 0], [2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [0, 3], [1, 3],
      [2, 3], [3, 3], [3, 2], [3, 1], [2, 1], [2, 0],
    );
    expect(isValidPath(s, path)).toBe(true);
    expect(enclosedCells(s, path).sort((a, b) => a - b)).toEqual(cells(s, [1, 1], [1, 2], [2, 2]));
  });
});
