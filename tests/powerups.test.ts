import { describe, expect, it } from 'vitest';
import { applyMove, applyPowerUp, canUsePowerUp, hasMove, type GameState } from '../src/rules';
import { at, cells, colorOf, game } from './helpers';

const count = (s: GameState, color: number) => s.cells.filter((p) => p?.kind === 'dot' && p.color === color).length;
const full = (s: GameState) => s.cells.every((p, i) => !s.playable[i] || s.layers.fire[i] || p !== null);

describe('eraser', () => {
  it('clears one dot without using a move; it counts toward goals and the board refills', () => {
    const s = game(['012', '120', '200'], { goals: [{ type: 'collect', color: 2, count: 5 }] });
    const { state, result } = applyPowerUp(s, { kind: 'eraser', cell: at(s, 0, 2) });
    expect(state.movesUsed).toBe(0);
    expect(state.assisted).toBe(false);
    expect(state.goals[0].progress).toBe(1);
    expect(result.steps[0]).toEqual({ kind: 'line', cells: [at(s, 0, 2)], sources: [] });
    expect(full(state)).toBe(true);
  });

  it('a picked dot next to ice leaves the ice alone', () => {
    const s = game(['012', '120', '200'], { ice: ['.2.', '...', '...'] });
    const { state } = applyPowerUp(s, { kind: 'eraser', cell: at(s, 0, 0) });
    expect(state.layers.ice[at(s, 0, 1)]).toBe(2);
  });

  it('on a frozen cell, knocks off one layer of ice and leaves the dot', () => {
    const s = game(['012', '120', '200'], { ice: ['2..', '...', '...'], goals: [{ type: 'ice', count: 1 }] });
    const id = s.cells[0]!.id;
    const once = applyPowerUp(s, { kind: 'eraser', cell: 0 }).state;
    expect(once.layers.ice[0]).toBe(1);
    expect(once.cells[0]!.id).toBe(id);
    const twice = applyPowerUp(once, { kind: 'eraser', cell: 0 }).state;
    expect(twice.layers.ice[0]).toBe(0);
    expect(twice.status).toBe('won');
  });

  it('on a burning cell, puts the fire out; the cell refills and fire elsewhere does not spread', () => {
    const s = game(['.12', '212', '12.'], { fire: ['x..', '...', '..x'] });
    const { state } = applyPowerUp(s, { kind: 'eraser', cell: 0 });
    expect(state.layers.fire.flatMap((f, i) => (f ? [i] : []))).toEqual([at(s, 2, 2)]);
    expect(state.cells[0]).not.toBeNull();
  });

  it('on a slimed dot: one hit on the slime, and the dot stays; other slime does not spread', () => {
    const s = game(['012', '120', '200'], { slime: ['x..', '...', '..x'] });
    const id = s.cells[0]!.id;
    const { state } = applyPowerUp(s, { kind: 'eraser', cell: 0 });
    expect(state.layers.slime).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 2]);
    expect(state.cells[0]!.id).toBe(id);
  });

  it('a picked dot next to water floods', () => {
    const s = game(['012', '120', '200'], { water: ['x..', '...', '...'] });
    const { state } = applyPowerUp(s, { kind: 'eraser', cell: at(s, 0, 1) });
    expect(state.layers.water[at(s, 0, 1)]).toBe(true);
  });

  it('a ladybug loses a spot and stays put; on its last spot it is removed and its bomb goes off', () => {
    const bug = (spots: number) => game(['012', '120', '200'], {
      pieces: [{ r: 1, c: 1, type: 'ladybug', color: 2, spots }], goals: [{ type: 'ladybugs', count: 1 }],
    });
    const hit = applyPowerUp(bug(3), { kind: 'eraser', cell: at(bug(3), 1, 1) });
    expect(hit.result.events.some((e) => e.kind === 'walk')).toBe(false);
    expect(hit.state.cells.findIndex((p) => p?.kind === 'ladybug')).toBe(at(bug(3), 1, 1));
    expect(hit.state.cells.find((p) => p?.kind === 'ladybug')).toMatchObject({ spots: 2 });
    const last = applyPowerUp(bug(1), { kind: 'eraser', cell: at(bug(1), 1, 1) });
    expect(last.state.status).toBe('won');
    expect(last.result.steps.map((x) => x.kind)).toEqual(['line', 'blast']);
  });

  it('on a gem, sets it off', () => {
    const s = game(['012', '120', '200'], { pieces: [{ r: 1, c: 1, type: 'gem', color: 0, shape: 'column' }], goals: [{ type: 'gems', count: 1 }] });
    const { state, result } = applyPowerUp(s, { kind: 'eraser', cell: at(s, 1, 1) });
    expect(result.steps.map((x) => x.kind)).toEqual(['blast']);
    expect(result.steps[0].cells).toEqual(cells(s, [0, 1], [1, 1], [2, 1]));
    expect(state.status).toBe('won');
  });

  it('cannot be used on an anchor, an empty spot, a missing cell, or a finished game', () => {
    const s = game(['01-', '120', '200'], { pieces: [{ r: 0, c: 0, type: 'anchor' }] });
    expect(canUsePowerUp(s, { kind: 'eraser', cell: 0 })).toBe(false);
    expect(canUsePowerUp(s, { kind: 'eraser', cell: at(s, 0, 2) })).toBe(false);
    expect(canUsePowerUp(s, { kind: 'eraser', cell: 99 })).toBe(false);
    expect(() => applyPowerUp(s, { kind: 'eraser', cell: 0 })).toThrow(/can't use/);
    expect(canUsePowerUp({ ...s, status: 'lost' }, { kind: 'eraser', cell: 1 })).toBe(false);
  });
});

