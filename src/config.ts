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

  terrain: {
    /** On shaped boards, a faint tile behind each cell so the shape reads. Alpha of the ink color. */
    tileAlpha: 0.06,
    /** Tile size and corner radius as fractions of cell size. */
    tileScale: 0.92,
    tileRadius: 0.22,
    /** Walls: thickness as a fraction of cell size, alpha of the ink color, end inset as a fraction of cell. */
    wallThickness: 0.07,
    wallAlpha: 0.6,
    wallInset: 0.1,
  },

  input: {
    /** How close (fraction of cell size) the finger must be to a dot's center to pick it. */
    hitRadius: 0.46,
    /** Finger movement is sampled at this spacing (fraction of cell) so fast swipes don't skip dots. */
    sampleStep: 0.2,
    /**
     * When a new drag may start after a move: 'settle' as soon as the dots have
     * landed (tail effects finish underneath it), or 'end' once everything has finished.
     */
    unlockAt: 'settle' as 'settle' | 'end',
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
    /** New dots under fire can't fall in, so they grow in place over this long. */
    appearMs: 240,
  },

  anchor: {
    /** Anchor glyph size as a multiple of dot radius. */
    scale: 1.25,
    /** Time to sink out of the bottom of the board. */
    sinkMs: 320,
  },

  ice: {
    /** Ice tint per thickness (index 1-3), light and dark themes. Alpha is in the color. */
    fill: { light: ['', '#C9DCE8A0', '#C2D8E6C0', '#BDD5E6E0'], dark: ['', '#8FB3CC70', '#94B8D29A', '#9ABED8C4'] },
    edge: { light: '#9FBFD4', dark: '#B5D2E6' },
    /** Tile size and corner radius as fractions of cell size. */
    scale: 0.86,
    radius: 0.2,
    /** Crack line width as a fraction of cell size. */
    crackWidth: 0.025,
    /** Pause while ice cracks (and other layers change) after a move. */
    crackMs: 220,
  },

  gem: {
    /** Gem size as a multiple of dot radius. */
    scale: 1.3,
    /** Beam width (fraction of cell) and peak alpha. */
    beamWidth: 0.7,
    beamAlpha: 0.55,
  },

  ladybug: {
    /** Ladybug size as a multiple of dot radius. */
    scale: 1.15,
    /** Flight time, and how high (in cells) the flight arcs. */
    flyMs: 420,
    arc: 0.6,
    /** Head and spot color. */
    ink: { light: '#2E2B28', dark: '#1A1917' },
  },

  water: {
    /** Watered-cell tile, light and dark themes. Kept paler and greener than the slate dot. */
    fill: { light: '#A9D3D6', dark: '#2F5A60' },
    /** Tile size and corner radius as fractions of cell size. */
    scale: 0.94,
    radius: 0.24,
  },

  slime: {
    /** Slime blob and bubble colors, light and dark themes. Dull olive so it never reads as the sage dot. */
    fill: { light: '#B3AC7E', dark: '#5E5A3C' },
    bubble: { light: '#CFC9A2', dark: '#7A7550' },
    /** Blob size as a fraction of cell size; how much its edge wobbles. */
    scale: 0.9,
    wobble: 0.05,
    /** Width of the bridge joining neighboring slimed cells, as a fraction of cell size. */
    bridge: 0.7,
  },

  fire: {
    /** Burning-cell tile and flame colors. Charcoal and amber, so a flame never reads as a dot. */
    tile: { light: '#3B3532', dark: '#2A2523' },
    outer: { light: '#E8913F', dark: '#E8913F' },
    inner: { light: '#F6D27A', dark: '#F6D27A' },
    /** Tile size and corner radius as fractions of cell size; flame height as a fraction of cell. */
    scale: 0.9,
    radius: 0.22,
    flame: 0.62,
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
