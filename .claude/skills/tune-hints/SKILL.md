---
name: tune-hints
description: Verify a hint generation config change before shipping it, and judge its effect afterwards. Use when changing CONFIG.DIFFICULTY.HINT_CONFIG, hint counts, minDistance, or the hint generator itself.
---

# Verifying a hint generation change

**Never ship a `CONFIG.DIFFICULTY.HINT_CONFIG` change on inspection.** Run it across a year
of daily seeds first, and judge it on players afterwards. Both steps are below.

## Before shipping: measure the puzzles offline

The generator is a pure function of a grid size, a config and a seeded random source, and
`generation/puzzleShape.js` imports only from `utils.js`, so the whole pipeline runs in
plain Node with no browser.

`config.js` imports the i18n runtime, which resolves a Vite-only alias, so a Node-side
harness needs `src/i18n/index.js` and `src/tokens.js` stubbed. `scripts/lib/stub-i18n.mjs`
and `scripts/lib/stub-tokens.mjs` already exist for this; `scripts/lib/browserless-hooks.mjs`
lets `src/` modules import in plain Node. `scripts/lib/tutorial-boards.mjs` is a working
example of building a real daily puzzle this way.

Build each day's puzzle exactly as `buildPuzzle()` in `views/game.js` does — solution first,
hints second, from the same seeded source — so the harness produces the puzzles players
would be dealt. Then run `describePuzzle()` on each and report the year's averages:

| Measure | Why it matters |
|---|---|
| `hintCount` | the spaced generator silently places fewer than asked when spacing is tight |
| `coveragePercent` | share of cells inside at least one hint's 3x3 |
| `redundancy` | mean hints watching each covered cell — cross-checking |
| `anchorHints` | hints reading 0 or 1, the low-value footholds |
| `expectedTurnsTotal` | the closest single number to constraint load |

The current defaults produce Easy 1.73 / 62.6% / 1.00 / 0.00, Tricky 5 / 77.2% / 1.24 /
0.31 and Diabolical 16 / 88.9% / 2.13 / 2.29 (hints / coverage / redundancy / anchors). If a
harness does not reproduce those for the unchanged config, the harness is wrong.

## After shipping: judge it per player

**Count players, not starts.** A few daily regulars play every day and dominate start
counts; whichever side of a comparison they land on wins. Completion per `game_started`
produced two false "wins" in the hint placement experiment, one of which shipped.

- Primary measure: share of players who completed at least one puzzle at that difficulty,
  or the outcome of each player's first puzzle.
- Keep a null baseline — a difficulty or segment the change does not touch — and read it
  with the same query. If it shows a gap, so will everything else, for no reason.
- Do not act on an early peek. The full story is in `docs/experiments.md`.

## Rules that will bite you

1. **Hint count is not a free parameter.** It moves difficulty far more than placement does
   — Easy lost 16 points of per-player completion going from 1.73 to 4 hints. Change count
   and anything else in separate releases, or the result cannot be attributed.
2. **Coverage is not the lever it looks like.** Full coverage on Tricky at the same hint
   count did not raise completion. Read `docs/experiments.md` before trying it again.
3. **Easy's 1.73 is deliberate.** `minDistance` 3 is unsatisfiable from any interior cell of
   a 4x4, so about a quarter of days ship one hint. Players finish that far more often than
   a busier 4x4.
4. **`minDistance` caps out silently.** On a 6x6 the spacing caps the achievable count at 9,
   on an 8x8 at 16. `minDistance: 1` is a no-op (Chebyshev >= 1 is any distinct cell).
5. **Coverage and redundancy trade against each other.** Spacing hints out spreads their
   areas so fewer cells go unconstrained, but the areas then overlap less and cross-checking
   is lost.

## Scope

A config change affects new daily puzzles, restored daily puzzles, and new unlimited
puzzles alike. **Saved unlimited puzzles** keep their original placement when restored (no
migration). **Saved daily puzzles** rebuild their hints from the seed — so a config change
reaches an in-progress daily puzzle, and the hints move under the path the player has
already drawn. Ship generation changes knowing that.
