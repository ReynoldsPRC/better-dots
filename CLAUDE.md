# better dots

A personal puzzle game for one player, inspired by early Two Dots, minus everything built to monetize attention. This file is the spec and the source of truth. When a decision changes, update this file in the same commit.

## What it is

- A web app (installable PWA) played in a phone browser, added to the home screen, fully offline. Portrait, one-handed.
- Single player. No backend, no network calls at runtime.
- Its own visual identity: don't copy Two Dots art, icons, or branding.

## Never

Non-negotiable. Don't add any of these, even as an option:

- Lives, energy, or any waiting to play
- Timers: timed levels, countdowns, limited-time events
- Currency, a shop, or anything purchasable
- Ads
- Random reward boxes. Power-ups come only from the fixed triggers below.
- Daily rewards, streaks, push notifications, "come back" prompts
- Accounts, online features, leaderboards, analytics, tracking. All data stays on the device.

## Tech and working rules

- Plain web stack, no game engine: TypeScript, Vite, Vitest.
- **Rendering: Canvas 2D.** Chosen over SVG because every frame redraws a few dozen dots in motion (falls, settles, pops, cascades) plus a line that tracks the finger. One immediate-mode canvas sized to devicePixelRatio stays smooth on a phone. SVG would mean diffing many DOM nodes per frame for no benefit, since nothing on the board needs to be a DOM element.
- Game rules live in a pure module with no DOM or rendering code. Rendering and input are separate layers that read rule state.
- Rules are deterministic given a seed (seeded RNG for refills, ladybug flights, shuffles). Same level + seed + moves = same result. This is required for tests, the bot, and reproducing bugs.
- Every rule has unit tests. Run the full suite after every change. A change that breaks an earlier mechanic isn't done.
- All feel parameters (fall speed, easing, bounce, line thickness, animation timings, bomb radius, etc.) live in one config file so they can be tuned without touching logic. The player will describe feel problems in plain language ("too floaty," "the snap is late"); translate those into config changes.
- Levels are JSON data files, not code.
- Progress is saved locally (IndexedDB or localStorage), with export/import of the save as a file.
- Service worker for offline play.
- A developer switch (settings toggle or URL flag) unlocks all levels for testing.
- Commit after each working step with a clear message.

### Layout and commands

- `src/rules/`: pure rules (no DOM, clock, or `Math.random`; `tests/rules-purity.test.ts` enforces this). `src/rules/rng.ts` is the seeded RNG: state is a single 32-bit int, so it can be stored in rule state.
- `src/rules/`: `types.ts` (state shapes), `board.ts` (grid geometry), `path.ts` (dragging, loops, enclosure), `game.ts` (setup, moves, gravity, refill, reshuffle, goals). A move returns the new state plus a `MoveResult` (clear stages, settled board, spawned ids) that the render layer animates.
- `src/render/`: canvas drawing (`board.ts`), layout and hit-testing (`layout.ts`), the per-move animation timeline (`animation.ts`). `src/ui/`: DOM screens, HUD, overlays, and touch input (`play.ts`). `src/main.ts`: wiring. `src/config.ts`: all feel parameters.
- `levels/world-N/world.json` (`{ "name": ... }`) and `levels/world-N/NN.json` (01, 02, ... with no gaps). Level ids are `N-NN` from that position. `src/levels.ts` bundles them at build time; `tests/level.test.ts` checks every shipped file. Level file fields: `name` (optional), `seed` (fixes the opening board), `moves`, `colors` (palette ids 0-4), `layout` (row strings: `.` random dot, `0`-`4` a fixed dot), `goals` (`{ "type": "collect", "color", "count" }`), `stars` (optional `{ "two", "three" }`: most moves used that still earns 2 or 3 stars; until the bot sets them, `config.stars` fallback fractions of the move limit apply).
- `src/progress.ts`: save format and unlock/star bookkeeping (pure). `src/ui/storage.ts`: localStorage key `better-dots-save`, export/import as a JSON file from Settings. Developer switch: Settings toggle, or `?dev` in the URL.
- World 1's move limits were hand-set and sanity-checked with a throwaway greedy player; expect the step 5 bot to retune them.
- A board with no goals never counts as won (sandbox). Retrying a level keeps its starting layout (from the level seed) but uses a new play seed for refills.
- Dev builds expose the play screen as `window.__play` for console poking.
- `public/sw.js`: service worker (network-first for the page, cache-first for hashed assets; bump `VERSION` to evict old caches). `public/manifest.webmanifest`. Icons come from `npm run icons`.
- `npm test`, `npm run dev`, `npm run phone` (dev server on the LAN), `npm run build`.
- Hosting: GitHub Pages via `.github/workflows/deploy.yml`. Every push to `main` runs the tests, builds, and deploys. The build uses relative paths (`base: './'`), so it works under the repo subpath.

