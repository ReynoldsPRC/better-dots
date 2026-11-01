# Two Dots mechanics vs. better dots spec

Nov 1, 2026 · @User

## Bottom line

Two Dots has 68 named mechanics plus core rules; the spec covers 7 of them (anchors, ice, water, fire, slime, gems, beetles) and lists 3 more as Later (monsters, thunderclouds, ramps). Of the remaining 58, ten sit inside the era the spec is cloning (L86–L836) and are the ones that count as missing; the other 48 postdate everything in the spec. Separately, three of the spec's seven mechanics are different designs from the original under the same name.

### Missing, from the spec's own era (unlock level)

1. Blocks (86): a solid cell that stops falling, one adjacent hit to remove. The original's basic terrain piece; the spec has walls instead, which the original doesn't have.
2. Teleporters (111): bottom-of-column pads that feed a top-of-column pad elsewhere.
3. Blank Dots / wilds (136): connect as any color; a square of wilds wipes the board.
4. One-Sided Blocks (186): removed only from the weak side or by a blast.
5. Circuits (286): a frame around a dot that toggles when the dot is used; a fully-on group fires as bombs.
6. Lotus Dots (336): after each move, auto-clear every touching same-color dot for free.
7. Nesting Dots (386): three adjacent hits, then it becomes a bomb.
8. Magnets (486): a wild you drag along connections; two adjacent magnets explode.
9. Trapdoors (686): a hole dots fall through until closed with three adjacent hits.
10. Trains (836): a car on a track that moves one space every move, carrying its dot.

Also missing, smaller: the horizontal (row) gem; the end-of-level sequence where leftover moves become bombs; the Shuffler and Sure Shot power-ups; the optional square hint.

Not missing: the Wikipedia claim that 13+ dots in a line clears the color appears nowhere else and is almost certainly wrong. Thin edge walls don't exist in the original; they're the spec's own device, which is fine.

### Where the spec's existing mechanics diverge from the original

| Mechanic | Original | Spec |
| --- | --- | --- |
| Ice | Overlay; the dot inside is connectable and falls through; 3 hits from using that dot or a square of its color; never blocks gravity | *Migrated in step 8.1; now matches the original.* Was: locks the dot, plugs the column, cracked from neighbors, one layer per move. The original's locking variant is Glaciers (L2401, explosion-only). The old ice was a hybrid that exists in neither. |
| Slime | 2 hits, by connecting the dot on the slime; spreads per region when that region isn't hit; spreads into empty cells; coexists with fire | 1 hit; global spread check; no overlap with fire |
| Beetles / ladybugs | Walk one cell in their facing direction each move they're ignored, turning at walls; stay put when hit; leave a bomb on removal | Fly to a random cell when hit; no bomb; loop-enclosure kills them (that rule is the original's Monster rule) |
| Fire | Per-region spread; bombs and gem beams extinguish it; it eats anchors (uncredited), wilds, lotus, nesting dots; enters water and slime | Global spread check; blasts don't extinguish; anchors safe; no overlap with water or slime |
| Anchors | Bombs, gem beams, zaps and nesting-dot bombs destroy them (players count it as credit); often one on board at a time with a delay | Immune to blasts; immediate top-up |
| Gems | Row, column and cross shapes; beams destroy anchors | Column and cross only; beams skip anchors |
| Water | Fire can spread into it | Fire can't |

All of these are already in the spec's "defaults to revisit" list except the ice model (flagged separately), the slime hit count, and the beetle movement model. None of them is wrong for a personal game; they're just not the original.

## Core rules: original vs spec

The spec's core loop matches the original on everything that is documented. The real gaps are elsewhere (ramps, wilds, teleporters, blocks) and in how the spec's own obstacles behave. Where the original is undocumented, that's noted rather than guessed.

| Rule | Two Dots | Spec | Verdict |
| --- | --- | --- | --- |
| Connection | 2+ same-color dots, orthogonal only; path may zig-zag. One connection = one move. No timer anywhere in main levels. | Same | Match |
| Loop | Any closed loop of 4+ dots clears every dot of that color (official text says "square"; every detailed source says square, rectangle, or any closed polygon). | Same | Match |
| Bombs | Dots of any color fully enclosed by the loop become bombs; each clears itself plus its 8 neighbors. Multiple enclosed dots = multiple bombs. Detonation timing: 2014 Gamezebo says after the color clear, in place; Wikipedia (uncited) says after they fall. | Same, 8 neighbors, in place before gravity | Match; timing choice is the better-attested one |
| Gravity | Dots fall until they land on a dot or the floor; new dots enter from the top. | Same | Match |
| Refill | Random from the level's palette (3–5 colors). One 2014 source claims the refill right after a loop excludes the color just cleared; nothing else confirms it. | Refills may include the cleared color (listed as a default to revisit) | Possible difference; unverified |
| Stuck board | Auto-shuffles colored dots only when no adjacent same-color pair exists; obstacles, fire, ice and wilds stay put; costs nothing. | Same (obstacles stay put) | Match |
| Move limit and goals | Fixed move budget per level; objectives shown above the board; all must be met. Levels combine goals freely. | Same | Match |
| Leftover moves | End-of-level bonus: the first 5 leftover moves drop as bombs onto the board, extra moves score points (2014 source; not confirmed in current builds). | Nothing | Missing (cosmetic; relevant only if you want the end-of-level fireworks) |
| Out of moves | Offer of +5 moves for money/Gold (now via spinners); declining costs a life; quitting after the first move costs a life. | +5 assist or retry, no penalty | Deliberate omission |
| Rating | 2014: 1–3 stars per level by points/moves. Help Center text still says stars exist; modern sources are silent. | Stars by moves vs bot | Spec's own system |
| "13+ dots in a line clears the color" | Appears only on Wikipedia, uncited; no other source (official or guide) mentions it. | Not present | Not missing; treat as apocryphal |
| Square hint | Settings toggle flashes a possible square on the board. | Nothing | Optional nicety |
| Cosmic Blast (2024) | Temporary modifier: closing a square also clears the 3×3 around the closing dot. | Nothing | Not core; skip |

