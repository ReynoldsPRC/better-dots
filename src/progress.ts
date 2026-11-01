// Saved progress: what's cleared, best moves, settings. Pure functions over a plain
// object; src/ui/storage.ts persists it to localStorage and handles export/import.
// Records are keyed on each level's stable id, so renumbering level files doesn't
// move progress between levels. Stars aren't stored: they're derived from the best
// moves and the level's current thresholds, so retuning a level updates them.
import { starsFor, type LevelDef } from './rules';

/** Power-ups earned for a level's first 3-star clear, and for finishing a world. */
export const POWER_UPS_PER_THREE_STAR = 1;
export const POWER_UPS_PER_WORLD = 2;

export interface LevelRecord {
  /** Fewest moves in an unassisted clear (null if only ever cleared with the assist). */
  bestMoves: number | null;
  /** Cleared, but only ever with the assist. Shown as a mark in level select. */
  assistedOnly: boolean;
}

export interface Settings {
  colorblind: boolean;
  /** Developer switch: every level unlocked. */
  devUnlock: boolean;
  /** Highlight an available square after a few seconds without input. */
  squareHint: boolean;
}

export interface SaveData {
  version: 2;
  levels: Record<string, LevelRecord>;
  settings: Settings;
  /** Power-ups on hand (one pool: each can be used as any of the four kinds). */
  powerUps: number;
  /** Awards already given, so each is earned once: level ids (3 stars) and world numbers. */
  awarded: { levels: string[]; worlds: number[] };
}

export function emptySave(): SaveData {
  return { version: 2, levels: {}, settings: { colorblind: false, devUnlock: false, squareHint: false }, powerUps: 0, awarded: { levels: [], worlds: [] } };
}

/**
 * Gives any power-ups earned and not yet given: one for each level with a
 * 3-star best (at its current thresholds), two for each world whose every
 * level has an unassisted clear. Assisted clears earn none. Safe to call
 * any time (after a win, on load); returns the new save and how many were given.
 */
export function awardPowerUps(save: SaveData, worlds: readonly { number: number; levels: readonly LevelDef[] }[]): { save: SaveData; earned: number } {
  const levels = new Set(save.awarded.levels);
  const done = new Set(save.awarded.worlds);
  let earned = 0;
  const clean = (l: LevelDef) => {
    const rec = save.levels[l.id];
    return rec && !rec.assistedOnly && rec.bestMoves != null ? rec.bestMoves : null;
  };
  for (const w of worlds) {
    for (const l of w.levels) {
      const best = clean(l);
      if (best !== null && !levels.has(l.id) && starsFor(l, best, false) === 3) {
        levels.add(l.id);
        earned += POWER_UPS_PER_THREE_STAR;
      }
    }
    if (w.levels.length > 0 && !done.has(w.number) && w.levels.every((l) => clean(l) !== null)) {
      done.add(w.number);
      earned += POWER_UPS_PER_WORLD;
    }
  }
  if (earned === 0) return { save, earned };
  return { save: { ...save, powerUps: save.powerUps + earned, awarded: { levels: [...levels], worlds: [...done].sort((a, b) => a - b) } }, earned };
}

/** Spends one power-up. Throws if there are none. */
export function spendPowerUp(save: SaveData): SaveData {
  if (save.powerUps < 1) throw new Error('no power-ups to spend');
  return { ...save, powerUps: save.powerUps - 1 };
}

/** Records a win. Never lowers earlier results. */
export function recordWin(save: SaveData, levelId: string, movesUsed: number, assisted: boolean): SaveData {
  const prev = save.levels[levelId];
  const rec: LevelRecord = assisted
    ? prev ?? { bestMoves: null, assistedOnly: true }
    : { bestMoves: prev?.bestMoves == null ? movesUsed : Math.min(prev.bestMoves, movesUsed), assistedOnly: false };
  return { ...save, levels: { ...save.levels, [levelId]: rec } };
}

export function isCleared(save: SaveData, levelId: string): boolean {
  return levelId in save.levels;
}

/** Levels unlock one at a time, in order. `order` is every level id in play order. */
export function isUnlocked(save: SaveData, order: readonly string[], levelId: string, devUnlock = save.settings.devUnlock): boolean {
  if (devUnlock) return true;
  const k = order.indexOf(levelId);
  return k === 0 || (k > 0 && isCleared(save, order[k - 1]));
}

/**
 * Version 1 saves were keyed on positional labels ("4-3") and stored stars.
 * Maps each record through `labelToId`; records with no matching level are dropped.
 */
export function migrateSave(v1: { levels: Record<string, LevelRecord>; settings: Settings }, labelToId: ReadonlyMap<string, string>): SaveData {
  const save = emptySave();
  for (const [label, rec] of Object.entries(v1.levels)) {
    const id = labelToId.get(label);
    if (id) save.levels[id] = { bestMoves: rec.bestMoves, assistedOnly: rec.assistedOnly };
  }
  save.settings = { ...v1.settings };
  return save;
}

/**
 * Checks and normalizes a save loaded from storage or an imported file. Throws if unusable.
 * Version 1 saves are migrated through `labelToId` (see migrateSave).
 */
export function parseSave(raw: unknown, labelToId: ReadonlyMap<string, string>): SaveData {
  if (typeof raw !== 'object' || raw === null) throw new Error('not a better dots save file');
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 && o.version !== 2) throw new Error(`unsupported save version ${JSON.stringify(o.version)}`);
  if (typeof o.levels !== 'object' || o.levels === null) throw new Error('save has no levels');
  const levels: Record<string, LevelRecord> = {};
  for (const [id, v] of Object.entries(o.levels as Record<string, unknown>)) {
    const r = v as Record<string, unknown>;
    if (o.version === 1 && ![0, 1, 2, 3].includes(r?.stars as number)) throw new Error(`level ${id}: bad stars`);
    const best = r?.bestMoves;
    if (best !== null && !(typeof best === 'number' && Number.isInteger(best) && best > 0)) throw new Error(`level ${id}: bad bestMoves`);
    levels[id] = { bestMoves: best, assistedOnly: r.assistedOnly === true };
  }
  const s = (o.settings ?? {}) as Record<string, unknown>;
  const settings = { colorblind: s.colorblind === true, devUnlock: s.devUnlock === true, squareHint: s.squareHint === true };
  if (o.version === 1) return migrateSave({ levels, settings }, labelToId);
  // Saves from before power-ups have neither field.
  const n = o.powerUps ?? 0;
  if (!(typeof n === 'number' && Number.isInteger(n) && n >= 0)) throw new Error('bad powerUps');
  const a = (o.awarded ?? {}) as Record<string, unknown>;
  const awardedLevels = Array.isArray(a.levels) ? a.levels.filter((x): x is string => typeof x === 'string') : [];
  const awardedWorlds = Array.isArray(a.worlds) ? a.worlds.filter((x): x is number => Number.isInteger(x)) : [];
  return { version: 2, levels, settings, powerUps: n, awarded: { levels: awardedLevels, worlds: awardedWorlds } };
}
