// Level data: checks a parsed level file and scores a finished attempt.
import { config } from '../config';
import { MAX_COLORS, type ColorId, type Goal, type LevelDef } from './types';

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isColor = (v: unknown): v is ColorId => isInt(v) && v >= 0 && v < MAX_COLORS;

/** Validates a level file's contents. Throws with a readable message on any problem. */
export function parseLevel(raw: unknown, id: string): LevelDef {
  const fail = (msg: string): never => {
    throw new Error(`level ${id}: ${msg}`);
  };
  if (typeof raw !== 'object' || raw === null) fail('not an object');
  const o = raw as Record<string, unknown>;

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
    const bad = row.search(/[^.0-4]/);
    if (bad >= 0) fail(`"layout" has ${JSON.stringify(row[bad])} at row ${r}, col ${bad}`);
  });

  if (!Array.isArray(o.goals) || o.goals.length === 0) fail('"goals" must be a non-empty list');
  const goals = (o.goals as unknown[]).map((g, k): Goal => {
    const go = g as Record<string, unknown>;
    if (go?.type !== 'collect') fail(`goal ${k}: unknown type ${JSON.stringify(go?.type)}`);
    if (!isColor(go.color) || !(colors as number[]).includes(go.color)) fail(`goal ${k}: color must be one of "colors"`);
    if (!isInt(go.count) || (go.count as number) < 1) fail(`goal ${k}: "count" must be a positive integer`);
    return { type: 'collect', color: go.color as ColorId, count: go.count as number };
  });

  let stars: LevelDef['stars'];
  if (o.stars !== undefined) {
    const s = o.stars as Record<string, unknown>;
    if (!isInt(s?.two) || !isInt(s?.three) || s.three > s.two || s.two > (o.moves as number) || s.three < 1) {
      fail('"stars" must be { "two": n, "three": m } with 1 <= three <= two <= moves');
    }
    stars = { two: s.two as number, three: s.three as number };
  }

  return {
    id,
    name: typeof o.name === 'string' ? o.name : undefined,
    seed: o.seed as number,
    moves: o.moves as number,
    colors: (colors as ColorId[]).slice(),
    layout: rows.slice(),
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