Scoring (2014, from the only source with numbers): 1 point per dot or fire doused, 10 per anchor sunk, 10 per ice broken, 5 per leftover move. Whether a numeric score is still shown is unconfirmed; the spec has none, which is fine.

Open question the sources don't settle: loops with an interior hole (a cutout or block inside the loop). Nothing to convert, presumably nothing happens; the spec's enclosure test should just skip empty cells, which it already does.

Sources: Help Center faq/368, faq/372, faq/382, faq/383; Gamezebo 2014 walkthrough; Wikipedia; levelwinner walkthroughs; iMore; roseplusman guide. Full list at the end.

## Mechanics the spec already has: original vs spec

The spec's anchors, water, gems and fire are close to the original. Ice, slime and ladybugs are different designs that share a name. "Official" = the in-game tutorial text (from the localized Help Center); "guide" = the 2016 unofficial guide and player writeups.

### Anchors (L25)

Original:

- Official text in full: "Anchors must fall to the bottom of the board for them to count toward your goal." Not connectable; fall with gravity; sink off the bottom row.
- Bombs destroy anchors, and players treat that as credited ("a bomb can clear anchors without bringing them all the way down"; "plan switch explosions to kill anchors"). Nesting-dot bombs, cloud zaps, gem beams and magnet explosions also destroy them. No source states outright that these count, but every guide lists them as ways to clear anchors.
- Fire and monsters destroy anchors without credit.
- Spawning: many levels keep one anchor on the board at a time, with a grace period of a move or more before the next drops; some levels hard-cap the total.
- Anchors pass through teleporters; beetles swap places with them; erasers are suggested for the lone dot under an anchor.

Spec differs:

- Bombs and beams don't affect anchors (listed as a default to revisit). In the original, blasts are a primary way to clear anchors, so anchor levels play very differently.
- Spec tops up to the starting count immediately; original often runs one at a time with a delay.

### Ice (L36)

Original:

- Official: "Ice takes three hits to be removed. Hit it with dot connections and squares!"
- Ice is an overlay on the cell, not a lock: the dot inside is connectable, dots fall through iced cells normally, and an iced cell can be empty if a block above starves it. A hit = using the dot currently in the ice in a connection, or a square of that dot's color. Three visual phases.
- Bombs, nesting-dot bombs, cloud zaps, gem beams each deal one hit; erasers and Color Burst deal only one hit; a square of wilds deals one hit to every hit-taking obstacle.
- Doesn't block gravity. Blocks water and holds back slime. Fire can be trapped inside ice.

Spec differed until step 8.1 (kept for history; the build now follows the original):

- Spec ice locks the dot, makes it unconnectable, plugs the column, and is cracked from orthogonal neighbors, one layer per move regardless of neighbor count. Original ice is cracked from inside, as many times per move as the dot is involved, and never blocks falling.
- The original's locking variant is Glaciers (L2401): trapped dots can't be connected, adjacency does nothing, only explosions hit them, 2 hits. The spec's ice is a hybrid of Ice (adjacent-ish, 1–3 layers) and Glacier (locks, immune to connection) that exists in neither.
- Original: a loop of the frozen dot's color counts as a hit. Spec: a loop leaves it.

### Water (L11, retrofitted; originally \~L643)

Original:

- Official: "Make connections next to Water to spread it. Squares can also spread Water. Gems, Bombs and Lotus Dots also remove dots so that Water can spread. Obstacles like Ice, Blocks and Slime block Water."
- A background layer; dots on it play normally; the goal is to cover all background. Guide: "reverse slime"; water spreads into cells whose dots were just removed and that connect to existing water, evaluated before gravity refills them.
- Water blocks slime; slime blocks water. Fire can spread into water (guide calls it "a violation of physics"). Trapdoors can't be waterlogged; one-sided blocks contain water.
- Flood extent (whole cleared region vs only cells touching water) is never stated.

Spec differs:

- Spec: fire doesn't spread onto watered cells. Original: it does.
- Spec floods the full connected cleared set; original extent is undocumented, so the spec's default is a legitimate choice, not a known match.

### Fire (L61)

Original:

- Official: "Make a connection next to the Fire to extinguish it. Squares help contain the Fire. If you don't make a connection next to the Fire, it spreads. The Fire won't advance until you move."
- Occupies the cell; one hit kills: adjacent connection, bomb blast, gem beam, cloud zap, a monster eating it, an eraser.
- Spread is per connected fire region: a region that got no adjacent hit this move grows by one adjacent cell; clearing the middle of a fire zone splits it into two zones that then spread independently. Target cell choice is undocumented (appears random).
- The new fire cell destroys whatever was there: a dot, a wild, an anchor (no credit), a lotus, a nesting dot. Fire can spread into water and inside slime; it can be trapped inside ice. Blocks, one-sided blocks and trapdoors contain it. Fire doesn't fall (not stated anywhere, but nothing suggests it does).
- Some 2015 levels respawned fire mid-level.

