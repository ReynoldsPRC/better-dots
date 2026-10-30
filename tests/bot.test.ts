import { describe, expect, it } from 'vitest';
import { analyzeLevel, candidateMoves, findLoops, isLuckHeavy, percentile, playOnce, tuneFromStats, type LevelStats } from '../src/bot/bot';
import { formatLevelJson, toLevelFile } from '../src/bot/format';
import { generateCandidate } from '../src/bot/generate';
import { candidates, catalog } from '../src/levels';
import { createGame, enclosedCells, isLoopClosed, isValidPath, parseLevel, type GameState, type LevelDef } from '../src/rules';
import { at, game } from './helpers';

const groupOf = (s: GameState, color: number) => s.cells.flatMap((p, i) => (p?.kind === 'dot' && p.color === color ? [i] : []));

const easy: LevelDef = {
  id: 'easy', label: 'easy', seed: 3, moves: 30, colors: [0, 1, 2], layout: Array(6).fill('......'),
  goals: [{ type: 'collect', color: 0, count: 10 }],
};

describe('bot', () => {
  it('only proposes legal moves, including a loop when one exists', () => {
    const s = createGame({ ...easy, layout: ['001', '001', '110'] });
    const moves = candidateMoves(s);
    for (const m of moves) expect(isValidPath(s, m)).toBe(true);
    expect(moves.some(isLoopClosed)).toBe(true);
  });

  it('finds lines on shaped and walled boards', () => {
    const level = catalog.order.find((l) => l.label === '3-6')!;
    const s = createGame(level);
    for (const m of candidateMoves(s)) expect(isValidPath(s, m)).toBe(true);
  });

  it('is reproducible for the same seed, whatever the options', () => {
    expect(playOnce(easy, 9)).toEqual(playOnce(easy, 9));
    const opts = { noise: 0.9, lookahead: 2, replyWeight: 0.8, pathBudget: 100 };
    expect(playOnce(easy, 9, undefined, opts)).toEqual(playOnce(easy, 9, undefined, opts));
    expect(analyzeLevel(easy, 5, 3, opts)).toEqual(analyzeLevel(easy, 5, 3, opts));
  });

  it('finds several distinct loops in a group', () => {
    const s = game(['0000', '0000', '1212']);
    const loops = findLoops(s, groupOf(s, 0));
    expect(loops.length).toBeGreaterThanOrEqual(2);
    for (const l of loops) {
      expect(isLoopClosed(l)).toBe(true);
      expect(isValidPath(s, l)).toBe(true);
    }
    const keys = loops.map((l) => l.slice(0, -1).sort((a, b) => a - b).join());
    expect(new Set(keys).size).toBe(loops.length);
  });

  it('prefers the loop that encloses more other-color dots', () => {
    // A ring around the 1 at (1,1), plus plain squares to its right.
    const s = game(['00000', '01000', '00012', '12121']);
    const loops = findLoops(s, groupOf(s, 0));
    expect(loops.length).toBeGreaterThanOrEqual(2);
    expect(enclosedCells(s, loops[0])).toContain(at(s, 1, 1));
    expect(enclosedCells(s, loops[loops.length - 1])).toEqual([]);
  });

  it('wins an easy level and loses an impossible one', () => {
    expect(playOnce(easy, 1).won).toBe(true);
    const impossible = { ...easy, moves: 2, goals: [{ type: 'collect' as const, color: 0 as const, count: 500 }] };
    expect(playOnce(impossible, 1)).toEqual({ won: false, movesUsed: 2 });
  });

  it('reports how many moves it needed, using a generous cap', () => {
    const stats = analyzeLevel({ ...easy, moves: 1 }, 10, 1);
    expect(stats.finishRate).toBe(1);
    expect(stats.winRate).toBe(0);
    expect(stats.movesNeeded.length).toBe(10);
    expect(stats.p10).toBeLessThanOrEqual(stats.median);
    expect(stats.median).toBeLessThanOrEqual(stats.p75);
  });
});

