/**
 * Puzzle generation module - simple snake pattern
 */

/**
 * Generate a Hamiltonian cycle using a snake pattern
 * @param {number} size - Grid size (e.g., 5 for 5x5)
 * @returns {Array<{row: number, col: number}>} Array of cell coordinates forming the path
 */
export function generateSolutionPath(size) {
  const path = [];

  // Simple snake pattern: go right, down one, go left, down one, etc.
  for (let row = 0; row < size; row++) {
    if (row % 2 === 0) {
      // Go left to right
      for (let col = 0; col < size; col++) {
        path.push({ row, col });
      }
    } else {
      // Go right to left
      for (let col = size - 1; col >= 0; col--) {
        path.push({ row, col });
      }
    }
  }

  return path;
}
