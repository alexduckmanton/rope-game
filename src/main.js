/**
 * Loop Puzzle Game - Main Entry Point
 */

import { renderGrid, clearCanvas } from './renderer.js';

// Game configuration
const GRID_SIZE = 5;

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game state
let cellSize = 0;

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
}

/**
 * Initialize the game
 */
function init() {
  // Set up resize handler
  window.addEventListener('resize', resizeCanvas);

  // Initial setup
  resizeCanvas();

  console.log('Loop Puzzle Game initialized');
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
