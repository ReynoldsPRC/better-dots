import { describe, expect, it } from 'vitest';
import { emptySave, isUnlocked, parseSave, recordWin } from '../src/progress';

const ORDER = ['1-1', '1-2', '1-3'];

describe('progress', () => {
  it('unlocks levels one at a time, in order', () => {
    let save = emptySave();
    expect(ORDER.map((id) => isUnlocked(save, ORDER, id))).toEqual([true, false, false]);
    save = recordWin(save, '1-1', 10, 2, false);
    expect(ORDER.map((id) => isUnlocked(save, ORDER, id))).toEqual([true, true, false]);
  });

  it('the developer switch unlocks everything', () => {
    const save = emptySave();
    expect(isUnlocked(save, ORDER, '1-3', true)).toBe(true);
    save.settings.devUnlock = true;
    expect(isUnlocked(save, ORDER, '1-3')).toBe(true);
  });

  it('an assisted clear unlocks the next level but earns no stars and is marked', () => {
    const save = recordWin(emptySave(), '1-1', 22, 0, true);
    expect(save.levels['1-1']).toEqual({ stars: 0, bestMoves: null, assistedOnly: true });
    expect(isUnlocked(save, ORDER, '1-2')).toBe(true);
  });

  it('replaying without the assist earns stars and clears the mark', () => {
    let save = recordWin(emptySave(), '1-1', 22, 0, true);
    save = recordWin(save, '1-1', 12, 2, false);
    expect(save.levels['1-1']).toEqual({ stars: 2, bestMoves: 12, assistedOnly: false });
  });

  it('never lowers earlier results', () => {
    let save = recordWin(emptySave(), '1-1', 8, 3, false);
    save = recordWin(save, '1-1', 15, 1, false);
    save = recordWin(save, '1-1', 30, 0, true);
    expect(save.levels['1-1']).toEqual({ stars: 3, bestMoves: 8, assistedOnly: false });
  });

  it('round-trips through export and import', () => {
    let save = recordWin(emptySave(), '1-1', 8, 3, false);
    save.settings.colorblind = true;
    save = recordWin(save, '1-2', 9, 0, true);
    expect(parseSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it('rejects files that are not saves', () => {
    expect(() => parseSave({ hello: 1 })).toThrow();
    expect(() => parseSave({ version: 2, levels: {} })).toThrow(/version/);
    expect(() => parseSave({ version: 1, levels: { '1-1': { stars: 9 } } })).toThrow(/stars/);
  });
});
