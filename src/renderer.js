/**
 * Canvas rendering module for the Loop puzzle game
 */

import { CONFIG } from './config.js';

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

  ctx.strokeStyle = CONFIG.COLORS.SOLUTION_PATH;
  ctx.lineWidth = CONFIG.RENDERING.PATH_LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw lines connecting the path with smooth corners
  if (path.length >= 2) {
    ctx.beginPath();

    // Corner radius for smooth curves
    const radius = cellSize * CONFIG.RENDERING.CORNER_RADIUS_FACTOR;

    // Convert path to pixel coordinates
    const points = path.map(cell => ({
      x: cell.col * cellSize + cellSize / 2,
      y: cell.row * cellSize + cellSize / 2
    }));

    // For a closed loop, calculate the proper starting point
    // Start on the line from the last point toward the first point
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

    // Draw path with smooth corners using arcTo
    // Arc around all points including the first point
    for (let i = 0; i < points.length; i++) {
      const cornerPoint = points[i];
      const nextPoint = points[(i + 1) % points.length];
      ctx.arcTo(cornerPoint.x, cornerPoint.y, nextPoint.x, nextPoint.y, radius);
    }

    // Close the path - now it should connect smoothly without overhang
    ctx.closePath();
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
 * Get the validation area bounds for a hint cell
 * @param {number} row - Row index of hint cell
 * @param {number} col - Column index of hint cell
 * @param {number} gridSize - Grid size
 * @returns {{minRow: number, maxRow: number, minCol: number, maxCol: number}} Validation area bounds
 */
function getValidationBounds(row, col, gridSize) {
  return {
    minRow: Math.max(0, row - 1),
    maxRow: Math.min(gridSize - 1, row + 1),
    minCol: Math.max(0, col - 1),
    maxCol: Math.min(gridSize - 1, col + 1)
  };
}

/**
 * Check if two rectangular bounds overlap
 * @param {{minRow: number, maxRow: number, minCol: number, maxCol: number}} bounds1 - First rectangle
 * @param {{minRow: number, maxRow: number, minCol: number, maxCol: number}} bounds2 - Second rectangle
 * @returns {boolean} True if rectangles overlap
 */
function rectanglesOverlap(bounds1, bounds2) {
  // Two rectangles overlap if they overlap on both axes
  const rowOverlap = bounds1.minRow <= bounds2.maxRow && bounds1.maxRow >= bounds2.minRow;
  const colOverlap = bounds1.minCol <= bounds2.maxCol && bounds1.maxCol >= bounds2.minCol;
  return rowOverlap && colOverlap;
}

/**
 * Calculate border layers for hint cells to prevent visual overlap
 * Uses greedy graph coloring: overlapping validation areas get different layers
 * @param {Set<string>} hintCells - Set of "row,col" strings for hint cells
 * @param {number} gridSize - Grid size
 * @returns {Map<string, number>} Map of cellKey -> layer number (0 = outermost)
 */
function calculateBorderLayers(hintCells, gridSize) {
  const hintArray = Array.from(hintCells);
  const layers = new Map();

  // Calculate validation bounds for all hint cells
  const boundsMap = new Map();
  for (const cellKey of hintArray) {
    const [row, col] = cellKey.split(',').map(Number);
    boundsMap.set(cellKey, getValidationBounds(row, col, gridSize));
  }

  // Greedy layer assignment
  for (const cellKey of hintArray) {
    const bounds = boundsMap.get(cellKey);

    // Find all overlapping hint cells that already have layers assigned
    const overlappingLayers = new Set();
    for (const [otherKey, layer] of layers) {
      const otherBounds = boundsMap.get(otherKey);
      if (rectanglesOverlap(bounds, otherBounds)) {
        overlappingLayers.add(layer);
      }
    }

    // Assign the lowest layer number that doesn't conflict with overlapping cells
    let assignedLayer = 0;
    while (overlappingLayers.has(assignedLayer)) {
      assignedLayer++;
    }
    layers.set(cellKey, assignedLayer);
  }

  return layers;
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
 * @param {string} borderMode - Border display mode: 'off' | 'center' | 'full'
 */
export function renderCellNumbers(ctx, gridSize, cellSize, solutionPath, hintCells, hintMode = 'partial', playerDrawnCells = new Set(), playerConnections = new Map(), borderMode = 'full') {
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

  // Assign a color to each hint cell
  const hintCellsArray = Array.from(hintCells);
  const hintColorMap = new Map();
  hintCellsArray.forEach((cellKey, index) => {
    hintColorMap.set(cellKey, CONFIG.COLORS.HINT_COLORS[index % CONFIG.COLORS.HINT_COLORS.length]);
  });

  // Calculate border layers for full mode (to prevent visual overlap)
  const borderLayers = borderMode === 'full' ? calculateBorderLayers(hintCells, gridSize) : new Map();

  // Array to collect border drawing information (deferred rendering)
  const bordersToDraw = [];

  // Set up text rendering
  ctx.font = `bold ${Math.floor(cellSize * CONFIG.HINT.FONT_SIZE_FACTOR)}px sans-serif`;
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

      // Collect border drawing information for hint cells (deferred rendering)
      if (isInHintSet && borderMode !== 'off') {
        const isValid = expectedTurnCount === actualTurnCount;
        const hintColor = isValid ? CONFIG.COLORS.HINT_VALIDATED : hintColorMap.get(cellKey);
        const borderWidth = CONFIG.BORDER.WIDTH;

        // Calculate the bounding box based on border mode
        let minRow, maxRow, minCol, maxCol;
        if (borderMode === 'center') {
          // Border around only the hint cell itself
          minRow = row;
          maxRow = row;
          minCol = col;
          maxCol = col;
        } else {
          // Border around the entire validation area (3x3, or less at edges/corners)
          minRow = Math.max(0, row - 1);
          maxRow = Math.min(gridSize - 1, row + 1);
          minCol = Math.max(0, col - 1);
          maxCol = Math.min(gridSize - 1, col + 1);
        }

        // Get layer for this hint cell (0 for center mode)
        const layer = borderMode === 'full' ? (borderLayers.get(cellKey) || 0) : 0;

        // Store border info for deferred rendering
        bordersToDraw.push({
          minRow,
          maxRow,
          minCol,
          maxCol,
          hintColor,
          borderWidth,
          layer
        });
      }

      // Set text color and opacity based on whether cell is in the hint set
      if (isInHintSet) {
        const isValid = expectedTurnCount === actualTurnCount;
        const hintColor = isValid ? CONFIG.COLORS.HINT_VALIDATED : hintColorMap.get(cellKey);
        ctx.fillStyle = hintColor;
        ctx.globalAlpha = 1.0;  // Always 100% opacity
      } else {
        ctx.fillStyle = CONFIG.COLORS.HINT_EXTRA; // Light grey for extra cells in 'all' mode
        ctx.globalAlpha = 1.0;
      }

      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      ctx.fillText(expectedTurnCount.toString(), x, y);
    }
  }

  // Draw all borders in layer order (highest layer first for proper visual stacking)
  // This ensures inner borders appear on top of outer borders
  bordersToDraw.sort((a, b) => b.layer - a.layer);

  for (const border of bordersToDraw) {
    const { minRow, maxRow, minCol, maxCol, hintColor, borderWidth, layer } = border;

    // Calculate layer-based inset (only for full mode)
    const layerInset = borderMode === 'full' ? (layer * CONFIG.BORDER.LAYER_OFFSET) : 0;
    const totalInset = CONFIG.BORDER.INSET + layerInset;

    // Calculate border position and dimensions with layer offset
    const borderX = minCol * cellSize + totalInset + borderWidth / 2;
    const borderY = minRow * cellSize + totalInset + borderWidth / 2;
    const areaWidth = (maxCol - minCol + 1) * cellSize - 2 * totalInset - borderWidth;
    const areaHeight = (maxRow - minRow + 1) * cellSize - 2 * totalInset - borderWidth;

    // Safety check: only draw if the calculated area is large enough
    if (areaWidth > 0 && areaHeight > 0) {
      ctx.strokeStyle = hintColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(borderX, borderY, areaWidth, areaHeight);
    }
  }
}

