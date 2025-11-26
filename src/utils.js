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

/**
 * Draw smooth curves through an array of points with optional loop closure
 * Handles the complex math for calculating proper starting points and arc tangents
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context (must have beginPath already called)
 * @param {Array<{x: number, y: number}>} points - Array of pixel coordinate points
 * @param {number} radius - Corner radius for smooth curves
 * @param {boolean} isLoop - Whether this is a closed loop
 */
export function drawSmoothCurve(ctx, points, radius, isLoop) {
  if (points.length < 2) return;

  if (isLoop && points.length >= 2) {
    // Closed loop - calculate proper starting point to avoid overhang
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const secondPoint = points[1];

    // Calculate the angle at the first corner
    const dx1 = firstPoint.x - lastPoint.x;
    const dy1 = firstPoint.y - lastPoint.y;
    const dx2 = secondPoint.x - firstPoint.x;
    const dy2 = secondPoint.y - firstPoint.y;

    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    // Normalize vectors
    const ux1 = dx1 / len1;
    const uy1 = dy1 / len1;
    const ux2 = dx2 / len2;
    const uy2 = dy2 / len2;

    // Calculate angle between vectors
    const dot = ux1 * ux2 + uy1 * uy2;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

    // Calculate tangent distance from corner to arc start
    const tangentDist = Math.min(radius / Math.tan(angle / 2), len1 / 2, len2 / 2);

    // Starting point is offset from first point toward last point
    const startX = firstPoint.x - ux1 * tangentDist;
    const startY = firstPoint.y - uy1 * tangentDist;

    // Start at calculated position
    ctx.moveTo(startX, startY);

    // Arc around all points including the first point
    for (let i = 0; i < points.length; i++) {
      const cornerPoint = points[i];
      const nextPoint = points[(i + 1) % points.length];
      ctx.arcTo(cornerPoint.x, cornerPoint.y, nextPoint.x, nextPoint.y, radius);
    }
    ctx.closePath();
  } else {
    // Open path - start at first point and smooth interior corners only
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 2; i++) {
      const cornerPoint = points[i + 1];
      const nextPoint = points[i + 2];
      ctx.arcTo(cornerPoint.x, cornerPoint.y, nextPoint.x, nextPoint.y, radius);
    }
    // Draw to final point
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  }
}

/**
 * Build a map indicating which cells in a solution path are turns (corners)
 * A turn is where the path changes direction (not a straight line)
 *
 * @param {Array<{row: number, col: number}>} solutionPath - Array of cells in path order
 * @returns {Map<string, boolean>} Map of "row,col" -> isTurn (true if turn, false if straight)
 */
export function buildSolutionTurnMap(solutionPath) {
  const turnMap = new Map();
  const pathLength = solutionPath.length;

  for (let i = 0; i < pathLength; i++) {
    const prev = solutionPath[(i - 1 + pathLength) % pathLength];
    const current = solutionPath[i];
    const next = solutionPath[(i + 1) % pathLength];

    // Check if this is a straight path (no turn)
    const isStraight =
      (prev.row === current.row && current.row === next.row) ||
      (prev.col === current.col && current.col === next.col);

    turnMap.set(`${current.row},${current.col}`, !isStraight);
  }

  return turnMap;
}

/**
 * Get all adjacent cells in a 3x3 area (including diagonals and center)
 * Returns array of [row, col] coordinates
 *
 * @param {number} row - Center row
 * @param {number} col - Center column
 * @returns {Array<[number, number]>} Array of [row, col] coordinates in 3x3 area
 */
export function getAdjacentCells(row, col) {
  return [
    [row - 1, col - 1], // up-left
    [row - 1, col],     // up
    [row - 1, col + 1], // up-right
    [row, col - 1],     // left
    [row, col],         // self (center)
    [row, col + 1],     // right
    [row + 1, col - 1], // down-left
    [row + 1, col],     // down
    [row + 1, col + 1]  // down-right
  ];
}

/**
 * Count turns in a 3x3 area around a cell (used for hint validation)
 *
 * @param {number} row - Center row
 * @param {number} col - Center column
 * @param {number} gridSize - Grid size for bounds checking
 * @param {Map<string, boolean>} turnMap - Map of cellKey -> isTurn
 * @returns {number} Count of turns in the 3x3 area
 */
export function countTurnsInArea(row, col, gridSize, turnMap) {
  let turnCount = 0;
  const adjacents = getAdjacentCells(row, col);

  for (const [adjRow, adjCol] of adjacents) {
    // Check bounds
    if (adjRow >= 0 && adjRow < gridSize && adjCol >= 0 && adjCol < gridSize) {
      const adjKey = `${adjRow},${adjCol}`;
      if (turnMap.get(adjKey)) {
        turnCount++;
      }
    }
  }

  return turnCount;
}

