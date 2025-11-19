/**
 * Loop Puzzle Game - Main Entry Point
 */

import { renderGrid, clearCanvas, renderPath, renderCellNumbers, generateHintCells, renderPlayerPath } from './renderer.js';
import { generateSolutionPath } from './generator.js';

// Game configuration
const GRID_SIZE = 6;

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const newBtn = document.getElementById('new-btn');
const hintsCheckbox = document.getElementById('hints-checkbox');

// Game state
let cellSize = 0;
let solutionPath = [];
let hintCells = new Set();
let hintMode = 'partial'; // 'none' | 'partial' | 'all'

// Player path state
let playerDrawnCells = new Set();      // Set of "row,col" strings
let playerConnections = new Map();      // Map of "row,col" -> Set of connected "row,col"
let lastTappedCell = null;              // "row,col" string or null

// Drag state
let isDragging = false;
let dragPath = [];                      // Cells visited during current drag (in order)
let cellsAddedThisDrag = new Set();     // Cells that were newly added during this drag
let hasDragMoved = false;               // Whether pointer moved to different cells during drag

/**
 * Check if two cells are adjacent (Manhattan distance = 1)
 */
function isAdjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

/**
 * Try to connect two cells if possible
 */
function tryConnect(cellKeyA, cellKeyB) {
  const [r1, c1] = cellKeyA.split(',').map(Number);
  const [r2, c2] = cellKeyB.split(',').map(Number);

  // Check adjacency
  if (!isAdjacent(r1, c1, r2, c2)) return;

  // Check if already connected
  if (playerConnections.get(cellKeyA)?.has(cellKeyB)) return;

  // Check connection limits (max 2 per cell)
  const connectionsA = playerConnections.get(cellKeyA)?.size || 0;
  const connectionsB = playerConnections.get(cellKeyB)?.size || 0;

  if (connectionsA >= 2 || connectionsB >= 2) return;

  // Make the connection
  if (!playerConnections.has(cellKeyA)) {
    playerConnections.set(cellKeyA, new Set());
  }
  if (!playerConnections.has(cellKeyB)) {
    playerConnections.set(cellKeyB, new Set());
  }

  playerConnections.get(cellKeyA).add(cellKeyB);
  playerConnections.get(cellKeyB).add(cellKeyA);
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

  if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
    return { row, col, key: `${row},${col}` };
  }
  return null;
}

/**
 * Check if two cells can be connected
 */
function canConnect(cellKeyA, cellKeyB) {
  const [r1, c1] = cellKeyA.split(',').map(Number);
  const [r2, c2] = cellKeyB.split(',').map(Number);

  // Must be adjacent
  if (!isAdjacent(r1, c1, r2, c2)) return false;

  // Must not already be connected
  if (playerConnections.get(cellKeyA)?.has(cellKeyB)) return false;

  // Both cells must have < 2 connections
  const connectionsA = playerConnections.get(cellKeyA)?.size || 0;
  const connectionsB = playerConnections.get(cellKeyB)?.size || 0;

  if (connectionsA >= 2 || connectionsB >= 2) return false;

  return true;
}

/**
 * Add a connection between two cells (assumes canConnect was checked)
 */
function addConnection(cellKeyA, cellKeyB) {
  if (!playerConnections.has(cellKeyA)) {
    playerConnections.set(cellKeyA, new Set());
  }
  if (!playerConnections.has(cellKeyB)) {
    playerConnections.set(cellKeyB, new Set());
  }

  playerConnections.get(cellKeyA).add(cellKeyB);
  playerConnections.get(cellKeyB).add(cellKeyA);
}

/**
 * Remove a connection between two cells
 */
function removeConnection(cellKeyA, cellKeyB) {
  playerConnections.get(cellKeyA)?.delete(cellKeyB);
  playerConnections.get(cellKeyB)?.delete(cellKeyA);
}

/**
 * Find path from one cell to another using BFS (for non-adjacent cells)
 * Returns array of cell keys (not including start, but including end)
 * Only paths through empty cells (for intermediates) are valid
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
      nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE
    );

    for (const [nr, nc] of neighbors) {
      const neighborKey = `${nr},${nc}`;
      if (visited.has(neighborKey)) continue;

      // Check if this is the target
      if (neighborKey === toKey) {
        // Target can have 0 or 1 connections
        const targetConnections = playerConnections.get(toKey)?.size || 0;
        if (targetConnections >= 2) continue;
        return [...path, neighborKey];
      }

      // For intermediate cells, they must be empty (not already drawn)
      // because they need 2 connections (entry and exit)
      if (playerDrawnCells.has(neighborKey)) continue;

      visited.add(neighborKey);
      queue.push([neighborKey, [...path, neighborKey]]);
    }
  }

  // No path found
  return null;
}


/**
 * Handle pointer down - start drag
 */
