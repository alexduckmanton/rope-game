/**
 * Game View - Loop Puzzle Game Logic
 *
 * Extracted game logic with initialization and cleanup functions
 * for use in a multi-view SPA
 */

import { renderGrid, clearCanvas, renderPath, renderCellNumbers, generateHintCells, renderPlayerPath, buildPlayerTurnMap } from '../renderer.js';
import { generateSolutionPath } from '../generator.js';
import { buildSolutionTurnMap, countTurnsInArea } from '../utils.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';
import { createGameCore } from '../gameCore.js';

/* ============================================================================
 * STATE VARIABLES
 * ========================================================================= */

// Game configuration
let gridSize = 4;
let cellSize = 0;

// DOM elements
let canvas;
let ctx;
let newBtn;
let restartBtn;
let hintsCheckbox;
let borderCheckbox;
let solutionCheckbox;
let backBtn;

// Puzzle state
let solutionPath = [];
let hintCells = new Set();
let hintMode = 'partial';
let borderMode = 'off';
let showSolution = false;
let hasWon = false;
let hasShownPartialWinFeedback = false;

// Game core instance
let gameCore;

// Event listener references for cleanup
let eventListeners = [];

/* ============================================================================
 * VALIDATION
 * ========================================================================= */

function checkStructuralWin() {
  const { playerDrawnCells, playerConnections } = gameCore.state;
  const totalCells = gridSize * gridSize;

  // Check if all cells are visited
  if (playerDrawnCells.size !== totalCells) return false;

  // Check if each cell has exactly 2 connections (closed loop)
  for (const cellKey of playerDrawnCells) {
    const connections = playerConnections.get(cellKey);
    if (!connections || connections.size !== 2) return false;
  }

  // Check if all cells form a SINGLE connected loop (not multiple separate loops)
  // Use BFS to traverse from one cell and verify we can reach all cells
  const startCell = playerDrawnCells.values().next().value;
  const visited = new Set();
  const queue = [startCell];
  visited.add(startCell);

  while (queue.length > 0) {
    const currentCell = queue.shift();
    const connections = playerConnections.get(currentCell);

    if (connections) {
      for (const connectedCell of connections) {
        if (!visited.has(connectedCell)) {
          visited.add(connectedCell);
          queue.push(connectedCell);
        }
      }
    }
  }

  // If we visited all cells, it's a single connected loop
  // If we didn't, there are multiple disconnected loops
  return visited.size === totalCells;
}

function checkWin() {
  // First check structural validity
  if (!checkStructuralWin()) return false;

  // Validate hint turn counts
  const { playerDrawnCells, playerConnections } = gameCore.state;
  const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);
  const solutionTurnMap = buildSolutionTurnMap(solutionPath);

  for (const cellKey of hintCells) {
    const [row, col] = cellKey.split(',').map(Number);
    const expectedTurnCount = countTurnsInArea(row, col, gridSize, solutionTurnMap);
    const actualTurnCount = countTurnsInArea(row, col, gridSize, playerTurnMap);
    if (expectedTurnCount !== actualTurnCount) return false;
  }

  return true;
}

/* ============================================================================
 * UI FUNCTIONS
 * ========================================================================= */

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

function cycleHintMode() {
  if (hintMode === 'none') {
    hintMode = 'partial';
  } else if (hintMode === 'partial') {
    hintMode = 'all';
  } else {
    hintMode = 'none';
  }
  setTimeout(updateCheckboxState, 0);
  render();
}

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

function cycleBorderMode() {
  if (borderMode === 'off') {
    borderMode = 'center';
  } else if (borderMode === 'center') {
    borderMode = 'full';
  } else {
    borderMode = 'off';
  }
  setTimeout(updateBorderCheckboxState, 0);
  render();
}

/* ============================================================================
 * GAME LIFECYCLE & RENDERING
 * ========================================================================= */

function calculateCellSize() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const availableHeight = viewportHeight - CONFIG.LAYOUT.TOP_BAR_HEIGHT;
  const availableWidth = viewportWidth - CONFIG.LAYOUT.HORIZONTAL_PADDING;
  const maxCellSize = Math.min(availableWidth / gridSize, availableHeight / gridSize);
  return Math.max(CONFIG.CELL_SIZE_MIN, Math.min(maxCellSize, CONFIG.CELL_SIZE_MAX));
}

function resizeCanvas() {
  cellSize = calculateCellSize();
  gameCore.setCellSize(cellSize);

  const totalSize = cellSize * gridSize;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = totalSize * dpr;
  canvas.height = totalSize * dpr;
  canvas.style.width = totalSize + 'px';
  canvas.style.height = totalSize + 'px';

  ctx.scale(dpr, dpr);
  render();
}

function render() {
  const { playerDrawnCells, playerConnections } = gameCore.state;
  const totalSize = cellSize * gridSize;

  clearCanvas(ctx, totalSize, totalSize);
  renderGrid(ctx, gridSize, cellSize);
  renderCellNumbers(ctx, gridSize, cellSize, solutionPath, hintCells, hintMode, playerDrawnCells, playerConnections, borderMode);

  if (showSolution) {
    renderPath(ctx, solutionPath, cellSize);
  }

  renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);

  if (!hasWon && checkStructuralWin()) {
    // Check if this is a full win or partial win (valid loop but wrong hints)
    if (checkWin()) {
      // Full win - all validation passed
      hasWon = true;
      hasShownPartialWinFeedback = false; // Reset flag
      renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);
      requestAnimationFrame(() => {
        setTimeout(() => {
          alert('You win!');
        }, 0);
      });
    } else if (!hasShownPartialWinFeedback) {
      // Partial win - valid loop but hints don't match
      // Only show feedback once per structural completion
      hasShownPartialWinFeedback = true;

      // Show feedback alert
      requestAnimationFrame(() => {
        setTimeout(() => {
          alert('Nice loop, but not all numbers have the correct amount of bends.');
        }, 0);
      });
    }
  } else {
    // If structural win is no longer valid, reset the feedback flag
    if (!checkStructuralWin()) {
      hasShownPartialWinFeedback = false;
    }
  }
}

