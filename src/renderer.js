/**
 * Canvas rendering module for the Loop puzzle game
 */

/**
 * Render the grid lines
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} size - Grid size (e.g., 5 for 5x5)
 * @param {number} cellSize - Size of each cell in pixels
 */
export function renderGrid(ctx, size, cellSize) {
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1;

  // Draw grid lines
  for (let i = 0; i <= size; i++) {
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(i * cellSize, 0);
    ctx.lineTo(i * cellSize, size * cellSize);
    ctx.stroke();

    // Horizontal lines
    ctx.beginPath();
    ctx.moveTo(0, i * cellSize);
    ctx.lineTo(size * cellSize, i * cellSize);
    ctx.stroke();
  }
}

/**
 * Clear the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
export function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Render the solution path
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<{row: number, col: number}>} path - Array of cell coordinates
 * @param {number} cellSize - Size of each cell in pixels
 */
export function renderPath(ctx, path, cellSize) {
  if (!path || path.length === 0) return;

  ctx.strokeStyle = '#4A90E2';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw lines connecting the path
  if (path.length >= 2) {
    ctx.beginPath();
    const first = path[0];
    ctx.moveTo(first.col * cellSize + cellSize / 2, first.row * cellSize + cellSize / 2);

    for (let i = 1; i < path.length; i++) {
      const cell = path[i];
      ctx.lineTo(cell.col * cellSize + cellSize / 2, cell.row * cellSize + cellSize / 2);
    }

    // Close loop
    ctx.lineTo(first.col * cellSize + cellSize / 2, first.row * cellSize + cellSize / 2);
    ctx.stroke();
  }
}

/**
 * Generate hint cells with random selection
 * @param {number} gridSize - Grid size (e.g., 6 for 6x6)
 * @param {number} probability - Probability (0-1) that each cell shows its hint
 * @returns {Set<string>} Set of "row,col" strings for cells that should show hints
 */
export function generateHintCells(gridSize, probability = 0.3) {
  const hintCells = new Set();

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (Math.random() < probability) {
        hintCells.add(`${row},${col}`);
      }
    }
  }

  return hintCells;
}

/**
 * Build a map of which cells are turns based on player's drawn path
 * @param {Set<string>} playerDrawnCells - Set of "row,col" strings for drawn cells
 * @param {Map<string, Set<string>>} playerConnections - Map of cell connections
 * @returns {Map<string, boolean>} Map of "row,col" -> isTurn
 */
export function buildPlayerTurnMap(playerDrawnCells, playerConnections) {
  const turnMap = new Map();

  for (const cellKey of playerDrawnCells) {
    const connections = playerConnections.get(cellKey);

    // Only cells with exactly 2 connections can be turns
    if (!connections || connections.size !== 2) {
      turnMap.set(cellKey, false);
      continue;
    }

    // Get the two connected cells
    const connectedArray = Array.from(connections);
    const [r1, c1] = connectedArray[0].split(',').map(Number);
    const [r2, c2] = connectedArray[1].split(',').map(Number);

    // Check if it's a straight line (same row or same column)
    const isStraight = (r1 === r2) || (c1 === c2);
    turnMap.set(cellKey, !isStraight);
  }

  return turnMap;
}

/**
 * Render numbers in each cell showing count of turns in adjacent cells
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} gridSize - Grid size (e.g., 6 for 6x6)
 * @param {number} cellSize - Size of each cell in pixels
 * @param {Array<{row: number, col: number}>} solutionPath - The solution path
 * @param {Set<string>} hintCells - Set of cells that should show their hints (the 30% subset)
 * @param {string} hintMode - Display mode: 'none' | 'partial' | 'all'
 * @param {Set<string>} playerDrawnCells - Set of "row,col" strings for drawn cells
 * @param {Map<string, Set<string>>} playerConnections - Map of cell connections
 */