/**
 * Trace continuous path segments from connections map
 * @param {Map<string, Set<string>>} connections - Map of cell connections
 * @returns {Array<Array<string>>} Array of continuous path segments (each segment is array of cell keys)
 */
function tracePathSegments(connections) {
  const visited = new Set();
  const segments = [];

  for (const startCell of connections.keys()) {
    if (visited.has(startCell)) continue;

    // Start a new segment
    const segment = [];
    const queue = [startCell];

    while (queue.length > 0) {
      const currentCell = queue.shift();
      if (visited.has(currentCell)) continue;

      visited.add(currentCell);
      segment.push(currentCell);

      // Add connected cells to queue
      const connectedCells = connections.get(currentCell);
      if (connectedCells) {
        for (const connectedCell of connectedCells) {
          if (!visited.has(connectedCell)) {
            queue.push(connectedCell);
          }
        }
      }
    }

    if (segment.length > 0) {
      segments.push(segment);
    }
  }

  return segments;
}

/**
 * Draw a smooth path through a segment of cells
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<string>} segment - Array of cell keys forming a path
 * @param {Map<string, Set<string>>} connections - Map of cell connections
 * @param {number} cellSize - Size of each cell in pixels
 * @param {string} color - Stroke color
 */
function drawSmoothSegment(ctx, segment, connections, cellSize, color) {
  if (segment.length === 0) return;

  // Convert segment to ordered path by following connections
  const orderedPath = [];
  const visited = new Set();

  // Find a good starting point (prefer cells with 1 connection, otherwise any cell)
  let startCell = segment.find(cellKey => {
    const connCount = connections.get(cellKey)?.size || 0;
    return connCount === 1;
  }) || segment[0];

  // Trace the path from start
  let current = startCell;
  while (current && !visited.has(current)) {
    visited.add(current);
    orderedPath.push(current);

    // Find next unvisited connected cell
    const connectedCells = connections.get(current);
    if (connectedCells) {
      const nextCell = Array.from(connectedCells).find(cell => !visited.has(cell));
      current = nextCell;
    } else {
      break;
    }
  }

  // Check if this is a closed loop
  const isLoop = orderedPath.length > 2 &&
                 connections.get(orderedPath[0])?.has(orderedPath[orderedPath.length - 1]);

  // Draw smooth path
  if (orderedPath.length === 1) {
    // Single isolated cell - draw a dot
    const [row, col] = orderedPath[0].split(',').map(Number);
    const x = col * cellSize + cellSize / 2;
    const y = row * cellSize + cellSize / 2;
    ctx.beginPath();
    ctx.arc(x, y, CONFIG.RENDERING.DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  } else if (orderedPath.length === 2) {
    // Two cells - draw a simple line
    const [row1, col1] = orderedPath[0].split(',').map(Number);
    const [row2, col2] = orderedPath[1].split(',').map(Number);
    const x1 = col1 * cellSize + cellSize / 2;
    const y1 = row1 * cellSize + cellSize / 2;
    const x2 = col2 * cellSize + cellSize / 2;
    const y2 = row2 * cellSize + cellSize / 2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = CONFIG.RENDERING.PATH_LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else {
    // Three or more cells - use smooth curves
    const radius = cellSize * CONFIG.RENDERING.CORNER_RADIUS_FACTOR;

    // Convert to pixel coordinates
    const points = orderedPath.map(cellKey => {
      const [row, col] = cellKey.split(',').map(Number);
      return {
        x: col * cellSize + cellSize / 2,
        y: row * cellSize + cellSize / 2
      };
    });

    ctx.beginPath();

    if (isLoop) {
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

    ctx.strokeStyle = color;
    ctx.lineWidth = CONFIG.RENDERING.PATH_LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
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

  const PLAYER_COLOR = hasWon ? CONFIG.COLORS.PLAYER_PATH_WIN : CONFIG.COLORS.PLAYER_PATH;

  // Trace all continuous path segments
  const segments = tracePathSegments(connections);

  // Draw each segment with smooth curves
  for (const segment of segments) {
    drawSmoothSegment(ctx, segment, connections, cellSize, PLAYER_COLOR);
  }

  // Draw dots for cells with 0 connections
  for (const cellKey of drawnCells) {
    const connectionCount = connections.get(cellKey)?.size || 0;
    if (connectionCount === 0) {
      const [row, col] = cellKey.split(',').map(Number);
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;

      ctx.beginPath();
      ctx.arc(x, y, CONFIG.RENDERING.DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLOR;
      ctx.fill();
    }
  }
}
