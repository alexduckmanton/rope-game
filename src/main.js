/**
 * Loop Puzzle Game - Main Entry Point
 *
 * This is a minimalist path-drawing puzzle game where players create a single
 * continuous loop through a grid, guided by numbered hints. The hints show how
 * many turns (corners) the path makes in a 3x3 area around each numbered cell.
 */

/* ============================================================================
 * IMPORTS
 * ========================================================================= */

import { renderGrid, clearCanvas, renderPath, renderCellNumbers, generateHintCells, renderPlayerPath, buildPlayerTurnMap } from './renderer.js';
import { generateSolutionPath } from './generator.js';
import { isAdjacent, buildSolutionTurnMap, countTurnsInArea, determineConnectionToBreak, findShortestPath } from './utils.js';
import { CONFIG } from './config.js';

/* ============================================================================
 * STATE VARIABLES
 * ========================================================================= */

// Game configuration
let gridSize = 4;
let cellSize = 0;

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const newBtn = document.getElementById('new-btn');
const restartBtn = document.getElementById('restart-btn');
const hintsCheckbox = document.getElementById('hints-checkbox');
const borderCheckbox = document.getElementById('border-checkbox');
const solutionCheckbox = document.getElementById('solution-checkbox');
const gridSizeSelect = document.getElementById('grid-size-select');

// Puzzle state
let solutionPath = [];                 // Solution path generated for the puzzle
let hintCells = new Set();             // Set of cells that show hint numbers
let hintMode = 'partial';              // Display mode: 'none' | 'partial' | 'all'
let borderMode = 'off';                // Border mode: 'off' | 'center' | 'full'
let showSolution = false;              // Whether to show the solution path
let hasWon = false;                    // Whether the player has completed the puzzle

// Player path state
let playerDrawnCells = new Set();      // Set of "row,col" strings player has drawn
let playerConnections = new Map();     // Map of "row,col" -> Set of connected "row,col"

// Drag interaction state
let isDragging = false;                // Whether player is currently dragging
let dragPath = [];                     // Cells visited during current drag (in order)
let cellsAddedThisDrag = new Set();    // Cells newly added during this drag
let hasDragMoved = false;              // Whether drag has moved to different cells

/* ============================================================================
 * PLAYER CELL & CONNECTION MANAGEMENT
 * ========================================================================= */

/**
 * Clear a player cell and all its connections
 * Removes the cell from drawn cells and cleans up all connection references
 *
 * @param {number} row - Row index of cell to clear
 * @param {number} col - Column index of cell to clear
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
 * Converts screen coordinates to grid cell position
 *
 * @param {PointerEvent} event - The pointer event
 * @returns {{row: number, col: number, key: string}|null} Cell info or null if out of bounds
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
 * Remove a bidirectional connection between two cells
 * Updates both cells' connection sets to remove references to each other
 *
 * @param {string} cellKeyA - First cell key
 * @param {string} cellKeyB - Second cell key
 */
function removeConnection(cellKeyA, cellKeyB) {
  playerConnections.get(cellKeyA)?.delete(cellKeyB);
  playerConnections.get(cellKeyB)?.delete(cellKeyA);
}

/**
 * Ensure a cell has an entry in the connections map
 * Initializes an empty Set if the cell doesn't have one yet
 *
 * @param {string} cellKey - Cell key to ensure has a connection map
 */
function ensureConnectionMap(cellKey) {
  if (!playerConnections.has(cellKey)) {
    playerConnections.set(cellKey, new Set());
  }
}

/**
 * Reset all drag state variables to initial values
 * Called when drag interaction ends
 */
function resetDragState() {
  isDragging = false;
  dragPath = [];
  cellsAddedThisDrag = new Set();
  hasDragMoved = false;
}

/**
 * Clean up orphaned cells (cells with 0 connections)
 * Removes all cells that have no connections, repeating until no more orphans exist
 * This handles cascading orphans (removing one orphan might create another)
 *
 * Uses iterative approach to handle chains of dependencies
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

/* ============================================================================
 * PATH CONNECTION LOGIC
 * Functions for managing bidirectional connections between cells
 * ========================================================================= */