/**
 * Determine which connection to break based on "opposite direction" priority
 * When drawing from cellA to cellB, we want to remove the connection from cellB
 * that goes in the opposite direction from where we're coming
 *
 * @param {string} targetCell - The cell that has 2 connections (format: "row,col")
 * @param {string} comingFromCell - The cell we're drawing from (format: "row,col")
 * @param {Set<string>} existingConnections - Set of cells connected to targetCell
 * @returns {string} The cell key to disconnect from targetCell
 */
export function determineConnectionToBreak(targetCell, comingFromCell, existingConnections) {
  const [targetRow, targetCol] = targetCell.split(',').map(Number);
  const [fromRow, fromCol] = comingFromCell.split(',').map(Number);

  // Direction vector from comingFrom to target (the direction we're drawing)
  const drawDirection = {
    row: targetRow - fromRow,
    col: targetCol - fromCol
  };

  // We want to remove the connection in the opposite direction
  const oppositeDirection = {
    row: -drawDirection.row,
    col: -drawDirection.col
  };

  // Find which existing connection is in the opposite direction
  for (const connectedKey of existingConnections) {
    const [connRow, connCol] = connectedKey.split(',').map(Number);
    const connectionDirection = {
      row: connRow - targetRow,
      col: connCol - targetCol
    };

    // Check if this connection is in the opposite direction
    if (connectionDirection.row === oppositeDirection.row &&
        connectionDirection.col === oppositeDirection.col) {
      return connectedKey;
    }
  }

  // Fallback: return first connection if no opposite found
  return Array.from(existingConnections)[0];
}

/**
 * Find shortest path from one cell to another using BFS
 * Returns array of cell keys (not including start, but including end)
 *
 * @param {string} fromKey - Starting cell key (format: "row,col")
 * @param {string} toKey - Target cell key (format: "row,col")
 * @param {number} gridSize - Size of the grid for bounds checking
 * @returns {Array<string>|null} Array of cell keys forming path, or null if no path exists
 */
export function findShortestPath(fromKey, toKey, gridSize) {
  const [fromRow, fromCol] = fromKey.split(',').map(Number);
  const [toRow, toCol] = toKey.split(',').map(Number);

  // If adjacent, just return the target
  if (isAdjacent(fromRow, fromCol, toRow, toCol)) {
    return [toKey];
  }

  // BFS to find shortest path
  const queue = [[fromKey, []]];
  const visited = new Set([fromKey]);

  while (queue.length > 0) {
    const [current, path] = queue.shift();
    const [r, c] = current.split(',').map(Number);

    // Get adjacent cells
    const neighbors = [
      [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
    ].filter(([nr, nc]) =>
      nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize
    );

    for (const [nr, nc] of neighbors) {
      const neighborKey = `${nr},${nc}`;
      if (visited.has(neighborKey)) continue;

      // Check if this is the target
      if (neighborKey === toKey) {
        return [...path, neighborKey];
      }

      visited.add(neighborKey);
      queue.push([neighborKey, [...path, neighborKey]]);
    }
  }

  // No path found
  return null;
}

/**
 * Check if the player has drawn a valid single closed loop
 * @param {Set} playerDrawnCells - Set of cell keys that have been drawn
 * @param {Map} playerConnections - Map of cell keys to their connected neighbors
 * @param {number} gridSize - Grid size
 * @returns {boolean} True if all cells visited and form a single closed loop
 */
export function checkStructuralLoop(playerDrawnCells, playerConnections, gridSize) {
  const totalCells = gridSize * gridSize;

  // Check if all cells are visited
  if (playerDrawnCells.size !== totalCells) return false;

  // Check if each cell has exactly 2 connections (closed loop)
  for (const cellKey of playerDrawnCells) {
    const connections = playerConnections.get(cellKey);
    if (!connections || connections.size !== 2) return false;
  }

  // Check if all cells form a SINGLE connected loop (not multiple separate loops)
  // Use BFS to traverse from one cell and verify we can reach all cells
  const startCell = playerDrawnCells.values().next().value;
  const visited = new Set();
  const queue = [startCell];
  visited.add(startCell);

  while (queue.length > 0) {
    const currentCell = queue.shift();
    const connections = playerConnections.get(currentCell);

    if (connections) {
      for (const connectedCell of connections) {
        if (!visited.has(connectedCell)) {
          visited.add(connectedCell);
          queue.push(connectedCell);
        }
      }
    }
  }

  // If we visited all cells, it's a single connected loop
  // If we didn't, there are multiple disconnected loops
  return visited.size === totalCells;
}

/**
 * Show an alert message asynchronously with optional callback
 * Uses requestAnimationFrame + setTimeout to ensure render completes before alert
 * @param {string} message - The alert message to display
 * @param {Function} [callback] - Optional callback to run after alert is dismissed
 */
export function showAlertAsync(message, callback) {
  requestAnimationFrame(() => {
    setTimeout(() => {
      alert(message);
      if (callback) callback();
    }, 0);
  });
}
