import { describe, expect, it } from 'vitest';
import { applyMove, hintSquare, leftoverBombs, LEFTOVER_BOMBS, movesLeft } from '../src/rules';
import { cells, game } from './helpers';

describe('leftover-move bombs', () => {
  const won = (moves: number) => {
    const s = game(['00', '12', '21'], { moves, goals: [{ type: 'collect', color: 0, count: 2 }] });
    return applyMove(s, cells(s, [0, 0], [0, 1])).state;
  };

  it('a win with moves to spare drops one bomb per unused move, up to five', () => {
    const s = won(20);
    expect(s.status).toBe('won');
    const steps = leftoverBombs(s);
    expect(steps).toHaveLength(LEFTOVER_BOMBS);
    expect(won(3).status).toBe('won');
    expect(leftoverBombs(won(3))).toHaveLength(2);
    expect(leftoverBombs(won(1))).toHaveLength(0);
  });

  it('each bomb lands on a dot and goes off before the next lands', () => {
    let before = won(20);
    for (const { state, result } of leftoverBombs(before)) {
      const blast = result.steps[0];
      expect(blast.kind).toBe('blast');
      expect(blast.sources).toHaveLength(1);
      expect(before.cells[blast.sources[0].cell]?.kind).toBe('dot');
      expect(result.events.at(-1)?.kind).toBe('fall');
      before = state;
    }
  });

  it('changes no record: still won, same moves used', () => {
    const s = won(20);
    const steps = leftoverBombs(s);
    const last = steps.at(-1)!.state;
    expect(last.status).toBe('won');
    expect(last.movesUsed).toBe(s.movesUsed);
    expect(movesLeft(last)).toBe(movesLeft(s));
  });

  it('is seeded, and only follows a win', () => {
    expect(leftoverBombs(won(20))).toEqual(leftoverBombs(won(20)));
    const playing = game(['00', '12', '21'], { goals: [{ type: 'collect', color: 0, count: 9 }] });
    expect(leftoverBombs(playing)).toEqual([]);
  });
});

describe('square hint', () => {
  it('finds the first square that can be closed, as a loop path', () => {
    const s = game(['1200', '2100', '1212']);
    expect(hintSquare(s)).toEqual(cells(s, [0, 2], [0, 3], [1, 3], [1, 2], [0, 2]));
  });

  it('is null when no square is available', () => {
    expect(hintSquare(game(['0011', '1200', '2121']))).toBeNull();
  });
});
