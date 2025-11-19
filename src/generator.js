/**
 * Puzzle generation module using Warnsdorff's heuristic
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
    const path = tryWarnsdorff(size, start.row, start.col, totalCells);
    if (path) return path;
  }

  // Fallback to snake pattern
  return generateSnakePattern(size);
}

/**
 * Try to find Hamiltonian cycle using Warnsdorff's heuristic
 */
function tryWarnsdorff(size, startRow, startCol, totalCells) {
  const visited = Array(size).fill(null).map(() => Array(size).fill(false));
  const path = [];

  let row = startRow;
  let col = startCol;

  for (let i = 0; i < totalCells; i++) {
    visited[row][col] = true;
    path.push({ row, col });

    if (i === totalCells - 1) break;

    // Get unvisited neighbors sorted by Warnsdorff's rule
    const neighbors = getNeighbors(size, row, col)
      .filter(n => !visited[n.row][n.col])
      .map(n => ({
        ...n,
        degree: countUnvisitedNeighbors(size, n.row, n.col, visited)
      }))
      .sort((a, b) => a.degree - b.degree);

    if (neighbors.length === 0) return null; // Dead end

    // Pick from neighbors with minimum degree (random tie-break)
    const minDegree = neighbors[0].degree;
    const candidates = neighbors.filter(n => n.degree === minDegree);
    const next = candidates[Math.floor(Math.random() * candidates.length)];

    row = next.row;
    col = next.col;
  }

  // Check if we can close the loop
  const lastCell = path[path.length - 1];
  if (isAdjacent(lastCell.row, lastCell.col, startRow, startCol)) {
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
 * Count unvisited neighbors of a cell
 */
function countUnvisitedNeighbors(size, row, col, visited) {
  return getNeighbors(size, row, col)
    .filter(n => !visited[n.row][n.col])
    .length;
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