export function renderCellNumbers(ctx, gridSize, cellSize, solutionPath, hintCells, hintMode = 'partial', playerDrawnCells = new Set(), playerConnections = new Map()) {
  if (!solutionPath || solutionPath.length === 0) return;
  if (hintMode === 'none') return;

  // Build a map of which cells have turns in solution
  const solutionTurnMap = new Map();
  const pathLength = solutionPath.length;

  for (let i = 0; i < pathLength; i++) {
    const prev = solutionPath[(i - 1 + pathLength) % pathLength];
    const current = solutionPath[i];
    const next = solutionPath[(i + 1) % pathLength];

    // Check if this is a straight path (no turn)
    const isStraight =
      (prev.row === current.row && current.row === next.row) ||
      (prev.col === current.col && current.col === next.col);

    solutionTurnMap.set(`${current.row},${current.col}`, !isStraight);
  }

  // Build a map of which cells have turns in player's path
  const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);

  // Validation colors
  const VALID_COLOR = '#27AE60';   // Green
  const INVALID_COLOR = '#C0392B'; // Dark red
  const BORDER_WIDTH = 3;
  const BORDER_INSET = 2;

  // Set up text rendering
  ctx.font = `bold ${Math.floor(cellSize * 0.75)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cellKey = `${row},${col}`;
      const isInHintSet = hintCells.has(cellKey);

      // Determine if we should render this cell
      if (hintMode === 'partial' && !isInHintSet) continue;

      // Count turns in adjacent cells (including diagonals and self) for solution
      let expectedTurnCount = 0;
      let actualTurnCount = 0;
      const adjacents = [
        [row - 1, col - 1], // up-left
        [row - 1, col],     // up
        [row - 1, col + 1], // up-right
        [row, col - 1],     // left
        [row, col],         // self
        [row, col + 1],     // right
        [row + 1, col - 1], // down-left
        [row + 1, col],     // down
        [row + 1, col + 1]  // down-right
      ];

      for (const [adjRow, adjCol] of adjacents) {
        if (adjRow >= 0 && adjRow < gridSize && adjCol >= 0 && adjCol < gridSize) {
          const adjKey = `${adjRow},${adjCol}`;
          if (solutionTurnMap.get(adjKey)) {
            expectedTurnCount++;
          }
          if (playerTurnMap.get(adjKey)) {
            actualTurnCount++;
          }
        }
      }

      // Draw validation border around the entire validation area for hint cells
      if (isInHintSet) {
        const isValid = expectedTurnCount === actualTurnCount;
        ctx.strokeStyle = isValid ? VALID_COLOR : INVALID_COLOR;
        ctx.lineWidth = BORDER_WIDTH;

        // Calculate the bounding box of the validation area (3x3, or less at edges/corners)
        const minRow = Math.max(0, row - 1);
        const maxRow = Math.min(gridSize - 1, row + 1);
        const minCol = Math.max(0, col - 1);
        const maxCol = Math.min(gridSize - 1, col + 1);

        // Calculate border position and dimensions for the entire validation area
        const borderX = minCol * cellSize + BORDER_INSET + BORDER_WIDTH / 2;
        const borderY = minRow * cellSize + BORDER_INSET + BORDER_WIDTH / 2;
        const areaWidth = (maxCol - minCol + 1) * cellSize - 2 * BORDER_INSET - BORDER_WIDTH;
        const areaHeight = (maxRow - minRow + 1) * cellSize - 2 * BORDER_INSET - BORDER_WIDTH;

        ctx.strokeRect(borderX, borderY, areaWidth, areaHeight);
      }

      // Set text color based on whether cell is in the hint set
      if (isInHintSet) {
        ctx.fillStyle = '#2C3E50'; // Dark color for hint cells
      } else {
        ctx.fillStyle = '#C0C0C0'; // Light grey for extra cells in 'all' mode
      }

      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      ctx.fillText(expectedTurnCount.toString(), x, y);
    }
  }
}

/**
 * Render the player's drawn path
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Set<string>} drawnCells - Set of "row,col" strings for drawn cells
 * @param {Map<string, Set<string>>} connections - Map of cell connections
 * @param {number} cellSize - Size of each cell in pixels
 * @param {boolean} hasWon - Whether the player has won (uses green color)
 */
export function renderPlayerPath(ctx, drawnCells, connections, cellSize, hasWon = false) {
  if (!drawnCells || drawnCells.size === 0) return;

  const PLAYER_COLOR = hasWon ? '#27AE60' : '#E24A4A'; // Green when won, Red otherwise

  // Draw connections as lines
  const drawnConnections = new Set();

  for (const [cellKey, connectedCells] of connections) {
    const [row, col] = cellKey.split(',').map(Number);
    const x1 = col * cellSize + cellSize / 2;
    const y1 = row * cellSize + cellSize / 2;

    for (const connectedKey of connectedCells) {
      // Avoid drawing same connection twice
      const connectionId = [cellKey, connectedKey].sort().join('-');
      if (drawnConnections.has(connectionId)) continue;
      drawnConnections.add(connectionId);

      const [r2, c2] = connectedKey.split(',').map(Number);
      const x2 = c2 * cellSize + cellSize / 2;
      const y2 = r2 * cellSize + cellSize / 2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = PLAYER_COLOR;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  // Draw dots for cells with 0 connections
  for (const cellKey of drawnCells) {
    const connectionCount = connections.get(cellKey)?.size || 0;
    if (connectionCount === 0) {
      const [row, col] = cellKey.split(',').map(Number);
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLOR;
      ctx.fill();
    }
  }
}
