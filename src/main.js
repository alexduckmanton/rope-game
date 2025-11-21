/**
 * Loop Puzzle Game - Main Entry Point
 */

import { renderGrid, clearCanvas, renderPath, renderCellNumbers, generateHintCells, renderPlayerPath, buildPlayerTurnMap } from './renderer.js';
import { generateSolutionPath } from './generator.js';

// Haptic module - loaded lazily to prevent blocking game initialization
let hapticModule = null;
let hapticLoadAttempted = false;

// Lazy load haptic module
async function loadHapticModule() {
  if (hapticLoadAttempted) return;
  hapticLoadAttempted = true;

  try {
    hapticModule = await import('ios-haptics');
  } catch (error) {
    console.warn('Failed to load haptic module:', error);
  }
}

// Safe haptic wrapper - lazy loads module and plays haptic
async function playHaptic() {
  try {
    if (!hapticModule) {
      await loadHapticModule();
    }
    if (hapticModule && hapticModule.haptic) {
      hapticModule.haptic();
    }
  } catch (error) {
    console.warn('Haptic feedback error:', error);
  }
}

// Safe haptic confirm wrapper
async function playHapticConfirm() {
  try {
    if (!hapticModule) {
      await loadHapticModule();
    }
    if (hapticModule && hapticModule.haptic && hapticModule.haptic.confirm) {
      hapticModule.haptic.confirm();
    }
  } catch (error) {
    console.warn('Haptic confirm error:', error);
  }
}

// Game configuration
let gridSize = 4;

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const newBtn = document.getElementById('new-btn');
const restartBtn = document.getElementById('restart-btn');
const hintsCheckbox = document.getElementById('hints-checkbox');
const borderCheckbox = document.getElementById('border-checkbox');
const solutionCheckbox = document.getElementById('solution-checkbox');
const gridSizeSelect = document.getElementById('grid-size-select');

// Game state
let cellSize = 0;
let solutionPath = [];
let hintCells = new Set();
let hintMode = 'partial'; // 'none' | 'partial' | 'all'
let borderMode = 'off'; // 'off' | 'center' | 'full'
let showSolution = false;
let hasWon = false;

// Player path state
let playerDrawnCells = new Set();      // Set of "row,col" strings
let playerConnections = new Map();      // Map of "row,col" -> Set of connected "row,col"

// Drag state
let isDragging = false;
let dragPath = [];                      // Cells visited during current drag (in order)
let cellsAddedThisDrag = new Set();     // Cells that were newly added during this drag
let hasDragMoved = false;               // Whether pointer moved to different cells during drag
let lastHapticCell = null;              // Last cell we played haptic for (to avoid duplicates)

/**
 * Check if two cells are adjacent (Manhattan distance = 1)
 */
function isAdjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

/**
 * Clear a player cell and its connections
 */
function clearPlayerCell(row, col) {
  const cellKey = `${row},${col}`;

  // Remove from drawn cells
  playerDrawnCells.delete(cellKey);

  // Remove all connections involving this cell
  const connections = playerConnections.get(cellKey);
  if (connections) {
    for (const connectedCell of connections) {
      playerConnections.get(connectedCell)?.delete(cellKey);
    }
    playerConnections.delete(cellKey);
  }
}

/**
 * Get cell coordinates from pointer event
 */
function getCellFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const col = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);

  if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
    return { row, col, key: `${row},${col}` };
  }
  return null;
}

/**
 * Remove a connection between two cells
 */
function removeConnection(cellKeyA, cellKeyB) {
  playerConnections.get(cellKeyA)?.delete(cellKeyB);
  playerConnections.get(cellKeyB)?.delete(cellKeyA);
}

/**
 * Ensure a cell has an entry in the connections map
 */
function ensureConnectionMap(cellKey) {
  if (!playerConnections.has(cellKey)) {
    playerConnections.set(cellKey, new Set());
  }
}

/**
 * Reset drag state variables
 */
