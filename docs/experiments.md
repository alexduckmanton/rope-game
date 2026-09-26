# Experiments

**No experiment is running.** Every difficulty uses the original `spaced` hint generator
(`CONFIG.DIFFICULTY.HINT_CONFIG`) and is safe to tune - though read "Running the next
experiment" below before trusting any result that says a change helped.

## Hint placement experiments (2026-08-06 to 2026-09-26) - concluded

**Outcome: nothing shipped.** A coverage-first hint placement was tested against the
original on all three difficulties over two rounds. Counted per player, it made Easy worse
and Tricky and Diabolical no better. Every difficulty is back on the original generator and
the alternative has been deleted (git history has it: `generateHintCellsCovering()` in the
former `src/generation/hintPlacement.js`).

The most important thing this experiment produced is not a result about hints. It is that
**reading completion rate per game start, rather than per player, produced two confident
"wins" that were not real** - one of which was shipped. See "The clustering error" below.

### The idea

Tricky completed at 37% against Diabolical's 53%, despite Diabolical being the bigger grid.
The `spaced` generator knows nothing about the solution: it shuffles the cells and takes the
first N that are far enough apart. On a 6x6 that leaves about 23% of cells outside every
hint's 3x3 area, with no feedback for a player drawing there. The hypothesis was that
guaranteeing every cell sits inside some hint area (`covering`) would make Tricky
deducible, and so completable.

### Results, counted per player

Each player counted once - did they complete at least one puzzle at that difficulty. This is
the measure to trust; the start-level figures that were originally reported are kept
alongside so the error is visible.

**Round 1** (2026-08-06 to 08-22) - `covering` on every difficulty, with Easy's hint count
raised 2 -> 4 and Tricky's 5 -> 8. Diabolical kept 16.

| difficulty | spaced | covering | per-player verdict | originally reported (per start) |
|---|---|---|---|---|
| Easy | 54.8% (115) | 38.4% (125) | **worse, p ≈ 0.01** | 66.2% -> 43.3%, p < 0.0001 |
| Tricky | 33.3% (51) | 25.6% (39) | no difference | 34.4% -> 38.8%, p = 0.57 |
| Diabolical | 22.7% (22) | 23.5% (17) | **no difference** | 25.0% -> 66.7%, "p < 0.0001" |

**Round 2** (2026-08-22 to 09-26) - Tricky only, `covering` at 5 hints, the same count as
`spaced`, so placement was the only variable. Diabolical ran `covering` for everyone.

| | spaced | covering | |
|---|---|---|---|
| Tricky, per player | 26.3% (167) | 21.6% (176) | p ≈ 0.31; 95% CI about -14 to +4 pts |
| Tricky, per start | 38.1% (257) | 23.4% (269) | looked like p ≈ 0.0003 - see below |
| Median win time per player | 110s | 132s | |

The round-2 interval excludes the +13 points the test was powered to find, so the
conclusion is firm: **coverage does not make Tricky easier to finish.** It may make it
slightly harder.

### What stands

- **Easy's sparse hints are a feature.** On a 4x4, more hints means more constraint load
  (7.1 -> 21.9 expected turns at 4 hints), not more help. This held per player.
- **Hint count moves difficulty far more than placement does.** Change them in separate
  releases or the result cannot be attributed.
- **Coverage is not what makes a puzzle solvable.** The 23% of Tricky left unconstrained is
  not why players give up on it.
- **Retention was unaffected** in round 1 (day-1 return 4.5% vs 4.7%). At this traffic only
  a regression of roughly a halving is detectable, so retention is a guardrail here, not a
  measurement.

### What is retracted

- **The Diabolical "+42 point win".** One player in the covering arm produced 16 of its 34
  wins. Per player it was 22.7% vs 23.5%. `covering` was shipped to every Diabolical player
  on the strength of this from 2026-08-22 to 2026-09-26.
- **"The hypothesis was right; the implementation confounded it."** The confound was real
  (count and placement changed together), but the one clean-looking confirmation was the
  artefact above. With count held fixed in round 2, placement did nothing.
- **Round 1's "anchors 0.31 -> 1.82" for Tricky.** The arms were measured at different
  thresholds. Measured consistently, `spaced` yields more low-value hints than `covering`.

### Open question: Diabolical

Per-player Diabolical completion was about 23% in round 1 and about 9% in round 2, when
every player had `covering`. Round 2 also roughly doubled daily traffic, so this may be a
change in who was playing - but a harder puzzle is not ruled out. Now that Diabolical is
back on `spaced`, comparing per-player completion for the weeks after 2026-09-26 against
round 2 answers it cheaply, with no new code.

### The clustering error

Completion rate per `game_started` treats every start as an independent trial. They are not.
A small core of daily regulars plays every day, and a player who finishes nine Diabolical
puzzles counts nine times. With a few hundred players, whichever arm the regulars happen to
be randomised into wins.

It showed up clearly in round 2 on Diabolical, where **both arms received byte-identical
puzzles** - same hint count, coverage, redundancy and turns - and completion per start still
ran 38.9% vs 4.3%. Seven control players had produced 58 of the wins. Per player it was 10.4%
vs 6.1%, which is noise. A difficulty with zero treatment effect had produced a z-score of
about 5.

### Running the next experiment

1. **The unit of analysis is the player.** Pre-register a per-player metric - completed at
   least one, or the outcome of each player's first puzzle - and do the power calculation in
   players, not starts. Report per-start figures only as a secondary read.
2. **Keep a null baseline.** Leave some surface untouched by the treatment - a difficulty,
   a segment - and read it with the same query. If the null shows a gap, the method is
   producing noise, whatever the treated surface says.
3. **Change one thing.** Count and placement moved together in round 1 and the result could
   not be attributed.
4. **Do not act on a peek.** Easy's null gap in round 2 swung 20 points before converging to
   1, and a nominal p = 0.007 appeared on a zero-effect difficulty.
5. **Measure every arm the same way.** `describePuzzle()` now uses one anchor threshold for
   everything for this reason.
6. **There are no feature flags.** The slim posthog build cannot read them. Randomise
   client-side, cache the arm in localStorage, attach it to every game event as a property,
   and pin it into saves - a daily save holds no puzzle data, so without pinning a player
   whose arm changed would see their part-finished puzzle rearranged. PostHog's Experiment
   object cannot compute results without flag exposure; analyse in SQL.
7. **Verify generation offline first.** The generator is a pure function of a grid size, a
   config and a seeded random source, so a candidate can be run across 365 daily seeds in
   Node before any player sees it. `config.js` imports the i18n runtime, so a harness needs
   `src/i18n/index.js` and `src/tokens.js` stubbed; `scripts/lib/` has stubs.

### What was left behind

- **Analytics**: `generator_variant` / `variant_source` on events from 2026-08-06 to
  2026-09-26 - `control` / `dense` in round 1, `tricky-control` / `tricky-covering` in
  round 2 - and the `generator_variant` person property. Nothing writes them now.
- **localStorage**: `loop-game:experiment:hint-generation` and
  `loop-game:experiment:tricky-hints`, which nothing reads. Saves may carry a
  `generatorVariant` field, which is ignored.
- **PostHog**: experiment 405364 and both hint placement dashboards, all marked concluded
  with the per-player results.
- **Deploy effect**: a Diabolical puzzle, or a Tricky puzzle in the covering arm, left in
  progress across the revert regenerates its hints once. Easy and Tricky-control puzzles are
  byte-identical before and after.