Spec differs:

- Spec spreads when no fire anywhere was extinguished (global). Original is per region, which is what makes splitting a fire zone a tactic.
- Spec: a blast landing on a burning cell doesn't put it out. Original: bombs and gem beams extinguish fire directly.
- Spec: anchors, gems, ladybugs are safe from spread; no spread onto water or slime. Original: fire eats anchors (uncredited), wilds, lotus, nesting dots, and enters water and slime.

### Slime (L436)

Original:

- Official: "Connect dots on Slime to hit it. Making squares also affects Slime! Slime needs two hits to be removed." Bubbles show the one-hit-left state. The official text says nothing about spreading.
- A hit = using a dot that sits on a slimed cell (not beside it), or a square that clears such a dot. Two hits per cell. Nothing one-shots slime: bombs, gems, lotus, clouds, erasers, Color Burst and wild squares each deal one hit.
- Guide: spreads every move in which no dot inside that slime region was matched, by one cell at full two-hit strength; regions split and spread independently; it spreads into empty cells (under blocks); it doesn't fall; it encases dots and obstacles rather than destroying them.
- Blocked by blocks, ice, water, one-sided blocks, trapdoors. Fire can live inside slime and spread independently. Monsters eat slime.

Spec differs:

- Spec: one hit. Original: two, with a bubbling indicator.
- Spec's spread check is global (any slime cleaned anywhere). Original is per region.
- Spec: no slime onto burning cells, no fire onto slime. Original: they overlap.
- Spec says nothing about empty cells; original slime spreads into them.

### Gems (L536)

Original:

- Official: "Make squares to activate Gems of the same color. Dots do not connect directly to Gems. Horizontal Gems remove all dots aligned horizontally with them. Vertical Gems remove all dots aligned vertically. Square Gems remove dots aligned both horizontally and vertically."
- Three shapes: horizontal rectangle (row), vertical rectangle (column), square (cross).
- Triggers: square of its color, bomb blast, another gem's beam (chains), cloud zap, lotus clear, Color Burst or TNT of its color.
- Beam: destroys plain dots; one hit to slime, ice, beetles, nesting dots; destroys one-sided blocks from any side, anchors, fire, clouds; toggles circuits; clears background for water. Whether blocks stop a beam is unstated. Falls with gravity.
- Goal: collect N gems. Guide: "not really an obstacle."

Spec differs:

- Missing the horizontal (row) gem.
- Spec beams skip anchors; original beams destroy them.
- Spec's wave resolution (bombs and loop-triggered gems first, then gems a wave reaches) is finer than anything documented for the original; keep it.

### Ladybugs = Beetle Dots (L586)

Original:

- Official: "Connect Beetles to dots of the same color. Beetles change color when hit. Beetles need 3 hits to be removed. When a Beetle flaps its wings, it reveals the color it will become next. Beetles you don't connect will move. Beetles leave Bombs behind when eliminated!"
- Connectable as its current color. Each hit (connection through it, or bomb/gem/cloud/Color Burst/TNT/wild square) removes one spot and changes its color; spots show hits left; it shivers at one hit left. Touch-and-hold previews the next color.
- Movement: each move in which it isn't connected, it moves one cell in the direction it faces; at a wall or another beetle it turns instead; otherwise it swaps places with whatever is ahead (dot, anchor, nesting dot, wild). Which way it turns is undocumented.
- Third hit: it leaves a bomb on its cell and flies away; the bomb explodes normally.
- Listed officially among "explosive dots" (things that hit blockers).

Spec differs:

- Spec: on hit it changes color and flies to a random cell, swapping. Original: it walks deterministically when ignored and stays put when hit.
- Spec: removed at the last spot with no bomb. Original leaves a bomb.
- Spec: enclosed in a loop, it becomes a bomb and is removed regardless of spots. Not documented for beetles; that instant-kill is the official rule for Monsters.
- The spec's random-flight behavior is closer to the original's Octo Dots (L2901): connect it and it swims to another dot, takes its place and color; three hits; last hit blasts the 8 neighbors.

### Walls, shaped boards, blocks

- Shaped boards (cutouts): original has them from the first worlds; dots don't cross a gap vertically unless a ramp feeds them. Match.
- Thin edge walls (block connection, not falling): no source describes these in Two Dots. The spec's walls are its own device. The original's region separators are full cells:
  - Blocks (L86): official "Blocks prevent dots from falling. Connect dots next to Blocks to clear them." One adjacent hit; also removed by blasts; contain fire, slime, monsters, beetles; block water.
  - One-Sided Blocks (L186): official "Connect dots on the weak side to break them." One light side; only a connection adjacent to that side, or a bomb/gem/zap from any side, removes it. Also blocks falling on some levels.
- Cosmetic note: the 2014 reviews' "geometric obstacles that separate rows" are cutouts and blocks, not edge walls.

### Power-ups

- Spec's Pick ≈ Eraser (one dot; one layer off ice or slime; full clear on a nesting dot). Spec's Color clear ≈ Color Burst (one hit to gems/beetles/ice/slime; activates gems and monsters of that color). The original also has Shuffler and Sure Shot (row + column cross). No source says any power-up costs a move.

## Mechanics marked Later in the spec

All three are real, and the spec's one-liners are roughly right. Details:

