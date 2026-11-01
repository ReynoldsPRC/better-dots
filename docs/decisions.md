# Decisions: where better dots differs from Two Dots

The rule is "match the original's mechanics." This file lists every deliberate exception and the reason, so a future session doesn't "fix" one back. Anything not listed here that differs from `two-dots-reference.md` is a bug or an undocumented default (see the last section of `CLAUDE.md`), not a decision.

| Area | Original | better dots | Why |
| --- | --- | --- | --- |
| Lives, timers, currency, ads, boosters, daily/streak systems, accounts | All present | None (see Never in CLAUDE.md) | The point of the project. |
| Out of moves | +5 moves for money or a spinner; declining costs a life | Free +5 assist (marked, earns nothing) or free retry | Monetization hook removed; the assist keeps the "almost had it" relief without the price. |
| Power-ups: how obtained | Bought, spun, or awarded by events | Earned: 1 per first 3-star clear, 2 per world finished; one pool usable as any kind | Keep the four tools, remove the shop. |
| Pre-level Booster Boxes / Supply Crates | Five kinds plus a random box | Not built | They are consumables designed to be bought; the in-level power-ups cover the same ground. |
| Stars | 2014: 1–3 stars by points; later builds unclear | 1–3 stars by moves used vs. the bot's runs | Points aren't built; the bot gives a real skill curve. |
| Scoring / points | A numeric score (2014) | None | Nothing used it. |
| Walls (thin edge barriers) | Don't exist | Kept as legacy terrain for World 3 only; no new levels, generator never places them | Built before the research; harmless; replacing World 3 isn't worth the churn. Can be retired later. |
| Piece naming in code | Beetle Dots | `ladybug` type name kept in code and level files | Renaming would churn saves, levels, bot, and tests for no play difference. The spec says "Ladybugs (the original's Beetle Dots)." |
| Level numbering and worlds | 25-level worlds, 8,000+ levels | Short hand-made and bot-generated worlds, one mechanic each | Personal game; levels are kept only if the player likes them. |
| Hidden teleporter pairings | Not shown; players work them out | Drawn so they can be traced | Hidden pairings are a frustration mechanic, not a puzzle. |
| Square hint | Settings toggle, default on | Settings toggle, default off | Taste. |
