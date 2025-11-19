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
  ctx.fillStyle = '#4A90E2';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw circles at each cell center
  for (const cell of path) {
    const x = cell.col * cellSize + cellSize / 2;
    const y = cell.row * cellSize + cellSize / 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

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
 * Render numbers in each cell showing count of turns in adjacent cells
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} gridSize - Grid size (e.g., 6 for 6x6)
 * @param {number} cellSize - Size of each cell in pixels
 * @param {Array<{row: number, col: number}>} solutionPath - The solution path
 */
export function renderCellNumbers(ctx, gridSize, cellSize, solutionPath) {
  if (!solutionPath || solutionPath.length === 0) return;

  // Build a map of which cells have turns
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

  // Render the turn count for each cell
  ctx.fillStyle = '#2C3E50';
  ctx.font = `bold ${Math.floor(cellSize * 0.75)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // Count turns in adjacent cells
      let turnCount = 0;
      const adjacents = [
        [row - 1, col], // up
        [row + 1, col], // down
        [row, col - 1], // left
        [row, col + 1]  // right
      ];

      for (const [adjRow, adjCol] of adjacents) {
        if (adjRow >= 0 && adjRow < gridSize && adjCol >= 0 && adjCol < gridSize) {
          if (turnMap.get(`${adjRow},${adjCol}`)) {
            turnCount++;
          }
        }
      }

      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      ctx.fillText(turnCount.toString(), x, y);
    }
  }
}