### Monster Dots (L236)

- Official: "Each Monster Dot has a color and an assigned number. Connecting a Monster Dot with other dots of its color lowers its number. When its number reaches zero, the Monster Dot is removed. Turn it into a Bomb to destroy it instantly. If a Monster Dot doesn't receive a connection, it moves to eat a dot and leaves a dot of its own color in its place. Monster Dots can eat dots of any type, including Fire Dots."
- Connectable as a dot of its color. The number is HP. Guide example: a 6-dot purple connection through a purple monster took it from 10 to 4, so roughly one per connected dot; a square or color-clear of its color that doesn't run through it counts as one hit. The guide's two statements don't fully reconcile.
- Each move in which a given monster isn't connected: it eats an adjacent dot (moving into that cell) and leaves a dot of its own color behind; the guide says its number also rises by 1 per move. Direction appears random. It eats fire, anchors (uncredited), slime, presumably wilds.
- Instant kill: enclose it in a loop so it becomes a bomb; an adjacent bomb blast also kills it. Color Burst of its color activates it.
- Blocks contain monsters. Some players leave a monster alive because it keeps spawning its color, which helps squares.
- Spec's line ("eat nearby dots unless connected to dots of their color") is correct but misses the HP counter, the color it leaves behind, and the loop-kill.

### Thunderclouds (L761)

- Official: "Align the Clouds horizontally to clear them. Clouds clear the dots between them. Use the lightning wisely to hit the special dots in between!"
- Same row only; nothing mentions columns. The moment two or more clouds share a row they zap, with no move spent. The zap crosses whatever lies between them.
- Lightning destroys plain dots and one-sided blocks, extinguishes fire, triggers gems, toggles circuits, clears background for water, destroys other clouds in the path, and deals exactly one hit to slime, ice, nesting dots, beetles and trapdoors no matter how many clouds fired. Guide says it "clears one anchor" (ambiguous).
- A stranded cloud is removed by an eraser, bomb, gem beam or another zap. Clouds fall with gravity and drop in from the top; levels cap how many are on the board, often one at a time like anchors. Goal: clear N clouds.
- Spec's line matches.

### Ramps and diagonal falling (early worlds, no unlock article)

- Triangular half-cells present from the first worlds ("triangle blockers", "slanted surfaces"). A dot landing on the slope slides one column sideways and continues falling; some boards feed dots in from the side.
- Guide's observed order: when a dot below a ramp, one column over, is cleared, dots coming down the ramp fill it before dots directly above it. The guide's author admits he still doesn't understand ramp physics after a year; no formal rule is published anywhere.
- Squares built near or under a ramp are unreliable because of that fill order.
- Spec's line matches; the fill-priority rule above is the one detail to decide when building it.

## Every other mechanic, in unlock order

Sixty-odd pieces the spec doesn't mention. "Official text" below is back-translated from the French/Spanish Help Center pages, which carry the in-game tutorial text that the English pages hide in images. Anything beyond that text is from the unofficial guide (2016) or marked as inference. Gravity behavior is almost never stated officially.

A recurring grammar worth noticing: nearly everything is one of (a) hit by an adjacent clear, N hits; (b) hit only by explosions; (c) triggered by any square; (d) acts on its own when not hit. The spec's event system already supports all four patterns.

### Early game (L86–L836)

These are the ones that sit inside the spec's own era (the spec's newest mechanic, gems, is L536). They are the real candidates for "missing".

| Mechanic (unlock) | Official text (back-translated) | Details, guide notes, inferences |
| --- | --- | --- |
| Blocks (86) | Blocks prevent dots from falling. Connect dots next to Blocks to clear them. | Full-cell, not connectable, doesn't fall; one adjacent hit or any blast removes it. Contains fire, slime, monsters, beetles; blocks water. An iced cell under a block can sit empty. |
| Teleporters (111) | Dots and Anchors that fall into a Teleporter reappear elsewhere on the screen. Pay attention to which Teleporters are linked. | A bottom-of-column exit pad feeds a top-of-column entry pad in another column; pairings aren't shown; chains exist. Player note: the receiving column's gravity is what pulls dots through. Anchors travel through them (whether a bottom pad can sink one is unanswered). Not clearable. |
| Blank Dots (136) | Blank Dots can be converted into the color of any other dot on the board. | Wild: joins any color's connection and can stand in for a color inside a square. Square of wilds: guide and two others say it clears the whole board and deals one hit to every hit-taking obstacle; one 2015 review says it clears only the blanks. Falls like a dot. Can strand with no legal move. Lotus can't bridge across it; Shuffler won't move it; Waterfall won't paint it; fire eats it. |
| One-Sided Blocks (186) | Connect dots on the weak side to break One-Sided Blocks. | One light side, three dark; a connection adjacent to the light side, or a bomb/gem/zap from anywhere, removes it. Blocks falling on some levels. Contains fire, slime, water; can lock anchors. Eraser probably doesn't work. |
| Circuits (286) | Connect dots of the same color to activate a Circuit. Connecting an activated Circuit with another dot deactivates it. Once all linked Circuits are activated, they remove the dots around them. | A cell frame around a normal falling dot; using the dot inside toggles it (so do squares of its color, bombs, gems, zaps, lotus). When every circuit in a group is on, each fires like a bomb. An empty circuit cell can't be toggled. Goal: clear N circuits. |
| Lotus Dots (336) | After a move, Lotus Dots automatically connect to any dot of the same color they touch. | After the move resolves, it auto-clears every same-color dot connected to it, costing no move; doesn't form squares; can't cross wilds. Triggers gems, toggles circuits, counts as one hit on slime. Whether the lotus itself persists, falls, or is a goal is undocumented. Levels dispense them on a schedule. |
| Nesting Dots (386) | Make connections next to a Nesting Dot to hit it; squares can also help. Three hits to remove. The final hit turns it into a Bomb, which removes the dots surrounding it. Shakes when one hit away. | Not connectable; falls. Bombs/gems/zaps one hit each; an eraser clears it fully. Its bomb chains into other nesting dots and gems, destroys anchors, hits ice and slime once. |
| Magnets (486) | Connect Magnets to remove them. A Magnet acts as a Blank Dot. Drag Magnets along dots of the same color to bring them near other Magnets. When two Magnets come together, they remove the dots around them. | A wild that isn't consumed by an ordinary connection; it moves along the path you draw. Two magnets adjacent = both removed with a bomb-like blast (destroys anchors). A magnet alone in a square survives the square. Exact movement semantics undocumented. Goal: collect N (in pairs). |
| Trapdoors (686) | Connect dots next to Trapdoors to close them; squares help. Once closed, dots can take its place; the space is integrated into the board. | Guide: three hits (varies per trapdoor; some start damaged); bombs/gems/zaps one hit. While open it's a hole: dots and nesting dots fall through, it holds nothing, can't be connected or watered, and contains fire and slime. Closing one reflows the board. |
| Trains (836) | Trains move once every turn and carry the dots along with them. The arrow shows the direction the Train will travel next. | Unconditional: one track space per move no matter what. Carried dots stay connectable. Not clearable; no goal; water must sometimes reach the train. Cars can be iced. Track-end behavior undocumented. |

