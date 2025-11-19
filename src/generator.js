/**
 * Puzzle generation module using recursive backtracking
 */

/**
 * Generate a random Hamiltonian cycle on a grid
 * @param {number} size - Grid size (e.g., 5 for 5x5)
 * @returns {Array<{row: number, col: number}>} Array of cell coordinates forming the path
 */
export function generateSolutionPath(size) {
  const totalCells = size * size;
  const visited = Array(size).fill(null).map(() => Array(size).fill(false));
  const path = [];

  // Try random starting positions until we find a cycle
  const positions = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      positions.push({ row: r, col: c });
    }
  }
  shuffleArray(positions);

  for (const start of positions) {
    // Reset state
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        visited[r][c] = false;
      }
    }
    path.length = 0;

    if (findHamiltonianCycle(size, start.row, start.col, start.row, start.col, visited, path, totalCells)) {
      return path;
    }
  }

  // Fallback: should never happen for 5x5
  console.error('Failed to generate Hamiltonian cycle');
  return [];
}

/**
 * Recursive backtracking to find Hamiltonian cycle
 */
function findHamiltonianCycle(size, row, col, startRow, startCol, visited, path, totalCells) {
  visited[row][col] = true;
  path.push({ row, col });

  // If all cells visited, check if we can close the loop
  if (path.length === totalCells) {
    if (isAdjacent(row, col, startRow, startCol)) {
      return true;
    }
    visited[row][col] = false;
    path.pop();
    return false;
  }

  // Get and shuffle unvisited neighbors
  const neighbors = getUnvisitedNeighbors(size, row, col, visited);
  shuffleArray(neighbors);

  for (const neighbor of neighbors) {
    if (findHamiltonianCycle(size, neighbor.row, neighbor.col, startRow, startCol, visited, path, totalCells)) {
      return true;
    }
  }

  // Backtrack
  visited[row][col] = false;
  path.pop();
  return false;
}

/**
 * Check if two cells are adjacent
 */
function isAdjacent(row1, col1, row2, col2) {
  const rowDiff = Math.abs(row1 - row2);
  const colDiff = Math.abs(col1 - col2);
  return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

/**
 * Get unvisited neighboring cells
 */
function getUnvisitedNeighbors(size, row, col, visited) {
  const neighbors = [];
  const directions = [
    { row: -1, col: 0 },  // Up
    { row: 1, col: 0 },   // Down
    { row: 0, col: -1 },  // Left
    { row: 0, col: 1 }    // Right
  ];

  for (const dir of directions) {
    const newRow = row + dir.row;
    const newCol = col + dir.col;

    if (newRow >= 0 && newRow < size &&
        newCol >= 0 && newCol < size &&
        !visited[newRow][newCol]) {
      neighbors.push({ row: newRow, col: newCol });
    }
  }

  return neighbors;
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