function generateNewPuzzle() {
  solutionPath = generateSolutionPath(gridSize);
  hintCells = generateHintCells(gridSize, CONFIG.HINT.PROBABILITY);
  gameCore.restartPuzzle();
  hasWon = false;
  hasShownPartialWinFeedback = false;
  render();
}

function restartPuzzle() {
  gameCore.restartPuzzle();
  hasWon = false;
  hasShownPartialWinFeedback = false;
  render();
}

/* ============================================================================
 * INITIALIZATION & CLEANUP
 * ========================================================================= */

/**
 * Map difficulty to grid size
 */
function getGridSizeFromDifficulty(difficulty) {
  const difficultyMap = {
    'easy': 4,
    'medium': 6,
    'hard': 8
  };
  return difficultyMap[difficulty] || 6; // Default to medium
}

/**
 * Initialize the game view
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 */
export function initGame(difficulty) {
  // Set grid size from difficulty
  gridSize = getGridSizeFromDifficulty(difficulty);

  // Get DOM elements
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  newBtn = document.getElementById('new-btn');
  restartBtn = document.getElementById('restart-btn');
  hintsCheckbox = document.getElementById('hints-checkbox');
  borderCheckbox = document.getElementById('border-checkbox');
  solutionCheckbox = document.getElementById('solution-checkbox');
  backBtn = document.getElementById('back-btn');

  // Reset state
  hintMode = 'partial';
  borderMode = 'off';
  showSolution = false;
  hasWon = false;
  hasShownPartialWinFeedback = false;
  eventListeners = [];

  // Create game core instance
  gameCore = createGameCore({
    gridSize,
    canvas,
    onRender: () => {
      // Only render if not already won
      if (!hasWon) {
        render();
      }
    }
  });

  // Set up event listeners and store references for cleanup
  const resizeHandler = () => resizeCanvas();
  const newBtnHandler = () => generateNewPuzzle();
  const restartBtnHandler = () => restartPuzzle();
  const hintsHandler = (e) => {
    e.preventDefault();
    cycleHintMode();
  };
  const borderHandler = (e) => {
    e.preventDefault();
    cycleBorderMode();
  };
  const solutionHandler = () => {
    showSolution = solutionCheckbox.checked;
    render();
  };
  const backBtnHandler = () => {
    // Smart navigation: if we came from home, go back to original entry
    // Otherwise (direct URL visit), replace with home
    if (history.state?.fromHome) {
      history.back();
    } else {
      navigate('/', true);
    }
  };

  // Use gameCore methods for pointer events
  const pointerDownHandler = (e) => {
    if (!hasWon) gameCore.handlePointerDown(e);
  };
  const pointerMoveHandler = (e) => gameCore.handlePointerMove(e);
  const pointerUpHandler = (e) => gameCore.handlePointerUp(e);
  const pointerCancelHandler = (e) => gameCore.handlePointerCancel(e);

  window.addEventListener('resize', resizeHandler);
  newBtn.addEventListener('click', newBtnHandler);
  restartBtn.addEventListener('click', restartBtnHandler);
  hintsCheckbox.addEventListener('click', hintsHandler);
  borderCheckbox.addEventListener('click', borderHandler);
  solutionCheckbox.addEventListener('change', solutionHandler);
  backBtn.addEventListener('click', backBtnHandler);
  canvas.addEventListener('pointerdown', pointerDownHandler);
  canvas.addEventListener('pointermove', pointerMoveHandler);
  canvas.addEventListener('pointerup', pointerUpHandler);
  canvas.addEventListener('pointercancel', pointerCancelHandler);

  // Store event listener references for cleanup
  eventListeners = [
    { element: window, event: 'resize', handler: resizeHandler },
    { element: newBtn, event: 'click', handler: newBtnHandler },
    { element: restartBtn, event: 'click', handler: restartBtnHandler },
    { element: hintsCheckbox, event: 'click', handler: hintsHandler },
    { element: borderCheckbox, event: 'click', handler: borderHandler },
    { element: solutionCheckbox, event: 'change', handler: solutionHandler },
    { element: backBtn, event: 'click', handler: backBtnHandler },
    { element: canvas, event: 'pointerdown', handler: pointerDownHandler },
    { element: canvas, event: 'pointermove', handler: pointerMoveHandler },
    { element: canvas, event: 'pointerup', handler: pointerUpHandler },
    { element: canvas, event: 'pointercancel', handler: pointerCancelHandler }
  ];

  // Initial canvas setup
  resizeCanvas();

  // Generate initial puzzle
  generateNewPuzzle();

  // Set initial checkbox state
  updateCheckboxState();
  updateBorderCheckboxState();
}

/**
 * Cleanup function - removes all event listeners
 * Called when navigating away from game view
 */
export function cleanupGame() {
  // Remove all event listeners
  for (const { element, event, handler } of eventListeners) {
    element.removeEventListener(event, handler);
  }
  eventListeners = [];

  // Reset drag state in core
  if (gameCore) {
    gameCore.resetDragState();
  }
}
