// The level catalog, built from the JSON files in /levels at build time.
// Layout: levels/world-N/world.json ({ "name": ... }) and levels/world-N/NN.json.
import { parseLevel, type LevelDef } from './rules';

export interface World {
  number: number;
  name: string;
  levels: LevelDef[];
}

export interface Catalog {
  worlds: World[];
  /** Every level in play order. */
  order: LevelDef[];
  /** Keyed on the stable id from the level file. */
  byId: Map<string, LevelDef>;
}

/**
 * Builds the catalog from { path: parsed JSON }. Paths look like ".../world-2/03.json".
 * `prefix` marks a separate set (candidates get "c", so labels look like "c2-3").
 */
export function buildCatalog(files: Record<string, unknown>, prefix = ''): Catalog {
  const worlds = new Map<number, { name: string; files: [number, unknown][] }>();
  for (const [path, data] of Object.entries(files)) {
    const m = path.match(/world-(\d+)\/(world|\d+)\.json$/);
    if (!m) throw new Error(`unexpected level file ${path}`);
    const w = Number(m[1]);
    const entry = worlds.get(w) ?? { name: prefix ? `World ${w} candidates` : `World ${w}`, files: [] };
    if (m[2] === 'world') entry.name = String((data as { name?: unknown }).name ?? entry.name);
    else entry.files.push([Number(m[2]), data]);
    worlds.set(w, entry);
  }
  const list: World[] = [...worlds.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, { name, files: fs }]) => ({
      number,
      name,
      levels: fs.sort(([a], [b]) => a - b).map(([n, data], k) => {
        if (n !== k + 1) throw new Error(`world-${number}: level files must be numbered 01, 02, ... (missing ${k + 1})`);
        return parseLevel(data, `${prefix}${number}-${n}`);
      }),
    }))
    .filter((w) => w.levels.length > 0);
  const order = list.flatMap((w) => w.levels);
  const byId = new Map<string, LevelDef>();
  for (const l of order) {
    const dup = byId.get(l.id);
    if (dup) throw new Error(`levels ${dup.label} and ${l.label} share the id ${l.id}`);
    byId.set(l.id, l);
  }
  return { worlds: list, order, byId };
}

export const catalog: Catalog = buildCatalog(
  import.meta.glob('../levels/world-*/*.json', { eager: true, import: 'default' }),
);

/** Generated levels waiting for the player to keep or reject. Shown with the developer switch on. */
export const candidates: Catalog = buildCatalog(
  import.meta.glob('../levels/candidates/world-*/*.json', { eager: true, import: 'default' }),
  'c',
);
