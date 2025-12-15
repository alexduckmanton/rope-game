/**
 * Game Validation Utilities
 *
 * Win condition checking for both game and tutorial views.
 */

import { checkStructuralLoop, checkPartialStructuralLoop, buildSolutionTurnMap, countTurnsInArea, parseCellKey } from '../utils.js';
import { buildPlayerTurnMap } from '../renderer.js';

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
