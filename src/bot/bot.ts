// The level-testing bot: randomized greedy with a short lookahead. Each turn it
// lists a handful of candidate moves (per same-color group: the best few loops,
// ranked by what they enclose, and the longest lines it finds), plays each one
// on a copy of the board, and scores the result by goal progress plus a little
// noise. The top few are then scored again with the best reply after them.
// Pure and seeded like the rules, so runs are reproducible.
import {
  applyMove, canLink, cellsAround, connectableColor, createGame, enclosedCells, goalRemaining, Rng, seedRng,
  type GameState, type LevelDef,
} from '../rules';

export interface BotOptions {
  /**
   * Noise added to each candidate's score, in units of one item of the largest
   * goal (0 = always the same choice). Below 1, so it only breaks near-ties.
   */
  noise?: number;
  /** Search budget per group when looking for long lines. */
  pathBudget?: number;
  /** How many of the best one-move candidates get a second look with their best reply (0 = pure greedy). */
  lookahead?: number;
  /** Weight of the best reply's score in that second look. */
  replyWeight?: number;
}

const DEFAULTS: Required<BotOptions> = { noise: 0.2, pathBudget: 400, lookahead: 3, replyWeight: 0.5 };

/** Same-color groups of cells a line could run through. */
function groups(s: GameState): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let i = 0; i < s.cells.length; i++) {
    if (seen.has(i) || !s.cells[i]) continue;
    const group: number[] = [];
    const stack = [i];
    seen.add(i);
    while (stack.length) {
      const a = stack.pop()!;
      group.push(a);
      for (const b of neighbors(s, a)) {
        if (!seen.has(b) && canLink(s, a, b)) {
          seen.add(b);
          stack.push(b);
        }
      }
    }
    if (group.length >= 2) out.push(group);
  }
  return out;
}

function neighbors(s: GameState, i: number): number[] {
  const c = i % s.cols;
  const out: number[] = [];
  if (i >= s.cols) out.push(i - s.cols);
  if (i + s.cols < s.cells.length) out.push(i + s.cols);
  if (c > 0) out.push(i - 1);
  if (c + 1 < s.cols) out.push(i + 1);
  return out;
}

/**
 * Distinct closed loops inside the group (one per non-tree edge of a DFS),
 * best first: by how many other-color dots and ladybugs they enclose (each a
 * bomb), then by how many gems those bombs would reach. At most `max`.
 */
export function findLoops(s: GameState, group: number[], max = 4): number[][] {
  const seen = new Set<string>();
  const loops: { path: number[]; bombs: number; gems: number }[] = [];
  for (const path of cycles(s, group)) {
    const key = path.slice(0, -1).sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const color = connectableColor(s, path[0]);
    const bombs = enclosedCells(s, path).filter((i) => {
      const p = s.cells[i];
      return (p?.kind === 'dot' || p?.kind === 'ladybug') && p.color !== color;
    });
    const hit = new Set<number>();
    for (const b of bombs) for (const j of cellsAround(s, b, s.bombRadius)) if (s.cells[j]?.kind === 'gem') hit.add(j);
    loops.push({ path, bombs: bombs.length, gems: hit.size });
  }
  loops.sort((a, b) => b.bombs - a.bombs || b.gems - a.gems);
  return loops.slice(0, max).map((l) => l.path);
}

/** Every cycle closed by a non-tree edge of a DFS over the group (paths start and end at the same cell). */
function* cycles(s: GameState, group: number[]): Generator<number[]> {
  const inGroup = new Set(group);
  const parent = new Map<number, number>();
  const depth = new Map<number, number>();
  for (const root of group) {
    if (depth.has(root)) continue;
    depth.set(root, 0);
    parent.set(root, -1);
    const stack = [root];
    while (stack.length) {
      const a = stack.pop()!;
      for (const b of neighbors(s, a)) {
        if (!inGroup.has(b) || !canLink(s, a, b) || b === parent.get(a)) continue;
        if (!depth.has(b)) {
          depth.set(b, depth.get(a)! + 1);
          parent.set(b, a);
          stack.push(b);
        } else {
          // A non-tree edge a-b: climb from both ends to their common
          // ancestor, then close the cycle back at a.
          const fromA: number[] = [];
          const fromB: number[] = [];
          let x = a;
          let y = b;
          while (x !== y) {
            if (depth.get(x)! >= depth.get(y)!) {
              fromA.push(x);
              x = parent.get(x)!;
            } else {
              fromB.push(y);
              y = parent.get(y)!;
            }
          }
          const loop = [...fromA, x, ...fromB.reverse(), a];
          if (loop.length >= 5) yield loop;
        }
      }
    }
  }
}

