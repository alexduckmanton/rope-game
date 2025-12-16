/**
 * Canvas rendering module for the Loop puzzle game
 */

import { CONFIG } from './config.js';
import { drawSmoothCurve, buildSolutionTurnMap, countTurnsInArea, parseCellKey, createCellKey } from './utils.js';

/**
 * Animation state for number scaling animations
 * Tracks active animations and previous state for change detection
 */
const numberAnimationState = {
  activeAnimations: new Map(), // Map<cellKey, { startTime: number }>
  previousState: new Map(),    // Map<cellKey, { displayValue: number, color: string }>
};

/**
 * Elastic easing function (ease out)
 * Creates a smooth, springy motion with gentle oscillation
 * @param {number} t - Progress from 0 to 1
 * @returns {number} Eased value from 0 to 1
 */
function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;

  if (t === 0) {
    return 0;
  } else if (t === 1) {
    return 1;
  } else {
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
}

/**
 * Calculate the current animation scale for a cell
 * @param {string} cellKey - The cell key to check
 * @param {number} currentTime - Current timestamp in milliseconds
 * @returns {number} Scale factor (1.0 to 1.5)
 */
function getAnimationScale(cellKey, currentTime) {
  const animation = numberAnimationState.activeAnimations.get(cellKey);
  if (!animation) return 1.0;

  const elapsed = currentTime - animation.startTime;
  const duration = 500; // 500ms total animation time

  if (elapsed >= duration) {
    // Animation complete - clean up and return normal scale
    numberAnimationState.activeAnimations.delete(cellKey);
    return 1.0;
  }

  // Calculate scale with elastic easing
  // Starts at 1.5x (snap), animates to 1.0x (normal) with springy motion
  const progress = elapsed / duration; // 0 to 1
  const easedProgress = easeOutElastic(progress); // 0 to 1 with elastic spring
  const scale = 1.5 - (easedProgress * 0.5); // 1.5 to 1.0

  return scale;
}

/**
 * Reset all number animation state
 * Call this when changing puzzles or cleaning up the game view
 */
export function resetNumberAnimationState() {
  numberAnimationState.activeAnimations.clear();
  numberAnimationState.previousState.clear();
}

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
    // Corner radius for smooth curves
    const radius = cellSize * CONFIG.RENDERING.CORNER_RADIUS_FACTOR;

    // Convert path to pixel coordinates
    const points = path.map(cell => ({
      x: cell.col * cellSize + cellSize / 2,
      y: cell.row * cellSize + cellSize / 2
    }));

    // Draw smooth curve (solution paths are always closed loops)
    ctx.beginPath();
    drawSmoothCurve(ctx, points, radius, true);
    ctx.stroke();
  }
}

/**
 * Generate hint cells with random selection
 * @param {number} gridSize - Grid size (e.g., 6 for 6x6)
 * @param {number} probability - Probability (0-1) that each cell shows its hint
 * @param {function(): number} randomFn - Optional random function (defaults to Math.random)
 * @param {number|null} maxHints - Optional maximum number of hints (null for unlimited)
 * @returns {Set<string>} Set of "row,col" strings for cells that should show hints
 */
