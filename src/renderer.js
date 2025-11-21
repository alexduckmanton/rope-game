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

  // Border styling constants
  const BORDER_WIDTH = 3;
  const BORDER_INSET = 2;
  const LAYER_OFFSET = 6; // Additional inset per layer for concentric borders

  // Hint color palette - each hint gets a color in sequence
  const HINT_COLORS = [
    '#E09F7D', // Peachy orange
    '#ED8C6E', // Coral peach
    '#EF5D60', // Coral red
    '#EE4F64', // Red pink
    '#EC4067', // Pink magenta
    '#C72072', // Pink purple
    '#A01A7D', // Purple
    '#B54585'  // Light purple
  ];

  // Assign a color to each hint cell
  const hintCellsArray = Array.from(hintCells);
  const hintColorMap = new Map();
  hintCellsArray.forEach((cellKey, index) => {
    hintColorMap.set(cellKey, HINT_COLORS[index % HINT_COLORS.length]);
  });

  // Calculate border layers for full mode (to prevent visual overlap)
  const borderLayers = borderMode === 'full' ? calculateBorderLayers(hintCells, gridSize) : new Map();

  // Array to collect border drawing information (deferred rendering)
  const bordersToDraw = [];

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

      // Collect border drawing information for hint cells (deferred rendering)
      if (isInHintSet && borderMode !== 'off') {
        const isValid = expectedTurnCount === actualTurnCount;
        const hintColor = isValid ? '#ACF39D' : hintColorMap.get(cellKey);
        const borderWidth = BORDER_WIDTH;  // Always 3px thick

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
        const hintColor = isValid ? '#ACF39D' : hintColorMap.get(cellKey);
        ctx.fillStyle = hintColor;
        ctx.globalAlpha = 1.0;  // Always 100% opacity
      } else {
        ctx.fillStyle = '#C0C0C0'; // Light grey for extra cells in 'all' mode
        ctx.globalAlpha = 1.0;
      }

      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      ctx.fillText(expectedTurnCount.toString(), x, y);

      // Reset globalAlpha for next iteration
      ctx.globalAlpha = 1.0;
    }
  }

  // Draw all borders in layer order (highest layer first for proper visual stacking)
  // This ensures inner borders appear on top of outer borders
  bordersToDraw.sort((a, b) => b.layer - a.layer);

  for (const border of bordersToDraw) {
    const { minRow, maxRow, minCol, maxCol, hintColor, borderWidth, layer } = border;

    // Calculate layer-based inset (only for full mode)
    const layerInset = borderMode === 'full' ? (layer * LAYER_OFFSET) : 0;
    const totalInset = BORDER_INSET + layerInset;

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
 * Identify corner cells (cells with 2 non-aligned connections)
 * @param {Map<string, Set<string>>} connections - Map of cell connections
 * @returns {Set<string>} Set of corner cell keys
 */
function identifyCorners(connections) {
  const corners = new Set();

  for (const [cellKey, connectedCells] of connections) {
    if (connectedCells.size === 2) {
      const [conn1, conn2] = Array.from(connectedCells);
      const [r, c] = cellKey.split(',').map(Number);
      const [r1, c1] = conn1.split(',').map(Number);
      const [r2, c2] = conn2.split(',').map(Number);

      // Check if connections are aligned (straight line through cell)
      const aligned = (r1 === r && r2 === r) || (c1 === c && c2 === c);

      if (!aligned) {
        corners.add(cellKey);
      }
    }
  }

  return corners;
}

/**
 * Reconstruct ordered path sequences from connection graph
 * @param {Map<string, Set<string>>} connections - Map of cell connections
 * @returns {Array<Array<string>>} Array of paths (each path is array of cell keys)
 */
function reconstructPaths(connections) {
  if (connections.size === 0) return [];

  const visited = new Set();
  const paths = [];

  for (const startCell of connections.keys()) {
    if (visited.has(startCell)) continue;

    const path = [startCell];
    visited.add(startCell);

    let current = startCell;
    let previous = null;

    // Follow the path
    while (true) {
      const neighbors = connections.get(current);
      if (!neighbors) break;

      // Find next cell (not the one we came from)
      let next = null;
      for (const neighbor of neighbors) {
        if (neighbor !== previous) {
          next = neighbor;
          break;
        }
      }

      // Check if we've completed a loop or reached the end
      if (!next || next === startCell || visited.has(next)) {
        break;
      }

      path.push(next);
      visited.add(next);
      previous = current;
      current = next;
    }

    paths.push(path);
  }

  return paths;
}

/**
 * Draw a wiggled segment between two points
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x1 - Start x coordinate
 * @param {number} y1 - Start y coordinate
 * @param {number} x2 - End x coordinate
 * @param {number} y2 - End y coordinate
 * @param {number} amplitude - Wiggle amplitude
 * @param {number} frequency - Wiggle frequency (wavelengths per segment)
 * @param {number} samples - Number of sample points
 * @param {boolean} isFirst - Whether this is the first segment (use moveTo)
 */
function drawWiggledSegment(ctx, x1, y1, x2, y2, amplitude, frequency, samples, isFirst) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 0.1) return; // Skip very short segments

  const dirX = dx / distance;
  const dirY = dy / distance;
  const perpX = -dirY;
  const perpY = dirX;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const baseX = x1 + dx * t;
    const baseY = y1 + dy * t;
    const offset = amplitude * Math.sin(frequency * 2 * Math.PI * t);
    const x = baseX + perpX * offset;
    const y = baseY + perpY * offset;

    if (isFirst && i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
}

