import { describe, expect, it } from 'vitest';
import {
  addMoves, applyMove, createGame, hasMove, movesLeft, Rng, seedRng,
  type ColorId, type GameState, type LevelDef,
} from '../src/rules';
import { at, cells, colorOf, colors, game } from './helpers';

const ids = (s: GameState) => s.cells.map((p) => p?.id ?? null);

describe('createGame', () => {
  it('places fixed colors and fills "." from the level seed', () => {
    const level: LevelDef = { id: 't', label: 't', seed: 9, moves: 10, colors: [1, 2], goals: [], layout: ['0..', '...'] };
    const a = createGame(level);
    const b = createGame(level);
    expect(colors(a)).toEqual(colors(b));
    expect(colorOf(a.cells[0])).toBe(0);
    for (const p of a.cells.slice(1)) expect([1, 2]).toContain(colorOf(p));
  });

  it('gives every piece a unique id', () => {
    const s = game(['....', '....'], {}, 3);
    expect(new Set(ids(s)).size).toBe(8);
  });

  it('reshuffles a starting board that has no move', () => {
    const s = game(['0101', '1010', '0101']);
    expect(hasMove(s)).toBe(true);
    expect(colors(s).join('').split('').sort()).toEqual('010110100101'.split('').sort());
  });

  it('rejects unknown layout characters', () => {
    expect(() => game(['0x'])).toThrow(/bad layout/);
  });
});

describe('line clears and gravity', () => {
  const BOARD = [
    '1231',
    '0032',
    '2131',
  ];

  it('clears the line, drops dots above it, and refills from the top', () => {
    const s = game(BOARD);
    const above0 = s.cells[at(s, 0, 0)]!.id;
    const above1 = s.cells[at(s, 0, 1)]!.id;
    const { state, result } = applyMove(s, cells(s, [1, 0], [1, 1]));
    expect(result.steps).toEqual([{ kind: 'line', cells: cells(s, [1, 0], [1, 1]), sources: [] }]);
    expect(state.cells[at(s, 1, 0)]!.id).toBe(above0);
    expect(state.cells[at(s, 1, 1)]!.id).toBe(above1);
    expect(result.spawned).toHaveLength(2);
    expect(result.spawned).toContain(state.cells[at(s, 0, 0)]!.id);
    expect(result.spawned).toContain(state.cells[at(s, 0, 1)]!.id);
    // Untouched columns stay put.
    for (const c of [2, 3]) for (const r of [0, 1, 2]) expect(state.cells[at(s, r, c)]).toBe(s.cells[at(s, r, c)]);
  });

  it('refills a whole column after a vertical line', () => {
    const s = game(BOARD);
    const { result } = applyMove(s, cells(s, [0, 2], [1, 2], [2, 2]));
    expect(result.spawned).toHaveLength(3);
  });

  it('uses one move and does not mutate the old state', () => {
    const s = game(BOARD);
    const before = JSON.stringify(s);
    const { state } = applyMove(s, cells(s, [1, 0], [1, 1]));
    expect(JSON.stringify(s)).toBe(before);
    expect(state.movesUsed).toBe(1);
    expect(movesLeft(state)).toBe(19);
  });

  it('refills only with the level colors', () => {
    let s = game(['00', '00'], { colors: [3, 4] as ColorId[] });
    for (let k = 0; k < 10 && s.status === 'playing'; k++) {
      const pair = firstPair(s)!;
      s = applyMove(s, pair).state;
    }
    for (const p of s.cells) expect([0, 3, 4]).toContain(colorOf(p));
  });

  it('throws on an invalid path or a finished game', () => {
    const s = game(BOARD);
    expect(() => applyMove(s, cells(s, [0, 0], [0, 1]))).toThrow(/invalid/);
    expect(() => applyMove({ ...s, status: 'won' }, cells(s, [1, 0], [1, 1]))).toThrow(/won/);
  });
});

describe('loops and bombs', () => {
  const RING = [
    '0001',
    '0201',
    '0003',
    '1231',
  ];
  const ring = (s: GameState) =>
    cells(s, [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]);

  it('a 2x2 square clears every dot of that color', () => {
    const s = game([
      '0012',
      '0010',
      '2120',
    ]);
    const { result } = applyMove(s, cells(s, [0, 0], [0, 1], [1, 1], [1, 0], [0, 0]));
    expect(result.loop).toBe(true);
    expect(result.steps[0].kind).toBe('loop');
    expect(result.steps[0].cells).toEqual(cells(s, [0, 0], [0, 1], [1, 0], [1, 1], [1, 3], [2, 3]));
  });

  it('any closed loop counts, not only squares', () => {
    const s = game(['000', '000', '111']);
    const { result } = applyMove(s, cells(s, [0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0], [0, 0]));
    expect(result.loop).toBe(true);
    expect(result.steps[0].cells).toHaveLength(6);
  });

  it('enclosed dots of other colors become bombs', () => {
    const s = game(RING);
    const { result } = applyMove(s, ring(s));
    expect(result.steps).toHaveLength(2);
    expect(result.steps[1]).toEqual({ kind: 'blast', cells: cells(s, [1, 1]), sources: [{ cell: at(s, 1, 1), type: 'bomb' }] });
  });

  it('a bomb clears the cells around it', () => {
    const level: LevelDef = { id: 't', label: 't', seed: 1, moves: 5, colors: [0, 1, 2, 3], goals: [], layout: RING };
    const s = createGame(level, { bombRadius: 2 });
    const { result } = applyMove(s, ring(s));
    expect(result.steps[1].cells).toHaveLength(16 - 8);
  });

  it('every kind of clear counts toward goals', () => {
    const level: LevelDef = {
      id: 't', label: 't', seed: 1, moves: 5, colors: [0, 1, 2, 3], layout: RING,
      goals: [{ type: 'collect', color: 0, count: 8 }, { type: 'collect', color: 2, count: 2 }],
    };
    const s = createGame(level, { bombRadius: 2 });
    const { state } = applyMove(s, ring(s));
    expect(state.goals.map((g) => g.progress)).toEqual([8, 2]);
    expect(state.status).toBe('won');
  });
});