/**
 * Cells worth clearing for reasons a plain "clear the most" search misses:
 * the cells under anchors (so they drop), iced cells (to crack them), dry
 * cells next to active water (to spread it), ladybugs, slimed cells, and
 * cells next to fire (to put it out).
 */
export function targetCells(s: GameState): Set<number> {
  const out = new Set<number>();
  const flooding = s.goals.some((g) => g.goal.type === 'flood');
  s.cells.forEach((p, i) => {
    if (flooding && s.layers.water[i] && s.layers.ice[i] === 0) {
      for (const j of neighbors(s, i)) if (s.cells[j] && !s.layers.water[j] && s.layers.ice[j] === 0) out.add(j);
    }
    if (p?.kind === 'anchor') {
      for (let j = i + s.cols; j < s.cells.length; j += s.cols) if (s.cells[j]) out.add(j);
    }
    if (s.layers.ice[i] > 0 && p) out.add(i);
    if (p?.kind === 'ladybug') out.add(i);
    if (s.layers.slime[i] && s.layers.ice[i] === 0 && p) out.add(i);
    if (s.layers.fire[i] && s.layers.ice[i] === 0) for (const j of neighbors(s, i)) if (s.cells[j]) out.add(j);
  });
  return out;
}

/** The longest simple line found within a search budget, optionally starting from one cell. */
function longestLine(s: GameState, group: number[], budget: number, from?: number): number[] {
  const inGroup = new Set(group);
  let best: number[] = [];
  let steps = 0;
  const path: number[] = [];
  const onPath = new Set<number>();
  const dfs = (a: number) => {
    path.push(a);
    onPath.add(a);
    if (path.length > best.length) best = path.slice();
    for (const b of neighbors(s, a)) {
      if (steps++ > budget || best.length === group.length) break;
      if (inGroup.has(b) && !onPath.has(b) && canLink(s, a, b)) dfs(b);
    }
    path.pop();
    onPath.delete(a);
  };
  for (const start of from === undefined ? group : [from]) {
    if (steps > budget || best.length === group.length) break;
    dfs(start);
  }
  return best;
}

export function candidateMoves(s: GameState, budget = DEFAULTS.pathBudget): number[][] {
  const out: number[][] = [];
  // Lines over the same cells clear the same way; keep one of each.
  const seen = new Set<string>();
  const add = (path: number[]) => {
    const key = path.slice().sort((a, b) => a - b).join(',');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(path);
    }
  };
  const targets = targetCells(s);
  for (const g of groups(s)) {
    if (g.length >= 4) findLoops(s, g).forEach(add);
    add(g.length === 2 ? g : longestLine(s, g, budget));
    if (g.length > 2) for (const t of g) if (targets.has(t)) add(longestLine(s, g, budget / 4, t));
  }
  return out;
}

/**
 * Score for the board after a move: goal progress (each goal normalized by its
 * starting size), plus nudges toward progress the goals can't see yet.
 */
export function progressScore(before: GameState, after: GameState, startRemaining: number[]): number {
  let score = 0;
  after.goals.forEach((g, k) => {
    const was = goalRemaining(before, before.goals[k]);
    const now = goalRemaining(after, g);
    const share = 1 / Math.max(1, startRemaining[k]);
    score += (was - now) * share;
    // Anchors: reward moving them down, a fraction of what sinking one is worth.
    if (g.goal.type === 'anchors' && now > 0) score += 0.8 * share * anchorDescent(before, after);
    // Gems: credit for leaving a ready-made loop (a 2x2 square) in a color a gem is waiting for.
    if (g.goal.type === 'gems' && now > 0) score += 0.15 * share * (gemSquares(after) - gemSquares(before));
    // Ladybugs: partial credit for each spot knocked off.
    if (g.goal.type === 'ladybugs' && now > 0) score += 0.3 * share * (bugSpots(before) - bugSpots(after) - (was - now) );
    // Ice: partial credit for each layer knocked off.
    if (g.goal.type === 'ice' && now > 0) score += 0.3 * share * (iceLayers(before) - iceLayers(after));
  });
  return score;
}