/**
 * Force a connection between two cells, breaking existing connections if necessary
 * This prioritizes the new connection being drawn and removes old connections
 * based on "opposite direction" logic
 *
 * @param {string} cellKeyA - First cell key
 * @param {string} cellKeyB - Second cell key
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
 *
 * @param {string} fromKey - Starting cell key
 * @param {string} toKey - Target cell key
 * @returns {Array<string>|null} Array of cell keys forming path, or null if no path
 */
function findPathToCell(fromKey, toKey) {
  return findShortestPath(fromKey, toKey, gridSize);
}

/* ============================================================================
 * VALIDATION
 * Functions for checking win conditions and path validity
 * ========================================================================= */

/**
 * Check if the player has won the game
 * Win conditions:
 * 1. All cells are covered
 * 2. All cells have exactly 2 connections (forms a closed loop)
 * 3. All hint cells are valid (expected turns === actual turns)
 *
 * @returns {boolean} True if player has won, false otherwise
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
  const solutionTurnMap = buildSolutionTurnMap(solutionPath);

  // Check all hint cells are valid
  for (const cellKey of hintCells) {
    const [row, col] = cellKey.split(',').map(Number);

    // Count turns in adjacent cells (including diagonals and self)
    const expectedTurnCount = countTurnsInArea(row, col, gridSize, solutionTurnMap);
    const actualTurnCount = countTurnsInArea(row, col, gridSize, playerTurnMap);

    if (expectedTurnCount !== actualTurnCount) return false;
  }

  return true;
}


/* ============================================================================
 * DRAG INTERACTION HELPERS
 * Helper functions for managing drag-based path drawing
 * ========================================================================= */

/**
 * Attempt to close a loop by connecting back to start cell
 *
 * @param {Array<string>} currentDragPath - Current drag path
 * @returns {boolean} True if loop was closed successfully
 */
function tryCloseLoop(currentDragPath) {
  if (currentDragPath.length < 2) return false;

  const lastCell = currentDragPath[currentDragPath.length - 1];
  const firstCell = currentDragPath[0];

  // Check if already connected or can make connection
  if (playerConnections.get(lastCell)?.has(firstCell) || forceConnection(lastCell, firstCell)) {
    // Close the loop by connecting last cell to first
    dragPath.push(firstCell);
    cleanupOrphanedCells();
    render();
    return true;
  }

  return false;
}

/**
 * Handle backtracking when drag returns to a previous cell
 * @param {number} backtrackIndex - Index in dragPath to backtrack to
 */
function handleBacktrack(backtrackIndex) {
  // Remove connections from backtrackIndex+1 onwards
  for (let i = dragPath.length - 1; i > backtrackIndex; i--) {
    const cellToRemove = dragPath[i];
    const prevCell = dragPath[i - 1];
    removeConnection(prevCell, cellToRemove);
  }

  // Trim drag path and cleanup any orphaned cells
  dragPath = dragPath.slice(0, backtrackIndex + 1);
  cleanupOrphanedCells();
  render();
}

/**
 * Extend the drag path forward to a new cell
 * @param {string} newCellKey - The new cell to extend to
 * @param {string} currentCellKey - The current end of the drag path
 */
