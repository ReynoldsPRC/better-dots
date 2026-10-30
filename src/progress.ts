// Saved progress: what's cleared, best moves, settings. Pure functions over a plain
// object; src/ui/storage.ts persists it to localStorage and handles export/import.
// Records are keyed on each level's stable id, so renumbering level files doesn't
// move progress between levels. Stars aren't stored: they're derived from the best
// moves and the level's current thresholds, so retuning a level updates them.

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
}

export interface SaveData {
  version: 2;
  levels: Record<string, LevelRecord>;
  settings: Settings;
}

export function emptySave(): SaveData {
  return { version: 2, levels: {}, settings: { colorblind: false, devUnlock: false } };
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
  const settings = { colorblind: s.colorblind === true, devUnlock: s.devUnlock === true };
  return o.version === 1 ? migrateSave({ levels, settings }, labelToId) : { version: 2, levels, settings };
}
