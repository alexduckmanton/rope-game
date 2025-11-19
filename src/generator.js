/**
 * Puzzle generation module using backtracking with iteration limit
 */

/**
 * Generate a random Hamiltonian cycle on a grid
 * @param {number} size - Grid size (e.g., 5 for 5x5)
 * @returns {Array<{row: number, col: number}>} Array of cell coordinates forming the path
 */
export function generateSolutionPath(size) {
  const totalCells = size * size;

  // Try from random starting positions
  const starts = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      starts.push({ row: r, col: c });
    }
  }
  shuffleArray(starts);

  for (const start of starts) {
    const path = tryBacktracking(size, start.row, start.col, totalCells);
    if (path) return path;
  }

  // Fallback to snake pattern
  return generateSnakePattern(size);
}

/**
 * Try to find Hamiltonian cycle using backtracking with iteration limit
 */
function tryBacktracking(size, startRow, startCol, totalCells) {
  const visited = Array(size).fill(null).map(() => Array(size).fill(false));
  const path = [];
  let iterations = 0;
  const maxIterations = 50000;

  function backtrack(row, col) {
    if (iterations++ > maxIterations) return false;

    visited[row][col] = true;
    path.push({ row, col });

    if (path.length === totalCells) {
      if (isAdjacent(row, col, startRow, startCol)) {
        return true;
      }
      visited[row][col] = false;
      path.pop();
      return false;
    }

    // Get and shuffle neighbors for randomness
    const neighbors = getNeighbors(size, row, col)
      .filter(n => !visited[n.row][n.col]);
    shuffleArray(neighbors);

    for (const next of neighbors) {
      if (backtrack(next.row, next.col)) {
        return true;
      }
    }

    visited[row][col] = false;
    path.pop();
    return false;
  }

  if (backtrack(startRow, startCol)) {
    return path;
  }
  return null;
}

/**
 * Get all neighbors of a cell
 */
function getNeighbors(size, row, col) {
  const neighbors = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of dirs) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < size && c >= 0 && c < size) {
      neighbors.push({ row: r, col: c });
    }
  }
  return neighbors;
}

/**
 * Check if two cells are adjacent
 */
function isAdjacent(r1, c1, r2, c2) {
  return (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Fallback snake pattern
 */
function generateSnakePattern(size) {
  const path = [];
  for (let row = 0; row < size; row++) {
    if (row % 2 === 0) {
      for (let col = 0; col < size; col++) {
        path.push({ row, col });
      }
    } else {
      for (let col = size - 1; col >= 0; col--) {
        path.push({ row, col });
      }
    }
  }
  return path;
}
