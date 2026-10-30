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
  },

  line: {
    /** Connection line thickness as a fraction of cell size. */
    thickness: 0.12,
  },

  fall: {
    /** Fall speed in cells per second at full speed. */
    speed: 14,
    /** Easing applied to a fall: 'easeInQuad' etc. (see render layer). */
    easing: 'easeInQuad',
    /** Overshoot of the landing settle, as a fraction of cell size. */
    settleBounce: 0.06,
    settleMs: 120,
  },

  clear: {
    /** Time for a cleared dot to shrink away. */
    popMs: 140,
    /** Board-wide pulse when a loop is made. */
    loopPulseMs: 260,
  },

  bomb: {
    /** 1 = the 8 neighbors. */
    radius: 1,
    explodeMs: 200,
  },

  cascade: {
    /** Pause between steps of a chain reaction so it reads clearly. */
    stepMs: 180,
  },
} as const;

export type Config = typeof config;
