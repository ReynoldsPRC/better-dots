import { describe, expect, it } from 'vitest';
import { buildCatalog, catalog } from '../src/levels';
import { createGame, hasMove, parseLevel, starCutoffs, starsFor, type LevelDef } from '../src/rules';

const valid = {
  seed: 1, moves: 20, colors: [0, 1, 2],
  layout: ['...', '...'],
  goals: [{ type: 'collect', color: 0, count: 10 }],
};

describe('parseLevel', () => {
  it('accepts a valid level', () => {
    const l = parseLevel({ ...valid, name: 'Hi', stars: { two: 15, three: 10 } }, '1-1');
    expect(l).toMatchObject({ id: '1-1', name: 'Hi', moves: 20, stars: { two: 15, three: 10 } });
  });

  it.each([
    ['seed', { seed: 1.5 }, /seed/],
    ['moves', { moves: 0 }, /moves/],
    ['colors', { colors: [0, 7] }, /colors/],
    ['duplicate colors', { colors: [1, 1] }, /duplicates/],
    ['ragged layout', { layout: ['...', '..'] }, /same length/],
    ['layout char', { layout: ['..x'] }, /"x"/],
    ['no goals', { goals: [] }, /goals/],
    ['goal type', { goals: [{ type: 'nope', color: 0, count: 1 }] }, /unknown type/],
    ['goal color', { goals: [{ type: 'collect', color: 4, count: 1 }] }, /color/],
    ['stars order', { stars: { two: 5, three: 9 } }, /stars/],
  ])('rejects bad %s', (_, patch, msg) => {
    expect(() => parseLevel({ ...valid, ...patch }, 'x')).toThrow(msg);
  });
});

describe('stars', () => {
  const level = { ...parseLevel(valid, 't'), stars: { two: 15, three: 10 } } as LevelDef;

  it('1 for any clear, 2 at or under the median cutoff, 3 at or under the best cutoff', () => {
    expect(starsFor(level, 20, false)).toBe(1);
    expect(starsFor(level, 15, false)).toBe(2);
    expect(starsFor(level, 10, false)).toBe(3);
  });

  it('assisted clears earn none', () => {
    expect(starsFor(level, 3, true)).toBe(0);
  });

  it('falls back to fractions of the move limit before the bot has scored a level', () => {
    const c = starCutoffs({ ...level, stars: undefined });
    expect(c.three).toBeLessThan(c.two);
    expect(c.two).toBeLessThan(level.moves);
  });
});

describe('catalog', () => {
  it('orders worlds and levels by number and names them', () => {
    const c = buildCatalog({
      '/levels/world-2/01.json': valid,
      '/levels/world-1/02.json': valid,
      '/levels/world-1/01.json': valid,
      '/levels/world-1/world.json': { name: 'Dots' },
    });
    expect(c.worlds.map((w) => w.name)).toEqual(['Dots', 'World 2']);
    expect(c.order.map((l) => l.id)).toEqual(['1-1', '1-2', '2-1']);
  });

  it('rejects gaps in level numbering', () => {
    expect(() => buildCatalog({ '/levels/world-1/02.json': valid })).toThrow(/missing 1/);
  });

  it('every shipped level file is valid and starts playable', () => {
    expect(catalog.order.length).toBeGreaterThan(0);
    for (const level of catalog.order) {
      const s = createGame(level);
      expect(hasMove(s), level.id).toBe(true);
    }
  });
});
