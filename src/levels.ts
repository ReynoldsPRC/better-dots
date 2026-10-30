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
  byId: Map<string, LevelDef>;
}

/** Builds the catalog from { path: parsed JSON }. Paths look like ".../world-2/03.json". */
export function buildCatalog(files: Record<string, unknown>): Catalog {
  const worlds = new Map<number, { name: string; files: [number, unknown][] }>();
  for (const [path, data] of Object.entries(files)) {
    const m = path.match(/world-(\d+)\/(world|\d+)\.json$/);
    if (!m) throw new Error(`unexpected level file ${path}`);
    const w = Number(m[1]);
    const entry = worlds.get(w) ?? { name: `World ${w}`, files: [] };
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
        return parseLevel(data, `${number}-${n}`);
      }),
    }))
    .filter((w) => w.levels.length > 0);
  const order = list.flatMap((w) => w.levels);
  return { worlds: list, order, byId: new Map(order.map((l) => [l.id, l])) };
}

export const catalog: Catalog = buildCatalog(
  import.meta.glob('../levels/world-*/*.json', { eager: true, import: 'default' }),
);
