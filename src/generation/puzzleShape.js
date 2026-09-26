/**
 * Puzzle shape measurement
 *
 * Describes a generated puzzle in the terms that decide how hard it plays, so
 * every game event can carry them. The difficulty label alone cannot tell an
 * unlucky day's puzzle from a mistuned difficulty; these properties can.
 *
 *   - **Coverage** - share of the grid inside at least one hint's 3x3 area.
 *     Cells outside every area give the player no feedback at all.
 *   - **Redundancy** - hints constraining the average constrained cell. Where
 *     hint areas overlap the hints cross-check each other and deduction is
 *     possible; at 1.0 every hint is an isolated local puzzle.
 *   - **Anchors** - hints reading 0 or 1, the most informative things a hint
 *     can say (a 0 forces a straight run through the whole area).
 *   - **Expected turns** - the total the player must satisfy, which is the
 *     closest single number to constraint load.
 *
 * This file used to hold a second hint placement too, `covering`, which
 * guaranteed full coverage. It was A/B tested against the shipped `spaced`
 * placement from 2026-08-06 to 2026-09-26 and removed when, counted per
 * player, it improved no difficulty. See "Hint placement experiments" in
 * docs/experiments.md, and git history for the implementation.
 *
 * Imports only from utils.js (which has no imports of its own), so it can be
 * exercised in Node without the CSS-backed colour tokens.
 */

import { createCellKey, parseCellKey, countTurnsInArea, getAdjacentCells } from '../utils.js';

/**
 * Turn count at or below which a hint counts as an "anchor"
 *
 * 0 forces a straight run through the whole area; 1 allows exactly one corner.
 * Both prune the search space hard. From 2 upwards the constraint loosens.
 *
 * How many such positions a puzzle can even offer depends heavily on the grid.
 * Measured across every hint position on a year of daily solutions:
 *
 *   | grid | value <=1        | value <=2         |
 *   |------|------------------|-------------------|
 *   | 4x4  | 0.0 per puzzle   | 1.7 per puzzle    |
 *   | 6x6  | 2.0 per puzzle   | 7.6 per puzzle    |
 *   | 8x8  | 9.3 per puzzle   | 19.6 per puzzle   |
 *
 * A 4x4 Hamiltonian cycle packs ~11 turns into 16 cells, so every 3x3 window on
 * it holds at least two - Easy's anchor count is always zero at this threshold.
 */
const ANCHOR_MAX_VALUE = 1;

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
 * Measure the shape of a generated puzzle
 *
 * Sent with every game lifecycle event so puzzle characteristics can be
 * correlated against completion directly. It is the only way to tell an unlucky
 * day's puzzle from a bad difficulty setting.
 *
 * @param {number} gridSize - Grid size
 * @param {Set<string>} hintCells - Placed hints
 * @param {Map<string, boolean>} solutionTurnMap - From buildSolutionTurnMap()
 * @returns {{hintCount: number, expectedTurnsTotal: number, coveragePercent: number, redundancy: number, solutionTurns: number, anchorHints: number}}
 */
export function describePuzzle(gridSize, hintCells, solutionTurnMap) {
  const coverCount = new Map();
  let expectedTurnsTotal = 0;
  let anchorHints = 0;

  for (const cellKey of hintCells) {
    const value = hintValue(cellKey, gridSize, solutionTurnMap);
    expectedTurnsTotal += value;
    if (value <= ANCHOR_MAX_VALUE) anchorHints++;

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
