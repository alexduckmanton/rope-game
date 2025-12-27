/**
 * Game Validation Utilities
 *
 * Win condition checking for both game and tutorial views.
 */

import { checkStructuralLoop, checkPartialStructuralLoop, buildSolutionTurnMap, countTurnsInArea, parseCellKey } from '../utils.js';
import { buildPlayerTurnMap } from '../renderer.js';
import { CONFIG } from '../config.js';

/**
 * Difficulty level constants
 * Used for difficulty-based win condition checks
 */
export const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

/**
 * Check if player has drawn a valid closed loop
 * @param {Set<string>} playerDrawnCells - Set of drawn cell keys
 * @param {Map<string, Set<string>>} playerConnections - Map of cell connections
 * @param {number} gridSize - Size of the grid
 * @returns {boolean} True if a valid structural loop exists
 */
export function checkStructuralWin(playerDrawnCells, playerConnections, gridSize) {
  return checkStructuralLoop(playerDrawnCells, playerConnections, gridSize);
}

/**
 * Validate that all hint constraints are satisfied
 * @param {Map<string, boolean>} solutionTurnMap - Solution turn map
 * @param {Map<string, boolean>} playerTurnMap - Player turn map
 * @param {Set<string>} hintCells - Cells with hint numbers
 * @param {number} gridSize - Size of the grid
 * @returns {boolean} True if all hints are satisfied
 */
export function validateHints(solutionTurnMap, playerTurnMap, hintCells, gridSize) {
  for (const cellKey of hintCells) {
    const { row, col } = parseCellKey(cellKey);
    const expected = countTurnsInArea(row, col, gridSize, solutionTurnMap);
    const actual = countTurnsInArea(row, col, gridSize, playerTurnMap);
    if (expected !== actual) return false;
  }
  return true;
}

/**
 * Full win check: structural validity + hint validation
 * @param {Object} gameState - { playerDrawnCells, playerConnections }
 * @param {Array<{row: number, col: number}>} solutionPath - Solution path
 * @param {Set<string>} hintCells - Cells with hint numbers
 * @param {number} gridSize - Size of the grid
 * @param {Map<string, boolean>} [solutionTurnMap] - Optional pre-built solution turn map
 * @param {Map<string, boolean>} [playerTurnMap] - Optional pre-built player turn map
 * @returns {boolean} True if player has won
 */
export function checkFullWin(gameState, solutionPath, hintCells, gridSize, solutionTurnMap = null, playerTurnMap = null) {
  const { playerDrawnCells, playerConnections } = gameState;

  // Check structural validity first
  if (!checkStructuralWin(playerDrawnCells, playerConnections, gridSize)) {
    return false;
  }

  // Build maps if not provided
  const solMap = solutionTurnMap || buildSolutionTurnMap(solutionPath);
  const playerMap = playerTurnMap || buildPlayerTurnMap(playerDrawnCells, playerConnections);

  // Validate hints
  return validateHints(solMap, playerMap, hintCells, gridSize);
}

/**
 * Check if player has drawn a valid closed loop (without requiring all cells)
 * @param {Set<string>} playerDrawnCells - Set of drawn cell keys
 * @param {Map<string, Set<string>>} playerConnections - Map of cell connections
 * @returns {boolean} True if drawn cells form a valid single closed loop
 */
export function checkPartialStructuralWin(playerDrawnCells, playerConnections) {
  return checkPartialStructuralLoop(playerDrawnCells, playerConnections);
}

/**
 * Check if all cells in the grid have been visited
 * @param {Set<string>} playerDrawnCells - Set of drawn cell keys
 * @param {number} gridSize - Size of the grid
 * @returns {boolean} True if all cells are visited
 */
export function checkAllCellsVisited(playerDrawnCells, gridSize) {
  const totalCells = gridSize * gridSize;
  return playerDrawnCells.size === totalCells;
}

/**
 * Compute a unique key representing the current player path state.
 * Used to detect if the path has actually changed between renders,
 * preventing redundant validation and error modals from reappearing.
 *
 * Only includes cells with connections - orphaned cells (from taps) are ignored
 * since they don't affect validation and are removed by cleanup.
 *
 * @param {Set<string>} playerDrawnCells - Set of drawn cell keys
 * @param {Map<string, Set<string>>} playerConnections - Map of cell connections
 * @returns {string} A string uniquely identifying the current path state (format: "cells|connections")
 */
export function computeStateKey(playerDrawnCells, playerConnections) {
  // Only include cells that have connections (ignore orphaned cells)
  // Orphaned cells don't affect validation and are temporary during taps
  const connectedCells = [];
  for (const cellKey of playerDrawnCells) {
    const connections = playerConnections.get(cellKey);
    if (connections && connections.size > 0) {
      connectedCells.push(cellKey);
    }
  }
  const cellsStr = connectedCells.sort().join(',');

  // Create sorted list of connection pairs (each connection represented once)
  const connectionPairs = new Set();
  for (const [cell, connections] of playerConnections) {
    for (const connectedCell of connections) {
      // Only add pair once (alphabetically sorted)
      const pair = [cell, connectedCell].sort().join('-');
      connectionPairs.add(pair);
    }
  }
  const connectionsStr = [...connectionPairs].sort().join(',');

  return `${cellsStr}|${connectionsStr}`;
}