function resetDragState() {
  isDragging = false;
  dragPath = [];
  cellsAddedThisDrag = new Set();
  hasDragMoved = false;
  lastHapticCell = null;
}

/**
 * Clean up orphaned cells (cells with 0 connections)
 * Removes all cells that have no connections, repeating until no more orphans exist
 * This handles cascading orphans (removing one orphan might create another)
 */
function cleanupOrphanedCells() {
  let foundOrphan = true;

  while (foundOrphan) {
    foundOrphan = false;

    for (const cellKey of playerDrawnCells) {
      const connections = playerConnections.get(cellKey);
      if (!connections || connections.size === 0) {
        // Remove orphaned cell
        playerDrawnCells.delete(cellKey);
        playerConnections.delete(cellKey);
        foundOrphan = true;
        break; // Restart iteration since we modified the set
      }
    }
  }
}

/**
 * Determine which connection to break based on "opposite direction" priority.
 * When drawing from cellA to cellB, we want to remove the connection from cellB
 * that goes in the opposite direction from where we're coming.
 *
 * @param {string} targetCell - The cell that has 2 connections
 * @param {string} comingFromCell - The cell we're drawing from
 * @param {Set<string>} existingConnections - Set of cells connected to targetCell
 * @returns {string} The cell key to disconnect from targetCell
 */
function determineConnectionToBreak(targetCell, comingFromCell, existingConnections) {
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
 * Force a connection between two cells, breaking existing connections if necessary.
 * This prioritizes the new connection being drawn and removes old connections
 * based on "opposite direction" logic.
 *
 * @param {string} cellKeyA - First cell
 * @param {string} cellKeyB - Second cell
 * @returns {boolean} True if connection was made, false if not possible
 */
function forceConnection(cellKeyA, cellKeyB) {
  const [r1, c1] = cellKeyA.split(',').map(Number);
  const [r2, c2] = cellKeyB.split(',').map(Number);

  // Must be adjacent
  if (!isAdjacent(r1, c1, r2, c2)) return false;

  // Must not already be connected
  if (playerConnections.get(cellKeyA)?.has(cellKeyB)) return false;

  // Initialize connection maps if needed
  ensureConnectionMap(cellKeyA);
  ensureConnectionMap(cellKeyB);

  // Check if cellA has 2 connections - if so, break one
  const connectionsA = playerConnections.get(cellKeyA);
  if (connectionsA.size >= 2) {
    const toBreak = determineConnectionToBreak(cellKeyA, cellKeyB, connectionsA);
    removeConnection(cellKeyA, toBreak);
  }

  // Check if cellB has 2 connections - if so, break one
  const connectionsB = playerConnections.get(cellKeyB);
  if (connectionsB.size >= 2) {
    const toBreak = determineConnectionToBreak(cellKeyB, cellKeyA, connectionsB);
    removeConnection(cellKeyB, toBreak);
  }

  // Now make the new connection
  playerConnections.get(cellKeyA).add(cellKeyB);
  playerConnections.get(cellKeyB).add(cellKeyA);

  return true;
}

/**
 * Find path from one cell to another using BFS (for non-adjacent cells)
 * Returns array of cell keys (not including start, but including end)
 * Can path through any cells - forceConnection will handle breaking old connections
 */
function findPathToCell(fromKey, toKey) {
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
 * Check if the player has won the game
 * Win conditions:
 * 1. All cells are covered
 * 2. All cells have exactly 2 connections (forms a closed loop)
 * 3. All hint cells are valid (expected turns === actual turns)
 */
function checkWin() {
  const totalCells = gridSize * gridSize;

  // Check if all cells are covered
  if (playerDrawnCells.size !== totalCells) return false;

  // Check if all cells have exactly 2 connections (closed loop requirement)
  for (const cellKey of playerDrawnCells) {
    const connections = playerConnections.get(cellKey);
    if (!connections || connections.size !== 2) return false;
  }

  // Build turn maps for validation
  const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);

  // Build solution turn map
  const solutionTurnMap = new Map();
  const pathLength = solutionPath.length;

  for (let i = 0; i < pathLength; i++) {
    const prev = solutionPath[(i - 1 + pathLength) % pathLength];
    const current = solutionPath[i];
    const next = solutionPath[(i + 1) % pathLength];

    const isStraight =
      (prev.row === current.row && current.row === next.row) ||
      (prev.col === current.col && current.col === next.col);

    solutionTurnMap.set(`${current.row},${current.col}`, !isStraight);
  }

  // Check all hint cells are valid
  for (const cellKey of hintCells) {
    const [row, col] = cellKey.split(',').map(Number);

    // Count turns in adjacent cells (including diagonals and self)
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
        if (solutionTurnMap.get(adjKey)) expectedTurnCount++;
        if (playerTurnMap.get(adjKey)) actualTurnCount++;
      }
    }

    if (expectedTurnCount !== actualTurnCount) return false;
  }

  return true;
}


