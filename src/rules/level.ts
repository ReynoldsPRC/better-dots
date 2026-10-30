// Level data: checks a parsed level file and scores a finished attempt.
import { config } from '../config';
import { MAX_COLORS, type ColorId, type Goal, type LevelDef, type PlacedPiece, type Wall } from './types';

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isColor = (v: unknown): v is ColorId => isInt(v) && v >= 0 && v < MAX_COLORS;

/** Every key a level file may have. Anything else is most likely a typo. */
const LEVEL_KEYS = [
  'id', 'name', 'seed', 'moves', 'colors', 'layout', 'walls', 'pieces', 'anchorDrops', 'ice', 'water', 'slime', 'fire', 'goals', 'stars', 'bot',
];
const GOAL_KEYS: Record<string, string[]> = {
  collect: ['type', 'color', 'count'],
  anchors: ['type', 'count'],
  ice: ['type', 'count'],
  gems: ['type', 'count'],
  ladybugs: ['type', 'count'],
  flood: ['type'],
  slime: ['type'],
  fire: ['type'],
};
const PIECE_KEYS: Record<string, string[]> = {
  anchor: ['r', 'c', 'type'],
  gem: ['r', 'c', 'type', 'color', 'shape'],
  ladybug: ['r', 'c', 'type', 'color', 'spots'],
};
const WALL_KEYS = ['r', 'c', 'side'];

/** A level file's stable id: lowercase letters and digits. */
export const LEVEL_ID = /^[a-z0-9]{6,12}$/;

/**
 * Validates a level file's contents. Throws with a readable message on any problem.
 * `label` is the level's positional name ("1-3"), used in messages and shown to the player.
 */
