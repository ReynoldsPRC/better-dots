// Saved progress: what's cleared, stars, settings. Pure functions over a plain
// object; src/ui/storage.ts persists it to localStorage and handles export/import.

export interface LevelRecord {
  /** Best stars earned without the assist (0 if only ever cleared with it). */
  stars: 0 | 1 | 2 | 3;
  /** Fewest moves in an unassisted clear. */
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
  version: 1;
  levels: Record<string, LevelRecord>;
  settings: Settings;
}

export function emptySave(): SaveData {
  return { version: 1, levels: {}, settings: { colorblind: false, devUnlock: false } };
}

/** Records a win. Never lowers earlier results. */
export function recordWin(save: SaveData, levelId: string, movesUsed: number, stars: 0 | 1 | 2 | 3, assisted: boolean): SaveData {
  const prev = save.levels[levelId];
  const rec: LevelRecord = assisted
    ? prev ?? { stars: 0, bestMoves: null, assistedOnly: true }
    : {
        stars: Math.max(prev?.stars ?? 0, stars) as LevelRecord['stars'],
        bestMoves: prev?.bestMoves == null ? movesUsed : Math.min(prev.bestMoves, movesUsed),
        assistedOnly: false,
      };
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

/** Checks and normalizes a save loaded from storage or an imported file. Throws if unusable. */
export function parseSave(raw: unknown): SaveData {
  if (typeof raw !== 'object' || raw === null) throw new Error('not a better dots save file');
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) throw new Error(`unsupported save version ${JSON.stringify(o.version)}`);
  if (typeof o.levels !== 'object' || o.levels === null) throw new Error('save has no levels');
  const save = emptySave();
  for (const [id, v] of Object.entries(o.levels as Record<string, unknown>)) {
    const r = v as Record<string, unknown>;
    const stars = r?.stars;
    if (stars !== 0 && stars !== 1 && stars !== 2 && stars !== 3) throw new Error(`level ${id}: bad stars`);
    const best = r.bestMoves;
    if (best !== null && !(typeof best === 'number' && Number.isInteger(best) && best > 0)) throw new Error(`level ${id}: bad bestMoves`);
    save.levels[id] = { stars, bestMoves: best, assistedOnly: r.assistedOnly === true };
  }
  const s = (o.settings ?? {}) as Record<string, unknown>;
  save.settings = { colorblind: s.colorblind === true, devUnlock: s.devUnlock === true };
  return save;
}