## Core rules

- **Board:** a grid of cells; some cells may be empty (shaped boards). Up to 5 dot colors per board, set per level.
- **Move:** drag across 2 or more adjacent dots of the same color, horizontally or vertically, never diagonally. Dragging back along the line shortens it. Releasing clears the line and uses one move.
- **Gravity and refill:** after a clear, dots fall straight down to fill gaps, passing over empty cells. New dots enter at the top of each column. Refills may include the color just cleared.
- **Loops:** if the line closes a loop, every dot of that color on the board clears. Any closed loop counts, not only 2×2 squares.
- **Bombs:** dots of other colors enclosed inside a loop become bombs. They explode, clearing themselves and the surrounding cells (default: the 8 neighbors).
- **Clears are clears:** every way of clearing a cell (line, loop, bomb, gem beam, power-up) counts the same for obstacle interactions and goal progress.
- **Chain resolution:** explosions and beams can trigger further bombs and gems. Resolve in a fixed, deterministic order and animate the cascade in sequence so it reads clearly.
- **Moves and goals:** each level has a move limit and one or more goals. Meet all goals before moves run out to win.
- **Stuck board:** if no legal move exists, reshuffle the regular dots automatically. Free, costs no move. Obstacles stay put.

## Board terrain

- **Walls:** barriers on cell edges. Connections can't cross a wall. Default: walls don't affect falling.
- **Shaped boards:** empty cells; dots fall past them.
- **Later:** ramps that feed dots in from the side, diagonal falling.

## Obstacles and special pieces

Each one is introduced in its own world (see Build order).

### Anchors
- Not connectable. Fall with gravity like dots.
- Sink when they reach the bottom of their column: removed and counted toward the anchor goal.
- Level data sets the starting anchors and how many more can drop in from the top.

### Ice
- Sits on a cell and locks that cell's dot in place. Frozen dots don't fall, dots above stack on them, and frozen dots can't be part of a connection.
- Broken from the edges: each move that clears at least one cell orthogonally adjacent to the ice removes one layer (default: one layer per move, no matter how many neighbors clear).
- Thickness 1–3, each with a distinct look (fresh, cracked, nearly broken). Levels can place ice at any thickness.
- When it breaks, the dot is freed, and anything under the ice (water, fire, slime) activates from that move on.
- This is the player's preferred rule; the original may have worked differently. Revisit if it feels wrong in playtesting.

### Water
- A cell layer. Some cells start watered.
- When a cleared cell is orthogonally adjacent to a watered cell, it becomes watered. Default: resolve along the whole cleared set, so a line that touches water floods its full length.
- Goal: flood every playable cell.

### Fire
- Burning cells hold no dot. Default: dots don't fall through them.
- Extinguish a burning cell by clearing a cell orthogonally adjacent to it. It becomes a normal cell and refills.
- Each move in which no fire is extinguished, fire spreads to one adjacent cell, destroying its dot.
- Goal: extinguish all fire.

### Slime
- A layer under dots. Clearing a dot on a slimed cell cleans that cell.
- Each move in which no slime is cleaned, slime spreads to one adjacent clean cell.
- Goal: clean all slime.

Water, fire, and slime share one spreading-layer system with per-type rules. Water spreads because of what the player does; fire and slime spread when ignored.

### Gems
- Each gem has one of the board's colors. It occupies a cell, isn't connectable, and falls with gravity.
- Triggers when a loop of its color is made.
- **Column gem** (rectangular): its beam clears its whole column.
- **Cross gem** (square): its beams clear its row and its column.
- A beam passing through another gem triggers that gem, so cascades are possible.
- Goal option: trigger N gems.