/**
 * Handle pointer down - start drag
 */
function handlePointerDown(event) {
  event.preventDefault();

  // Disable input if player has won
  if (hasWon) return;

  const cell = getCellFromPointer(event);
  if (!cell) return;

  // Capture pointer for smooth dragging
  canvas.setPointerCapture(event.pointerId);

  isDragging = true;
  hasDragMoved = false;
  dragPath = [cell.key];
  cellsAddedThisDrag = new Set();
  lastHapticCell = null; // Reset haptic tracking for new drag

  // Always add cell if not already drawn (for continuous drawing)
  if (!playerDrawnCells.has(cell.key)) {
    playerDrawnCells.add(cell.key);
    ensureConnectionMap(cell.key);
    cellsAddedThisDrag.add(cell.key);
  }

  render();
}

/**
 * Handle pointer move - continue drag
 */
function handlePointerMove(event) {
  if (!isDragging) return;
  event.preventDefault();

  const cell = getCellFromPointer(event);
  if (!cell) return;

  const currentCell = dragPath[dragPath.length - 1];

  // On first pointer move, play haptic for the initial cell we started from
  if (lastHapticCell === null) {
    playHaptic();
    lastHapticCell = currentCell;
  }

  if (cell.key === currentCell) return; // Same cell, ignore

  // Moving to a different cell - play haptic
  playHaptic();
  lastHapticCell = cell.key;

  hasDragMoved = true;

  // Check if backtracking (moving to a cell already in drag path)
  const backtrackIndex = dragPath.indexOf(cell.key);
  if (backtrackIndex !== -1 && backtrackIndex < dragPath.length - 1) {
    // Special case: returning to start cell might be loop closing
    if (backtrackIndex === 0) {
      const lastCell = dragPath[dragPath.length - 1];
      const firstCell = dragPath[0];

      // Check if already connected or can make connection
      if (playerConnections.get(lastCell)?.has(firstCell) || forceConnection(lastCell, firstCell)) {
        // Close the loop by connecting last cell to first
        dragPath.push(firstCell);
        cleanupOrphanedCells();
        render();
        return;
      }
    }

    // Backtracking! Remove connections from backtrackIndex+1 onwards
    for (let i = dragPath.length - 1; i > backtrackIndex; i--) {
      const cellToRemove = dragPath[i];
      const prevCell = dragPath[i - 1];
      removeConnection(prevCell, cellToRemove);
    }

    // Trim drag path and cleanup any orphaned cells
    dragPath = dragPath.slice(0, backtrackIndex + 1);
    cleanupOrphanedCells();
    render();
    return;
  }

  // Moving forward - find path to the new cell (handles non-adjacent cells)
  const path = findPathToCell(currentCell, cell.key);
  if (path && path.length > 0) {
    // Add all cells in path
    let prevInDrag = currentCell;
    for (const pathCell of path) {
      // Add cell if not already drawn
      if (!playerDrawnCells.has(pathCell)) {
        playerDrawnCells.add(pathCell);
        ensureConnectionMap(pathCell);
        cellsAddedThisDrag.add(pathCell);
      }

      // Try to connect or continue through existing connection
      if (playerConnections.get(prevInDrag)?.has(pathCell)) {
        // Already connected - continue drawing through it
        dragPath.push(pathCell);
        prevInDrag = pathCell;
      } else if (forceConnection(prevInDrag, pathCell)) {
        // Make new connection, breaking old ones if necessary
        dragPath.push(pathCell);
        prevInDrag = pathCell;
      } else {
        // Can't connect (e.g., not adjacent), stop here
        break;
      }
    }
    cleanupOrphanedCells();
    render();
  }
}

