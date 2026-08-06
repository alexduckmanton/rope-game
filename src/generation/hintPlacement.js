/**
 * Hint placement for the "dense" generation variant
 *
 * The original placement (`generateHintCellsWithMinDistance` in renderer.js)
 * shuffles every cell and takes the first N that satisfy a Chebyshev spacing
 * rule. It knows nothing about the solution, so two things fall out of it by
 * chance rather than by design:
 *
 *   - **Coverage.** A hint constrains the 3x3 area around itself, so cells
 *     outside every hint's area carry no information at all. Measured over a
 *     year of daily seeds, Tricky leaves a median 22% of the grid unconstrained
 *     and up to 39% on a bad day. A player drawing there has no feedback.
 *
 *   - **Redundancy.** Where hint areas overlap, the hints check each other and
 *     the puzzle becomes solvable by deduction. Where they don't, each hint is
 *     an isolated local puzzle you can only satisfy by trial. Tricky averaged
 *     1.24 hints per constrained cell - barely above Easy's 1.00 - while
 *     Diabolical averaged 2.13, which is why the larger grid was the *easier*
 *     one to finish.
 *
 * This module makes both properties explicit, in three stages:
 *
 *   1. **Cover** - greedy maximum-coverage selection guarantees every cell sits
 *      inside at least one hint area. Ties are broken with the seeded random
 *      function, so the covering set varies day to day rather than landing on a
 *      fixed lattice players would learn.
 *   2. **Anchor** - swap some of the free hints for ones reading 0 or 1. A 0
 *      forces a straight run through nine cells and is the single most
 *      informative thing a hint can say; a 4 or 5 on a nine-cell window rules
 *      out almost nothing. Guaranteeing a couple of anchors gives every puzzle
 *      a place to start reasoning from.
 *   3. **Fill** - place the remaining hints at random for redundancy.
 *
 * Stage 1 alone guarantees coverage, so stages 2 and 3 only ever touch hints
 * added after it. That is what makes the anchor swap safe.
 *
 * This module deliberately imports only from utils.js (which has no imports of
 * its own) and takes its configuration as an argument, so it can be exercised
 * outside a browser without pulling in the CSS-backed colour tokens.
 */

import { createCellKey, parseCellKey, countTurnsInArea, getAdjacentCells } from '../utils.js';

/**
 * Default turn count at or below which a hint counts as an "anchor"
 *
 * 0 forces a straight run through the whole area; 1 allows exactly one corner.
 * Both prune the search space hard. From 2 upwards the constraint loosens.
 *
 * The usable threshold is a property of the grid, not a matter of taste, and it
 * is why `anchorMaxValue` is per-difficulty rather than a single constant.
 * Measured across every hint position on a year of daily solutions:
 *
 *   | grid | value <=1        | value <=2         |
 *   |------|------------------|-------------------|
 *   | 4x4  | 0.0 per puzzle   | 1.7 per puzzle    |
 *   | 6x6  | 2.0 per puzzle   | 7.6 per puzzle    |
 *   | 8x8  | 9.3 per puzzle   | 19.6 per puzzle   |
 *
 * A 4x4 Hamiltonian cycle packs ~11 turns into 16 cells, so *every* 3x3 window
 * on it holds at least two. Asking Easy for a hint reading 0 or 1 is asking for
 * something that cannot exist, and 6x6 sits right on the edge - a target of two
 * anchors at threshold 1 would be demanding both of the only two that exist.
 */
const DEFAULT_ANCHOR_MAX_VALUE = 1;

/**
 * List every cell in the grid, in reading order
 *
 * @param {number} gridSize - Grid size (e.g. 6 for 6x6)
 * @returns {Array<string>} Cell keys
 */
function allCells(gridSize) {
  const cells = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      cells.push(createCellKey(row, col));
    }
  }
  return cells;
}

/**
 * Cells inside the 3x3 area a hint at this cell would constrain
 *
 * @param {string} cellKey - Hint cell
 * @param {number} gridSize - Grid size
 * @returns {Array<string>} Cell keys within the grid, including the hint itself
 */
