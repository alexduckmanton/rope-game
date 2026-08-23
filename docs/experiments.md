# Experiments

Live and settled experiments on puzzle generation. The freeze rule this implies for
`CONFIG.DIFFICULTY` is repeated in `.claude/rules/generation.md`, which is what an agent
editing that file actually loads.

#### Tricky hint placement experiment

**Round 1 is finished. Round 2 is running, and it tests Tricky alone.**

##### Round 1 (2026-08-06 to 2026-08-22): what it settled

The original hypothesis was that Tricky underperforms because its hints leave much of the
grid unconstrained, and that guaranteeing coverage would fix it. Round 1 tested a `covering`
placement against the shipped `spaced` one on all three difficulties at once, 50/50,
251 players and 579 starts.

| difficulty | spaced | covering | change | |
|---|---|---|---|---|
| Easy | 66.2% (160) | 43.3% (164) | **-23 pts** | p < 0.0001 |
| Tricky | 34.4% (93) | 38.8% (67) | +4.4 pts | p = 0.57, null |
| Diabolical | 25.0% (44) | 66.7% (51) | **+42 pts** | p < 0.0001 |

**The hypothesis was right; the implementation confounded it.** Two of the three arms raised
the hint *count* at the same time as changing placement, so they tested two things at once:

| | hints | expected turns | avg win time |
|---|---|---|---|
| Easy spaced | 1.73 | 7.1 | 41s |
| Easy covering | 4.00 | 21.9 | 74s |
| Tricky spaced | 5 | 22.4 | 112s |
| Tricky covering | 8 | 38.0 | 235s |
| Diabolical spaced | 16 | 68.9 | 270s |
| Diabolical covering | 16 | 64.8 | 298s |

Diabolical was the only arm that held its count fixed and changed placement alone - and it
was the only clear win. Easy tripled its constraint load and lost badly; on a 4x4, sparse is
a feature, not the bug it looked like. Tricky doubled its time-to-win for no completion gain.

**Shipped from round 1:** Easy keeps `spaced`, Diabolical takes `covering`. Both are now
fixed for every player and no longer branch on any arm.

**Caveats worth keeping.** Diabolical's samples are the smallest on the board (44 and 51),
and its *control* arm ran at 25% against a 50% pre-experiment baseline (n=34, p≈0.02) - an
unexplained shift. Randomisation still protects the comparison, since both arms drew from
the same population, but treat +42 points as directionally solid and probably overstated.
Localisation shipped mid-experiment and is *not* the explanation: it brought essentially no
non-English traffic (1 player each for de/ja/fr/es).

**Retention was unaffected** - day-1 return 4.5% vs 4.7%, ever-returned 13.6% vs 9.8%
(p = 0.35). At this traffic a retention regression is only detectable if it is roughly a
halving (~191 players per arm); anything subtler will never resolve. It is a guardrail, not
a measurement.

##### Round 2 (from 2026-08-22): Tricky only

Tricky is the difficulty the whole effort was for, and it is still unanswered. Round 2 keeps
the count at 5 - identical to control - so **placement is the only variable**, reproducing
the isolation that made Diabolical's result readable.

|                | `spaced` (control) | `covering` (variant) |
|----------------|--------------------|----------------------|
| hints          | 5                  | 5                    |
| coverage       | 77.2%              | 97.8%                |
| redundancy     | 1.24               | 1.16                 |
| anchors        | 1.18               | 0.79                 |
| expected turns | 20.6               | 23.9                 |

Coverage is the only thing the variant buys. Redundancy and anchors both dip slightly - the
same signature as Diabolical, where the win came with redundancy falling 2.13 -> 1.97. An
anchor quota above 2 changes nothing: the 6x6 cannot supply more low-value positions without
giving up a covering one, so the stage saturates at 0.79.

> **Round 1 reported "anchors 0.31 -> 1.82" for Tricky. That comparison was invalid** - the
> control arm was measured at `anchorMaxValue` 1 and the dense arm at 2. Measured
> consistently at 2, `spaced` yields *more* low-value hints than `covering`, not fewer. Both
> Tricky arms now declare the same threshold so the property is comparable.

**Assignment is client-side, not a PostHog feature flag.** The slim posthog build the game
ships has no flag network code at all (see the Analytics section), so `getFeatureFlag()`
returns `undefined` forever. Rather than pay +38KB gzipped to restore flags, assignment is a
50/50 coin flip in `experiment.js`, cached in `loop-game:experiment:tricky-hints`, resolved
from cache first and never touching the network.

- **The randomisation is sound.** Independent, even, sticky per browser.
- **PostHog cannot compute the results.** Its Experiment object keys on flag exposure, of
  which there is none. Experiment 405364 is kept only as a record of round 1's dates.
- **The analysis reads `generator_variant`** off the game events. Round 2 uses new values,
  `tricky-control` and `tricky-covering`, so the two rounds can never be conflated; the
  property *names* are unchanged so existing insights keep working.
- **Filter the analysis to `difficulty = 'medium'`.** The property records the player's arm
  and is attached to every event, but on Easy and Diabolical the arm changes nothing.
- **There is no remote kill switch.** Changing or stopping the split needs a deploy.
- **A fresh storage key** re-randomises everyone rather than inheriting round 1, which would
  carry round-1 exposure into round-2 behaviour.

*Saves pin their arm.* A daily save holds no puzzle data - hints are rebuilt from the date
seed on every load - so without pinning, a player whose assignment changed between visits
would find their part-finished puzzle rearranged around the path they had already drawn.
`variantForSavedGame()` makes the pinned arm win. Round 1's values fail the validity check
deliberately, so a save written before this deploy falls through to a fresh assignment - a
Tricky puzzle left in progress across the deploy will regenerate its hints once. Easy and
Diabolical saves are unaffected, since neither branches any more.

Every game event carries `generator_variant` and `variant_source`, the latter one of `local`
(coin flip in this browser) or `saved` (pinned by the save this puzzle was restored from).
Note `saved` can never appear on `game_started` - a restored game does not fire it.

**Teardown checklist**, once Tricky is called:

1. Fold the winner into `CONFIG.DIFFICULTY.HINT_PLACEMENT.medium` and delete
   `TRICKY_COVERING`. If `spaced` wins, `generateHintCellsCovering()` still has Diabolical as
   a caller; if `covering` wins, `generateHintCellsWithMinDistance()` still has Easy.
2. Delete `src/experiment.js`, its call in `main.js`, and `CONFIG.EXPERIMENT`.
3. Remove `currentVariant` / `currentVariantSource` and the `placementFor()` branch in
   `views/game.js`; keep `describePuzzle()` and the shape properties, which are useful
   permanently.
4. Drop `generatorVariant` from the save format in `persistence.js`. Old saves carrying it
   are ignored harmlessly, so no migration is needed.
5. Record the conclusion on PostHog experiment 405364. It holds no results - the numbers come
   from the saved SQL insights on `generator_variant`.
6. Leave both experiment keys in localStorage; they expire with nothing reading them.

**Verify any config change before shipping it.** Both placements are pure functions of a grid
size, a config and a seeded random source, so they can be exercised outside a browser -
`generation/hintPlacement.js` deliberately imports only from `utils.js` for this reason.
Every number in this section was produced by running the real modules across 365 daily seeds.
Note that `config.js` now imports the i18n runtime, which resolves a Vite-only alias, so an
offline harness needs `src/i18n/index.js` and `src/tokens.js` stubbed.
