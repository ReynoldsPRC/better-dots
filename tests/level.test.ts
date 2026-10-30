import { describe, expect, it } from 'vitest';
import { buildCatalog, candidates, catalog } from '../src/levels';
import { emptySave, isUnlocked, recordWin } from '../src/progress';
import { createGame, hasMove, parseLevel, starCutoffs, starsFor, type LevelDef } from '../src/rules';

const valid = {
  id: 'testlvl', seed: 1, moves: 20, colors: [0, 1, 2],
  layout: ['...', '...'],
  goals: [{ type: 'collect', color: 0, count: 10 }],
};

describe('parseLevel', () => {
  it('accepts a valid level', () => {
    const l = parseLevel({ ...valid, name: 'Hi', stars: { two: 15, three: 10 } }, '1-1');
    expect(l).toMatchObject({ id: 'testlvl', label: '1-1', name: 'Hi', moves: 20, stars: { two: 15, three: 10 } });
  });

  it.each([
    ['missing id', { id: undefined }, /"id"/],
    ['id format', { id: 'Has Space' }, /"id"/],
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
    ['unknown top-level key', { anchorDrop: 2 }, /unknown key "anchorDrop"/],
    ['unknown goal key', { goals: [{ type: 'collect', color: 0, count: 1, colour: 1 }] }, /goal 0: unknown key "colour"/],
    ['unknown piece key', { pieces: [{ r: 0, c: 0, type: 'anchor', spots: 2 }] }, /piece 0: unknown key "spots"/],
    ['unknown wall key', { walls: [{ r: 0, c: 0, side: 'right', thick: true }] }, /wall 0: unknown key "thick"/],
    ['unknown stars key', { stars: { two: 5, three: 3, one: 9 } }, /unknown key "one"/],
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
  const v = (id: string) => ({ ...valid, id });

  it('orders worlds and levels by number and labels them by position', () => {
    const c = buildCatalog({
      '/levels/world-2/01.json': v('ccc111'),
      '/levels/world-1/02.json': v('bbb111'),
      '/levels/world-1/01.json': v('aaa111'),
      '/levels/world-1/world.json': { name: 'Dots' },
    });
    expect(c.worlds.map((w) => w.name)).toEqual(['Dots', 'World 2']);
    expect(c.order.map((l) => l.label)).toEqual(['1-1', '1-2', '2-1']);
    expect(c.order.map((l) => l.id)).toEqual(['aaa111', 'bbb111', 'ccc111']);
    expect(c.byId.get('bbb111')?.label).toBe('1-2');
  });

  it('rejects gaps in level numbering', () => {
    expect(() => buildCatalog({ '/levels/world-1/02.json': valid })).toThrow(/missing 1/);
  });

  it('rejects duplicate ids', () => {
    expect(() => buildCatalog({ '/levels/world-1/01.json': v('aaa111'), '/levels/world-1/02.json': v('aaa111') })).toThrow(/share the id/);
  });

  it('every level id is unique across shipped levels and candidates', () => {
    const all = [...catalog.order, ...candidates.order];
    const ids = new Set(all.map((l) => l.id));
    expect(ids.size).toBe(all.length);
  });

  it('dropping a level file leaves every other level\'s record and unlock state intact', () => {
    const before = buildCatalog({
      '/levels/world-1/01.json': v('aaa111'),
      '/levels/world-1/02.json': v('bbb111'),
      '/levels/world-1/03.json': v('ccc111'),
      '/levels/world-1/04.json': v('ddd111'),
    });
    // Drop 1-2; the files after it are renumbered.
    const after = buildCatalog({
      '/levels/world-1/01.json': v('aaa111'),
      '/levels/world-1/02.json': v('ccc111'),
      '/levels/world-1/03.json': v('ddd111'),
    });
    let save = emptySave();
    for (const id of ['aaa111', 'bbb111', 'ccc111']) save = recordWin(save, id, 10 + id.charCodeAt(0), false);
    const unlocked = (c: typeof before, id: string) => isUnlocked(save, c.order.map((l) => l.id), id);
    for (const id of ['aaa111', 'ccc111', 'ddd111']) {
      expect(after.byId.get(id)).toBeDefined();
      expect(unlocked(after, id)).toBe(unlocked(before, id));
    }
    // The record for "ccc111" still describes that level, now labeled 1-2.
    expect(after.byId.get('ccc111')!.label).toBe('1-2');
    expect(save.levels.ccc111.bestMoves).toBe(10 + 'c'.charCodeAt(0));
    expect(unlocked(after, 'ddd111')).toBe(true);
  });

  it('every shipped level and candidate builds and starts playable', () => {
    expect(catalog.order.length).toBeGreaterThan(0);
    for (const level of [...catalog.order, ...candidates.order]) {
      const s = createGame(level);
      expect(hasMove(s), level.label).toBe(true);
    }
  });
});