function handlePointerDown(event) {
  event.preventDefault();

  const cell = getCellFromPointer(event);
  if (!cell) return;

  // Capture pointer for smooth dragging
  canvas.setPointerCapture(event.pointerId);

  isDragging = true;
  hasDragMoved = false;
  dragPath = [cell.key];
  cellsAddedThisDrag = new Set();

  // If cell is not drawn, add it
  if (!playerDrawnCells.has(cell.key)) {
    playerDrawnCells.add(cell.key);
    if (!playerConnections.has(cell.key)) {
      playerConnections.set(cell.key, new Set());
    }
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
  if (cell.key === currentCell) return; // Same cell, ignore

  hasDragMoved = true;

  // Check if backtracking (moving to a cell already in drag path)
  const backtrackIndex = dragPath.indexOf(cell.key);
  if (backtrackIndex !== -1 && backtrackIndex < dragPath.length - 1) {
    // Backtracking! Remove connections and cells from backtrackIndex+1 onwards
    for (let i = dragPath.length - 1; i > backtrackIndex; i--) {
      const cellToRemove = dragPath[i];
      const prevCell = dragPath[i - 1];

      // Remove connection between these cells
      removeConnection(prevCell, cellToRemove);

      // If this cell was added during this drag and now has 0 connections, remove it
      if (cellsAddedThisDrag.has(cellToRemove)) {
        const connections = playerConnections.get(cellToRemove);
        if (!connections || connections.size === 0) {
          playerDrawnCells.delete(cellToRemove);
          playerConnections.delete(cellToRemove);
          cellsAddedThisDrag.delete(cellToRemove);
        }
      }
    }

    // Trim drag path
    dragPath = dragPath.slice(0, backtrackIndex + 1);
    render();
    return;
  }

  // Moving forward - try to connect to the new cell
  // Check if current cell can accept another connection
  const currentConnections = playerConnections.get(currentCell)?.size || 0;
  if (currentConnections >= 2) {
    // Current cell is full, can't add more connections
    return;
  }

  // Find path to the new cell (handles non-adjacent cells)
  const path = findPathToCell(currentCell, cell.key);
  if (path && path.length > 0) {
    // Add all cells in path
    let prevInDrag = currentCell;
    for (const pathCell of path) {
      // Add cell if not already drawn
      if (!playerDrawnCells.has(pathCell)) {
        playerDrawnCells.add(pathCell);
        if (!playerConnections.has(pathCell)) {
          playerConnections.set(pathCell, new Set());
        }
        cellsAddedThisDrag.add(pathCell);
      }

      // Try to connect
      if (canConnect(prevInDrag, pathCell)) {
        addConnection(prevInDrag, pathCell);
        dragPath.push(pathCell);
        prevInDrag = pathCell;
      } else {
        // Can't connect, stop here
        break;
      }
    }
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
    // This was a tap on a single cell

    // If cell existed before this drag (not added), check for double-tap
    if (!cellsAddedThisDrag.has(cell.key)) {
      if (lastTappedCell === cell.key) {
        // Double-tap to delete
        const [row, col] = cell.key.split(',').map(Number);
        clearPlayerCell(row, col);
        lastTappedCell = null;
      } else {
        // Single tap on existing cell - try to connect from lastTappedCell
        if (lastTappedCell && playerDrawnCells.has(lastTappedCell)) {
          tryConnect(lastTappedCell, cell.key);
        }
        lastTappedCell = cell.key;
      }
    } else {
      // Cell was just added - try to connect from lastTappedCell
      if (lastTappedCell && playerDrawnCells.has(lastTappedCell)) {
        tryConnect(lastTappedCell, cell.key);
      }
      lastTappedCell = cell.key;
    }
  } else if (dragPath.length > 0) {
    // Was a drag - update lastTappedCell to the end of the drag
    lastTappedCell = dragPath[dragPath.length - 1];
  }

  // Reset drag state
  isDragging = false;
  dragPath = [];
  cellsAddedThisDrag = new Set();
  hasDragMoved = false;

  render();
}

/**
 * Handle pointer cancel - abort drag
 */
function handlePointerCancel(event) {
  canvas.releasePointerCapture(event.pointerId);

  // Keep changes made during drag, just reset state
  isDragging = false;
  dragPath = [];
  cellsAddedThisDrag = new Set();
  hasDragMoved = false;
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
 * Calculate optimal cell size based on viewport
 */
function calculateCellSize() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Reserve space for buttons (80px top, 20px padding)
  const availableHeight = viewportHeight - 100;
  const availableWidth = viewportWidth - 40; // 20px padding each side

  const maxCellSize = Math.min(
    availableWidth / GRID_SIZE,
    availableHeight / GRID_SIZE
  );

  // Ensure minimum cell size for usability (50px) and maximum (100px)
  return Math.max(50, Math.min(maxCellSize, 100));
}

/**
 * Resize canvas and re-render
 */
function resizeCanvas() {
  cellSize = calculateCellSize();
  const totalSize = cellSize * GRID_SIZE;

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
  const totalSize = cellSize * GRID_SIZE;

  // Clear canvas
  clearCanvas(ctx, totalSize, totalSize);

  // Render grid
  renderGrid(ctx, GRID_SIZE, cellSize);

  // Render cell numbers (turn counts)
  renderCellNumbers(ctx, GRID_SIZE, cellSize, solutionPath, hintCells, hintMode);

  // Render solution path
  renderPath(ctx, solutionPath, cellSize);

  // Render player path on top
  renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize);
}

/**
 * Generate a new puzzle
 */
function generateNewPuzzle() {
  solutionPath = generateSolutionPath(GRID_SIZE);
  hintCells = generateHintCells(GRID_SIZE, 0.3);

  // Clear player state
  playerDrawnCells.clear();
  playerConnections.clear();
  lastTappedCell = null;

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

  // Prevent double-tap zoom by handling touchend
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  // Set up resize handler
  window.addEventListener('resize', resizeCanvas);

  // Set up button handlers
  newBtn.addEventListener('click', generateNewPuzzle);

  // Set up hints toggle - use click on label to cycle through states
  hintsCheckbox.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default checkbox behavior
    cycleHintMode();
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

  console.log('Loop Puzzle Game initialized');
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
