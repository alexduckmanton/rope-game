/**
 * Loop Puzzle Game - Main Entry Point
 */

import { renderGrid, clearCanvas, renderPath, renderCellNumbers, generateHintCells } from './renderer.js';
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
  updateCheckboxState();
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
}

/**
 * Generate a new puzzle
 */
function generateNewPuzzle() {
  solutionPath = generateSolutionPath(GRID_SIZE);
  hintCells = generateHintCells(GRID_SIZE, 0.3);
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