function extendDragPath(newCellKey, currentCellKey) {
  const path = findPathToCell(currentCellKey, newCellKey);
  if (!path || path.length === 0) return;

  // Add all cells in path
  let prevInDrag = currentCellKey;
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

/* ============================================================================
 * EVENT HANDLERS
 * Functions for handling pointer/touch events and user interactions
 * ========================================================================= */

/**
 * Handle pointer down event - start drag interaction
 *
 * @param {PointerEvent} event - The pointer down event
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

  // Always add cell if not already drawn (for continuous drawing)
  if (!playerDrawnCells.has(cell.key)) {
    playerDrawnCells.add(cell.key);
    ensureConnectionMap(cell.key);
    cellsAddedThisDrag.add(cell.key);
  }

  render();
}

/**
 * Handle pointer move event - continue drag interaction
 * Handles backtracking, loop closing, and forward path extension
 *
 * @param {PointerEvent} event - The pointer move event
 */
function handlePointerMove(event) {
  if (!isDragging) return;
  event.preventDefault();

  const cell = getCellFromPointer(event);
  if (!cell) return;

  const currentCell = dragPath[dragPath.length - 1];
  if (cell.key === currentCell) return; // Same cell, ignore

  hasDragMoved = true;

  // Check if backtracking (moving to a cell already in drag path)
  const backtrackIndex = dragPath.indexOf(cell.key);
  if (backtrackIndex !== -1 && backtrackIndex < dragPath.length - 1) {
    // Special case: returning to start cell might be loop closing
    if (backtrackIndex === 0) {
      if (tryCloseLoop(dragPath)) {
        return;
      }
    }

    // Handle backtracking
    handleBacktrack(backtrackIndex);
    return;
  }

  // Moving forward - extend drag path to new cell
  extendDragPath(cell.key, currentCell);
}

/**
 * Handle pointer up event - end drag interaction
 * Handles tap-to-erase logic for single cell taps
 *
 * @param {PointerEvent} event - The pointer up event
 */
function handlePointerUp(event) {
  if (!isDragging) return;

  canvas.releasePointerCapture(event.pointerId);

  const cell = getCellFromPointer(event);

  // If it was just a tap (no movement to other cells), handle tap logic
  if (!hasDragMoved && cell && dragPath.length === 1 && dragPath[0] === cell.key) {
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
 * Handle pointer cancel event - abort drag interaction
 * Called when pointer event is cancelled (e.g., system interruption)
 *
 * @param {PointerEvent} event - The pointer cancel event
 */
function handlePointerCancel(event) {
  canvas.releasePointerCapture(event.pointerId);

  resetDragState();
  cleanupOrphanedCells();
}

/* ============================================================================
 * UI FUNCTIONS
 * Functions for managing UI state and visual updates
 * ========================================================================= */

/**
 * Update hint checkbox visual state to match current hintMode
 * Sets checkbox to unchecked, indeterminate, or checked based on mode
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
 * Cycle through hint display modes: none -> partial -> all -> none
 * Updates the hintMode state and checkbox visual state
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
 * Update border checkbox visual state to match current borderMode
 * Sets checkbox to unchecked, indeterminate, or checked based on mode
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
 * Cycle through border display modes: off -> center -> full -> off
 * Updates the borderMode state and checkbox visual state
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

/* ============================================================================
 * GAME LIFECYCLE & RENDERING
 * Functions for game initialization, state management, and rendering
 * ========================================================================= */

/**
 * Calculate optimal cell size based on viewport dimensions
 * Ensures cells fit within available space while respecting min/max bounds
 *
 * @returns {number} Calculated cell size in pixels
 */
function calculateCellSize() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Reserve space for buttons and padding
  const availableHeight = viewportHeight - CONFIG.LAYOUT.TOP_BAR_HEIGHT;
  const availableWidth = viewportWidth - CONFIG.LAYOUT.HORIZONTAL_PADDING;

  const maxCellSize = Math.min(
    availableWidth / gridSize,
    availableHeight / gridSize
  );

  // Ensure minimum and maximum cell size for usability
  return Math.max(CONFIG.CELL_SIZE_MIN, Math.min(maxCellSize, CONFIG.CELL_SIZE_MAX));
}

/**
 * Resize canvas to match calculated cell size and re-render
 * Handles high DPI displays by adjusting canvas internal resolution
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
 * Main render function - draws the complete game state
 * Orchestrates rendering of grid, hints, solution (if enabled), and player path
 * Also checks for win condition and displays victory message
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
 * Generate a new puzzle with random solution and hints
 * Clears all player state and renders the new puzzle
 */
function generateNewPuzzle() {
  solutionPath = generateSolutionPath(gridSize);
  hintCells = generateHintCells(gridSize, CONFIG.HINT.PROBABILITY);

  // Clear player state
  playerDrawnCells.clear();
  playerConnections.clear();
  hasWon = false;

  render();
}

/**
 * Restart current puzzle without generating a new one
 * Clears all player progress but keeps the same puzzle
 */
function restartPuzzle() {
  // Clear player state but keep the same puzzle
  playerDrawnCells.clear();
  playerConnections.clear();
  hasWon = false;

  render();
}

/* ============================================================================
 * INITIALIZATION
 * Game initialization and event listener setup
 * ========================================================================= */

/**
 * Initialize the game
 * Sets up event listeners, prevents mobile zoom gestures, and starts the first puzzle
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
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