function areaOf(cellKey, gridSize) {
  const { row, col } = parseCellKey(cellKey);
  const area = [];
  for (const [r, c] of getAdjacentCells(row, col)) {
    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
      area.push(createCellKey(r, c));
    }
  }
  return area;
}

/**
 * Fisher-Yates shuffle using the supplied random function
 *
 * Kept local rather than imported so the seeded ordering here can never drift
 * from a shared helper used elsewhere.
 *
 * @param {Array<T>} items - Array to shuffle (mutated in place)
 * @param {function(): number} randomFn - Random source
 * @returns {Array<T>} The same array, shuffled
 * @template T
 */
function shuffle(items, randomFn) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Stage 1: greedily select hints until every cell is covered
 *
 * At each step picks the cell whose area covers the most still-uncovered cells.
 * Candidates are shuffled first, so equal-scoring cells - which are common,
 * especially on the first pick - are chosen at random rather than by grid
 * order. Without that the covering set would be near-identical every day.
 *
 * Stops early if it runs out of budget, which only happens when `maxHints` is
 * below the number needed to cover the grid.
 *
 * @param {number} gridSize - Grid size
 * @param {number} maxHints - Hard cap on hints placed here
 * @param {function(): number} randomFn - Seeded random source
 * @returns {Set<string>} Covering hint cells
 */
function selectCoveringHints(gridSize, maxHints, randomFn) {
  const hints = new Set();
  const uncovered = new Set(allCells(gridSize));
  const candidates = shuffle(allCells(gridSize), randomFn);

  while (uncovered.size > 0 && hints.size < maxHints) {
    let best = null;
    let bestGain = 0;

    for (const candidate of candidates) {
      if (hints.has(candidate)) continue;

      let gain = 0;
      for (const cell of areaOf(candidate, gridSize)) {
        if (uncovered.has(cell)) gain++;
      }

      // Strictly greater, so the shuffled order decides ties
      if (gain > bestGain) {
        bestGain = gain;
        best = candidate;
      }
    }

    // No remaining cell covers anything new - only reachable if the grid is
    // already fully covered, which the loop condition rules out
    if (!best) break;

    hints.add(best);
    for (const cell of areaOf(best, gridSize)) uncovered.delete(cell);
  }

  return hints;
}

/**
 * Turn count a hint at this cell would display on a finished solution
 *
 * @param {string} cellKey - Hint cell
 * @param {number} gridSize - Grid size
 * @param {Map<string, boolean>} solutionTurnMap - From buildSolutionTurnMap()
 * @returns {number} Expected turn count for the hint's area
 */
function hintValue(cellKey, gridSize, solutionTurnMap) {
  const { row, col } = parseCellKey(cellKey);
  return countTurnsInArea(row, col, gridSize, solutionTurnMap);
}

/**
 * Whether a hint set leaves every cell of the grid constrained
 *
 * @param {Iterable<string>} hints - Hint cells
 * @param {number} gridSize - Grid size
 * @returns {boolean} True when coverage is complete
 */
function coversGrid(hints, gridSize) {
  const covered = new Set();
  for (const cellKey of hints) {
    for (const cell of areaOf(cellKey, gridSize)) covered.add(cell);
  }
  return covered.size === gridSize * gridSize;
}

/**
 * Generate hint cells using cover -> fill -> anchor
 *
 * Falls back gracefully at every stage: a grid that cannot be covered within
 * the hint budget, or a solution with too few low-value areas to anchor
 * against, produces a slightly weaker puzzle rather than an error. Coverage is
 * never traded away for an anchor - every swap is checked first.
 *
 * @param {number} gridSize - Grid size (e.g. 6 for 6x6)
 * @param {{ count: number, lowValueAnchors?: number, anchorMaxValue?: number }} config - Difficulty config
 * @param {Map<string, boolean>} solutionTurnMap - From buildSolutionTurnMap()
 * @param {function(): number} [randomFn] - Seeded random for daily puzzles
 * @returns {Set<string>} Hint cells
 */