describe('tuning from bot results', () => {
  const stats = (needed: number[], runs = needed.length): LevelStats => {
    const sorted = [...needed].sort((a, b) => a - b);
    const all = [...sorted, ...Array(runs - sorted.length).fill(Infinity)];
    return {
      runs, winRate: 0, finishRate: sorted.length / runs, movesNeeded: sorted,
      median: percentile(all, 0.5), p10: percentile(all, 0.1), p75: percentile(all, 0.75),
    };
  };

  it('sets the move limit at the 75th percentile and stars from the median and best 10%', () => {
    const t = tuneFromStats(stats([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]))!;
    expect(t.moves).toBe(17);
    expect(t.stars).toEqual({ two: 13, three: 10 });
  });

  it('treats a level the bot rarely finishes as unwinnable', () => {
    expect(tuneFromStats(stats([10, 12], 10))).toBeNull();
  });

  it('keeps 1 <= three < two <= moves whenever two >= 2', () => {
    // Tight spreads used to give two === three (3 stars straight after 1).
    for (const needed of [[2, 2, 2, 2], [3, 3, 3, 3], [5, 6, 6, 6, 7], [9, 9, 10, 10, 10, 11], [4, 8, 12, 16, 20]]) {
      const t = tuneFromStats(stats(needed))!;
      expect(t.stars.two, String(needed)).toBeLessThanOrEqual(t.moves);
      expect(t.stars.three, String(needed)).toBeGreaterThanOrEqual(1);
      if (t.stars.two >= 2) expect(t.stars.three, String(needed)).toBeLessThan(t.stars.two);
    }
  });

  it('gives levels of 2 moves or fewer a single tier', () => {
    expect(tuneFromStats(stats([1, 1, 2, 2]))).toEqual({ moves: 2, stars: { two: 1, three: 1 }, oneTier: true });
    expect(tuneFromStats(stats([3, 3, 3, 3]))!.oneTier).toBeUndefined();
  });

  it('flags levels where the outcome is mostly refill luck', () => {
    // Like 7-07 before: limit 41 against a median of 24 and a best 10% of 7.
    expect(isLuckHeavy(stats([7, 9, 15, 20, 24, 26, 30, 38, 41, 45]))).toBe(true);
    expect(isLuckHeavy(stats([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]))).toBe(false);
  });
});

describe('generator', () => {
  const params = {
    rows: 7, cols: 6, colors: 4, holes: 6, walls: 4, collectGoals: 2, targetMoves: [12, 30] as [number, number], runs: 12,
  };

  it('makes valid, reproducible levels within the move target', () => {
    const a = generateCandidate(params, 42);
    const b = generateCandidate(params, 42);
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    const level = a!.level;
    expect(() => parseLevel(toLevelFile(level), 'x')).not.toThrow();
    expect(level.moves).toBeGreaterThanOrEqual(12);
    expect(level.stars!.three).toBeLessThanOrEqual(level.stars!.two);
  });

  it('mirrors holes and keeps every column and the whole board connected', () => {
    const level = generateCandidate(params, 7)!.level;
    for (const row of level.layout) expect(row).toBe([...row].reverse().join(''));
    for (let c = 0; c < 6; c++) expect(level.layout.some((row) => row[c] !== '-')).toBe(true);
    expect(level.layout.join('').split('-').length - 1).toBe(6);
  });
});

describe('level files', () => {
  it('format round-trips through the parser', () => {
    for (const level of [...catalog.order, ...candidates.order]) {
      const text = formatLevelJson(toLevelFile(level));
      expect(parseLevel(JSON.parse(text), level.label)).toEqual(level);
    }
  });

  it('every shipped level has bot-set stars, with 3 stars strictly below 2 unless it has one tier', () => {
    for (const level of catalog.order) {
      expect(level.stars, level.label).toBeDefined();
      if (level.moves > 2) expect(level.stars!.three, level.label).toBeLessThan(level.stars!.two);
    }
  });
});
