# better dots

A personal puzzle game for one player: Two Dots with the original's mechanics and none of the machinery built to monetize attention. This file is the spec and the source of truth. When a decision changes, update this file in the same commit.

## What it is

- A web app (installable PWA) played in a phone browser, added to the home screen, fully offline. Portrait, one-handed.
- Single player. No backend, no network calls at runtime.
- Its own visual identity: don't copy Two Dots art, icons, or branding.
- **Rules follow the original Two Dots.** `docs/two-dots-reference.md` documents how the original's mechanics work (official tutorial text plus player guides). When this file and the reference disagree, this file wins; when this file is silent, the reference is the tiebreaker; when both are silent, pick the simplest rule, write it here, and tag it `(default)`. `docs/decisions.md` records every place this game deliberately differs from the original and why. Don't "fix" a documented deviation back toward the original without a decision entry.

## Never

Non-negotiable. Don't add any of these, even as an option:

- Lives, energy, or any waiting to play
- Timers: timed levels, countdowns, limited-time events
- Currency, a shop, or anything purchasable
- Ads
- Random reward boxes. Power-ups come only from the fixed triggers below.
- Daily rewards, streaks, push notifications, "come back" prompts
- Accounts, online features, leaderboards, analytics, tracking. All data stays on the device.
- Pre-level consumable boosters (the original's Booster Boxes / Supply Crates). The in-level power-ups are enough.

## Tech and working rules

- Plain web stack, no game engine: TypeScript, Vite, Vitest.
- **Rendering: Canvas 2D.** Chosen over SVG because every frame redraws a few dozen dots in motion (falls, settles, pops, cascades) plus a line that tracks the finger. One immediate-mode canvas sized to devicePixelRatio stays smooth on a phone. SVG would mean diffing many DOM nodes per frame for no benefit, since nothing on the board needs to be a DOM element.
- Game rules live in a pure module with no DOM or rendering code. Rendering and input are separate layers that read rule state.
- Rules are deterministic given a seed (seeded RNG for refills, hazard spread targets, beetle color changes, monster moves, shuffles). Same level + seed + moves = same result. This is required for tests, the bot, and reproducing bugs.
- Every rule has unit tests. Run the full suite after every change. A change that breaks an earlier mechanic isn't done.
- All feel parameters (fall speed, easing, bounce, line thickness, animation timings, bomb radius, etc.) live in one config file so they can be tuned without touching logic. The player will describe feel problems in plain language ("too floaty," "the snap is late"); translate those into config changes.
- Levels are JSON data files, not code.
- Progress is saved locally (IndexedDB or localStorage), with export/import of the save as a file. On iOS the home-screen app has its own localStorage, separate from Safari, so progress from Safari playtesting doesn't follow an install (use export/import to move it).
- Service worker for offline play.
- A developer switch (settings toggle or URL flag) unlocks all levels for testing.
- Commit after each working step with a clear message.

### Layout and commands

The notes in this subsection describe the code as built. Where a rule below changes, update the matching note in the same commit.

- `src/rules/`: pure rules (no DOM, clock, or `Math.random`; `tests/rules-purity.test.ts` enforces this). `src/rules/rng.ts` is the seeded RNG: state is a single 32-bit int, so it can be stored in rule state.
- `src/rules/`: `types.ts` (state shapes), `board.ts` (grid geometry), `path.ts` (dragging, loops, enclosure), `game.ts` (setup, moves, gravity, refill, reshuffle, goals). A move returns the new state plus a `MoveResult` whose `events` list what happened in order (`clear` stages, `fall`, `sink`, `shuffle`, ...), each with the board after it. `src/render/animation.ts` replays that list, so a new mechanic adds an event kind and a way to draw it.
- Gravity works per column in runs between fixed cells (currently burning cells; blocks join them when built). Ice is not fixed: pieces fall into and out of iced cells, and the ice stays with the cell. Pieces fall to the bottom of their run. The top run refills from above the board. In a run under a burning cell or block, new dots appear in place (they grow in) since nothing can fall through.
- `src/render/`: canvas drawing (`board.ts`), layout and hit-testing (`layout.ts`), the per-move animation timeline (`animation.ts`). `src/ui/`: DOM screens, HUD, overlays, and touch input (`play.ts`). `src/main.ts`: wiring. `src/config.ts`: all feel parameters.
- Level files may also have `pieces` (`[{ "r", "c", "type": "anchor" }]`), `anchorDrops` (how many more anchors drop in), and with it optional `maxOnBoard` and `dropDelay`. A new anchor drops into the top of a seeded column whenever fewer anchors are on the board than `maxOnBoard` (default: the starting count, at least one) and the wait is over, until drops run out; at most one per move. The wait (`state.anchorWait`) counts down one per move while the board is short and resets to `dropDelay` whenever it's full, so `dropDelay` is a grace period of that many moves. Blasts destroy anchors and count them (`Move.clear` with `blast`). Anchor goals: `{ "type": "anchors", "count" }`.
- Level files may have `ice` (a grid like `layout`: `.` none, `1`-`3` thickness). Ice goal: `{ "type": "ice", "count" }` counts cells broken all the way through. Ice hits are collected during the move (`Move.hitIce`) and applied together at the end of the cascade, after water, fire, and slime have reacted, so a hazard freed this move stays dormant for that move. Cell layers live in `state.layers`; a `layers` move event carries changes so the renderer can show them at the right moment.
- Gems are placed with `pieces`: `{ "r", "c", "type": "gem", "color", "shape": "row" | "column" | "cross" }`. Gem goal: `{ "type": "gems", "count" }`. Beams are blast sources, so they also destroy anchors (counted) and put out fire.
- Ladybugs are placed with `pieces`: `{ "r", "c", "type": "ladybug", "color", "spots"?, "facing"? }` (spots default 3, facing `"up" | "down" | "left" | "right"`, default `up`). Ladybug goal: `{ "type": "ladybugs", "count" }` counts ladybugs removed. The piece keeps the `ladybug` type name in code and level files; the original calls them Beetle Dots. A ladybug removed on its last spot queues a bomb that joins the next blast wave (`Move.bugBombs`). Walking is `Move.walk`, after hazards spread; it emits a `walk` event.
- Level files may have `fire` (a grid: `.` or `x` burning; a burning cell's layout must be `.` and it can't hold a piece). Fire goal: `{ "type": "fire" }`; remaining = burning cells, including dormant ones under ice (frozen fire holds no dot).
- Level files may have `slime` (a grid: `.` clean, `1` or `2` hits left; `x` means 2). `state.layers.slime` holds hits left per cell. Slime goal: `{ "type": "slime" }`; remaining = slimed cells, including dormant ones under ice. A hit on a cell (`Move.hitCell`) goes to its ice if it's iced, else to its slime. Slime regions are taken as the move begins; a region spreads only if none of its cells was hit.
- Level files may have `water` (a grid: `.` dry, `x` watered). Flood goal: `{ "type": "flood" }`. Water under ice is dormant: it doesn't spread until the ice breaks, and a move that breaks the ice doesn't flood from it (the water was still frozen while that move's cells cleared).
- `levels/world-N/world.json` (`{ "name": ... }`) and `levels/world-N/NN.json` (01, 02, ... with no gaps). A level's `label` (`N-NN`, or `cN-K` for candidates) comes from that position and is what the player sees; its `id` is a stable field in the file, and saves are keyed on it, so renumbering never moves progress between levels. `src/levels.ts` bundles them at build time (duplicate ids are an error); `tests/level.test.ts` checks every shipped file. Unknown keys anywhere in a level file are an error. Level file fields: `id` (required, 6-12 lowercase letters or digits; `npm run levels -- ids` mints 8-char random ones for files without), `name` (optional), `seed` (fixes the opening board), `moves`, `colors` (palette ids 0-4), `layout` (row strings: `.` random dot, `0`-`4` a fixed dot, `-` no cell), `walls` (optional list of `{ "r", "c", "side": "up" | "down" | "left" | "right" }`, each between two cells; legacy, see Board terrain), `goals` (`{ "type": "collect", "color", "count" }`), `stars` (optional `{ "two", "three" }`: most moves used that still earns 2 or 3 stars; until the bot sets them, `config.stars` fallback fractions of the move limit apply).
- `src/progress.ts`: save format (version 2: records keyed on level id, holding best moves and the assisted mark; plus `powerUps` on hand and `awarded` level ids and world numbers) and unlock bookkeeping (pure). Version 1 saves (keyed on labels, with stored stars) migrate on load through a label-to-id table; records with no matching level are dropped. `src/ui/storage.ts`: localStorage key `better-dots-save`, export/import as a JSON file from Settings. Developer switch: Settings toggle, or `?dev` in the URL.
- Worlds 1-3 (core, shaped boards, walls) were hand-made, then scored by the bot.
- `src/bot/`: pure and seeded like the rules (the purity test covers it). `bot.ts` plays randomized greedy with a short lookahead: per same-color group it proposes up to 4 distinct loops (from the DFS's non-tree edges, ranked by how many other-color dots and ladybugs they enclose, then by gems those bombs would reach), the longest line it finds, and lines from target cells; it simulates each with `applyMove` and scores by goal progress (each goal normalized by its starting size) plus small mechanic-specific nudges. Noise is in units of one item of the largest goal and stays below one unit (default 0.2), so it only breaks near-ties. The top 3 candidates are then rescored with 0.5 × the best reply's score (no noise, half the search budget). `generate.ts` builds candidates from `presets.ts` (one preset per world, ramping easy to hard across a batch) and sizes goals so the bot's needs land in the preset's move range. `format.ts` writes level JSON in a stable style.
- Tuning policy (`tuneFromStats`): the bot plays with a generous move cap and records moves needed. Move limit = 75th percentile (about 75% of bot runs fit). 2 stars = at most the bot's median minus 1 (at least 2). 3 stars = at most its best-10% mark, and always strictly fewer moves than 2 stars. Levels with a limit of 2 moves or fewer get one tier (two = three = 1, `oneTier` in the bot note). A level the bot finishes in under 75% of runs is unwinnable and discarded. Luck-heavy rule (`bot.ts`): when limit / median > 1.6 (`MAX_LIMIT_TO_MEDIAN`) or median / best-10% > 2.2 (`MAX_MEDIAN_TO_BEST`), the result is mostly refill luck; the generator discards such candidates, and `levels score` flags shipped ones as `luck-heavy` without dropping them (after the stronger bot: 7-03, 7-07, 9-05). The generator's tuning lever is the goal size `count`: collect counts, ice, and anchor drops follow it, and water sources, slime and fire cells, gems, and ladybugs scale by `count / count0` (rounded, at least 1, capped at a sixth of the cells for pieces, half for water and slime, a third for fire), so obstacle-only worlds converge. Each file keeps a `bot` note (`runs`, `winRate` at the limit, `median`, `p10`) for reference; the game ignores it.
- `npm run levels -- <command>` (`scripts/levels.ts`): `list` (with ids); `ids` gives any level file without an `id` a new one; `score [world ...]` re-runs the bot and rewrites `moves`, `stars`, `bot`; `generate <world> <count> [--seed S]` writes candidates to `levels/candidates/world-N/NN.json`, each with a fresh id; `regenerate <world> <n ...> [--seed S]` rebuilds shipped levels in place from the world's preset at their spot in the easy-to-hard ramp, with fresh ids (up to 3 seeds each; used when a rule change leaves a level the bot can't win); `keep <world> <n ...>` moves candidates to the end of that world, keeping their ids (so candidate playtest progress carries over); `reject <world> <n ...>` deletes candidates; `drop <world> <n ...>` removes shipped levels. All renumber so files stay 01, 02, ...
- Candidates show in level select (labels `cN-K`) when the developer switch is on, so the player can try them on the phone and then keep or reject them. Generate candidates for a world only after its step 8 migration is done, and only when the player asks.
- A board with no goals never counts as won (sandbox). Retrying a level keeps its starting layout (from the level seed) but uses a new play seed for refills.
- Dev builds expose the play screen as `window.__play` for console poking.
- `public/sw.js`: service worker (network-first for the page, cache-first for hashed assets; `VERSION` is stamped with the short git SHA at build by a plugin in `vite.config.ts`, so old caches are evicted on the next load). `public/manifest.webmanifest`. Icons come from `npm run icons`.
- `npm test`, `npm run dev`, `npm run phone` (dev server on the LAN), `npm run build`.
- Hosting: GitHub Pages via `.github/workflows/deploy.yml`, served at https://2by6vk6424.github.io/better-dots/ (repo `2by6vk6424/better-dots`). Every push to `main` runs the tests, builds, and deploys. The build uses relative paths (`base: './'`), so it works under the repo subpath.

## Vocabulary

- **Clear:** a cell's dot being removed by any means (line, loop, bomb, beam, zap, lotus, power-up). Every clear counts the same for goals and for obstacles.
- **Hit:** one unit of damage to an obstacle. Each obstacle below says what delivers a hit to it. The common kinds:
  - **adjacent clear:** a cell orthogonally next to the obstacle is cleared. One connection that clears several adjacent cells is still one hit; two separate clear events (a line, then a bomb) are two hits.
  - **clear on it:** the dot sitting on or inside the obstacle is cleared (ice, slime, circuits, targets work this way).
  - **blast:** a bomb explosion, a gem beam, a cloud zap, or a nesting-dot bomb reaching the cell. Each blast source is one hit.
- **Blast sources** (things that emit hits on cells): bombs from loops, nesting-dot bombs, beetle bombs, gem beams, cloud zaps, magnet explosions, circuit discharges, monster-kills by bomb. The Sure Shot power-up is a blast; Eraser and Color Burst are not (they deliver one hit to what they touch, as a clear).

## Core rules

- **Board:** a grid of cells; some cells may be empty (shaped boards). Up to 5 dot colors per board, set per level.
- **Move:** drag across 2 or more adjacent dots of the same color, horizontally or vertically, never diagonally. Dragging back along the line shortens it. Releasing clears the line and uses one move.
- **Gravity and refill:** after a clear, dots fall straight down to fill gaps, passing over empty cells. New dots enter at the top of each column. Refills are seeded random from the level's colors and may include the color just cleared `(default; one 2014 source claims the refill after a loop excludes that color, unconfirmed)`.
- **Loops:** if the line closes a loop, every dot of that color on the board clears. Any closed loop of 4+ dots counts, not only 2×2 squares.
- **Bombs:** dots of other colors fully enclosed inside a loop become bombs. They explode in place, after the loop's color clear and before gravity, clearing themselves and their 8 neighbors.
- **Chain resolution:** blasts can trigger further bombs, gems, and obstacle reactions. Resolve in waves in a fixed, deterministic order (everything set off together fires together; what a wave reaches fires in the next wave) and animate the cascade in sequence so it reads clearly.
- **Moves and goals:** each level has a move limit and one or more goals. Meet all goals before moves run out to win.
- **Stuck board:** if no legal move exists, reshuffle the regular dots automatically. Free, costs no move. Obstacles, wilds, and placed pieces stay put. At the start only the randomly filled cells are shuffled; dots the level placed stay put. A level whose placed dots leave no opening move is an error.
- **Order of a move:** (1) the connection's clears, including the loop's color clear; (2) bombs and triggered gems, in waves, with obstacle hits applied as each wave lands; (3) layer reactions that happen "on clear" (ice hits, slime hits, water spread, fire extinguished); (4) pieces that act after the cascade (beetle bombs, lotus auto-connect, monster kills); (5) gravity and refill; (6) things that react to the settled board (cloud zaps, teleporter transfers happen during the fall); (7) things that act when ignored (fire and slime spread, beetles walk, monsters eat, trains advance); (8) a second settle if step 7 moved anything. Steps 7 and 8 don't happen for power-up uses, since no move was spent. Any mechanic that needs a different slot says so below.
- **Leftover moves:** when the last goal is met with moves to spare, the first 5 unused moves drop as bombs onto seeded random dots, one at a time, each exploding before the next lands. Purely a finale; it changes no record.
- **Square hint:** an optional setting (off by default) highlights one available loop on the board after a few seconds of no input.

## Board terrain

- **Shaped boards:** empty cells; dots fall past them.
- **Blocks:** a full cell that holds no dot, can't be connected across, stops dots from falling (the column refills below it by growing in), and contains spreading hazards and walking pieces. Removed by one adjacent clear or one blast. Blocks block water. Level data: `blocks` grid.
- **One-sided blocks:** a block with one weak side. Removed only by an adjacent clear on the weak side, or by any blast from any side. Otherwise as a block. Level data: `{ "r", "c", "weak": "up" | "down" | "left" | "right" }`.
- **Teleporters:** a bottom pad in one column linked to a top pad in another. A dot or piece that falls into a bottom pad leaves the board there and enters at the linked top pad, continuing to fall. Transfers happen during gravity, pulled by space in the receiving column. Pairings are explicit in level data and are drawn so the player can trace them; chains are allowed. Connections don't cross a teleporter. An anchor reaching a bottom pad transfers; it doesn't sink `(default)`.
- **Walls (legacy):** thin barriers on cell edges that block connections but not falling. The original has no such thing; the shipped World 3 uses them. Keep them working, but no new levels use them and the generator never places them. See `docs/decisions.md`.
- **Later:** ramps (triangular half-cells that slide a falling dot one column sideways; dots arriving down a ramp fill a gap before dots directly above it), side feeds.

## Obstacles and special pieces

Each one is introduced in its own world. Order follows the original's unlock order; built mechanics keep their existing worlds.

### Water
- A cell layer. Some cells start watered. Dots on water play normally.
- When a cleared cell is orthogonally adjacent to a watered cell, it becomes watered, and the flood carries on through every cleared cell connected to it `(default; the original's flood extent is undocumented)`. Any clear counts: lines, loops, blasts, lotus, power-ups.
- Flooding happens after the move's whole cascade, before gravity, on the vacated cells.
- Blocked by ice, blocks, one-sided blocks, trapdoors, and slime. Water blocks slime. Fire can spread onto a watered cell; the cell stays watered.
- Goal: flood every playable cell.

### Anchors
- Not connectable. Fall with gravity like dots.
- Sink when they reach the bottom of their column (its lowest cell, even on shaped boards): removed and counted toward the anchor goal.
- **Blasts destroy anchors and count** toward the anchor goal. A loop around an anchor doesn't make it a bomb and does nothing to it.
- Fire spreading onto an anchor, or a monster eating one, destroys it **without** credit.
- Anchors travel through teleporters; beetles swap places with them; slime can cover the cell under one.
- Spawning: a new anchor drops into the top of a seeded column whenever fewer anchors are on the board than `maxOnBoard` (default: the starting count, at least 1), after `dropDelay` moves (default 0), until drops run out. At most one new anchor drops per move `(default)`. Level data: `anchorDrops`, optional `maxOnBoard`, optional `dropDelay`. `dropDelay` is a grace period: the board must stay below `maxOnBoard` for that many moves before the next anchor drops `(default reading of the reference's "grace period of a move or more")`.

### Ice
- A layer on a cell, thickness 1–3, each with a distinct look (fresh, cracked, nearly broken). Ice does **not** lock the dot: the dot on an iced cell is connectable, falls out when the cells below clear, and is replaced from above like any other dot. Ice never blocks falling.
- One hit = one clear on that cell, from any source: the dot used in a connection, a loop of the dot's color, a blast, a lotus, a power-up. Several clears on the cell in one move are several hits.
- Each blast source that reaches an iced cell is one hit, whatever the cell holds, including an empty cell or frozen fire; two bombs in one wave reaching it are two hits `(default)`.
- A hit on a ladybug on an iced cell is a clear on that cell: the ice takes a hit too `(default)`.
- An adjacent clear does nothing to ice.
- The goal counts cells broken all the way through.
- Ice blocks water and slime from spreading onto it. Water, fire, or slime placed under ice by the level is dormant until the ice breaks `(default; the original only says ice contains them)`. Frozen fire holds no dot and can't be extinguished until the ice breaks.
- A gem on an iced cell is protected: a trigger that reaches it hits the ice instead `(default)`. An anchor on an iced cell still sinks if it's on the bottom cell `(default; original undocumented)`.

### Fire
- A burning cell holds no dot; dots don't fall through it (the column grows in below).
- Extinguished by one adjacent clear or by one blast landing on it. Also by an Eraser, a Sure Shot, or a monster eating it. Once out, it's a normal cell and refills in the same move.
- **Spreads per region.** After the board settles, each connected region of fire that received no hit this move grows by one cell: a seeded pick among cells orthogonally next to it that aren't frozen, blocked, or burning. The new fire destroys what was there: a regular dot, a wild, a lotus, a nesting dot, or an anchor (uncredited). It skips gems, beetles, magnets, clouds, monsters, circuits, and pieces on a train `(default for the ones the original doesn't list)`. The destroyed dot counts toward nothing. Clearing the middle of a fire zone splits it into zones that spread independently.
- Fire can spread onto watered and slimed cells. Blocks, one-sided blocks, and trapdoors contain it. Fire under ice is dormant.
- Goal: extinguish all fire.

### Slime
- A layer under dots, two layers thick (fresh, bubbling). Dots on slime play normally.
- One hit = one clear on that cell (the slimed dot used in a connection, a loop of its color, a blast, a lotus, a power-up). An adjacent clear does nothing. Two hits clean the cell.
- **Spreads per region.** After the board settles, each connected region of slime that received no hit this move grows by one cell at full thickness: a seeded pick among orthogonally adjacent cells that aren't slimed, frozen, watered, blocked, or burning. Slime spreads onto empty cells (under blocks) and onto cells holding anchors, gems, or other pieces; it never moves with them and doesn't fall.
- Blocked by blocks, one-sided blocks, trapdoors, ice, and water. Fire can burn on a slimed cell; both layers stay until each is dealt with. Monsters clean the slime off a cell they eat into.
- Slime under ice is dormant: can't be hit, doesn't spread, still counts.
- Goal: clean all slime (both layers).

### Blank dots (wilds)
- A connectable dot with no color. It joins a connection of any color and can stand in for a dot of the loop's color in a loop. A connection may contain several wilds; its color is the color of its colored dots. A connection of only wilds is legal (2+) and clears just those wilds `(default)`.
- A loop made entirely of wilds clears every dot on the board and delivers one hit to every obstacle that takes hits.
- Falls like a dot; the level places them (and may drop more in: `wildDrops`). Not shuffled by reshuffles. Fire destroys a wild it spreads onto. Lotus connections don't pass through wilds. A wild never counts toward a collect goal.

### Monster dots
- A connectable dot with a color and a number (HP). Connecting it with dots of its color lowers the number by one per other dot in the connection; a loop or color clear of its color that doesn't run through it lowers it by one `(default reading of the guides)`. At zero it's removed.
- Enclosed in a loop, it becomes a bomb and is removed at once. A blast reaching it removes it.
- Each move in which a given monster wasn't part of a connection: it eats a seeded orthogonal neighbor (a dot of any kind, a wild, fire, an anchor without credit, a slimed cell's dot, cleaning the slime), moves into that cell, leaves a dot of its own color where it was, and its number rises by one. It doesn't eat gems, beetles, clouds, magnets, blocks, or other monsters `(default)`. Blocks contain it.
- Falls like a dot. Doesn't count toward collect goals.
- Goal: remove N monsters.

### Circuits
- A frame on a cell; the dot inside is a normal dot that falls and connects. A circuit is on or off. Any clear on the cell toggles it (a connection through the dot, a loop of its color, a blast, a lotus). An empty circuit cell can't toggle.
- Circuits belong to groups (level data). When every circuit in a group is on at the end of the cascade, the group fires: each circuit cell becomes a bomb, explodes, the frames are removed, and the group counts toward the goal.
- Goal: clear N circuits.

### Lotus dots
- A fixed piece with a color; doesn't fall, isn't connectable, and holds its cell `(default; the original doesn't say what the lotus itself does)`. After the move's cascade and before gravity, it clears every same-color dot connected to it by an orthogonal chain of that color, at no move cost. That clear counts as a clear (hits ice and slime once, floods water, triggers gems, toggles circuits) but never as a loop.
- The chain doesn't pass through wilds, beetles, or monsters.
- Levels may spawn lotuses on a schedule (`lotusDrops`: list of `{ "afterMove", "r", "c", "color" }`).
- No goal of its own; it's a helper.

### Nesting dots
- Not connectable; falls like a dot. Three layers. One hit = one adjacent clear, one loop that clears an adjacent dot, or one blast. The third hit turns it into a bomb that explodes at once (8 neighbors), so it chains into gems and other nesting dots and destroys anchors (credited). An Eraser clears it fully.
- Shakes when one hit away.
- Usually no goal; levels may ask for N nesting dots popped.

### Magnets
- A wild that isn't consumed by an ordinary connection. When a connection includes a magnet, the magnet moves to the cell where the drag ended `(default; the original says "drag magnets along dots")` and the other dots clear as usual. A loop that includes a magnet clears the loop's color and leaves the magnet.
- When two magnets are orthogonally adjacent after the board settles, both are removed and each explodes like a bomb. Three or more adjacent all go.
- Falls like a dot. Not shuffled. Levels cap how many are on the board (`maxOnBoard`) and drop more in (`magnetDrops`).
- Goal: collect N magnets.

### Gems
- Each gem has one of the board's colors. It occupies a cell, isn't connectable, and falls with gravity.
- Triggers when a loop or Color Burst of its color is made, or when a blast or lotus clear reaches it.
- **Row gem** (horizontal rectangle): its beam clears its whole row. **Column gem** (vertical rectangle): its whole column. **Cross gem** (square): row and column.
- Beams clear regular dots, destroy anchors (credited), blocks, one-sided blocks, clouds, and fire; deliver one hit to ice, slime, beetles, nesting dots, trapdoors; toggle circuits; trigger other gems in the next wave; flood water. Beams cross legacy walls and don't stop at anything. Frozen gems are protected (their ice cracks instead). Each gem fires once and is removed when it fires.
- Goal option: trigger N gems.

### Ladybugs (the original's Beetle Dots)
- Start with 3 spots. Connectable like a dot of their current color. Falls like a dot. Has a facing direction.
- One hit = being in a connection, a loop of its color, a blast, or a Color Burst / Eraser. A hit removes one spot and changes it to a different seeded color, at most one spot per move. Touch-and-hold on a ladybug previews its next color.
- At the third hit it flies away and leaves a bomb on its cell, which explodes in the same cascade.
- **Walks when ignored.** After the board settles, each ladybug that took no hit this move moves one cell in its facing direction, swapping places with what's there (a dot, wild, anchor, nesting dot, or empty-but-playable cell). If the next cell is off the board, empty space, a block, a fixed piece, or another ladybug, it turns 90° clockwise instead `(default direction)` and doesn't move this turn. Gems, burning cells, and legacy walls also stop it `(default)`. Ladybugs act one at a time in board order, so one blocked by another that hasn't moved yet turns `(default)`. A level that doesn't give a facing gets `up` `(default)`.
- A loop around a ladybug does nothing to it; it isn't a dot `(default; original undocumented)`.
- Ladybugs don't count toward collect goals; reshuffles leave them in place.
- Goal option: clear N ladybugs.

### Trapdoors
- An open hole in the board. While open: holds nothing, can't be connected across, can't be watered or slimed, and lets dots and pieces fall through it to the cell below. Contains fire and slime.
- Hits: 3 by default (level data can set 1–3 per trapdoor). One hit = one adjacent clear, a loop clearing an adjacent dot, or a blast. At zero it closes and becomes a normal cell that fills from above.
- Goal: close N trapdoors.

### Thunderclouds
- Not connectable; falls like a dot; levels drop them in from the top with a cap (`maxOnBoard`, `cloudDrops`).
- After the board settles, if two or more clouds share a row, they zap: every cell strictly between the outermost pair in that row is hit (regular dots clear, fire goes out, gems trigger, circuits toggle, anchors are destroyed and credited, blocks and one-sided blocks break, water floods; ice, slime, nesting dots, ladybugs, trapdoors take exactly one hit no matter how many clouds fired), and all clouds in that row are removed and counted. Costs no move. A zap can set off a cascade; resolve it and settle again.
- A lone cloud is also removed (and counted) by a blast or an Eraser.
- Goal: clear N clouds.

### Trains
- A track is a path of cells in level data; a train is one or more cars that sit on track cells, each carrying the dot (or piece) in its cell. Carried dots connect normally and don't fall.
- After every move, no matter what else happened, each train advances one track cell in its direction, taking its cargo with it; the dot it uncovers is left in place, and the cell it moves into gives its dot to the car's previous cell `(default: a swap)`. At the end of a track the train reverses `(default)`. The car shows the direction of its next move.
- Not clearable; no goal. A car can sit under ice.

### Later (record only, don't build yet)
- **Ramps and side feeds** (see Board terrain).
- Everything from the original's L911 onward (hermit crabs, flippers, meteors, fossils, sun dots, seed dots, snow, bubbles, moonstones, fireflies, ceramic tiles, targets, lanterns, ...). The reference documents them; add here only when one is chosen.

## Levels and progression

- Levels are grouped into worlds. Each world introduces exactly one new mechanic, in build order. World 1 is core rules only, World 2 shaped boards, World 3 walls (legacy); the step 6 mechanics start at World 4; new mechanics append as new worlds in the original's unlock order.
- Levels unlock one at a time, in order. The developer switch unlocks everything.
- Goal types: collect N dots of a color; sink N anchors; break N ice; flood the board; extinguish fire; clean slime; trigger N gems; clear N ladybugs; remove N monsters; clear N circuits; pop N nesting dots; collect N magnets; close N trapdoors; clear N clouds. Levels can combine goals.
- **Out of moves:** offer "5 more moves" (the assist) or an instant retry. No penalty either way.
- **Assisted clear:** unlocks the next level but earns no stars or power-ups, and is marked in level select. Replaying without the assist can earn them.
- **Stars, by moves used:** 1 star for any clear; 2 for using fewer moves than the bot's median run; 3 for matching the bot's best runs (default: top 10%). Thresholds are stored per level; expect retuning. Saves store best moves; stars are derived from the current thresholds, so retuning changes what level select shows.
- **Power-ups:** the original's four in-level power-ups, earned instead of bought. Earn 1 on the first 3-star clear of a level and 2 for finishing a world. Stored locally. One pool: each power-up on hand can be used as any kind. Using one costs no move and doesn't mark the level assisted. Usable only while the game is on (not after running out of moves) and once the last move's dots have landed. Hazards don't spread and walkers don't walk after a power-up, since no move was used.
  - **Eraser:** remove one chosen dot. On ice or slime: one hit, the dot stays. On fire: puts it out. On a ladybug: one hit. On a nesting dot: clears it fully. On a gem: sets it off. On a cloud: removes it. Anchors, blocks, and empty cells can't be erased.
  - **Shuffler:** reshuffle the regular dots, as the stuck-board shuffle does.
  - **Color Burst:** clear every dot of a chosen color as if a loop of that color had been made (triggers gems and hits monsters, ladybugs, ice, slime of that color), but with no path, so nothing is enclosed and no bombs form.
  - **Sure Shot:** tap a dot; its whole row and column are cleared as a blast (same effects as a cross gem's beams). Any cell can be the target, since only its row and column matter `(default)`.
  - All four count as clears for goals and obstacles, and the board settles and refills. Rules: `applyPowerUp` / `canUsePowerUp` in `game.ts` (kinds `eraser`, `colorBurst`, `shuffler`, `sureShot`). In the UI, Eraser and Sure Shot wait for a tap on the board (`PlayScreen.setTarget`); Shuffler and Color Burst act at once.
  - Earning (`awardPowerUps` in `progress.ts`, run after every win and on load): 1 the first time a level's best unassisted moves reach 3 stars at its current thresholds; 2 the first time every level of a world has an unassisted clear. The save lists awards given, so each is earned once. Candidates never earn. The developer switch makes power-ups unlimited for testing.

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
- **Feel priorities:** the line tracks the finger tightly; dots fall with slight easing and a small settle; cascades are readable. A new drag can start as soon as the dots have landed; tail effects finish underneath it (`config.input.unlockAt`: `'settle'`, or `'end'` to wait for everything). HUD counts change when the cleared dots have popped, not when the finger lifts.
- **Sound:** no music. Soft synthesized tones (Web Audio, no audio files) that rise in pitch as the line grows, and a distinct chime on loops. Light haptics where the browser supports them. Mute toggle.
- **Level select:** a plain grid of numbered levels grouped by world. Illustrated world art may come later from the player's own drawings.

## Build order

Steps 1–7 and 8.1–8.7 are done. The current build was written from memory of the original; step 8 brings the built mechanics in line with the original, then steps 9+ add the mechanics the original has that this game doesn't.

1. Setup: PWA shell, rules module, test harness, config file, seeded RNG, and free static hosting (GitHub Pages or similar) so every working build can be opened on the phone.
2. Core loop on one hardcoded board: drag, clear, gravity, refill, loops, bombs, moves, the collect-color goal, win/lose, auto-shuffle, colorblind symbols. Playtest on the phone until the feel is right before moving on.
3. Level format (JSON), level select, saved progress, retry, assist.
4. Terrain: walls, shaped boards.
5. Generator and bot for the core rules; stars from bot results.
6. Mechanics, one world each, extending the generator and bot with each: anchors → ice → water → gems → ladybugs → slime → fire. Hazards-under-ice.
7. Power-ups.
8. **Migration to the original's rules**, one mechanic per commit, in this order, re-scoring the affected worlds with the bot after each and re-playtesting their levels:
   1. Ice: overlay model (dot connectable, falls through, hit per clear on the cell, no gravity plug). This removes the "run under ice doesn't refill" gravity case and changes the frozen-anchor, frozen-gem, and ladybug-landing rules above.
   2. Slime: two layers, hit = clear on the cell, per-region spread, spreads onto empty cells and onto pieces, overlaps with fire.
   3. Fire: per-region spread, blasts extinguish, spread destroys anchors/wilds/lotus/nesting dots, spreads onto water and slime.
   4. Anchors: blasts destroy and credit; `maxOnBoard` and `dropDelay`.
   5. Gems: row gem; beams destroy anchors, blocks, clouds, fire.
   6. Ladybugs: facing, walking, bomb on removal, no random flight, no loop kill.
   7. Power-ups: rename Pick → Eraser and Color clear → Color Burst; add Shuffler and Sure Shot.
   8. Leftover-move bombs; square-hint setting.
9. New mechanics, one world each, in the original's order, extending the generator and bot with each: blocks → teleporters → blank dots → one-sided blocks → monsters → circuits → lotus → nesting dots → magnets → trapdoors → thunderclouds → trains.
10. Sound, haptics, polish. Confirm offline play and home-screen install.

## Defaults chosen where the original is undocumented

Each is tagged `(default)` above. Revisit after playtesting; a change is a one-line edit here plus its test.

- Refills can include the just-cleared color
- Water floods the whole connected cleared set
- Hazards placed under ice are dormant until the ice breaks; a frozen anchor on the bottom cell still sinks; a frozen gem is protected
- Each blast source is one ice hit, even on a cell with no dot; a ladybug hit on ice also hits the ice
- Fire and slime spread targets are a seeded pick among eligible neighbors; what fire spares beyond the documented list
- Monster HP drops one per other dot in the connection; one per loop/color clear of its color; +1 per move it eats; what it won't eat
- Lotus persists, doesn't fall, isn't connectable
- Magnet moves to the end of the drag
- Ladybug turns clockwise when blocked; a loop around it does nothing; gems, fire, and walls block it; board order; default facing up
- Wild-only connections are legal; a loop around an anchor does nothing
- Teleported anchors don't sink at the pad
- At most one new anchor drops per move
- Train cars swap cargo with the cell ahead and reverse at track ends
- Star cutoffs; power-ups cost no move; Sure Shot can target any cell
