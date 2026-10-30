import { describe, expect, it } from 'vitest';
import { applyMove, goalRemaining, hasMove, parseLevel, type GameState } from '../src/rules';
import { at, cells, game } from './helpers';

const burning = (s: GameState) => s.layers.fire.flatMap((x, i) => (x ? [i] : []));

describe('fire', () => {
  it('burning cells hold no dot', () => {
    const s = game(['.12', '212', '121'], { fire: ['x..', '...', '...'] });
    expect(s.cells[0]).toBeNull();
    expect(hasMove(s)).toBe(true);
  });

  it('clearing a neighboring cell puts it out, and the cell refills', () => {
    const s = game(['.00', '212', '121'], { fire: ['x..', '...', '...'], goals: [{ type: 'fire' }] });
    const { state } = applyMove(s, cells(s, [0, 1], [0, 2]));
    expect(burning(state)).toEqual([]);
    expect(state.cells[0]).not.toBeNull();
    expect(state.status).toBe('won');
  });

  it('dots do not fall through fire; cells under it refill from under it', () => {
    const t = game(['1', '.', '2', '0', '0'], { fire: ['.', 'x', '.', '.', '.'], colors: [2] });
    const above = t.cells[0]!.id;
    const { state, result } = applyMove(t, cells(t, [3, 0], [4, 0]));
    // Not next to the fire: it keeps burning, and gravity stops at it.
    expect(state.layers.fire[at(t, 1, 0)]).toBe(true);
    const fall = result.events.find((e) => e.kind === 'fall');
    if (fall?.kind !== 'fall') throw new Error('no fall');
    expect(fall.board[0]!.id).toBe(above);
    expect(fall.board[at(t, 1, 0)]).toBeNull();
    // The two new dots below the fire appear in place rather than falling past it.
    const starts = Object.entries(fall.spawnFrom).map(([id, row]) => [row, fall.board.findIndex((p) => p?.id === Number(id))]);
    expect(starts).toHaveLength(2);
    for (const [row, i] of starts) expect(row).toBe(Math.floor(i / t.cols));
  });

  it('spreads when a move puts none out, destroying the dot it lands on', () => {
    const s = game(['.12', '212', '100'], { fire: ['x..', '...', '...'] });
    const { state } = applyMove(s, cells(s, [2, 1], [2, 2]));
    const now = burning(state);
    expect(now).toHaveLength(2);
    const spread = now.find((i) => i !== 0)!;
    expect([at(s, 0, 1), at(s, 1, 0)]).toContain(spread);
    expect(state.cells[spread]).toBeNull();
  });

  it('does not spread on a move that put one out', () => {
    const s = game(['.00', '212', '...'], { fire: ['x..', '...', '..x'] });
    const { state } = applyMove(s, cells(s, [0, 1], [0, 2]));
    expect(burning(state)).toEqual([at(s, 2, 2)]);
  });

  it('does not spread onto anchors, gems, or ladybugs', () => {
    const s = game(['..1', '.20', '120'], {
      fire: ['x..', '...', '...'], pieces: [{ r: 0, c: 1, type: 'gem', color: 0, shape: 'column' }, { r: 1, c: 0, type: 'anchor' }],
    });
    const { state } = applyMove(s, cells(s, [1, 2], [2, 2]));
    expect(burning(state)).toEqual([0]);
  });

  it('fire under ice is dormant: it does not spread, cannot be put out, and still counts', () => {
    const s = game(['.12', '212', '100'], { fire: ['x..', '...', '...'], ice: ['2..', '...', '...'], goals: [{ type: 'fire' }] });
    expect(goalRemaining(s, s.goals[0])).toBe(1);
    const { state } = applyMove(s, cells(s, [2, 1], [2, 2]));
    expect(burning(state)).toEqual([0]);
  });

  it('level files: fire grids and fire goals are checked', () => {
    const base = { seed: 1, moves: 5, colors: [0, 1], layout: ['..', '..'] };
    expect(parseLevel({ ...base, fire: ['x.', '..'], goals: [{ type: 'fire' }] }, 'x').fire).toEqual(['x.', '..']);
    expect(() => parseLevel({ ...base, goals: [{ type: 'fire' }] }, 'x')).toThrow(/needs some starting/);
    expect(() => parseLevel({ ...base, layout: ['0.', '..'], fire: ['x.', '..'], goals: [{ type: 'fire' }] }, 'x')).toThrow(/holds no dot/);
    expect(() => parseLevel({ ...base, fire: ['x.', '..'], pieces: [{ r: 0, c: 0, type: 'anchor' }], goals: [{ type: 'fire' }] }, 'x')).toThrow(/burning/);
  });
});