/** 2x2 same-color squares in colors that some gem on the board needs (capped so one color can't dominate). */
function gemSquares(s: GameState): number {
  const want = new Set<number>();
  for (const p of s.cells) if (p?.kind === 'gem') want.add(p.color);
  if (want.size === 0) return 0;
  const found = new Map<number, number>();
  for (let r = 0; r + 1 < s.rows; r++) {
    for (let c = 0; c + 1 < s.cols; c++) {
      const a = r * s.cols + c;
      const col = connectableColor(s, a);
      if (col === null || !want.has(col)) continue;
      if (canLink(s, a, a + 1) && canLink(s, a + 1, a + s.cols + 1) && canLink(s, a + s.cols + 1, a + s.cols) && canLink(s, a + s.cols, a)) {
        found.set(col, Math.min(2, (found.get(col) ?? 0) + 1));
      }
    }
  }
  let n = 0;
  for (const v of found.values()) n += v;
  return n;
}

const bugSpots = (s: GameState) => s.cells.reduce((n, p) => n + (p?.kind === 'ladybug' ? p.spots : 0), 0);

const iceLayers = (s: GameState) => s.layers.ice.reduce((a, b) => a + b, 0);

/** How many rows the anchors on both boards moved down, as a fraction of board height. */
function anchorDescent(before: GameState, after: GameState): number {
  const rowOf = (s: GameState) => {
    const m = new Map<number, number>();
    s.cells.forEach((p, i) => p?.kind === 'anchor' && m.set(p.id, Math.floor(i / s.cols)));
    return m;
  };
  const a = rowOf(before);
  const b = rowOf(after);
  let total = 0;
  for (const [id, r] of b) if (a.has(id)) total += r - a.get(id)!;
  return total / before.rows;
}

export interface RunResult {
  won: boolean;
  /** Moves the bot needed to meet every goal (or the moves it used before giving up). */
  movesUsed: number;
}

/** Scores single moves from one board: goal progress plus small tie-breakers. */
function scorer(s: GameState, startRemaining: number[]) {
  const targets = targetCells(s);
  const nearTarget = new Set<number>();
  for (const t of targets) for (const n of neighbors(s, t)) if (!targets.has(n)) nearTarget.add(n);
  return (path: number[]): { state: GameState; score: number } => {
    const { state, result } = applyMove(s, path);
    let cleared = 0;
    let near = 0;
    for (const st of result.steps) {
      cleared += st.cells.length;
      for (const i of st.cells) if (nearTarget.has(i)) near++;
    }
    const score =
      (state.status === 'won' ? 100 : 0) +
      progressScore(s, state, startRemaining) +
      0.002 * cleared +
      // Clearing next to a stuck target brings it new neighbors.
      0.006 * near;
    return { state, score };
  };
}

/** The best score any one move from `s` reaches (no noise). */
function bestReply(s: GameState, startRemaining: number[], budget: number): number {
  if (s.status !== 'playing') return 0;
  const score = scorer(s, startRemaining);
  let best = -Infinity;
  for (const path of candidateMoves(s, budget)) best = Math.max(best, score(path).score);
  return Number.isFinite(best) ? best : 0;
}

/**
 * Plays one game. `moveCap` overrides the level's limit so the bot can report
 * how many moves it actually needed.
 */