/**
 * Handle pointer up - end drag
 */
function handlePointerUp(event) {
  if (!isDragging) return;

  canvas.releasePointerCapture(event.pointerId);

  const cell = getCellFromPointer(event);

  // If it was just a tap (no movement to other cells), handle tap logic
  if (!hasDragMoved && cell && dragPath.length === 1 && dragPath[0] === cell.key) {
    // This was a tap on a single cell - play haptic
    playHaptic();

    // This was a tap on a single cell
    if (!cellsAddedThisDrag.has(cell.key)) {
      // Cell existed before this tap - erase it
      const [row, col] = cell.key.split(',').map(Number);
      clearPlayerCell(row, col);
    }
    // If cell was just added during this tap, keep it
  }

  resetDragState();
  cleanupOrphanedCells();
  render();
}

/**
 * Handle pointer cancel - abort drag
 */
function handlePointerCancel(event) {
  canvas.releasePointerCapture(event.pointerId);

  resetDragState();
  cleanupOrphanedCells();
}

/**
 * Update checkbox visual state to match hintMode
 */
function updateCheckboxState() {
  if (hintMode === 'none') {
    hintsCheckbox.checked = false;
    hintsCheckbox.indeterminate = false;
  } else if (hintMode === 'partial') {
    hintsCheckbox.checked = false;
    hintsCheckbox.indeterminate = true;
  } else if (hintMode === 'all') {
    hintsCheckbox.checked = true;
    hintsCheckbox.indeterminate = false;
  }
}

/**
 * Cycle through hint modes: none -> partial -> all -> none
 */
function cycleHintMode() {
  if (hintMode === 'none') {
    hintMode = 'partial';
  } else if (hintMode === 'partial') {
    hintMode = 'all';
  } else {
    hintMode = 'none';
  }
  // Use setTimeout to ensure our state is applied after browser default behavior
  setTimeout(updateCheckboxState, 0);
  render();
}

/**
 * Update border checkbox visual state to match borderMode
 */
function updateBorderCheckboxState() {
  if (borderMode === 'off') {
    borderCheckbox.checked = false;
    borderCheckbox.indeterminate = false;
  } else if (borderMode === 'center') {
    borderCheckbox.checked = false;
    borderCheckbox.indeterminate = true;
  } else if (borderMode === 'full') {
    borderCheckbox.checked = true;
    borderCheckbox.indeterminate = false;
  }
}

/**
 * Cycle through border modes: off -> center -> full -> off
 */
function cycleBorderMode() {
  if (borderMode === 'off') {
    borderMode = 'center';
  } else if (borderMode === 'center') {
    borderMode = 'full';
  } else {
    borderMode = 'off';
  }
  // Use setTimeout to ensure our state is applied after browser default behavior
  setTimeout(updateBorderCheckboxState, 0);
  render();
}

/**
 * Calculate optimal cell size based on viewport
 */
function calculateCellSize() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Reserve space for buttons (80px top, 20px padding)
  const availableHeight = viewportHeight - 100;
  const availableWidth = viewportWidth - 40; // 20px padding each side

  const maxCellSize = Math.min(
    availableWidth / gridSize,
    availableHeight / gridSize
  );

  // Ensure minimum cell size for usability (50px) and maximum (100px)
  return Math.max(50, Math.min(maxCellSize, 100));
}

/**
 * Resize canvas and re-render
 */
