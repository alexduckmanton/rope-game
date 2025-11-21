/**
 * Shared utility functions for the Loop puzzle game
 */

/**
 * Check if two cells are adjacent (Manhattan distance = 1)
 * @param {number} r1 - Row of first cell
 * @param {number} c1 - Column of first cell
 * @param {number} r2 - Row of second cell
 * @param {number} c2 - Column of second cell
 * @returns {boolean} True if cells are adjacent
 */
export function isAdjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}