export function generateHintCells(gridSize, probability = 0.3, randomFn = Math.random, maxHints = null) {
  const hintCells = new Set();

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (randomFn() < probability) {
        hintCells.add(createCellKey(row, col));
        // Early return if we've reached the max hint limit
        if (maxHints !== null && hintCells.size >= maxHints) {
          return hintCells;
        }
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
    const { row: r1, col: c1 } = parseCellKey(connectedArray[0]);
    const { row: r2, col: c2 } = parseCellKey(connectedArray[1]);

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
 * Draw collected hint borders with proper layering
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} bordersToDraw - Array of border info objects
 * @param {number} cellSize - Size of each cell in pixels
 * @param {string} borderMode - Border display mode ('off' | 'center' | 'full')
 */
function drawHintBorders(ctx, bordersToDraw, cellSize, borderMode) {
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
 * Calculate border layers for hint cells to prevent visual overlap
 * Uses greedy graph coloring: overlapping validation areas get different layers
 * @param {Set<string>} hintCells - Set of "row,col" strings for hint cells
 * @param {number} gridSize - Grid size
 * @returns {Map<string, number>} Map of cellKey -> layer number (0 = outermost)
 */
export function calculateBorderLayers(hintCells, gridSize) {
  const hintArray = Array.from(hintCells);
  const layers = new Map();

  // Calculate validation bounds for all hint cells
  const boundsMap = new Map();
  for (const cellKey of hintArray) {
    const { row, col } = parseCellKey(cellKey);
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
 * Render pulsing backgrounds for hint validation areas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} gridSize - Grid size (e.g., 4 for 4x4)
 * @param {number} cellSize - Size of each cell in pixels
 * @param {Array<{row: number, col: number}>} solutionPath - The solution path
 * @param {Set<string>} hintCells - Set of cells that have hints
 * @param {number} animationTime - Current animation time in milliseconds
 * @param {Set<string>} playerDrawnCells - Set of "row,col" strings for drawn cells
 * @param {Map<string, Set<string>>} playerConnections - Map of cell connections
 * @param {boolean} countdown - Whether to show remaining (true) or total required (false) corners
 * @param {Map<string, boolean>} [prebuiltSolutionTurnMap] - Optional pre-built solution turn map for performance
 * @param {Map<string, boolean>} [prebuiltPlayerTurnMap] - Optional pre-built player turn map for performance
 */
export function renderHintPulse(ctx, gridSize, cellSize, solutionPath, hintCells, animationTime, playerDrawnCells = new Set(), playerConnections = new Map(), countdown = true, prebuiltSolutionTurnMap = null, prebuiltPlayerTurnMap = null) {
  if (!hintCells || hintCells.size === 0) return;

  // Use pre-built maps if provided, otherwise build them
  const solutionTurnMap = prebuiltSolutionTurnMap || buildSolutionTurnMap(solutionPath);
  const playerTurnMap = prebuiltPlayerTurnMap || buildPlayerTurnMap(playerDrawnCells, playerConnections);

  // Calculate pulse opacity using sine wave
  // Goes from 0 to max opacity over PULSE_DURATION ms
  const cycle = (animationTime % CONFIG.HINT.PULSE_DURATION) / CONFIG.HINT.PULSE_DURATION;
  const opacity = Math.abs(Math.sin(cycle * Math.PI)) * CONFIG.HINT.PULSE_MAX_OPACITY;

  // Save context state
  ctx.save();

  // Render pulsing background for each hint's validation area
  for (const cellKey of hintCells) {
    const { row, col } = parseCellKey(cellKey);

    // Check if this hint is validated (same logic as renderCellNumbers)
    const expectedTurnCount = countTurnsInArea(row, col, gridSize, solutionTurnMap);
    const actualTurnCount = countTurnsInArea(row, col, gridSize, playerTurnMap);
    const remainingTurns = expectedTurnCount - actualTurnCount;
    const isValid = remainingTurns === 0;

    // Determine display value based on countdown mode
    const displayValue = countdown ? remainingTurns : expectedTurnCount;

    // Get color for pulsing background: green if validated, blue otherwise
    const hintColor = isValid ? CONFIG.COLORS.HINT_VALIDATED : CONFIG.COLORS.SOLUTION_PATH;

    // Calculate validation area (3x3 around hint, bounded by grid)
    const minRow = Math.max(0, row - 1);
    const maxRow = Math.min(gridSize - 1, row + 1);
    const minCol = Math.max(0, col - 1);
    const maxCol = Math.min(gridSize - 1, col + 1);

    // Calculate rectangle dimensions
    const x = minCol * cellSize;
    const y = minRow * cellSize;
    const width = (maxCol - minCol + 1) * cellSize;
    const height = (maxRow - minRow + 1) * cellSize;

    // Draw pulsing background
    ctx.globalAlpha = opacity;
    ctx.fillStyle = hintColor;
    ctx.fillRect(x, y, width, height);
  }

  // Restore context state
  ctx.restore();
}

/**
 * Get color for a hint cell based on its magnitude (distance from zero)
 * @param {number} value - The turn count value for this hint
 * @param {boolean} isValidated - Whether the hint has been validated by the player
 * @returns {string} Hex color code
 */
function getColorByMagnitude(value, isValidated) {
  // Validated hints are always green
  if (isValidated) {
    return CONFIG.COLORS.HINT_VALIDATED;
  }

  // Zero is always green (special case - no turns in area)
  if (value === 0) {
    return CONFIG.COLORS.HINT_VALIDATED;
  }

  // For non-zero values, use magnitude (absolute value) to determine color
  const magnitude = Math.abs(value);

  // Clamp magnitude to valid range (1-9)
  // If somehow we get a value outside this range, use closest valid color
  const clampedMagnitude = Math.max(1, Math.min(9, magnitude));

  // Return color from palette (magnitude 1 = index 0, magnitude 9 = index 8)
  return CONFIG.COLORS.HINT_COLORS[clampedMagnitude - 1];
}

/**
 * Render numbers in each cell showing count of turns in adjacent cells
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} gridSize - Grid size (e.g., 6 for 6x6)
 * @param {number} cellSize - Size of each cell in pixels
 * @param {Array<{row: number, col: number}>} solutionPath - The solution path
 * @param {Set<string>} hintCells - Set of cells that should show their hints (the 30% subset)
 * @param {string} hintMode - Display mode: 'partial' | 'all'
 * @param {Set<string>} playerDrawnCells - Set of "row,col" strings for drawn cells
 * @param {Map<string, Set<string>>} playerConnections - Map of cell connections
 * @param {string} borderMode - Border display mode: 'off' | 'center' | 'full'
 * @param {boolean} countdown - Whether to show remaining (true) or total required (false) corners
 * @param {Map<string, boolean>} [prebuiltSolutionTurnMap] - Optional pre-built solution turn map for performance
 * @param {Map<string, boolean>} [prebuiltPlayerTurnMap] - Optional pre-built player turn map for performance
 * @param {Map<string, number>} [prebuiltBorderLayers] - Optional pre-built border layers for performance
 * @param {string} [animationMode] - Animation mode: 'auto' (detect changes and animate) or 'none' (no animation)
 * @returns {{hasActiveAnimations: boolean}} Object indicating if there are active animations
 */
export function renderCellNumbers(ctx, gridSize, cellSize, solutionPath, hintCells, hintMode = 'partial', playerDrawnCells = new Set(), playerConnections = new Map(), borderMode = 'full', countdown = true, prebuiltSolutionTurnMap = null, prebuiltPlayerTurnMap = null, prebuiltBorderLayers = null, animationMode = 'auto') {
  if (!solutionPath || solutionPath.length === 0) {
    return { hasActiveAnimations: false };
  }

  const currentTime = Date.now();

  // Use pre-built maps if provided, otherwise build them
  const solutionTurnMap = prebuiltSolutionTurnMap || buildSolutionTurnMap(solutionPath);
  const playerTurnMap = prebuiltPlayerTurnMap || buildPlayerTurnMap(playerDrawnCells, playerConnections);

  // Use pre-built border layers if provided, otherwise calculate
  const borderLayers = borderMode === 'full'
    ? (prebuiltBorderLayers || calculateBorderLayers(hintCells, gridSize))
    : new Map();

  // Array to collect border drawing information (deferred rendering)
  const bordersToDraw = [];

  // Set up text rendering
  ctx.font = `bold ${Math.floor(cellSize * CONFIG.HINT.FONT_SIZE_FACTOR)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cellKey = createCellKey(row, col);
      const isInHintSet = hintCells.has(cellKey);

      // Determine if we should render this cell
      if (hintMode === 'partial' && !isInHintSet) continue;

      // Count turns in adjacent cells (including diagonals and self)
      const expectedTurnCount = countTurnsInArea(row, col, gridSize, solutionTurnMap);
      const actualTurnCount = countTurnsInArea(row, col, gridSize, playerTurnMap);

      // Calculate remaining corners needed (negative if too many drawn)
      const remainingTurns = expectedTurnCount - actualTurnCount;
      const isValid = remainingTurns === 0;

      // Determine display value based on countdown mode
      const displayValue = countdown ? remainingTurns : expectedTurnCount;

      // Determine color for this cell
      let hintColor;
      if (isInHintSet) {
        hintColor = getColorByMagnitude(displayValue, isValid);
      } else {
        hintColor = CONFIG.COLORS.HINT_EXTRA; // Light grey for extra cells in 'all' mode
      }

      // Collect border drawing information for hint cells (deferred rendering)
      if (isInHintSet && borderMode !== 'off') {
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

      // Animation handling (only for hint cells)
      let scale = 1.0;
      if (isInHintSet) {
        const currentState = { displayValue, color: hintColor };
        const previousState = numberAnimationState.previousState.get(cellKey);

        if (animationMode === 'auto') {
          // Trigger animation if:
          // 1. First time seeing this cell (no previousState), OR
          // 2. Value changed, OR
          // 3. Color changed (validation state changed)
          if (!previousState ||
              previousState.displayValue !== displayValue ||
              previousState.color !== hintColor) {
            numberAnimationState.activeAnimations.set(cellKey, { startTime: currentTime });
          }
        }

        // Always update previousState to track current state
        numberAnimationState.previousState.set(cellKey, currentState);

        // Get current animation scale
        scale = getAnimationScale(cellKey, currentTime);
      }

      // Set text color and opacity
      ctx.fillStyle = hintColor;
      ctx.globalAlpha = 1.0;

      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;

      // Apply scale transform if animating
      if (scale !== 1.0) {
        ctx.save();
        ctx.translate(x, y);        // Move origin to cell center
        ctx.scale(scale, scale);    // Scale around center
        ctx.fillText(displayValue.toString(), 0, 0); // Draw at origin (cell center)
        ctx.restore();
      } else {
        ctx.fillText(displayValue.toString(), x, y);
      }
    }
  }

  // Draw all collected borders with proper layering
  drawHintBorders(ctx, bordersToDraw, cellSize, borderMode);

  // Return whether there are active animations
  return { hasActiveAnimations: numberAnimationState.activeAnimations.size > 0 };
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
    const { row, col } = parseCellKey(orderedPath[0]);
    const x = col * cellSize + cellSize / 2;
    const y = row * cellSize + cellSize / 2;
    ctx.beginPath();
    ctx.arc(x, y, CONFIG.RENDERING.DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  } else if (orderedPath.length === 2) {
    // Two cells - draw a simple line
    const { row: row1, col: col1 } = parseCellKey(orderedPath[0]);
    const { row: row2, col: col2 } = parseCellKey(orderedPath[1]);
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
      const { row, col } = parseCellKey(cellKey);
      return {
        x: col * cellSize + cellSize / 2,
        y: row * cellSize + cellSize / 2
      };
    });

    // Draw smooth curve through points
    ctx.beginPath();
    drawSmoothCurve(ctx, points, radius, isLoop);
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
      const { row, col } = parseCellKey(cellKey);
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;

      ctx.beginPath();
      ctx.arc(x, y, CONFIG.RENDERING.DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLOR;
      ctx.fill();
    }
  }
}