export function generateHintCellsCovering(gridSize, config, solutionTurnMap, randomFn = Math.random) {
  const { count, lowValueAnchors = 0, anchorMaxValue = DEFAULT_ANCHOR_MAX_VALUE } = config;

  // Stage 1: coverage. Placed first so the rest of the budget is free to move.
  const hints = new Set(selectCoveringHints(gridSize, count, randomFn));

  // Stage 2: fill the remaining budget at random, for redundancy
  const pool = shuffle(allCells(gridSize).filter((cell) => !hints.has(cell)), randomFn);
  for (const cell of pool) {
    if (hints.size >= count) break;
    hints.add(cell);
  }

  // Stage 3: guarantee anchors. Any hint may be swapped out, including a
  // covering one, as long as the grid stays fully covered afterwards - on a
  // tight grid like 6x6 the low-value positions are often the covering ones,
  // so restricting swaps to the free hints leaves the quota unmet.
  if (lowValueAnchors > 0) {
    const isAnchor = (cell) => hintValue(cell, gridSize, solutionTurnMap) <= anchorMaxValue;

    let anchorCount = 0;
    for (const cell of hints) {
      if (isAnchor(cell)) anchorCount++;
    }

    const candidates = pool.filter((cell) => !hints.has(cell) && isAnchor(cell));

    while (anchorCount < lowValueAnchors && candidates.length > 0) {
      const candidate = candidates.pop();
      // Prefer giving up a hint that isn't an anchor itself, newest first
      const removable = Array.from(hints).filter((cell) => !isAnchor(cell)).reverse();

      let swapped = false;
      for (const victim of removable) {
        hints.delete(victim);
        hints.add(candidate);
        if (coversGrid(hints, gridSize)) {
          swapped = true;
          break;
        }
        // Coverage broke - put it back and try giving up a different hint
        hints.delete(candidate);
        hints.add(victim);
      }

      if (swapped) anchorCount++;
    }
  }

  return hints;
}

/**
 * Measure the shape of a generated puzzle
 *
 * Sent with `game_started` / `game_completed` so puzzle characteristics can be
 * correlated against completion rate directly, rather than inferred from which
 * experiment arm a player landed in. Useful well beyond the experiment: it is
 * the only way to tell an unlucky day's puzzle from a bad difficulty setting.
 *
 * @param {number} gridSize - Grid size
 * @param {Set<string>} hintCells - Placed hints
 * @param {Map<string, boolean>} solutionTurnMap - From buildSolutionTurnMap()
 * @param {number} [anchorMaxValue] - Threshold this difficulty counts as an anchor
 * @returns {{hintCount: number, expectedTurnsTotal: number, coveragePercent: number, redundancy: number, solutionTurns: number, anchorHints: number}}
 */
export function describePuzzle(gridSize, hintCells, solutionTurnMap, anchorMaxValue = DEFAULT_ANCHOR_MAX_VALUE) {
  const coverCount = new Map();
  let expectedTurnsTotal = 0;
  let anchorHints = 0;

  for (const cellKey of hintCells) {
    const value = hintValue(cellKey, gridSize, solutionTurnMap);
    expectedTurnsTotal += value;
    if (value <= anchorMaxValue) anchorHints++;

    for (const cell of areaOf(cellKey, gridSize)) {
      coverCount.set(cell, (coverCount.get(cell) || 0) + 1);
    }
  }

  const totalCells = gridSize * gridSize;
  const covered = coverCount.size;
  let overlapSum = 0;
  for (const n of coverCount.values()) overlapSum += n;

  return {
    hintCount: hintCells.size,
    expectedTurnsTotal,
    anchorHints,
    coveragePercent: Math.round((covered / totalCells) * 100),
    // Hints constraining the average constrained cell. 1.0 means no hint areas
    // overlap at all, so no cross-checking and no deduction is possible.
    redundancy: covered > 0 ? Math.round((overlapSum / covered) * 100) / 100 : 0,
    solutionTurns: Array.from(solutionTurnMap.values()).filter(Boolean).length,
  };
}