### Mid game (L911–L2901)

| Mechanic (unlock) | Official text (back-translated) | Details and inferences |
| --- | --- | --- |
| Hermit Crabs (911) | Connect dots next to them to remove; 2 hits. Spanish page adds: crabs not hit move one space on the next turn. | Not connectable. Fandom: "crabs that aren't hit move in the direction they're facing." Goal: remove N crabs. Direction/turning rules unstated. |
| Flippers (986) | Clear dots along a hinge to flip a Flipper; it crushes ALL dots in its path. | A hinged board fixture; clearing the dot(s) along its hinge line swings it and removes everything in its sweep, any color. Not connectable, doesn't fall. |
| Meteors (1061) | Sink them to the bottom to activate; they shoot upward removing all dots in their path; special dots hit on the way explode in a star shape. | Falls like an anchor; at the bottom it fires up its own column. Launched April 2017. |
| Fossils (1136) | Only affected by explosions; connecting next to them does nothing. First hit reveals what dot is inside; second hit releases it. | Spanish adds explosion sources: gems, beetles, nesting dots. 2 hits. |
| Sun Dots (1211) | Clear dots on Solar Portals to charge them; a full portal releases a Sun Dot. Sun Dots connect with any color and you drag them along the connection, including upward; on release they explode, clearing the dots around them. | Two pieces: portal tile (charged by clearing dots sitting on it) and the wild Sun Dot that travels with your line and detonates where you let go. |
| Seed Dots (1286) | Connecting next to a seed makes it bloom in the connected color. Clearing it with a Blank Dot or an explosion makes a rainbow flower that counts for any flower goal. | Goal: flowers per color, rainbow = wild. |
| Snow (1361) | Connect next to it three times to remove it and uncover the ice underneath. | A 3-layer cover on top of Ice; then normal Ice rules apply. |
| Bubbles (1436) | Float upward and can carry any type of dot inside. Pop them before they float away by getting rid of the dot inside. | Anti-gravity piece (rate unstated); leaves the board at the top if not popped. |
| Moonstones (1511) | Make a square of any color to activate (it glows); another square triggers its cross-shaped explosion. | 2 hits, hit = any square anywhere on the board. Designer portfolio confirms. Counts as a "powerful explosion" for tiles. |
| Fireflies (1586) | Wake them by connecting next to them; connect next to them again on the very next turn or they fall back asleep. Once released, three fireflies fly off and hit other obstacles. | State machine: asleep → awake → released, with a one-turn window. Targeting rule unstated. |
| Ceramic Tiles (1661) | Only hit by powerful explosions such as bombs and gems; fireflies can also hit them; 2 hits. | Immune to connections and squares. |
| Targets (1736) | Connect on top of a Target to hit it. Reach the target goal to remove the tracks; once removed, Water and Slime can spread. | Hit = the dot on it is in a connection (overlap, not adjacency). Tracks are board lines that block Water/Slime spread until the goal count is met. |
| Lanterns (1811) | Connect next to it to light it; connect next to it again to make it explode in a cross shape. | 2 adjacent hits. Lantern explosions damage Glaciers. |
| Egg Dots (1886) | Connect next to an egg to reveal a chick; connect next to the chick to collect it. | 2 adjacent hits. Goal: chicks. |
| Crates (1986) | Connect next to a crate: a monkey appears; again: fruit is added to your goals. Crates contain several fruits. | Multi-hit container yielding goal items. (Sealed Crates, L6911, are separate.) |
| Zappers (2036) | Connect next to a Zapper tile to hit it; all Zappers of the same design are hit together. At zero they destroy everything between them, then reset to their original number and never leave the board. | Linked groups with a shared countdown; permanent fixtures, so not a goal in themselves. |
| Vines (2111) | Connect next to them to remove them; if you don't hit the Vines, they grow back. | Spread-when-ignored overlay, 1 hit per tile. Spread count unstated. |
| Ghost Dots (2186) | Connect to any color like Blank Dots. After each turn every ghost finds a new dot to haunt; they never leave the level. Draw a square with a ghost and all ghosts turn that color. | Connectable wild that relocates every move; squares convert ghosts into normal dots. |
| Enchanted Dots (2301) | Open Scrolls by connecting next to them, 3 hits; a fully open scroll enchants a dot. Connect with Enchanted Dots for a powerful explosion. They rotate 90° after each move. | Scroll (3-hit obstacle) spawns a connectable dot with a directional blast whose direction turns every move. |
| Glaciers (2401) | Trap dots in place; regular connections won't hit them; trapped dots can't be connected; only explosions affect them (e.g. lanterns); removed after 2 hits. | Note: this is the "locks the dot, immune to adjacency" ice variant. The spec's Ice is closer to a hybrid of Ice and Glacier. |
| Mushrooms (2501) | Change color and shoot spores when you connect next to them; spores remove obstacles in their path; collected after 3 hits. | Spore direction/count unstated. |
| Pod Dots (2601) | Connect next to Pods to crack them; one more opens them. Pods always contain goals or useful dots. | 2 adjacent hits; releases an item. |
| Compass Dots (2701) | Connect in the direction the needle points to collect them. If not hit, the needle turns after each move. | 1 hit from the pointed side only; needle rotates when ignored. |
| Curtains (2801) | Connect next to them to raise them and reveal what's behind. | 1-hit overlay hiding a dot or another mechanic. |
| Octo Dots (2901) | Connect to one and it swims to another dot, taking its place and color; spots show hits left; after 3 hits it hits all the dots around it and swims away. | Connectable; each hit relocates and recolors it rather than clearing it; 3rd hit = 8-neighbor blast and removal. Structurally the closest relative of the spec's ladybug. |