describe('goals, winning, and running out of moves', () => {
  const BOARD = ['0011', '2233', '0011'];
  const goal = (count: number) => [{ type: 'collect' as const, color: 0 as ColorId, count }];

  it('wins when every goal is met', () => {
    const s = game(BOARD, { goals: goal(2) });
    const { state } = applyMove(s, cells(s, [0, 0], [0, 1]));
    expect(state.status).toBe('won');
  });

  it('loses when moves run out first', () => {
    const s = game(BOARD, { goals: goal(99), moves: 1 });
    const { state } = applyMove(s, cells(s, [0, 2], [0, 3]));
    expect(state.status).toBe('lost');
  });

  it('meeting the goal on the last move is a win', () => {
    const s = game(BOARD, { goals: goal(2), moves: 1 });
    expect(applyMove(s, cells(s, [0, 0], [0, 1])).state.status).toBe('won');
  });

  it('a board with no goals never counts as won', () => {
    const s = game(BOARD);
    expect(applyMove(s, cells(s, [0, 0], [0, 1])).state.status).toBe('playing');
  });

  it('the assist adds moves, resumes play, and marks the attempt', () => {
    const s = game(BOARD, { goals: goal(99), moves: 1 });
    const lost = applyMove(s, cells(s, [0, 2], [0, 3])).state;
    const resumed = addMoves(lost, 5);
    expect(resumed.status).toBe('playing');
    expect(resumed.assisted).toBe(true);
    expect(movesLeft(resumed)).toBe(5);
  });
});

describe('determinism and invariants', () => {
  const level: LevelDef = {
    id: 'fuzz', label: 'fuzz', seed: 77, moves: 1000, colors: [0, 1, 2, 3, 4], goals: [], layout: Array(7).fill('......'),
  };

  function playRandom(seed: number, moves: number) {
    const pick = new Rng(seedRng(seed * 31 + 7));
    let s = createGame(level, { playSeed: seed });
    const log: number[][] = [];
    for (let k = 0; k < moves; k++) {
      const options = allPairs(s);
      const square = findSquare(s);
      const path = square && pick.float() < 0.3 ? square : pick.pick(options);
      const { state, result } = applyMove(s, path);
      log.push(result.path);
      checkInvariants(state);
      s = state;
    }
    return { s, log };
  }

  it('the same seed and moves give the same result', () => {
    const a = playRandom(5, 40);
    const b = playRandom(5, 40);
    expect(a.log).toEqual(b.log);
    expect(a.s).toEqual(b.s);
  });

  it('different play seeds refill differently', () => {
    const a = createGame(level, { playSeed: 1 });
    const b = createGame(level, { playSeed: 2 });
    expect(colors(a)).toEqual(colors(b));
    const pair = firstPair(a)!;
    expect(colors(applyMove(a, pair).state)).not.toEqual(colors(applyMove(b, pair).state));
  });

  it('the board stays full, ids stay unique, and a move always exists', () => {
    for (let seed = 1; seed <= 20; seed++) playRandom(seed, 60);
  });

  it('a stuck board is reshuffled for free', () => {
    // Two colors on a 1x3 strip get stuck often; play until it happens.
    const strip: LevelDef = { id: 'strip', label: 'strip', seed: 3, moves: 1000, colors: [0, 1], goals: [], layout: ['...'] };
    let s = createGame(strip, { playSeed: 4 });
    let seen = false;
    for (let k = 0; k < 200 && !seen; k++) {
      const { state, result } = applyMove(s, firstPair(s)!);
      if (result.shuffled) {
        seen = true;
        expect(hasMove({ ...state, cells: result.settled })).toBe(false);
        expect(state.movesUsed).toBe(s.movesUsed + 1);
      }
      expect(hasMove(state)).toBe(true);
      s = state;
    }
    expect(seen).toBe(true);
  });
});

function allPairs(s: GameState): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < s.cells.length; i++) {
    const a = s.cells[i];
    if (!a) continue;
    const c = i % s.cols;
    if (c + 1 < s.cols && colorOf(s.cells[i + 1]) === colorOf(a)) out.push([i, i + 1]);
    if (i + s.cols < s.cells.length && colorOf(s.cells[i + s.cols]) === colorOf(a)) out.push([i, i + s.cols]);
  }
  return out;
}

function firstPair(s: GameState): number[] | undefined {
  return allPairs(s)[0];
}

function findSquare(s: GameState): number[] | null {
  for (let r = 0; r + 1 < s.rows; r++) {
    for (let c = 0; c + 1 < s.cols; c++) {
      const [a, b, d, e] = [at(s, r, c), at(s, r, c + 1), at(s, r + 1, c + 1), at(s, r + 1, c)];
      const col = colorOf(s.cells[a]);
      if ([b, d, e].every((i) => colorOf(s.cells[i]) === col)) return [a, b, d, e, a];
    }
  }
  return null;
}

function checkInvariants(s: GameState) {
  s.cells.forEach((p, i) => expect(p === null).toBe(!s.playable[i]));
  const all = s.cells.filter((p) => p).map((p) => p!.id);
  expect(new Set(all).size).toBe(all.length);
  expect(Math.max(...all)).toBeLessThan(s.nextId);
  if (s.status === 'playing') expect(hasMove(s)).toBe(true);
}
