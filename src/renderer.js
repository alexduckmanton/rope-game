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
 * Animation timing constants (pre-calculated for performance)
 */
const ANIMATION_DURATION = 400; // Total animation time in milliseconds
const SCALE_UP_PHASE = 0.15; // First 15% is scale-up
const SCALE_UP_DURATION = ANIMATION_DURATION * SCALE_UP_PHASE; // 60ms
const SCALE_DOWN_DURATION = ANIMATION_DURATION - SCALE_UP_DURATION; // 340ms
const SCALE_DOWN_PHASE_DIVISOR = 1 / SCALE_DOWN_DURATION; // Pre-calc for phase 2 (1/340 ≈ 0.00294)

/**
 * Animation scale constants
 */
const MAX_SCALE = 1.4; // Peak scale (40% larger)
const SCALE_RANGE = MAX_SCALE - 1.0; // 0.4

/**
 * Back easing constants (pre-calculated for performance)
 */
const BACK_C1 = 2.70158;
const BACK_C3 = BACK_C1 + 1;

/**
 * Back easing function (ease out) - optimized version
 * Creates a single overshoot and settle motion
 * @param {number} t - Progress from 0 to 1
 * @returns {number} Eased value from 0 to 1 (with overshoot past 1)
 */
function easeOutBack(t) {
  // Optimized: manual multiplication instead of Math.pow
  const t1 = t - 1;
  const t1Squared = t1 * t1;
  const t1Cubed = t1Squared * t1;
  return 1 + BACK_C3 * t1Cubed + BACK_C1 * t1Squared;
}

/**
 * Calculate the current animation scale for a cell
 * @param {string} cellKey - The cell key to check
 * @param {number} currentTime - Current timestamp in milliseconds
 * @returns {number} Scale factor (1.0 to 1.4)
 */
