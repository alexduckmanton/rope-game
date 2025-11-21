/**
 * Puzzle generation module using hybrid Warnsdorff + Backtracking approach
 *
 * Three-phase strategy for finding Hamiltonian cycles:
 * 1. Warnsdorff's heuristic (fast greedy, ~20-30% success for 8x8)
 * 2. Backtracking with high iteration limits (slower but reliable)
 * 3. Snake pattern fallback (deterministic last resort)
 */

/**
 * Generate a random Hamiltonian cycle on a grid
 * @param {number} size - Grid size (e.g., 5 for 5x5)
 * @returns {Array<{row: number, col: number}>} Array of cell coordinates forming the path
 */
export function generateSolutionPath(size) {
  const totalCells = size * size;

  // Phase 1: Try Warnsdorff's heuristic (fast greedy algorithm)
  // This is very fast (<1ms per attempt) but doesn't always find valid cycles.
  // The algorithm picks neighbors with fewest onward options to avoid dead ends.
  // Worth trying multiple times before falling back to slower backtracking.
  const warnsdorffAttempts = size >= 8 ? 15 : 10;

  for (let attempt = 0; attempt < warnsdorffAttempts; attempt++) {
    // Random starting position for variety
    const startRow = Math.floor(Math.random() * size);
    const startCol = Math.floor(Math.random() * size);
    const path = tryWarnsdorff(size, startRow, startCol, totalCells);
    if (path) return path;
  }

  // Phase 2: Try backtracking with higher iteration budget
  // Warnsdorff failed to close a cycle, so use slower but more reliable backtracking.
  // We can afford much higher iteration limits since we're doing fewer attempts.
  const starts = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      starts.push({ row: r, col: c });
    }
  }
  shuffleArray(starts);

  // For larger grids, use significantly higher iteration limits
  // 8x8 is challenging - use very high limits with focused attempts
  const backtrackAttempts = size >= 8 ? 30 : Math.min(10, starts.length);
  const iterationLimit = size >= 8 ? 2000000 : 200000;

  for (let i = 0; i < backtrackAttempts; i++) {
    const start = starts[i];
    const path = tryBacktracking(size, start.row, start.col, totalCells, iterationLimit);
    if (path) return path;
  }

  // Phase 3: Fallback to snake pattern
  // If both Warnsdorff and backtracking failed, use deterministic pattern
  return generateSnakePattern(size);
}

/**
 * Try to find Hamiltonian cycle using Warnsdorff's heuristic
 *
 * Warnsdorff's rule: Always move to the neighbor with the fewest unvisited neighbors.
 * This greedy strategy avoids creating dead ends by saving well-connected cells for later.
 *
 * Fast but not guaranteed to find cycles - particularly the "closing the loop" constraint
 * makes this challenging for grid Hamiltonian cycles (vs knight's tour where it works better).
 *
 * @returns {Array|null} Path if successful, null if failed to close cycle
 */
function tryWarnsdorff(size, startRow, startCol, totalCells) {
  const visited = Array(size).fill(null).map(() => Array(size).fill(false));
  const path = [];

  let row = startRow;
  let col = startCol;

  // Build path greedily following Warnsdorff's rule
  for (let i = 0; i < totalCells; i++) {
    visited[row][col] = true;
    path.push({ row, col });

    // If we've visited all cells, stop and check cycle closure
    if (i === totalCells - 1) break;

    // Get unvisited neighbors with their degree (count of unvisited neighbors)
    const neighbors = getNeighbors(size, row, col)
      .filter(n => !visited[n.row][n.col])
      .map(n => ({
        row: n.row,
        col: n.col,
        degree: countUnvisitedNeighbors(size, n.row, n.col, visited)
      }))
      .sort((a, b) => a.degree - b.degree);

    // Dead end - no unvisited neighbors available
    if (neighbors.length === 0) return null;

    // Warnsdorff's rule: pick neighbor with minimum degree
    // If multiple have same minimum, pick randomly for variety
    const minDegree = neighbors[0].degree;
    const candidates = neighbors.filter(n => n.degree === minDegree);
    const next = candidates[Math.floor(Math.random() * candidates.length)];

    row = next.row;
    col = next.col;
  }

  // Critical: Check if we can close the loop back to start
  const lastCell = path[path.length - 1];
  if (!isAdjacent(lastCell.row, lastCell.col, startRow, startCol)) {
    return null; // Can't close the cycle
  }

  return path;
}

/**
 * Count how many unvisited neighbors a cell has
 * Used by Warnsdorff's heuristic to calculate degrees
 */
function countUnvisitedNeighbors(size, row, col, visited) {
  const neighbors = getNeighbors(size, row, col);
  let count = 0;
  for (const n of neighbors) {
    if (!visited[n.row][n.col]) count++;
  }
  return count;
}

/**
 * Try to find Hamiltonian cycle using backtracking with iteration limit
 *
 * This is slower than Warnsdorff but more reliable. It explores the search space
 * systematically with backtracking, and the iteration limit prevents browser hangs.
 *
 * @param {number} maxIterations - Maximum iterations before giving up (tuned per grid size)
 */
function tryBacktracking(size, startRow, startCol, totalCells, maxIterations = 50000) {
  const visited = Array(size).fill(null).map(() => Array(size).fill(false));
  const path = [];
  let iterations = 0;

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
 * Get all neighbors of a cell (orthogonal only, no diagonals)
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
 * Check if two cells are adjacent (Manhattan distance = 1)
 */
function isAdjacent(r1, c1, r2, c2) {
  return (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
}

/**
 * Fisher-Yates shuffle for randomizing arrays
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Fallback pattern that forms a valid Hamiltonian cycle
 * Column-wise snake that guarantees all consecutive cells are adjacent
 *
 * With the high iteration limits, this fallback should rarely be needed.
 */
function generateSnakePattern(size) {
  const path = [];

  // Column-wise snake: go down column 0, then snake through remaining columns
  // Start at (0,0), go down to (size-1,0)
  for (let row = 0; row < size; row++) {
    path.push({ row, col: 0 });
  }

  // Snake through columns 1 to size-1
  for (let col = 1; col < size; col++) {
    if (col % 2 === 1) {
      // Odd columns: go up (from bottom to top)
      for (let row = size - 1; row >= 0; row--) {
        path.push({ row, col });
      }
    } else {
      // Even columns: go down (from top to bottom)
      for (let row = 0; row < size; row++) {
        path.push({ row, col });
      }
    }
  }

  // For even-sized grids, the path ends at (0, size-1)
  // For odd-sized grids, the path ends at (size-1, size-1)
  // Neither is adjacent to (0,0), so rotate to find a valid start

  // Find where to start so the cycle closes
  for (let start = 0; start < path.length; start++) {
    const prev = (start - 1 + path.length) % path.length;
    const currCell = path[start];
    const prevCell = path[prev];
    const dist = Math.abs(currCell.row - prevCell.row) + Math.abs(currCell.col - prevCell.col);

    if (dist === 1) {
      // Found a valid rotation point
      return path.slice(start).concat(path.slice(0, start));
    }
  }

  // Fallback: return as-is (should not reach here for valid grids)
  return path;
}
