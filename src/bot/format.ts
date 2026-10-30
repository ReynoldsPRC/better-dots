// Writes level files in a stable, readable JSON style: one row per layout
// line, one object per goal or wall line.
import type { LevelDef } from '../rules';

/** What the bot learned about a level, stored in its file for reference. */
export interface BotNote {
  runs: number;
  winRate: number;
  median: number;
  p10: number;
  /** Too short for separate 2- and 3-star cutoffs: any clear earns 3 stars. */
  oneTier?: boolean;
}

export type LevelFile = Omit<LevelDef, 'label'> & { bot?: BotNote };

/** The level as it should appear in a file: no label (that comes from the file's position). */
export function toLevelFile(level: LevelDef, bot?: BotNote): LevelFile {
  const { label: _label, ...rest } = level;
  const out: Record<string, unknown> = {};
  // Fixed key order keeps diffs small.
  for (const k of ['id', 'name', 'seed', 'moves', 'colors', 'layout', 'walls', 'pieces', 'anchorDrops', 'ice', 'water', 'slime', 'fire', 'goals', 'stars'] as const) {
    if (rest[k] !== undefined) out[k] = rest[k];
  }
  for (const [k, v] of Object.entries(rest)) if (!(k in out) && v !== undefined) out[k] = v;
  if (bot) out.bot = bot;
  return out as LevelFile;
}

export function formatLevelJson(file: LevelFile): string {
  const json = JSON.stringify(file, null, 2);
  return (
    json
      // Arrays of numbers on one line.
      .replace(/\[\n\s+(-?\d+(?:\.\d+)?(?:,\n\s+-?\d+(?:\.\d+)?)*)\n\s+\]/g, (_, body: string) => `[${body.split(/,\s+/).join(', ')}]`)
      // Small flat objects (goals, walls, stars, bot) on one line.
      .replace(/\{\n((?:\s+"[^"]+": (?:-?\d+(?:\.\d+)?|"[^"\n]*"|true|false),?\n)+)\s+\}/g, (_, body: string) =>
        `{ ${body.trim().split(/,?\n\s+/).map((x) => x.replace(/,$/, '')).join(', ')} }`)
    + '\n'
  );
}
