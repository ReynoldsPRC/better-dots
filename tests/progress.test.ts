import { describe, expect, it } from 'vitest';
import { emptySave, isUnlocked, migrateSave, parseSave, recordWin } from '../src/progress';

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