/**
 * Determines if validation should run based on state changes and interaction state.
 * Validation only runs when:
 * - State has changed since last validation
 * - Game is not already won
 * - User is not currently dragging (deferred validation prevents modal interruptions)
 *
 * This helper encapsulates the "when to validate" logic shared between game and tutorial views,
 * while leaving the "what to validate" and "what to do when validated" logic in each view.
 *
 * @param {Object} params
 * @param {Set<string>} params.playerDrawnCells - Current drawn cells
 * @param {Map<string, Set<string>>} params.playerConnections - Current connections
 * @param {Object} params.gameCore - Game core instance (for isDragging state)
 * @param {boolean} params.hasWon - Whether game is already won
 * @param {string} params.lastValidatedStateKey - Last state that was validated
 * @returns {Object} { shouldValidate: boolean, currentStateKey: string, stateChanged: boolean }
 */
export function checkShouldValidate({
  playerDrawnCells,
  playerConnections,
  gameCore,
  hasWon,
  lastValidatedStateKey
}) {
  const currentStateKey = computeStateKey(playerDrawnCells, playerConnections);
  const stateChanged = currentStateKey !== lastValidatedStateKey;
  const isDragging = gameCore.state.isDragging;

  return {
    shouldValidate: stateChanged && !hasWon && !isDragging,
    currentStateKey,
    stateChanged
  };
}

/**
 * Map score percentage to label
 * @param {number} percentage - Score percentage (0-100)
 * @returns {string} Label for the percentage range
 */
export function getScoreLabel(percentage) {
  if (percentage === 100) return 'Perfect';
  if (percentage >= 80) return 'Genius';
  if (percentage >= 60) return 'Amazing';
  if (percentage >= 40) return 'Great';
  if (percentage >= 20) return 'Good';
  return 'Okay';
}

/**
 * Calculate progress score based on hint constraints and cell coverage
 *
 * Score has two components:
 * - Hints: 0 to (100 - HAMILTONIAN_BONUS_PERCENT)% based on constraint satisfaction
 * - Coverage: 0 to HAMILTONIAN_BONUS_PERCENT% based on cells visited (proportional)
 *
 * Total score = hints% + coverage%
 *
 * Uses absolute values for hints so +1 and -1 are treated the same.
 *
 * @param {Set<string>} hintCells - Cells with hint numbers
 * @param {Set<string>} playerDrawnCells - Cells drawn by player
 * @param {number} gridSize - Size of the grid
 * @param {Map<string, boolean>} solutionTurnMap - Pre-built solution turn map
 * @param {Map<string, boolean>} playerTurnMap - Pre-built player turn map
 * @returns {{ percentage: number, label: string } | null} Score object or null if no hints
 */
export function calculateScore(hintCells, playerDrawnCells, gridSize, solutionTurnMap, playerTurnMap) {
  // Return null if no hints (hide score display)
  if (!hintCells || hintCells.size === 0) {
    return null;
  }

  // Calculate hints score (weighted to 90% by default, configurable via 100 - bonus)
  const hintsWeight = 100 - CONFIG.SCORING.HAMILTONIAN_BONUS_PERCENT;

  let hintsScore = 0;
  let startingTotal = 0;
  let currentTotal = 0;

  // Calculate totals for all required hints
  for (const cellKey of hintCells) {
    const { row, col } = parseCellKey(cellKey);
    const expectedTurnCount = countTurnsInArea(row, col, gridSize, solutionTurnMap);
    const actualTurnCount = countTurnsInArea(row, col, gridSize, playerTurnMap);
    const remainingTurns = expectedTurnCount - actualTurnCount;

    startingTotal += Math.abs(expectedTurnCount);
    currentTotal += Math.abs(remainingTurns);
  }

  // Calculate hints percentage (clamp to 0% minimum)
  if (startingTotal === 0) {
    // Edge case: all hints have expected value of 0
    hintsScore = currentTotal === 0 ? hintsWeight : 0;
  } else {
    hintsScore = ((startingTotal - currentTotal) / startingTotal) * hintsWeight;
    hintsScore = Math.max(0, hintsScore);
  }

  // Calculate Hamiltonian bonus (10% by default, proportional to cell coverage)
  const cellsVisited = playerDrawnCells ? playerDrawnCells.size : 0;
  const totalCells = gridSize * gridSize;
  const coverageScore = (cellsVisited / totalCells) * CONFIG.SCORING.HAMILTONIAN_BONUS_PERCENT;

  // Total score (hints + coverage, clamped to 0-100 range)
  const totalScore = hintsScore + coverageScore;
  const percentage = Math.max(0, Math.min(100, Math.round(totalScore)));

  return {
    percentage,
    label: getScoreLabel(percentage)
  };
}
