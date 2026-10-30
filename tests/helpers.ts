import { createGame, type ColorId, type GameState, type Goal, type LevelDef, type Piece } from '../src/rules';

/** A game from a fixed layout of color digits. */
export function game(layout: string[], extra: Partial<LevelDef> = {}, playSeed = 1): GameState {
  const level: LevelDef = {
    id: 'test',
    label: 'test',
    seed: 1,
    moves: 20,
    colors: [0, 1, 2, 3] as ColorId[],
    goals: [] as Goal[],
    layout,
    ...extra,
  };
  return createGame(level, { playSeed, bombRadius: 1 });
}

/** Cell index from (row, col). */
export function at(s: GameState, r: number, c: number): number {
  return r * s.cols + c;
}

/** Path from [row, col] pairs. */
export function cells(s: GameState, ...rc: [number, number][]): number[] {
  return rc.map(([r, c]) => at(s, r, c));
}

/** Board colors as digit strings, '-' for no cell. */
export function colors(s: GameState, board = s.cells): string[] {
  const out: string[] = [];
  for (let r = 0; r < s.rows; r++) {
    let row = '';
    for (let c = 0; c < s.cols; c++) {
      const i = r * s.cols + c;
      const p = board[i];
      row += !s.playable[i] ? '-' : p ? (p.kind === 'dot' ? String(p.color) : 'A') : ' ';
    }
    out.push(row);
  }
  return out;
}

/** A piece's color, or undefined for pieces without one. */
export function colorOf(p: Piece | null | undefined): ColorId | undefined {
  return p && 'color' in p ? p.color : undefined;
}
