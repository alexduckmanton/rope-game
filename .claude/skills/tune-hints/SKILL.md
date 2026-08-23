---
name: tune-hints
description: Verify a hint placement or generation config change before shipping it. Use when changing CONFIG.DIFFICULTY, hint counts, minDistance, anchor quotas, or either placement strategy.
---

# Verifying a hint placement change

**Never ship a `CONFIG.DIFFICULTY` change on inspection.** Every number in
`docs/experiments.md` was produced by running the real modules across 365 daily seeds, and
that is the bar for any new one.

## Why this is possible offline

Both placements are pure functions of a grid size, a config and a seeded random source.
`generation/hintPlacement.js` deliberately imports only from `utils.js` for exactly this
reason, so it runs in plain Node with no browser.

`config.js` imports the i18n runtime, which resolves a Vite-only alias, so an offline
harness needs `src/i18n/index.js` and `src/tokens.js` stubbed. `scripts/lib/stub-i18n.mjs`
and `scripts/lib/stub-tokens.mjs` already exist for this; `scripts/lib/browserless-hooks.mjs`
lets `src/` modules import in plain Node.

## What to measure

Run the candidate config across a year of seeds and report all of:

| Measure | Why it matters |
|---|---|
| `hint_coverage_percent` | share of cells inside at least one hint's 3x3 |
| `hint_redundancy` | mean hints watching each covered cell — cross-checking |
| `anchor_hints` | hints reading `<= anchorMaxValue`, the low-value footholds |
| `expected_turns_total` | the real proxy for constraint load |
| layout variety | does the covering set actually vary day to day, or settle on a lattice? |

`describePuzzle()` in `generation/hintPlacement.js` produces these.

## Rules that will bite you

1. **Hint count is not a free parameter.** Round 1's clearest lesson is that raising `count`
   changes difficulty far more than placement does — Easy lost 23 points of completion to
   it. **Change count and placement in separate releases**, or you cannot attribute the
   result.
2. **`anchorMaxValue` is also a measurement threshold.** `describePuzzle()` counts
   `anchor_hints` at whatever value the placement declares, so two configs being compared
   must declare the same one. Round 1 reported an invalid Tricky anchor comparison for
   exactly this reason.
3. **A quota the grid cannot supply is silently unmet.** The 6x6 saturates at 0.79 anchors;
   asking for more changes nothing.
4. **`spaced` caps out.** `minDistance` silently places *fewer* hints rather than failing —
   on a 6x6 the spacing caps the achievable count at 9, on an 8x8 at 16. `minDistance: 1`
   is a no-op (Chebyshev >= 1 is any distinct cell).
5. **Coverage and redundancy trade against each other.** Spacing hints out spreads their
   areas so fewer cells go unconstrained, but the areas then overlap less and cross-checking
   is lost.

## Scope

A config change affects new daily puzzles, restored daily puzzles, and new unlimited
puzzles alike. **Saved unlimited puzzles** keep their original placement when restored (no
migration). **Saved daily puzzles** rebuild their hints from the seed but pin their
experiment arm — so a config change *does* reach an in-progress daily puzzle, while an arm
change does not.

## While round 2 is running

`HINT_PLACEMENT.medium` and `TRICKY_COVERING` are **frozen**. Tuning either moves a baseline
mid-test and makes the result meaningless. Easy and Diabolical are settled and safe to tune.
The teardown checklist is in `docs/experiments.md`.
