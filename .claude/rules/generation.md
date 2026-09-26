---
paths:
  - "src/generator.js"
  - "src/generation/**"
  - "src/seededRandom.js"
---

# Puzzle generation

How puzzles and their hints are built, and what is safe to tune. No experiment is running. A coverage-first hint placement was tested for seven weeks and removed; `docs/experiments.md` has the results and — more usefully — the rules for running the next test without fooling yourself.

### Puzzle Generation

**Algorithm: Warnsdorff's Heuristic**

Generates Hamiltonian cycles (paths visiting all cells exactly once forming a loop). Note: While the generated solution is a Hamiltonian cycle, players are not required to visit all cells - they only need to satisfy the hint constraints with any valid closed loop.

**Strategy:**
1. Try Warnsdorff's heuristic multiple times (fast, ~0.5ms per attempt)
2. Fallback to a pre-generated valid cycle if every attempt fails

**Warnsdorff's Rule:** Always move to the neighbor with the fewest unvisited neighbors. This greedy strategy avoids dead ends by saving well-connected cells for later.

**Hint Cell Selection:** `generateHintCellsWithMinDistance()` in `renderer.js`, configured
per difficulty by `CONFIG.DIFFICULTY.HINT_CONFIG`: easy 2/3, medium 5/2, hard 16/0
(`count`/`minDistance`). It shuffles every grid cell with the seeded random function, then
walks the shuffled pool taking any cell at least `minDistance` (Chebyshev) from every hint
already taken, until `count` is reached. It knows nothing about the solution, so what each
hint ends up *saying* is pure chance. If the spacing is too tight it returns fewer hints
rather than failing - which is not a rare edge case on Easy: `minDistance` 3 is
unsatisfiable from any interior cell of a 4x4, so Easy averages 1.73 hints and roughly a
quarter of days ship a single hint. That is deliberate; see below.

Applies to daily puzzles (seeded random) and unlimited mode (true random) alike.

**Puzzle shape:** `describePuzzle()` in `generation/puzzleShape.js` measures every generated
puzzle - hint count, coverage, redundancy, anchors (hints reading 0 or 1), expected turns -
and the game attaches the result to every lifecycle event. It is how an unlucky day's puzzle
is told apart from a mistuned difficulty.

**Measured over 365 daily seeds**, which is what these defaults produce:

| | hints | coverage | redundancy | anchors |
|---|---|---|---|---|
| Easy | 1.73 | 62.6% | 1.00 | 0.00 |
| Tricky | 5 | 77.2% | 1.24 | 0.31 |
| Diabolical | 16 | 88.9% | 2.13 | 2.29 |

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
- Needs no network to generate a puzzle, which is what makes offline play possible at all
  (the service worker supplies the files; see `.claude/rules/offline.md`)
- No backend infrastructure needed
- Enables future social features (leaderboards, sharing)

-----

**Modify Hint Configuration:**

1. **Where**: `CONFIG.DIFFICULTY.HINT_CONFIG` - `count` and `minDistance` per difficulty.
2. **`minDistance` trades redundancy for coverage** - spacing hints out spreads their areas
   so fewer cells go unconstrained, but the areas then overlap less and cross-checking is
   lost. `minDistance: 1` is a no-op (Chebyshev >= 1 is any distinct cell). On a 6x6 the
   spacing caps the achievable count at 9, on an 8x8 at 16 - asking for more silently places
   fewer.
3. **Hint count is not a free parameter.** Raising `count` changes difficulty far more than
   placement does - Easy lost 16 points of per-player completion going from 1.73 to 4 hints.
   Change count and anything else in separate releases, or you cannot attribute the result.
4. **Coverage is not the lever it looks like.** Guaranteeing full coverage on Tricky, at the
   same hint count, did not raise completion. Do not re-run that idea without reading
   `docs/experiments.md` first.
5. **Easy's sparse hints are deliberate.** Players finish a 1-2 hint 4x4 far more often than
   a fully covered one. Do not "fix" the 1.73.
6. **Affects all modes**: new daily puzzles, restored daily puzzles, and new unlimited
   puzzles alike.
7. **Saved unlimited puzzles** keep their original hint placement when restored (no
   migration). **Saved daily puzzles** rebuild their hints from the seed, so a config change
   reaches an in-progress daily puzzle - the player's drawn path stays, the hints move under
   it. Ship generation changes knowing that.
8. **Graceful degradation**: too-tight constraints place fewer hints rather than failing.
9. **Verify before shipping**: the generator is a pure function of a grid size, a config and
   a seeded random source, so a candidate can be run across a year of seeds in Node and
   checked with `describePuzzle()` before any player sees it. `config.js` imports the i18n
   runtime, which resolves a Vite-only alias, so a Node-side harness needs
   `src/i18n/index.js` and `src/tokens.js` stubbed (`scripts/lib/` has both). The
   `tune-hints` skill walks through it.
10. **Judge the result per player, not per start.** A handful of daily regulars dominate
    start counts, and whichever side of a comparison they land on wins. This produced two
    false "wins" in the hint placement experiment. See `docs/experiments.md`.

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