function resizeCanvas() {
  cellSize = calculateCellSize();
  const totalSize = cellSize * gridSize;

  // Get device pixel ratio for high DPI display support
  const dpr = window.devicePixelRatio || 1;

  // Set canvas internal dimensions to account for DPR
  canvas.width = totalSize * dpr;
  canvas.height = totalSize * dpr;

  // Set CSS dimensions to maintain visual size
  canvas.style.width = totalSize + 'px';
  canvas.style.height = totalSize + 'px';

  // Scale context to handle DPR - all drawing operations will be scaled
  ctx.scale(dpr, dpr);

  render();
}

/**
 * Main render function
 */
function render() {
  const totalSize = cellSize * gridSize;

  // Clear canvas
  clearCanvas(ctx, totalSize, totalSize);

  // Render grid
  renderGrid(ctx, gridSize, cellSize);

  // Render cell numbers (turn counts) with validation
  renderCellNumbers(ctx, gridSize, cellSize, solutionPath, hintCells, hintMode, playerDrawnCells, playerConnections, borderMode);

  // Render solution path (only when checkbox is checked)
  if (showSolution) {
    renderPath(ctx, solutionPath, cellSize);
  }

  // Render player path on top
  renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);

  // Check for win condition (only if not already won)
  if (!hasWon && checkWin()) {
    hasWon = true;
    // Play success haptic
    playHapticConfirm();
    // Re-render with green path
    renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);
    // Show win alert after browser has painted the green path
    // requestAnimationFrame runs before next paint, then setTimeout runs after paint completes
    requestAnimationFrame(() => {
      setTimeout(() => {
        alert('You win!');
      }, 0);
    });
  }
}

/**
 * Generate a new puzzle
 */
function generateNewPuzzle() {
  solutionPath = generateSolutionPath(gridSize);
  hintCells = generateHintCells(gridSize, 0.3);

  // Clear player state
  playerDrawnCells.clear();
  playerConnections.clear();
  hasWon = false;

  render();
}

/**
 * Restart current puzzle (clear player's drawn paths)
 */
function restartPuzzle() {
  // Clear player state but keep the same puzzle
  playerDrawnCells.clear();
  playerConnections.clear();
  hasWon = false;

  render();
}

/**
 * Initialize the game
 */
function init() {
  // Prevent all forms of zooming on mobile devices

  // Prevent Safari gesture events (pinch zoom)
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('gestureend', (e) => e.preventDefault());

  // Prevent multi-touch zoom
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent double-tap zoom by handling touchstart (catches zoom earlier in event chain)
  let lastTouchStart = 0;
  document.addEventListener('touchstart', (e) => {
    const now = Date.now();
    if (e.touches.length === 1 && now - lastTouchStart <= 500) {
      e.preventDefault();
    }
    lastTouchStart = now;
  }, { passive: false });

  // Also prevent on touchend as a fallback
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 500) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  // Set up resize handler
  window.addEventListener('resize', resizeCanvas);

  // Set up button handlers
  newBtn.addEventListener('click', generateNewPuzzle);
  restartBtn.addEventListener('click', restartPuzzle);

  // Set up hints toggle - use click on label to cycle through states
  hintsCheckbox.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default checkbox behavior
    cycleHintMode();
  });

  // Set up border toggle - use click on label to cycle through states
  borderCheckbox.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default checkbox behavior
    cycleBorderMode();
  });

  // Set up solution toggle
  solutionCheckbox.addEventListener('change', () => {
    showSolution = solutionCheckbox.checked;
    render();
  });

  // Set up grid size selector
  gridSizeSelect.addEventListener('change', () => {
    gridSize = parseInt(gridSizeSelect.value, 10);
    resizeCanvas();
    generateNewPuzzle();
  });

  // Set up canvas pointer handlers for player drawing (supports touch and mouse)
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerCancel);

  // Initial canvas setup (sets cellSize)
  resizeCanvas();

  // Generate initial puzzle
  generateNewPuzzle();

  // Set initial checkbox state
  updateCheckboxState();
  updateBorderCheckboxState();

  console.log('Loop Puzzle Game initialized');
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
