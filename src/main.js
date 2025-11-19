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
 * Handle a cell tap
 */
function handleCellTap(row, col) {
  const cellKey = `${row},${col}`;

  if (playerDrawnCells.has(cellKey)) {
    // Cell is already drawn
    if (lastTappedCell === cellKey) {
      // Second tap on same cell - clear it
      clearPlayerCell(row, col);
      lastTappedCell = null;
    } else {
      // Tapping a different drawn cell - try to connect from last
      if (lastTappedCell && playerDrawnCells.has(lastTappedCell)) {
        tryConnect(lastTappedCell, cellKey);
      }
      lastTappedCell = cellKey;
    }
  } else {
    // New cell - draw it
    playerDrawnCells.add(cellKey);

    // Initialize connections for this cell
    if (!playerConnections.has(cellKey)) {
      playerConnections.set(cellKey, new Set());
    }

    // Try to connect from lastTappedCell
    if (lastTappedCell && playerDrawnCells.has(lastTappedCell)) {
      tryConnect(lastTappedCell, cellKey);
    }

    lastTappedCell = cellKey;
  }

  render();
}

/**
 * Handle canvas click events
 */
function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const col = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);

  // Check bounds
  if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
    handleCellTap(row, col);
  }
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

  // Set canvas dimensions
  canvas.width = totalSize;
  canvas.height = totalSize;
  canvas.style.width = totalSize + 'px';
  canvas.style.height = totalSize + 'px';

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
  // Set up resize handler
  window.addEventListener('resize', resizeCanvas);

  // Set up button handlers
  newBtn.addEventListener('click', generateNewPuzzle);

  // Set up hints toggle - use click on label to cycle through states
  hintsCheckbox.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default checkbox behavior
    cycleHintMode();
  });

  // Set up canvas click handler for player drawing
  canvas.addEventListener('click', handleCanvasClick);

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