export function parseLevel(raw: unknown, label: string): LevelDef {
  const fail = (msg: string): never => {
    throw new Error(`level ${label}: ${msg}`);
  };
  if (typeof raw !== 'object' || raw === null) fail('not an object');
  const o = raw as Record<string, unknown>;
  /** Fails on the first key of `obj` not in `allowed`. */
  const onlyKeys = (obj: unknown, allowed: readonly string[] | undefined, where: string) => {
    if (typeof obj !== 'object' || obj === null || !allowed) return;
    const bad = Object.keys(obj).find((k) => !allowed.includes(k));
    if (bad !== undefined) fail(`${where}unknown key ${JSON.stringify(bad)}`);
  };
  onlyKeys(o, LEVEL_KEYS, '');

  if (typeof o.id !== 'string' || !LEVEL_ID.test(o.id)) fail('"id" must be 6-12 lowercase letters or digits (run: npm run levels -- ids)');

  if (!isInt(o.seed)) fail('"seed" must be an integer');
  if (!isInt(o.moves) || (o.moves as number) < 1) fail('"moves" must be a positive integer');

  const colors = o.colors;
  if (!Array.isArray(colors) || colors.length < 1 || colors.length > MAX_COLORS || !colors.every(isColor)) {
    fail(`"colors" must list 1-${MAX_COLORS} color ids (0-4)`);
  }
  if (new Set(colors as number[]).size !== (colors as number[]).length) fail('"colors" has duplicates');

  const layout = o.layout;
  if (!Array.isArray(layout) || layout.length === 0 || !layout.every((r) => typeof r === 'string' && r.length > 0)) {
    fail('"layout" must be a non-empty list of row strings');
  }
  const rows = layout as string[];
  if (rows.some((r) => r.length !== rows[0].length)) fail('"layout" rows must all be the same length');
  rows.forEach((row, r) => {
    const bad = row.search(/[^.0-4-]/);
    if (bad >= 0) fail(`"layout" has ${JSON.stringify(row[bad])} at row ${r}, col ${bad}`);
  });
  if (!rows.some((r) => /[^-]/.test(r))) fail('"layout" has no cells');

  let walls: Wall[] | undefined;
  if (o.walls !== undefined) {
    if (!Array.isArray(o.walls)) fail('"walls" must be a list');
    walls = (o.walls as unknown[]).map((w, k): Wall => {
      const wo = w as Record<string, unknown>;
      onlyKeys(wo, WALL_KEYS, `wall ${k}: `);
      const sides = ['up', 'down', 'left', 'right'];
      if (!isInt(wo?.r) || !isInt(wo.c) || !sides.includes(wo.side as string)) {
        fail(`wall ${k}: must be { "r": row, "c": col, "side": "up" | "down" | "left" | "right" }`);
      }
      const r = wo.r as number, c = wo.c as number, side = wo.side as Wall['side'];
      const [r2, c2] = side === 'up' ? [r - 1, c] : side === 'down' ? [r + 1, c] : side === 'left' ? [r, c - 1] : [r, c + 1];
      const inGrid = (rr: number, cc: number) => rr >= 0 && rr < rows.length && cc >= 0 && cc < rows[0].length;
      if (!inGrid(r, c) || !inGrid(r2, c2)) fail(`wall ${k}: must sit between two cells of the layout`);
      return { r, c, side };
    });
  }

  const cellAt = (r: number, c: number) => isInt(r) && isInt(c) && r >= 0 && c >= 0 && r < rows.length && c < rows[0].length && rows[r][c] !== '-';

  /** An optional per-cell grid with the same shape as the layout. */
  const grid = (key: string, allowed: RegExp, what: string): string[] | undefined => {
    const g = o[key];
    if (g === undefined) return undefined;
    if (!Array.isArray(g) || g.length !== rows.length || !g.every((r) => typeof r === 'string' && r.length === rows[0].length)) {
      fail(`"${key}" must have the same rows and columns as "layout"`);
    }
    (g as string[]).forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      if (!allowed.test(ch)) fail(`"${key}" has ${JSON.stringify(ch)} at row ${r}, col ${c} (use "." or ${what})`);
      if (rows[r][c] === '-') fail(`"${key}" marks row ${r}, col ${c}, which is not a cell`);
    }));
    return (g as string[]).slice();
  };
  const ice = grid('ice', /^[1-3]$/, '1-3 for thickness');
  const iceCells = (ice ?? []).join('').replace(/\./g, '').length;
  const water = grid('water', /^x$/, 'x for watered');
  const slime = grid('slime', /^x$/, 'x for slimed');
  const fire = grid('fire', /^x$/, 'x for burning');
  const burning = (r: number, c: number) => fire?.[r][c] === 'x';
  fire?.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === 'x' && rows[r][c] !== '.') fail(`"fire" at row ${r}, col ${c}: a burning cell holds no dot, so its layout must be "."`);
  }));

  let pieces: PlacedPiece[] | undefined;
  if (o.pieces !== undefined) {
    if (!Array.isArray(o.pieces)) fail('"pieces" must be a list');
    const taken = new Set<string>();
    pieces = (o.pieces as unknown[]).map((x, k): PlacedPiece => {
      const po = x as Record<string, unknown>;
      if (!cellAt(po?.r as number, po?.c as number)) fail(`piece ${k}: "r" and "c" must name a cell of the layout`);
      onlyKeys(po, PIECE_KEYS[po.type as string], `piece ${k}: `);
      const at = `${po.r},${po.c}`;
      if (taken.has(at)) fail(`piece ${k}: another piece is already at row ${po.r}, col ${po.c}`);
      taken.add(at);
      const r = po.r as number;
      const c = po.c as number;
      if (burning(r, c)) fail(`piece ${k}: row ${r}, col ${c} is burning and can't hold a piece`);
      switch (po.type) {
        case 'anchor':
          return { r, c, type: 'anchor' };
        case 'gem':
          if (!isColor(po.color) || !(colors as number[]).includes(po.color)) fail(`piece ${k}: gem color must be one of "colors"`);
          if (po.shape !== 'column' && po.shape !== 'cross') fail(`piece ${k}: gem shape must be "column" or "cross"`);
          return { r, c, type: 'gem', color: po.color as ColorId, shape: po.shape as 'column' | 'cross' };
        case 'ladybug': {
          if (!isColor(po.color) || !(colors as number[]).includes(po.color)) fail(`piece ${k}: ladybug color must be one of "colors"`);
          if (po.spots !== undefined && !(isInt(po.spots) && po.spots >= 1 && po.spots <= 3)) fail(`piece ${k}: ladybug spots must be 1-3`);
          return { r, c, type: 'ladybug', color: po.color as ColorId, ...(po.spots !== undefined ? { spots: po.spots as number } : {}) };
        }
        default:
          return fail(`piece ${k}: unknown type ${JSON.stringify(po.type)}`);
      }
    });
  }
  const startAnchors = (pieces ?? []).filter((p) => p.type === 'anchor').length;

  let anchorDrops: number | undefined;
  if (o.anchorDrops !== undefined) {
    if (!isInt(o.anchorDrops) || o.anchorDrops < 0) fail('"anchorDrops" must be a whole number');
    anchorDrops = o.anchorDrops as number;
  }

  if (!Array.isArray(o.goals) || o.goals.length === 0) fail('"goals" must be a non-empty list');
  const positive = (v: unknown, k: number) => {
    if (!isInt(v) || v < 1) fail(`goal ${k}: "count" must be a positive integer`);
    return v as number;
  };
  const goals = (o.goals as unknown[]).map((g, k): Goal => {
    const go = g as Record<string, unknown>;
    onlyKeys(go, GOAL_KEYS[go?.type as string], `goal ${k}: `);
    switch (go?.type) {
      case 'collect':
        if (!isColor(go.color) || !(colors as number[]).includes(go.color)) fail(`goal ${k}: color must be one of "colors"`);
        return { type: 'collect', color: go.color as ColorId, count: positive(go.count, k) };
      case 'anchors': {
        const count = positive(go.count, k);
        if (count > startAnchors + (anchorDrops ?? 0)) fail(`goal ${k}: needs ${count} anchors but the level only has ${startAnchors + (anchorDrops ?? 0)}`);
        return { type: 'anchors', count };
      }
      case 'flood':
        if (!water) fail(`goal ${k}: a flood goal needs some starting "water"`);
        return { type: 'flood' };
      case 'slime':
        if (!slime) fail(`goal ${k}: a slime goal needs some starting "slime"`);
        return { type: 'slime' };
      case 'fire':
        if (!fire) fail(`goal ${k}: a fire goal needs some starting "fire"`);
        return { type: 'fire' };
      case 'gems': {
        const count = positive(go.count, k);
        const have = (pieces ?? []).filter((p) => p.type === 'gem').length;
        if (count > have) fail(`goal ${k}: needs ${count} gems but the level only has ${have}`);
        return { type: 'gems', count };
      }
      case 'ladybugs': {
        const count = positive(go.count, k);
        const have = (pieces ?? []).filter((p) => p.type === 'ladybug').length;
        if (count > have) fail(`goal ${k}: needs ${count} ladybugs but the level only has ${have}`);
        return { type: 'ladybugs', count };
      }
      case 'ice': {
        const count = positive(go.count, k);
        if (count > iceCells) fail(`goal ${k}: needs ${count} ice but the level only has ${iceCells}`);
        return { type: 'ice', count };
      }
      default:
        return fail(`goal ${k}: unknown type ${JSON.stringify(go?.type)}`);
    }
  });

  let stars: LevelDef['stars'];
  if (o.stars !== undefined) {
    const s = o.stars as Record<string, unknown>;
    onlyKeys(s, ['two', 'three'], '"stars": ');
    if (!isInt(s?.two) || !isInt(s?.three) || s.three > s.two || s.two > (o.moves as number) || s.three < 1) {
      fail('"stars" must be { "two": n, "three": m } with 1 <= three <= two <= moves');
    }
    stars = { two: s.two as number, three: s.three as number };
  }

  return {
    id: o.id as string,
    label,
    name: typeof o.name === 'string' ? o.name : undefined,
    seed: o.seed as number,
    moves: o.moves as number,
    colors: (colors as ColorId[]).slice(),
    layout: rows.slice(),
    walls,
    pieces,
    anchorDrops,
    ice,
    water,
    slime,
    fire,
    goals,
    stars,
  };
}

/**
 * Star cutoffs as "most moves used" for 2 and 3 stars. Levels get these from
 * the bot; until then they fall back to fractions of the move limit.
 */
export function starCutoffs(level: LevelDef): { two: number; three: number } {
  if (level.stars) return level.stars;
  const { fallbackTwo, fallbackThree } = config.stars;
  return {
    two: Math.max(1, Math.floor(level.moves * fallbackTwo)),
    three: Math.max(1, Math.floor(level.moves * fallbackThree)),
  };
}

/** Stars for a win. Assisted clears earn none. */
export function starsFor(level: LevelDef, movesUsed: number, assisted: boolean): 0 | 1 | 2 | 3 {
  if (assisted) return 0;
  const { two, three } = starCutoffs(level);
  return movesUsed <= three ? 3 : movesUsed <= two ? 2 : 1;
}