export function playOnce(level: LevelDef, playSeed: number, moveCap?: number, opts: BotOptions = {}): RunResult {
  const o = { ...DEFAULTS, ...opts };
  const rng = new Rng(seedRng(playSeed * 7919 + 17));
  let s = createGame(level, { playSeed });
  if (moveCap !== undefined) s = { ...s, moveLimit: moveCap };
  const startRemaining = s.goals.map((g) => goalRemaining(s, g));
  // One item of the largest goal: the smallest unit of progress the score sees.
  const unit = 1 / Math.max(1, ...startRemaining);

  while (s.status === 'playing') {
    const score = scorer(s, startRemaining);
    const scored = candidateMoves(s, o.pathBudget).map((path) => {
      const r = score(path);
      return { state: r.state, score: r.score + o.noise * unit * rng.float() };
    });
    // Second look at the best few: add the best reply after each.
    const top = scored.slice().sort((a, b) => b.score - a.score).slice(0, o.lookahead);
    let best = scored.reduce((a, b) => (b.score > a.score ? b : a));
    let bestTotal = -Infinity;
    for (const c of top) {
      const total = c.score + (c.state.status === 'won' ? 0 : o.replyWeight * bestReply(c.state, startRemaining, o.pathBudget / 2));
      if (total > bestTotal) {
        bestTotal = total;
        best = c;
      }
    }
    s = best.state;
  }
  return { won: s.status === 'won', movesUsed: s.movesUsed };
}

export interface LevelStats {
  runs: number;
  /** Share of runs the bot finished within the level's move limit. */
  winRate: number;
  /** Share of runs the bot finished at all (with a generous move cap). */
  finishRate: number;
  /** Moves needed in finished runs, ascending. */
  movesNeeded: number[];
  median: number;
  p10: number;
  p75: number;
}

export function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
}

/** Runs the bot many times with a generous cap and summarizes how many moves it needed. */
export function analyzeLevel(level: LevelDef, runs = 100, seed = 1, opts: BotOptions = {}): LevelStats {
  const cap = Math.max(level.moves * 3, 60);
  const needed: number[] = [];
  for (let k = 0; k < runs; k++) {
    const r = playOnce(level, seed + k, cap, opts);
    if (r.won) needed.push(r.movesUsed);
  }
  needed.sort((a, b) => a - b);
  // Failed runs count as "needed more than the cap" for percentiles.
  const all = [...needed, ...new Array(runs - needed.length).fill(Infinity)];
  return {
    runs,
    winRate: needed.filter((m) => m <= level.moves).length / runs,
    finishRate: needed.length / runs,
    movesNeeded: needed,
    median: percentile(all, 0.5),
    p10: percentile(all, 0.1),
    p75: percentile(all, 0.75),
  };
}

export interface Tuning {
  moves: number;
  stars: { two: number; three: number };
  /** Too short for separate 2- and 3-star cutoffs. */
  oneTier?: boolean;
}

/** Bot share of runs that should fit in the move limit. */
export const TARGET_WIN_RATE = 0.75;

/**
 * Move limit and star cutoffs from bot results: the limit fits ~75% of bot
 * runs; 2 stars for beating the bot's median; 3 for matching its best 10%,
 * always strictly fewer moves than 2 stars. Levels of 2 moves or fewer have
 * one tier (two = three = 1).
 */
export function tuneFromStats(stats: LevelStats): Tuning | null {
  if (stats.finishRate < TARGET_WIN_RATE || !Number.isFinite(stats.p75)) return null;
  const moves = stats.p75;
  if (moves <= 2) return { moves, stars: { two: 1, three: 1 }, oneTier: true };
  const two = Math.max(2, Math.min(moves, stats.median - 1));
  const three = Math.max(1, Math.min(two - 1, stats.p10));
  return { moves, stars: { two, three } };
}

/** Move limit over median: above this, whether a run fits the limit is mostly refill luck. */
export const MAX_LIMIT_TO_MEDIAN = 1.6;
/** Median over the best 10%: above this, 3 stars is mostly refill luck. */
export const MAX_MEDIAN_TO_BEST = 2.2;

/** True when the bot's results spread so wide that the outcome is mostly refill luck. */
export function isLuckHeavy(stats: LevelStats): boolean {
  return stats.p75 / stats.median > MAX_LIMIT_TO_MEDIAN || stats.median / stats.p10 > MAX_MEDIAN_TO_BEST;
}
