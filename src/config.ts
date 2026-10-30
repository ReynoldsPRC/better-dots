// Every feel parameter lives here so it can be tuned without touching logic.
// Durations are in milliseconds, distances in CSS pixels unless noted.

export const config = {
  palette: {
    // Order matches ColorId 0..4.
    light: ['#D8674B', '#DDAE4A', '#6FA88A', '#557FAE', '#8C6A9F'],
    // Nudged lighter for contrast on the dark background.
    dark: ['#E27A60', '#E5BC62', '#82B89B', '#6B92C0', '#A07FB3'],
  },
  background: { light: '#F5F2EC', dark: '#1C1B20' },
  ink: { light: '#3A3833', dark: '#E8E4DC' },

  board: {
    /** Dot diameter as a fraction of cell size. */
    dotScale: 0.5,
    /** Space kept free around the board, as a fraction of the shorter screen side. */
    margin: 0.06,
    /** Largest cell size in CSS pixels, so small boards don't get huge dots. */
    maxCell: 72,
  },

  input: {
    /** How close (fraction of cell size) the finger must be to a dot's center to pick it. */
    hitRadius: 0.46,
    /** Finger movement is sampled at this spacing (fraction of cell) so fast swipes don't skip dots. */
    sampleStep: 0.2,
  },

  line: {
    /** Connection line thickness as a fraction of cell size. */
    thickness: 0.12,
    /** Board tint (alpha) in the line's color while a loop is closed. */
    loopTint: 0.08,
  },

  select: {
    /** Ring that ripples out from each dot as it joins the line. */
    ringMs: 260,
    /** Ring's final radius as a multiple of the dot radius. */
    ringScale: 2.1,
    ringAlpha: 0.35,
  },

  fall: {
    /** Fall speed in cells per second at full speed. */
    speed: 14,
    /** Easing applied to a fall: 'easeInQuad' etc. (see render layer). */
    easing: 'easeInQuad',
    /** Overshoot of the landing settle, as a fraction of cell size. */
    settleBounce: 0.06,
    settleMs: 120,
    /** Shortest fall, so one-cell drops are still visible. */
    minMs: 90,
  },

  shuffle: {
    /** Pause before an automatic reshuffle, then how long dots take to swap places. */
    delayMs: 250,
    moveMs: 420,
  },

  clear: {
    /** Time for a cleared dot to shrink away. */
    popMs: 140,
    /** Board-wide pulse when a loop is made. */
    loopPulseMs: 260,
    /** Peak alpha of the loop pulse. */
    loopPulseAlpha: 0.18,
  },

  bomb: {
    /** 1 = the 8 neighbors. */
    radius: 1,
    explodeMs: 200,
  },

  colorblind: {
    /** Symbol size as a fraction of dot radius. */
    symbolScale: 0.5,
  },

  assist: {
    /** Moves granted by "5 more moves". */
    moves: 5,
  },

  stars: {
    // Placeholder cutoffs (fractions of the move limit) for levels the bot
    // hasn't scored yet: 2 stars at or under this many moves, 3 stars likewise.
    fallbackTwo: 0.8,
    fallbackThree: 0.6,
  },

  cascade: {
    /** Pause between steps of a chain reaction so it reads clearly. */
    stepMs: 180,
  },
} as const;

export type Config = typeof config;