### Late game (L3001–L7676+)

| Mechanic (unlock) | Official text (back-translated) | Details and inferences |
| --- | --- | --- |
| Magic Mirrors (3001) | Connect next to a Mirror to crack it; after 3 hits it breaks and counts toward your goal. Mirrors shine when hit by an explosion: they duplicate any explosion that hits them, then are destroyed and count toward the goal. | 3 adjacent hits, or one explosion (re-emitted from the mirror's position, then the mirror is gone). |
| Neon Signs (3101) | Signs display the color connected next to them; if it matches the target color, the sign lights up. Light a Rainbow Sign with an explosion or by connecting two Blank Dots. | Fixed tile, no HP; the goal is lit signs. Launched Dec 2020. |
| Honey / Hives (3251) | Connect next to a hive to fill it; after 3 hits it overflows and bees spread honey across the board. Collect the honey toward your goal. When there's enough honey on the board the hives disappear. Honey is sticky and stays on a dot until that dot is cleared. | Hive = 3-hit spawner; honey = collectible overlay that rides its dot. |
| Stone Head Dots (3401) | Connect next to one to open it (a regular dot is inside). Connect through it to collect it; if you don't, it closes again on the next move. Connect two or more open Stone Heads in one line and each explodes in a 3×3. | Closed → open (one move window) → collected. |
| Minecarts (3551) | Connect next to a cart to move it along its rails. It damages dots and tiles in its path; weak ones it rolls over, multi-hit ones stop it until further pushes break through. Push each cart to its goal, the Reserve. | Rail-bound; each push is a hit on what's ahead. |
| Pinecones (3701) | Connect next to them to collect them. | 1-hit collectible. Pinecones/Ropes/Party Poppers were built as tutorial-grade mechanics for a revised onboarding, hence the consecutive numbers. |
| Ropes (3702) | Ropes hold dots in place; connect next to them to free them. | 1-hit pin overlay. |
| Party Poppers (3703) | Connect next to them three times; after 3 hits they blast everything around them. | 3-hit, then 8-neighbor blast. |
| Coconuts (3851) | Connect next to a coconut to split it; each half flies to a new place on the board. Whole → halves → quarters; connect next to quarters to collect them. | One coconut = 4 scattered collectibles. |
| Potions (4001) | Connect next to Potions to activate them; if you don't hit them consecutively they cool down. After two hits the dots around them change to a new color. | Helper: 2 hits on consecutive moves recolors the neighborhood for a square. |
| Hedgehogs (4151) | Connect next to a Hedgehog's snout and it rolls over everything in front of it. Hedgehogs not connected next to move one space. Connect next to its spines to stop it moving. | Directional mover; front hit = charge, back hit = hold. |
| Grass (4301) | Connect next to Grass to spread dirt; dirt only spreads to spaces next to Grass; dirt turns into Grass at the end of the turn. Ice or Slime can prevent dirt spreading. | A beneficial floor layer the player grows; the opposite of slime, but the spec's Water is the nearer cousin. |
| Geodes (4451) | Connect next to them; 3 hits to remove. After 1 hit the crystals are exposed (a color); a square of that color explodes the Geode, hitting all spaces around it. Two goal kinds: removed (either way) and exploded (square route only). | A 3-hit obstacle that becomes square-triggered once cracked. |
| Lumen Dots (4791; older pages say 4591) | Connect to a Lumen Dot to collect it. Connect next to one to turn it on or off; off Lumen Dots can't be connected. Lit Lumen Dots change color after every move. | Connectable dot with a toggle and a color cycle. |
| Sand Castles (5111) | Connect next to them three times to knock them down; then watch out for the spreading sand. Connect once over the sand to clear it. | 3-hit blocker that leaves a spreading floor layer; sand cleared by connecting the dot on it. |
| Pipes (5471) | Connect to a Pipe Dot to activate and collect it. Unconnected Pipe Dots change direction after every move. A Pipe Dot dyes every dyeable dot in the line it faces. When two pipes' streams collide at the same distance, a bomb is created. | Connectable dot with a rotating recolor beam. |
| Song Shards (5831) | Connect next to Song Shards to activate them. Shards have different symbols; activate all shards with the same symbol to remove them. | Grouped set-completion. May 2024. |
| Superballs (6191) | Clear the way for Superballs to the bottom row to activate them; they bounce back up and explode in a cross shape, hitting dots vertically and horizontally. | A falling piece like the Meteor, with a plus-shaped blast. July 2024. |
| Stubborn Seeds (6551) | Connect next to them to crack the shell: two links crack it, the third makes it bloom; the last hit decides the flower's color, like Seed Dots. Explosions make them bloom in all colors. | 3-hit Seed Dot. |
| Sealed Crates (6911) | Connect next to a Sealed Crate to remove the lid and reveal what's inside; some are full of fruit, some are empty. Empty crates disappear when nearby dots are connected and don't count toward the goal. | Crate with a hidden decoy layer. Feb 2025. |
| Pinwheels (7271) | To hit a Pinwheel, connect dots next to a side of the same color. If not hit, it rotates after each move. Hitting 2 sides of the same color in a single move turns it into a Bomb. | Color-matched sides; rotates when ignored. |
| Piñatas (after 7676) | Special objects with a set amount of HP, reduced by adjacent links or nearby explosions. At 0 HP it explodes and releases Candy Dots. | Official English text exists for this one. |
| Candy Dots (after 7676) | Collectibles that appear after a Piñata breaks; they are what the level needs. Collected when linked, when hit by an explosion, or when a square of their color is made. On collection they explode in a cross shape. | Connectable goal dot with a blast on collection. |
| Paper Box (8036, 2025) | Fixed blocker with 1–3 HP; damaged by a connection directly next to it or by a special dot's blast; fire has no effect; blocks gravity until broken. | Newest; outside the 68-item list but in the Game Guides section. |

One official page is unusually useful as an interaction table: the Paper Box article lists which pieces emit hits on blockers. Explosive dots: Beetles, Nesting Dots, Pinwheels, Lanterns, Gems, Crab Dots, Thunderclouds, Moonstones, Hedgehogs, Geodes, Sun Dots, Enchanted Dots. Targeting dots: Fireflies, Mushrooms, Bouncy Balls, Octo Dots. Moving mechanics: Minecarts, Meteors. Fire: no effect.

## Boosters, failure flow, and modes in the original

Recorded for completeness; most of this is the monetization layer the spec excludes. The in-level power-ups are the part worth comparing: the spec's Pick ≈ Eraser and Color clear ≈ Color Burst, with Shuffler and Sure Shot the two the spec doesn't have.

### In-level power-ups (used mid-level, no move cost stated anywhere)

| Power-up | Effect | On obstacles |
| --- | --- | --- |
| Eraser | Remove one chosen dot. | One layer off ice or slime, not the whole obstacle; probably doesn't work on one-sided blocks. |
| Shuffler | Rearrange all colored dots. | Leaves obstacles and wilds in place. Most common drop. |
| Color Burst (Color Bomb) | Remove every dot of a chosen color, as if a square of that color were made; activates gems and monsters of that color. | One hit to gems, beetles, ice, slime. |
| Sure Shot | Tap a dot: clears its whole row and column (cross). | Counts as an explosive: damages tiles, fossils, etc. |
| Timed items | Infinite Lives / Sure Shot / Supply Crate for 15–30 minutes. | — |
| Bomb (2014 only) | Placed 8-neighbor bomb, bought after failing. | — |

### Booster Boxes (chosen before the level, fire before the first move)

- Dynamite (TNT): lights 3 random dots of 3 colors; matching one clears all of that color, gems and beetles included.
- Waterfall (Droplets): paints every dot one color, except wilds and obstacles.
- Sure Shot box (Bullseye): clears a random row and column; the refill is one color.
- Force Flood (Boxes): paints up to three 2×2 areas single-color so squares are ready-made.
- Air Strike (Bombs): drops up to three bombs at random spots.
- Supply Crate: a random one of the above.

### Failure and lives

- Out of moves: buy +5 moves (2014: $0.99; now Gold or a spinner with odds published in the Help Center), else lose a life. Five lives max, one back every 20 minutes.
- Leaving a level before the first move is free; restart or quit after the first move costs a life.
- The spec's +5 assist / free retry is the same flow with the penalties removed.

### Modes

- Treasure Hunt (2015–): weekly side map of 7 levels, originally a worldwide race; now a timed event with a medallion for finishing all 7.
- Expedition (2016, retired): ticketed runs of one obstacle type (Anchor Drop, Beetle Hunt, Cloud Burst, Gem Smash) through three zones with base camps; moves carry over.
- Scavenger Hunt (2020–): hidden-object minigame, 30-day runs, six tiers.
- Arcade: five levels in a row, one loss ends the run; uses its own tokens; the store calls it timed.
- Flip: bingo board where each tile is a level; lines and full boards earn trophies.
- Rewind: replay old Treasure Hunts, Arcades, Scavenger Hunts.
- Daily/meta layer: Daily Quests, Daily Calendar, Win Streaks, Gold Mine, Marlene's Lair, Square Race, Dots Race, Cave Chase, Leagues, Wheel of Wonder, Piñata Parties, Submarine Squad, card collections, Season Pass. All of it is the "Never" list in the spec.
- Minigame: Painting Puzzle (3-color map coloring), no penalty for losing.

Sources: Help Center Game Guides section (faq/368–394, 458–461, 472–475, 482–483, 535, 552–553), roseplusman booster and mini-game pages, Gamezebo 2014 review, Pocket Gamer June 2024.

## Sources

How the research was done: the official Help Center's English mechanic pages are a single unlock sentence plus images of the in-game tutorial cards. The Spanish, French, German, Portuguese, Japanese and Russian versions of the same pages carry the card text as HTML, so every "official text" quote above is a back-translation from those. The fandom wiki was unreachable from here and no mirror was used; the in-game Settings → Learn tab has the authoritative English card text if you want to check any quote.

Official:

- [Help Center, Mechanics section (68 articles, unlock order)](https://dots.helpshift.com/hc/en/3-two-dots/section/32-mechanics/?s=mechanic-tutorials&p=all&l=en); localized text at the same URLs with `/hc/es/`, `/hc/fr/`, `/hc/de/`, `/hc/pt/`, `/hc/ja/`, `/hc/ru/`
- Help Center Game Guides: [How do I play](https://dots.helpshift.com/hc/en/3-two-dots/faq/368-how-do-i-play-two-dots/), [What is a Bomb](https://dots.helpshift.com/hc/en/3-two-dots/faq/372-what-is-a-bomb/), [Erasers](https://dots.helpshift.com/hc/en/3-two-dots/faq/375-what-are-erasers/), [Color Bursts](https://dots.helpshift.com/hc/en/3-two-dots/faq/377-what-are-color-bursts/), [Sure Shot](https://dots.helpshift.com/hc/en/3-two-dots/faq/378-what-are-sure-shots/), [Booster Boxes](https://dots.helpshift.com/hc/en/3-two-dots/faq/373-what-are-booster-boxes/), [Which special dots can hit a Paper Box](https://dots.helpshift.com/hc/en/3-two-dots/faq/548-which-special-dots-can-hit-a-paper-box/), [Piñatas](https://dots.helpshift.com/hc/en/3-two-dots/faq/539-what-are-pinatas/), [Candy Dots](https://dots.helpshift.com/hc/en/3-two-dots/faq/540-what-are-candy-dots/), [Cosmic Blast](https://dots.helpshift.com/hc/en/3-two-dots/faq/475-how-does-cosmic-blast-work/)
- [Dots blog: gems tutorial, May 2016](https://blog.weplaydots.com/post/144918692599/check-out-how-the-gems-work-starting-on-level); [beetles tutorial, March 2016](https://blog.weplaydots.com/post/140396517889/confused-about-the-beetle-dots-check-out-our); [meteors, April 2017](https://blog.weplaydots.com/post/160052084437/starting-at-level-1061)
- [Song Shards announcement, May 2024](https://www.twodots-game.com/news/are-you-ready-to-make-the-music-flow-song-shards-are-here)

Guides and writeups:

- [A Very Unofficial Guide to Two Dots (roseplusman, 2016)](https://roseplusman.com/a-very-unofficial-guide-to-two-dots/): per-obstacle pages for the first 18 mechanics, plus ramps/wilds, boosters, tricks, Treasure Hunt, Expedition
- [Six of the Worst Two Dots Obstacles (thenerderypublic, 2016, with comments)](http://thenerderypublic.com/six-of-the-worst-two-dots-obstacles/)
- [Gamezebo walkthrough, 2014](https://www.gamezebo.com/walkthroughs/twodots-tips-tricks-and-strategies/) and [review](https://www.gamezebo.com/reviews/twodots-review-brother-can-you-spare-a-dot/)
- [iMore tips](https://www.imore.com/twodots-top-10-tips-hints-and-cheats-you-need-know?nopaging=1); [Vulcan Post, 2015](https://vulcanpost.com/339191/pro-two-dots/); [levelwinner walkthroughs](https://www.levelwinner.com/twodots-walkthrough-tips-guide-levels-31-35/); [withoutthesarcasm, level 69](https://www.withoutthesarcasm.com/posts/tips-beat-two-dots-level-69/)
- Joyce Leong's 2015 level blog (monsters, circuits, lotus, nesting dots, slime, magnets), e.g. [levels 286–310](http://joyce-leong.blogspot.com/2015/05/two-dots-level-286-310.html)
- Designer portfolios: [Jaclyn McKay](https://www.jaclynmckay.com/two-dots) (moonstones, ceramic tiles, targets, lanterns); [Bryce Williams](https://bwgamedesign.carrd.co) (mirrors, potions, minecarts, FTUE trio)
- [Game Developer: Two Dots, Too Charming](https://www.gamedeveloper.com/business/two-dots-too-charming)
- [Wikipedia: Two Dots (video game)](<https://en.wikipedia.org/wiki/Two_Dots_(video_game)>) (source of the uncited 13-dot claim)

The spec compared against: `CLAUDE.md` in ReynoldsPRC/better-dots as of 2026-11-01.
