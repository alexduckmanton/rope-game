---
paths:
  - "src/generator.js"
  - "src/generation/**"
  - "src/seededRandom.js"
  - "src/experiment.js"
---

# Puzzle generation

How puzzles and their hints are built, and what is safe to tune. Round 2 of the hint placement experiment is running — see `docs/experiments.md` for the numbers behind the freeze below.

### Puzzle Generation

**Algorithm: Warnsdorff's Heuristic**

Generates Hamiltonian cycles (paths visiting all cells exactly once forming a loop). Note: While the generated solution is a Hamiltonian cycle, players are not required to visit all cells - they only need to satisfy the hint constraints with any valid closed loop.

**Strategy:**
1. Try Warnsdorff's heuristic multiple times (fast, ~0.5ms per attempt)
2. Fallback to a pre-generated valid cycle if every attempt fails

**Warnsdorff's Rule:** Always move to the neighbor with the fewest unvisited neighbors. This greedy strategy avoids dead ends by saving well-connected cells for later.

**Hint Cell Selection:** each difficulty declares its own placement in
`CONFIG.DIFFICULTY.HINT_PLACEMENT`. Two strategies exist.

*`spaced`* - `generateHintCellsWithMinDistance()` in `renderer.js`. Shuffles every grid
cell with the seeded random function, then walks the shuffled pool taking any cell at least
`minDistance` (Chebyshev) from every hint already taken, until `count` is reached. It knows
nothing about the solution, so what each hint ends up *saying* is pure chance. If the
spacing is too tight it returns fewer hints rather than failing - which is not a rare edge
case on Easy, see below. Used by **Easy** (2/3) and **Tricky control** (5/2).

*`covering`* - `generateHintCellsCovering()` in `generation/hintPlacement.js`. Three stages:

1. **Cover** - greedy maximum-coverage selection: repeatedly take the cell whose 3x3 area
   covers the most still-uncovered cells, breaking ties with the seeded random function so
   the covering set varies day to day instead of settling on a fixed lattice.
2. **Fill** - spend any remaining budget at random, for overlap.
3. **Anchor** - swap hints for ones reading `<= anchorMaxValue`, checking after each swap
   that the grid is still fully covered. Any hint may be given up, including a covering one,
   because on a tight grid the low-value positions often *are* the covering ones. The quota
   is silently unmet when the grid cannot supply it.

Used by **Diabolical** (16 hints, shipped after round 1) and by the **Tricky covering arm**
(`CONFIG.DIFFICULTY.TRICKY_COVERING`, 5 hints).

`anchorMaxValue` is also the threshold `describePuzzle()` measures `anchor_hints` at, so any
two arms being compared must declare the same value or the figures are meaningless. Tricky's
control placement carries one purely for that reason.

Both arms apply to daily puzzles (seeded random) and unlimited mode (true random) alike.

-----

### Daily Puzzle System

**Architecture:** Deterministic generation using date-based seeded PRNG (no backend required).

**Key Design:**

| Aspect | Implementation |
|--------|----------------|
| **Seed Format** | YYYYMMDD + difficulty offset (0=easy, 1=medium, 2=hard) |
| **Example** | Nov 30, 2025 Medium = seed `202511301` |
| **Algorithm** | Mulberry32 PRNG (bitwise operations, cross-browser deterministic) |
| **Timezone** | Local timezone (puzzle changes at player's local midnight) |
| **Consistency** | Same seed always produces identical puzzle, hints, and solution path |
| **Puzzle ID** | Format: `"2025-11-30-medium"` (natural key for stats tracking) |

**Randomization Points:** Warnsdorff starting position, tie-breaking, hint cell selection (all seeded).

**Tradeoffs Accepted:**
- Puzzle quality varies by date (some dates produce easier/harder puzzles)
- Players can preview future puzzles by changing system clock (acceptable for casual game)
- No server-side validation of times (trust-based until backend added)

**Benefits:**
- Works offline after initial page load
- No backend infrastructure needed
- Enables future social features (leaderboards, sharing)

-----

**Modify Hint Placement Configuration:**

**While the Tricky re-test is running, do not touch `HINT_PLACEMENT.medium` or
`TRICKY_COVERING`.** Tuning either moves a baseline mid-test and makes the result
meaningless. Easy and Diabolical are settled and safe to tune.

1. **Per difficulty**: `CONFIG.DIFFICULTY.HINT_PLACEMENT` - each entry names a `strategy`
   plus its parameters. `spaced` takes `count` and `minDistance`; `covering` takes `count`,
   `lowValueAnchors` and `anchorMaxValue`.
2. **`spaced` tuning**: `minDistance` trades redundancy for coverage - spacing hints out
   spreads their areas so fewer cells go unconstrained, but the areas then overlap less and
   cross-checking is lost. `minDistance: 1` is a no-op (Chebyshev >= 1 is any distinct cell).
   On a 6x6 the spacing caps the achievable count at 9, on an 8x8 at 16 - asking for more
   silently places fewer.
3. **`covering` tuning**: raising `count` raises redundancy; coverage is already at or near
   100% at the current counts. An `anchorMaxValue` quota the grid cannot supply is silently
   unmet, so check the tables in "Tricky hint placement experiment" before raising one.
4. **Hint count is not a free parameter.** Round 1's clearest lesson is that raising `count`
   changes difficulty far more than placement does - Easy lost 23 points of completion to it.
   Change count and placement in separate releases, or you cannot attribute the result.
5. **`anchorMaxValue` is also a measurement threshold.** `describePuzzle()` counts
   `anchor_hints` at whatever value the placement declares, so two configs being compared
   must declare the same one.
6. **Affects all modes**: new daily puzzles, restored daily puzzles, and new unlimited
   puzzles alike.
7. **Saved unlimited puzzles** keep their original hint placement when restored (no
   migration). **Saved daily puzzles** rebuild their hints from the seed, but pin their arm -
   so a config change *does* reach an in-progress daily puzzle, while an arm change does not.
8. **Graceful degradation**: too-tight constraints place fewer hints rather than failing.
9. **Verify before shipping**: both placements are pure functions of a grid size, a config
   and a seeded random source, so they can be exercised outside a browser.
   `generation/hintPlacement.js` deliberately imports only from `utils.js` for this reason.
   Run a candidate config across a year of seeds and check coverage, redundancy, anchors and
   layout variety before trusting it - every number in this document was produced that way.
   `config.js` imports the i18n runtime, which resolves a Vite-only alias, so an offline
   harness needs `src/i18n/index.js` and `src/tokens.js` stubbed.

-----

**Modify Puzzle Generation:**
1. **Attempt counts**: Adjust `CONFIG.GENERATION.ATTEMPTS_*` values in `config.js`
2. **Algorithm**: Replace Warnsdorff's heuristic in `generator.js:tryWarnsdorff()`
3. **Fallback cycles**: Add pre-generated cycles to `FALLBACK_CYCLES` in `generator.js`

-----

**Change Grid Sizes:**
1. Update difficulty configuration in `config.js` (if adding new standard sizes)
2. Add fallback cycle to `FALLBACK_CYCLES` object in `generator.js` (if size not already supported)
3. Update difficulty buttons in `index.html` and routing logic in `views/home.js`