function getAnimationScale(cellKey, currentTime) {
  const animation = numberAnimationState.activeAnimations.get(cellKey);
  if (!animation) return 1.0;

  const elapsed = currentTime - animation.startTime;

  if (elapsed >= ANIMATION_DURATION) {
    // Animation complete - clean up and return normal scale
    numberAnimationState.activeAnimations.delete(cellKey);
    return 1.0;
  }

  // Phase 1: Quick scale up (first 60ms)
  if (elapsed < SCALE_UP_DURATION) {
    const scaleUpProgress = elapsed / SCALE_UP_DURATION; // 0 to 1
    // Cubic ease-out: optimized with manual multiplication
    const inverse = 1 - scaleUpProgress;
    const inverseCubed = inverse * inverse * inverse;
    const eased = 1 - inverseCubed;
    return 1.0 + (eased * SCALE_RANGE);
  }

  // Phase 2: Back ease with overshoot (remaining 340ms)
  const settleElapsed = elapsed - SCALE_UP_DURATION;
  const settleProgress = settleElapsed * SCALE_DOWN_PHASE_DIVISOR; // Optimized division
  const easedProgress = easeOutBack(settleProgress);
  return MAX_SCALE - (easedProgress * SCALE_RANGE);
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
 * Path animation state for smooth path drawing animations
 * Tracks cells that are currently animating as they're added to the path
 */
const pathAnimationState = {
  animatingCells: new Map(),     // Map<cellKey, { startTime: number, predecessorKey: string }>
  previousDrawnCells: new Set(), // Set<cellKey> from previous render
};

/**
 * Path animation timing constants
 */
const PATH_ANIMATION_DURATION = 100; // 100ms for smooth, responsive feel

/**
 * Cubic ease-out function for path animations
 * Creates smooth deceleration without overshoot
 * @param {number} t - Progress from 0 to 1
 * @returns {number} Eased value from 0 to 1
 */
function easeOutCubic(t) {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

/**
 * Get the animated position for a cell if it's currently animating
 * @param {string} cellKey - The cell key to check
 * @param {number} cellSize - Size of each cell in pixels
 * @param {number} currentTime - Current timestamp in milliseconds
 * @returns {{x: number, y: number} | null} Interpolated position or null if not animating
 */
function getAnimatedCellPosition(cellKey, cellSize, currentTime) {
  const animation = pathAnimationState.animatingCells.get(cellKey);
  if (!animation) return null;

  const elapsed = currentTime - animation.startTime;

  if (elapsed >= PATH_ANIMATION_DURATION) {
    // Animation complete - clean up and return null
    pathAnimationState.animatingCells.delete(cellKey);
    return null;
  }

  // Calculate eased progress
  const progress = easeOutCubic(elapsed / PATH_ANIMATION_DURATION);

  // Get target position (final position)
  const { row, col } = parseCellKey(cellKey);
  const targetX = col * cellSize + cellSize / 2;
  const targetY = row * cellSize + cellSize / 2;

  // If no predecessor, cell appears at its final position (shouldn't happen often)
  if (!animation.predecessorKey) {
    return { x: targetX, y: targetY };
  }

  // Get start position (predecessor's position)
  const { row: predRow, col: predCol } = parseCellKey(animation.predecessorKey);
  const startX = predCol * cellSize + cellSize / 2;
  const startY = predRow * cellSize + cellSize / 2;

  // Interpolate from predecessor to target
  return {
    x: startX + (targetX - startX) * progress,
    y: startY + (targetY - startY) * progress,
  };
}

/**
 * Reset all path animation state
 * Call this when changing puzzles or cleaning up the game view
 */
export function resetPathAnimationState() {
  pathAnimationState.animatingCells.clear();
  pathAnimationState.previousDrawnCells.clear();
}

/**
 * NUCLEAR RESET: Recreate animation state objects entirely
 * This guarantees fresh object allocation with no hidden state
 * Call at the START of view initialization to ensure complete isolation
 */
export function recreateAnimationState() {
  // Recreate path animation state objects
  pathAnimationState.animatingCells = new Map();
  pathAnimationState.previousDrawnCells = new Set();

  // Recreate number animation state objects
  numberAnimationState.activeAnimations = new Map();
  numberAnimationState.previousState = new Map();
}

/**
 * Render the grid lines
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} size - Grid size (e.g., 5 for 5x5)
 * @param {number} cellSize - Size of each cell in pixels
 */
export function renderGrid(ctx, size, cellSize) {
  ctx.strokeStyle = CONFIG.COLORS.GRID_LINE;
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
        const previousState = numberAnimationState.previousState.get(cellKey);

        // Check if state changed (avoid creating objects when unchanged)
        const hasChanged = !previousState ||
                           previousState.displayValue !== displayValue ||
                           previousState.color !== hintColor;

        if (hasChanged) {
          // Trigger animation only in auto mode
          if (animationMode === 'auto') {
            numberAnimationState.activeAnimations.set(cellKey, { startTime: currentTime });
          }
          // Only create and store new state object when it actually changed
          numberAnimationState.previousState.set(cellKey, { displayValue, color: hintColor });
        }

        // Get current animation scale (if any animation is active)
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
function drawSmoothSegment(ctx, segment, connections, cellSize, color, currentTime = null) {
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
    // Single isolated cell - draw a dot (with animation if applicable)
    const animatedPos = currentTime !== null
      ? getAnimatedCellPosition(orderedPath[0], cellSize, currentTime)
      : null;

    if (animatedPos) {
      ctx.beginPath();
      ctx.arc(animatedPos.x, animatedPos.y, CONFIG.RENDERING.DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      const { row, col } = parseCellKey(orderedPath[0]);
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      ctx.beginPath();
      ctx.arc(x, y, CONFIG.RENDERING.DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  } else if (orderedPath.length === 2) {
    // Two cells - draw a simple line (with animation if applicable)
    const animatedPos1 = currentTime !== null
      ? getAnimatedCellPosition(orderedPath[0], cellSize, currentTime)
      : null;
    const animatedPos2 = currentTime !== null
      ? getAnimatedCellPosition(orderedPath[1], cellSize, currentTime)
      : null;

    const { row: row1, col: col1 } = parseCellKey(orderedPath[0]);
    const { row: row2, col: col2 } = parseCellKey(orderedPath[1]);
    const x1 = animatedPos1?.x ?? (col1 * cellSize + cellSize / 2);
    const y1 = animatedPos1?.y ?? (row1 * cellSize + cellSize / 2);
    const x2 = animatedPos2?.x ?? (col2 * cellSize + cellSize / 2);
    const y2 = animatedPos2?.y ?? (row2 * cellSize + cellSize / 2);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = CONFIG.RENDERING.PATH_LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else {
    // Three or more cells - use smooth curves (with animation if applicable)
    const radius = cellSize * CONFIG.RENDERING.CORNER_RADIUS_FACTOR;

    // Convert to pixel coordinates, using animated positions when available
    const points = orderedPath.map(cellKey => {
      if (currentTime !== null) {
        const animatedPos = getAnimatedCellPosition(cellKey, cellSize, currentTime);
        if (animatedPos) return animatedPos;
      }

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
 * Render the player's drawn path with smooth drawing animations
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Set<string>} drawnCells - Set of "row,col" strings for drawn cells
 * @param {Map<string, Set<string>>} connections - Map of cell connections
 * @param {number} cellSize - Size of each cell in pixels
 * @param {boolean} hasWon - Whether the player has won (uses green color)
 * @param {string} animationMode - 'auto' to enable animations, 'none' to disable
 * @returns {{hasActiveAnimations: boolean}} Animation status for requestAnimationFrame
 */
export function renderPlayerPath(ctx, drawnCells, connections, cellSize, hasWon = false, animationMode = 'auto') {
  // Only use currentTime for animation calculations when animations are enabled
  // In 'none' mode, pass null to force static positions even if stale animation data exists
  const currentTime = animationMode === 'auto' ? Date.now() : null;
  let hasActiveAnimations = false;

  // Handle empty path - reset animation state
  if (!drawnCells || drawnCells.size === 0) {
    pathAnimationState.animatingCells.clear();
    pathAnimationState.previousDrawnCells.clear();
    return { hasActiveAnimations: false };
  }

  // Detect changes and manage animations
  if (animationMode === 'auto') {
    // CRITICAL FIX: Clear previousDrawnCells FIRST to prevent cross-view contamination
    // If tutorial rendered after game init, previousDrawnCells might have stale tutorial cells
    // This ensures we start fresh and only use cells from THIS view's current drawnCells
    const safePreviousDrawnCells = new Set(pathAnimationState.previousDrawnCells);
    pathAnimationState.previousDrawnCells.clear();

    // DEFENSIVE: Remove any animating cells that are no longer in drawnCells
    // OR have invalid predecessors (not in current connections)
    // This protects against stale animation data from previous views or race conditions
    for (const [cellKey, animation] of pathAnimationState.animatingCells.entries()) {
      if (!drawnCells.has(cellKey)) {
        pathAnimationState.animatingCells.delete(cellKey);
      } else if (animation.predecessorKey) {
        // Validate that the predecessor is actually connected to this cell
        const cellConnections = connections.get(cellKey);
        if (!cellConnections || !cellConnections.has(animation.predecessorKey)) {
          // Invalid predecessor - delete this animation entry
          pathAnimationState.animatingCells.delete(cellKey);
        }
      }
    }

    // Collect all new cells added this frame (using the safe copy)
    const newCells = new Set();
    for (const cellKey of drawnCells) {
      if (!safePreviousDrawnCells.has(cellKey)) {
        newCells.add(cellKey);
      }
    }

    // Multi-pass animation detection: keep trying to add cells until no more can be added
    // This handles chains where cell B depends on cell A which is also new this frame
    // (e.g., diagonal drags that add multiple intermediate cells at once)
    let addedAny;
    do {
      addedAny = false;

      for (const cellKey of newCells) {
        // Skip if already animating
        if (pathAnimationState.animatingCells.has(cellKey)) continue;

        // Find predecessor in EITHER previous cells OR currently animating cells
        const connectedCells = connections.get(cellKey);
        let predecessorKey = null;

        if (connectedCells) {
          for (const connKey of connectedCells) {
            if (pathAnimationState.previousDrawnCells.has(connKey) ||
                pathAnimationState.animatingCells.has(connKey)) {
              predecessorKey = connKey;
              break;
            }
          }
        }

        // Only add if we found a predecessor
        if (predecessorKey) {
          pathAnimationState.animatingCells.set(cellKey, {
            startTime: currentTime,
            predecessorKey,
          });
          addedAny = true;
        }
      }
    } while (addedAny);

    // Detect removed cells (backtracking) - cancel animations immediately
    // Use safePreviousDrawnCells since we already cleared the shared state
    for (const cellKey of safePreviousDrawnCells) {
      if (!drawnCells.has(cellKey)) {
        pathAnimationState.animatingCells.delete(cellKey);
      }
    }
  } else {
    // When animations are disabled, ensure animatingCells is empty
    // This is defensive - prevents any stale animation data from affecting rendering
    pathAnimationState.animatingCells.clear();
  }

  // ALWAYS update previous state for next frame (even in 'none' mode)
  // This ensures previousDrawnCells stays in sync with actual state
  // Critical for saved game restoration and view transitions
  pathAnimationState.previousDrawnCells.clear();
  for (const cellKey of drawnCells) {
    pathAnimationState.previousDrawnCells.add(cellKey);
  }

  const PLAYER_COLOR = hasWon ? CONFIG.COLORS.PLAYER_PATH_WIN : CONFIG.COLORS.PLAYER_PATH;

  // Trace all continuous path segments
  const segments = tracePathSegments(connections);

  // Draw each segment with smooth curves and animations
  for (const segment of segments) {
    drawSmoothSegment(ctx, segment, connections, cellSize, PLAYER_COLOR, currentTime);
  }

  // Draw dots for cells with 0 connections (isolated cells)
  for (const cellKey of drawnCells) {
    const connectionCount = connections.get(cellKey)?.size || 0;
    if (connectionCount === 0) {
      const animatedPos = getAnimatedCellPosition(cellKey, cellSize, currentTime);

      if (animatedPos) {
        hasActiveAnimations = true;
        ctx.beginPath();
        ctx.arc(animatedPos.x, animatedPos.y, CONFIG.RENDERING.DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = PLAYER_COLOR;
        ctx.fill();
      } else {
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

  // Check if there are any active animations
  hasActiveAnimations = hasActiveAnimations || pathAnimationState.animatingCells.size > 0;

  return { hasActiveAnimations };
}
