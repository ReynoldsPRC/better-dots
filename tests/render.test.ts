import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { MoveAnimation } from '../src/render/animation';
import { cellAt, computeLayout, toScreen } from '../src/render/layout';
import { applyMove } from '../src/rules';
import { at, cells, game } from './helpers';

describe('layout and hit-testing', () => {
  const l = computeLayout(390, 844, 6, 6, 80, 24);

  it('fits the board inside the screen, centered', () => {
    expect(l.x0).toBeGreaterThan(0);
    expect(l.x0 + l.cell * 6).toBeLessThan(390);
    expect(l.y0).toBeGreaterThan(80);
    expect(l.cell).toBeLessThanOrEqual(config.board.maxCell);
    expect(l.x0 * 2 + l.cell * 6).toBeCloseTo(390);
  });

  it('picks the cell under a dot center', () => {
    const [x, y] = toScreen(l, 2, 3);
    expect(cellAt(l, x, y)).toBe(2 * 6 + 3);
    expect(cellAt(l, x + l.cell * 0.3, y)).toBe(2 * 6 + 3);
  });

  it('ignores points between dots, so diagonals do not register', () => {
    const [x, y] = toScreen(l, 2, 3);
    expect(cellAt(l, x + l.cell / 2, y + l.cell / 2)).toBeNull();
    expect(cellAt(l, l.x0 - 5, y)).toBeNull();
  });
});

describe('move animation timeline', () => {
  const BOARD = ['1231', '0032', '2131'];

  it('starts from the old board and ends on the new one', () => {
    const s = game(BOARD);
    const { state, result } = applyMove(s, cells(s, [1, 0], [1, 1]));
    const anim = new MoveAnimation(s, result, state, 1000);

    const first = anim.frame(1000);
    expect(first.sprites).toHaveLength(12 + 2); // 12 old dots (2 popping) + 2 new above the board
    const above = first.sprites.find((p) => p.id === s.cells[at(s, 0, 0)]!.id)!;
    expect([above.r, above.c]).toEqual([0, 0]);

    const last = anim.frame(anim.end + 1);
    expect(last.done).toBe(true);
    expect(last.sprites).toHaveLength(12);
    for (const p of last.sprites) {
      const i = state.cells.findIndex((q) => q?.id === p.id);
      expect([p.r, p.c]).toEqual([Math.floor(i / 4), i % 4]);
    }
  });

  it('new dots enter from above the board', () => {
    const s = game(BOARD);
    const { state, result } = applyMove(s, cells(s, [0, 2], [1, 2], [2, 2]));
    const anim = new MoveAnimation(s, result, state, 0);
    const f = anim.frame(0);
    const spawned = f.sprites.filter((p) => result.spawned.includes(p.id));
    expect(spawned).toHaveLength(3);
    for (const p of spawned) expect(p.r).toBeLessThan(0);
  });

  it('a loop pulses, then bombs go off in a later stage', () => {
    const s = game(['0001', '0201', '0003', '1231']);
    const ring = cells(s, [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);
    const { state, result } = applyMove(s, ring);
    const anim = new MoveAnimation(s, result, state, 0);
    expect(anim.frame(1).pulse?.color).toBe(0);
    expect(anim.frame(1).blasts).toHaveLength(0);
    expect(anim.frame(config.cascade.stepMs + 1).blasts).toEqual([
      expect.objectContaining({ r: 1, c: 1 }),
    ]);
  });
});