### Ladybugs
- Start with 3 spots. Connectable like a dot of their current color.
- Cleared at 3 or 2 spots: loses a spot, changes to a different color, and flies to a random cell (swapping with the dot there; seeded).
- Cleared at 1 spot: removed.
- Enclosed inside a loop: becomes a bomb and is removed regardless of spots.
- Bombs, beams, and power-ups count as a clear (one spot lost).
- Goal option: clear N ladybugs.

### Later (record only, don't build yet)
- **Monsters:** eat nearby dots unless connected to dots of their color.
- **Clouds:** when two clouds are in the same row, lightning clears every dot between them and destroys both clouds.
- **Ramps and diagonal falling** (see Board terrain).

## Levels and progression

- Levels are grouped into worlds. Each world introduces exactly one new mechanic, in build order. World 1 is core rules only.
- Levels unlock one at a time, in order. The developer switch unlocks everything.
- Goal types: collect N dots of a color; sink N anchors; break N ice; flood the board; extinguish fire; clean slime; trigger N gems; clear N ladybugs. Levels can combine goals.
- **Out of moves:** offer "5 more moves" (the assist) or an instant retry. No penalty either way.
- **Assisted clear:** unlocks the next level but earns no stars or power-ups, and is marked in level select. Replaying without the assist can earn them.
- **Stars, by moves used:** 1 star for any clear; 2 for using fewer moves than the bot's median run; 3 for matching the bot's best runs (default: top 10%). Thresholds are stored per level; expect retuning.
- **Power-ups:** earn 1 on the first 3-star clear of a level and 2 for finishing a world. Stored locally. Using one costs no move and doesn't mark the level assisted.
  - **Pick:** remove one dot, or knock one layer off one obstacle.
  - **Color clear:** clear every dot of a chosen color, as if a loop of that color had been made (so it triggers gems of that color).

## Level creation

- A generator makes candidate levels from parameters: board shape, colors, obstacles, goals, move limit.
- A bot plays each candidate many times (randomized greedy, favoring loops and goal progress) and reports win rate and the distribution of moves used.
- Discard unwinnable candidates. Set move limits and star thresholds from the bot's results.
- The player plays the candidates and keeps or rejects them. Kept levels are saved as JSON in the levels folder.

## Look and feel

- **Palette** (starting proposal, adjustable): terracotta `#D8674B`, ochre `#DDAE4A`, sage `#6FA88A`, slate blue `#557FAE`, plum `#8C6A9F`. Muted, not hypersaturated.
- **Background** follows the phone's light/dark setting: light `#F5F2EC`, dark `#1C1B20`. Dot colors may be nudged lighter in dark mode for contrast.
- **Colorblind mode** (toggle, built in from the start): each color gets a small symbol inside its dots: triangle, bar, plus, ring, diamond.
- Flat circular dots. The connection line is drawn in the dot's color. Loops get a brief board-wide pulse in that color.
- **Feel priorities:** the line tracks the finger tightly; dots fall with slight easing and a small settle; cascades are readable.
- **Sound:** no music. Soft synthesized tones (Web Audio, no audio files) that rise in pitch as the line grows, and a distinct chime on loops. Light haptics where the browser supports them. Mute toggle.
- **Level select:** a plain grid of numbered levels grouped by world. Illustrated world art may come later from the player's own drawings.

## Build order

1. Setup: PWA shell, rules module, test harness, config file, seeded RNG, and free static hosting (GitHub Pages or similar) so every working build can be opened on the phone.
2. Core loop on one hardcoded board: drag, clear, gravity, refill, loops, bombs, moves, the collect-color goal, win/lose, auto-shuffle, colorblind symbols. Playtest on the phone until the feel is right before moving on.
3. Level format (JSON), level select, saved progress, retry, assist.
4. Terrain: walls, shaped boards.
5. Generator and bot for the core rules; stars from bot results.
6. Mechanics, one world each, extending the generator and bot with each: anchors → ice → water → gems → ladybugs → slime → fire. Add hazards-under-ice once ice and each hazard exist.
7. Power-ups.
8. Sound, haptics, polish. Confirm offline play and home-screen install.

## Defaults to revisit after playtesting

- Refills can include the just-cleared color
- Bomb radius: 8 neighbors
- Ice: one layer per move; frozen dots can't be connected
- Walls don't block falling
- Water floods the whole cleared line
- Fire and slime spread one cell per move
- Star cutoffs
- Power-ups cost no move