/**
 * Render the player's drawn path with smooth corners
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Set<string>} drawnCells - Set of "row,col" strings for drawn cells
 * @param {Map<string, Set<string>>} connections - Map of cell connections
 * @param {number} cellSize - Size of each cell in pixels
 * @param {boolean} hasWon - Whether the player has won (uses green color)
 */
export function renderPlayerPath(ctx, drawnCells, connections, cellSize, hasWon = false) {
  if (!drawnCells || drawnCells.size === 0) return;

  const PLAYER_COLOR = hasWon ? '#ACF39D' : '#000000';
  const WIGGLE_AMPLITUDE = 3.5;
  const WIGGLE_FREQUENCY = 2;
  const SAMPLES = 16;
  const CORNER_SHORTEN = 0.35; // Shorten segments by 35% at corners for smooth Bezier curves

  // Identify corners
  const corners = identifyCorners(connections);

  // Reconstruct ordered paths
  const paths = reconstructPaths(connections);

  // Track which connections have been drawn to handle branching paths
  const drawnConnections = new Set();

  // Draw each path
  for (const path of paths) {
    if (path.length === 0) continue;

    // Skip single-cell paths (they're artifacts of branching, connections will be drawn below)
    if (path.length === 1) continue;

    // Detect if this is a closed loop
    const isClosedLoop = path.length > 2 && connections.get(path[path.length - 1])?.has(path[0]);

    ctx.beginPath();
    ctx.strokeStyle = PLAYER_COLOR;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw path with smooth corners
    for (let i = 0; i < path.length; i++) {
      const current = path[i];
      const next = path[(i + 1) % path.length];

      // Skip if this is the last cell and path is not a loop
      if (i === path.length - 1 && !isClosedLoop) {
        break;
      }

      // Mark this connection as drawn
      const connectionId = [current, next].sort().join('-');
      drawnConnections.add(connectionId);

      const [r1, c1] = current.split(',').map(Number);
      const [r2, c2] = next.split(',').map(Number);

      let x1 = c1 * cellSize + cellSize / 2;
      let y1 = r1 * cellSize + cellSize / 2;
      let x2 = c2 * cellSize + cellSize / 2;
      let y2 = r2 * cellSize + cellSize / 2;

      const currentIsCorner = corners.has(current);
      const nextIsCorner = corners.has(next);

      // Calculate segment direction
      const dx = x2 - x1;
      const dy = y2 - y1;

      // Check if we'll actually draw a Bezier curve at the current corner
      let willDrawBezierAtCurrent = false;
      if (currentIsCorner && (i > 0 || isClosedLoop)) {
        const previous = path[(i - 1 + path.length) % path.length];
        const prevConnections = connections.get(current);
        willDrawBezierAtCurrent = prevConnections && prevConnections.has(previous) && prevConnections.has(next);
      }

      // Check if we'll actually draw a Bezier curve at the next corner
      let willDrawBezierAtNext = false;
      if (nextIsCorner && (i < path.length - 1 || isClosedLoop)) {
        const following = path[(i + 2) % path.length];
        const nextConnections = connections.get(next);
        willDrawBezierAtNext = nextConnections && nextConnections.has(current) && nextConnections.has(following);
      }

      // Only shorten segment endpoints if Bezier curves will connect them
      if (willDrawBezierAtCurrent) {
        x1 = x1 + dx * CORNER_SHORTEN;
        y1 = y1 + dy * CORNER_SHORTEN;
      }

      if (willDrawBezierAtNext) {
        x2 = x2 - dx * CORNER_SHORTEN;
        y2 = y2 - dy * CORNER_SHORTEN;
      }

      // Draw wiggled segment
      const isFirst = (i === 0);
      drawWiggledSegment(ctx, x1, y1, x2, y2, WIGGLE_AMPLITUDE, WIGGLE_FREQUENCY, SAMPLES, isFirst);

      // If next cell is a corner and we verified the Bezier can be drawn, draw it
      if (willDrawBezierAtNext) {
        const following = path[(i + 2) % path.length];
        const [r3, c3] = following.split(',').map(Number);

        let x3 = c3 * cellSize + cellSize / 2;
        let y3 = r3 * cellSize + cellSize / 2;

        const dx2 = x3 - (c2 * cellSize + cellSize / 2);
        const dy2 = y3 - (r2 * cellSize + cellSize / 2);

        const x3_start = (c2 * cellSize + cellSize / 2) + dx2 * CORNER_SHORTEN;
        const y3_start = (r2 * cellSize + cellSize / 2) + dy2 * CORNER_SHORTEN;

        // Control point at corner center
        const cx = c2 * cellSize + cellSize / 2;
        const cy = r2 * cellSize + cellSize / 2;

        // Draw quadratic Bezier curve
        ctx.quadraticCurveTo(cx, cy, x3_start, y3_start);
      }
    }

    ctx.stroke();
  }

  // Draw any remaining connections that weren't part of reconstructed paths
  // (This handles branching connections that were skipped during path reconstruction)
  ctx.strokeStyle = PLAYER_COLOR;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const [cellKey, connectedCells] of connections) {
    for (const connectedKey of connectedCells) {
      const connectionId = [cellKey, connectedKey].sort().join('-');
      if (drawnConnections.has(connectionId)) continue;
      drawnConnections.add(connectionId);

      const [r1, c1] = cellKey.split(',').map(Number);
      const [r2, c2] = connectedKey.split(',').map(Number);

      const x1 = c1 * cellSize + cellSize / 2;
      const y1 = r1 * cellSize + cellSize / 2;
      const x2 = c2 * cellSize + cellSize / 2;
      const y2 = r2 * cellSize + cellSize / 2;

      // Draw simple wiggled segment for orphaned connections
      ctx.beginPath();
      drawWiggledSegment(ctx, x1, y1, x2, y2, WIGGLE_AMPLITUDE, WIGGLE_FREQUENCY, SAMPLES, true);
      ctx.stroke();
    }
  }

  // Draw dots for isolated cells
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
