import { describe, expect, it } from 'vitest';
import { awardPowerUps, emptySave, isUnlocked, migrateSave, parseSave, recordWin, spendPowerUp } from '../src/progress';
import { parseLevel } from '../src/rules';

const ORDER = ['aaa111', 'bbb111', 'ccc111'];
const NO_LABELS = new Map<string, string>();

describe('progress', () => {
  it('unlocks levels one at a time, in order', () => {
    let save = emptySave();
    expect(ORDER.map((id) => isUnlocked(save, ORDER, id))).toEqual([true, false, false]);
    save = recordWin(save, 'aaa111', 10, false);
    expect(ORDER.map((id) => isUnlocked(save, ORDER, id))).toEqual([true, true, false]);
  });

  it('the developer switch unlocks everything', () => {
    const save = emptySave();
    expect(isUnlocked(save, ORDER, 'ccc111', true)).toBe(true);
    save.settings.devUnlock = true;
    expect(isUnlocked(save, ORDER, 'ccc111')).toBe(true);
  });

  it('an assisted clear unlocks the next level but records no moves and is marked', () => {
    const save = recordWin(emptySave(), 'aaa111', 22, true);
    expect(save.levels.aaa111).toEqual({ bestMoves: null, assistedOnly: true });
    expect(isUnlocked(save, ORDER, 'bbb111')).toBe(true);
  });

  it('replaying without the assist records moves and clears the mark', () => {
    let save = recordWin(emptySave(), 'aaa111', 22, true);
    save = recordWin(save, 'aaa111', 12, false);
    expect(save.levels.aaa111).toEqual({ bestMoves: 12, assistedOnly: false });
  });

  it('never lowers earlier results', () => {
    let save = recordWin(emptySave(), 'aaa111', 8, false);
    save = recordWin(save, 'aaa111', 15, false);
    save = recordWin(save, 'aaa111', 30, true);
    expect(save.levels.aaa111).toEqual({ bestMoves: 8, assistedOnly: false });
  });

  it('round-trips through export and import', () => {
    let save = recordWin(emptySave(), 'aaa111', 8, false);
    save.settings.colorblind = true;
    save = recordWin(save, 'bbb111', 9, true);
    expect(parseSave(JSON.parse(JSON.stringify(save)), NO_LABELS)).toEqual(save);
  });

  it('rejects files that are not saves', () => {
    expect(() => parseSave({ hello: 1 }, NO_LABELS)).toThrow();
    expect(() => parseSave({ version: 3, levels: {} }, NO_LABELS)).toThrow(/version/);
    expect(() => parseSave({ version: 1, levels: { '1-1': { stars: 9 } } }, NO_LABELS)).toThrow(/stars/);
    expect(() => parseSave({ version: 2, levels: { aaa111: { bestMoves: -1 } } }, NO_LABELS)).toThrow(/bestMoves/);
  });
});

describe('version 1 saves', () => {
  const labels = new Map([['1-1', 'aaa111'], ['1-2', 'bbb111'], ['c4-2', 'ccc111']]);
  const v1 = {
    version: 1,
    levels: {
      '1-1': { stars: 3, bestMoves: 8, assistedOnly: false },
      '1-2': { stars: 0, bestMoves: null, assistedOnly: true },
      'c4-2': { stars: 2, bestMoves: 14, assistedOnly: false },
      '9-9': { stars: 1, bestMoves: 30, assistedOnly: false },
    },
    settings: { colorblind: true, devUnlock: false },
  };

  it('migrate records from labels to ids, drop stored stars, and drop labels with no level', () => {
    const save = parseSave(v1, labels);
    expect(save).toEqual({
      version: 2,
      levels: {
        aaa111: { bestMoves: 8, assistedOnly: false },
        bbb111: { bestMoves: null, assistedOnly: true },
        ccc111: { bestMoves: 14, assistedOnly: false },
      },
      settings: { colorblind: true, devUnlock: false },
      powerUps: 0,
      awarded: { levels: [], worlds: [] },
    });
  });

  it('migrateSave is pure', () => {
    const input = { levels: { '1-1': { bestMoves: 8, assistedOnly: false } }, settings: { colorblind: false, devUnlock: true } };
    const copy = structuredClone(input);
    const out = migrateSave(input, labels);
    expect(input).toEqual(copy);
    expect(out.levels).toEqual({ aaa111: { bestMoves: 8, assistedOnly: false } });
    expect(out.settings.devUnlock).toBe(true);
  });
});

describe('power-ups', () => {
  // Stars: 3 at 5 moves or fewer, 2 at 8 or fewer.
  const level = (id: string) => parseLevel({
    id, seed: 1, moves: 12, colors: [0, 1], layout: ['..', '..'], goals: [{ type: 'collect', color: 0, count: 2 }], stars: { two: 8, three: 5 },
  }, id);
  const worlds = [{ number: 1, levels: [level('aaa111'), level('bbb111')] }, { number: 2, levels: [level('ccc111')] }];

  it('one for a level\'s first 3-star clear, and only once', () => {
    let save = recordWin(emptySave(), 'aaa111', 7, false);
    expect(awardPowerUps(save, worlds).earned).toBe(0);
    save = recordWin(save, 'aaa111', 4, false);
    const first = awardPowerUps(save, worlds);
    expect(first.earned).toBe(1);
    expect(first.save.powerUps).toBe(1);
    const again = awardPowerUps(recordWin(first.save, 'aaa111', 3, false), worlds);
    expect(again.earned).toBe(0);
    expect(again.save.powerUps).toBe(1);
  });

  it('two for finishing a world, once every level in it has an unassisted clear', () => {
    let save = recordWin(emptySave(), 'aaa111', 10, false);
    save = recordWin(save, 'bbb111', 10, true);
    expect(awardPowerUps(save, worlds).earned).toBe(0);
    save = recordWin(save, 'bbb111', 9, false);
    const r = awardPowerUps(save, worlds);
    expect(r.earned).toBe(2);
    expect(r.save.awarded.worlds).toEqual([1]);
    expect(awardPowerUps(r.save, worlds).earned).toBe(0);
  });

  it('assisted clears earn none, whatever the moves', () => {
    const save = recordWin(emptySave(), 'ccc111', 1, true);
    expect(awardPowerUps(save, worlds).earned).toBe(0);
  });

  it('spending takes one; with none it throws', () => {
    const save = { ...emptySave(), powerUps: 2 };
    expect(spendPowerUp(save).powerUps).toBe(1);
    expect(() => spendPowerUp(emptySave())).toThrow();
  });

  it('saves from before power-ups load with none; counts and awards round-trip', () => {
    const old = { version: 2, levels: {}, settings: { colorblind: false, devUnlock: false } };
    expect(parseSave(old, NO_LABELS)).toEqual(emptySave());
    const save = { ...emptySave(), powerUps: 3, awarded: { levels: ['aaa111'], worlds: [1] } };
    expect(parseSave(JSON.parse(JSON.stringify(save)), NO_LABELS)).toEqual(save);
    expect(() => parseSave({ ...old, powerUps: -1 }, NO_LABELS)).toThrow(/powerUps/);
  });
});