describe('color burst', () => {
  it('clears every dot of the color like a loop, without using a move', () => {
    const s = game(['012', '120', '200'], { goals: [{ type: 'collect', color: 1, count: 2 }] });
    const { state, result } = applyPowerUp(s, { kind: 'colorBurst', color: 1 });
    expect(result.loop).toBe(true);
    expect(result.color).toBe(1);
    expect(result.steps.map((x) => x.kind)).toEqual(['loop']);
    expect(result.steps[0].cells).toEqual(cells(s, [0, 1], [1, 0]));
    expect(state.movesUsed).toBe(0);
    expect(state.status).toBe('won');
  });

  it('sets off gems of that color; iced dots of it clear too, hitting their ice', () => {
    const s = game(['012', '120', '200'], {
      pieces: [{ r: 1, c: 2, type: 'gem', color: 1, shape: 'cross' }], ice: ['.2.', '...', '...'],
    });
    const { state, result } = applyPowerUp(s, { kind: 'colorBurst', color: 1 });
    expect(result.steps.map((x) => x.kind)).toEqual(['loop', 'blast']);
    expect(result.steps[0].cells).toContain(at(s, 0, 1));
    expect(state.layers.ice[at(s, 0, 1)]).toBe(1);
  });

  it('only for the board\'s colors', () => {
    const s = game(['012', '120', '200'], { colors: [0, 1, 2] });
    expect(canUsePowerUp(s, { kind: 'colorBurst', color: 4 })).toBe(false);
  });

  it('is deterministic, and the game carries on normally after it', () => {
    const s = game(['012', '120', '200'], { colors: [0, 1, 2] }, 5);
    const a = applyPowerUp(s, { kind: 'colorBurst', color: 0 });
    const b = applyPowerUp(s, { kind: 'colorBurst', color: 0 });
    expect(a).toEqual(b);
    expect(hasMove(a.state)).toBe(true);
    expect(count(a.state, 0) + count(a.state, 1) + count(a.state, 2)).toBe(9);
    const pair = a.state.cells.findIndex((p, i) => i % 3 < 2 && colorOf(p) === colorOf(a.state.cells[i + 1]));
    if (pair >= 0) expect(applyMove(a.state, [pair, pair + 1]).state.movesUsed).toBe(1);
  });
});

describe('shuffler', () => {
  it('reshuffles the regular dots without using a move; other pieces and layers stay put', () => {
    const s = game(['0023', '1220', '2301'], {
      colors: [0, 1, 2, 3], ice: ['1...', '....', '....'], pieces: [{ r: 1, c: 1, type: 'anchor' }],
    }, 3);
    const { state, result } = applyPowerUp(s, { kind: 'shuffler' });
    expect(result.events.map((e) => e.kind)).toEqual(['shuffle']);
    expect(state.movesUsed).toBe(0);
    expect(state.cells[at(s, 1, 1)]).toBe(s.cells[at(s, 1, 1)]);
    expect(state.layers).toEqual(s.layers);
    const ids = (g: GameState) => g.cells.flatMap((p) => (p?.kind === 'dot' ? [p.id] : [])).sort((a, b) => a - b);
    expect(ids(state)).toEqual(ids(s));
    expect(state.cells.map((p) => p?.id)).not.toEqual(s.cells.map((p) => p?.id));
    expect(hasMove(state)).toBe(true);
  });
});

describe('sure shot', () => {
  it('blasts the whole row and column of the tapped cell, like a cross gem', () => {
    const s = game(['0023', '1220', '2301'], { colors: [0, 1, 2, 3], goals: [{ type: 'collect', color: 2, count: 3 }] });
    const { state, result } = applyPowerUp(s, { kind: 'sureShot', cell: at(s, 1, 1) });
    expect(state.movesUsed).toBe(0);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({ kind: 'blast', sources: [{ cell: at(s, 1, 1), type: 'cross', color: 2 }] });
    expect(result.steps[0].cells).toEqual(cells(s, [0, 1], [1, 0], [1, 1], [1, 2], [1, 3], [2, 1]));
    // Blasted 2s: (1,1) and (1,2).
    expect(state.goals[0].progress).toBe(2);
  });

  it('as a blast, it destroys anchors (counted) and sets off gems', () => {
    const s = game(['0023', '1220', '2301'], {
      colors: [0, 1, 2, 3], goals: [{ type: 'anchors', count: 1 }, { type: 'gems', count: 1 }],
      pieces: [{ r: 0, c: 1, type: 'anchor' }, { r: 1, c: 3, type: 'gem', color: 0, shape: 'column' }],
    });
    const { state } = applyPowerUp(s, { kind: 'sureShot', cell: at(s, 1, 1) });
    expect(state.status).toBe('won');
  });
});
