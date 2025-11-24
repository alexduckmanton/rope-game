/**
 * Tutorial View - Interactive tutorial with progressive puzzles
 *
 * Teaches players the game mechanics through simple empty grid puzzles
 */

import { renderGrid, clearCanvas, renderPlayerPath } from '../renderer.js';
import { isAdjacent, determineConnectionToBreak, findShortestPath } from '../utils.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';

/* ============================================================================
 * TUTORIAL CONFIGURATIONS
 * ========================================================================= */

const TUTORIAL_CONFIGS = {
  '1': {
    gridSize: 2,
    heading: 'Tutorial 1/2',
    instruction: 'Drag to make a loop',
    nextRoute: '/tutorial?page=2'
  },
  '2': {
    gridSize: 4,
    heading: 'Tutorial 2/2',
    instruction: 'Make a loop that touches every square',
    nextRoute: '/tutorial?page=complete'
  }
};

/* ============================================================================
 * STATE VARIABLES
 * ========================================================================= */

// Tutorial configuration
let currentConfig = null;
let gridSize = 4;
let cellSize = 0;

// DOM elements
let canvas;
let ctx;
let restartBtn;
let backBtn;
let headingEl;
let instructionEl;
let completeScreen;
let completeHomeBtn;

// Game state (no hints for tutorials)
let hasWon = false;

// Player path state
let playerDrawnCells = new Set();
let playerConnections = new Map();

// Drag interaction state
let isDragging = false;
let dragPath = [];
let cellsAddedThisDrag = new Set();
let hasDragMoved = false;

// Event listener references for cleanup
let eventListeners = [];

/* ============================================================================
 * PLAYER CELL & CONNECTION MANAGEMENT
 * ========================================================================= */

function clearPlayerCell(row, col) {
  const cellKey = `${row},${col}`;
  playerDrawnCells.delete(cellKey);
  const connections = playerConnections.get(cellKey);
  if (connections) {
    for (const connectedCell of connections) {
      playerConnections.get(connectedCell)?.delete(cellKey);
    }
    playerConnections.delete(cellKey);
  }
}

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

function removeConnection(cellKeyA, cellKeyB) {
  playerConnections.get(cellKeyA)?.delete(cellKeyB);
  playerConnections.get(cellKeyB)?.delete(cellKeyA);
}

function ensureConnectionMap(cellKey) {
  if (!playerConnections.has(cellKey)) {
    playerConnections.set(cellKey, new Set());
  }
}

function resetDragState() {
  isDragging = false;
  dragPath = [];
  cellsAddedThisDrag = new Set();
  hasDragMoved = false;
}

function cleanupOrphanedCells() {
  let foundOrphan = true;
  while (foundOrphan) {
    foundOrphan = false;
    for (const cellKey of playerDrawnCells) {
      const connections = playerConnections.get(cellKey);
      if (!connections || connections.size === 0) {
        playerDrawnCells.delete(cellKey);
        playerConnections.delete(cellKey);
        foundOrphan = true;
        break;
      }
    }
  }
}

/* ============================================================================
 * PATH CONNECTION LOGIC
 * ========================================================================= */

function forceConnection(cellKeyA, cellKeyB) {
  const [r1, c1] = cellKeyA.split(',').map(Number);
  const [r2, c2] = cellKeyB.split(',').map(Number);

  if (!isAdjacent(r1, c1, r2, c2)) return false;
  if (playerConnections.get(cellKeyA)?.has(cellKeyB)) return false;

  ensureConnectionMap(cellKeyA);
  ensureConnectionMap(cellKeyB);

  const connectionsA = playerConnections.get(cellKeyA);
  if (connectionsA.size >= 2) {
    const toBreak = determineConnectionToBreak(cellKeyA, cellKeyB, connectionsA);
    removeConnection(cellKeyA, toBreak);
  }

  const connectionsB = playerConnections.get(cellKeyB);
  if (connectionsB.size >= 2) {
    const toBreak = determineConnectionToBreak(cellKeyB, cellKeyA, connectionsB);
    removeConnection(cellKeyB, toBreak);
  }

  playerConnections.get(cellKeyA).add(cellKeyB);
  playerConnections.get(cellKeyB).add(cellKeyA);

  return true;
}

function findPathToCell(fromKey, toKey) {
  return findShortestPath(fromKey, toKey, gridSize);
}

/* ============================================================================
 * VALIDATION
 * ========================================================================= */

function checkWin() {
  const totalCells = gridSize * gridSize;

  // Check if all cells are visited
  if (playerDrawnCells.size !== totalCells) return false;

  // Check if each cell has exactly 2 connections (closed loop)
  for (const cellKey of playerDrawnCells) {
    const connections = playerConnections.get(cellKey);
    if (!connections || connections.size !== 2) return false;
  }

  // No hints in tutorials, so just check completeness
  return true;
}

/* ============================================================================
 * DRAG INTERACTION HELPERS
 * ========================================================================= */

function tryCloseLoop(currentDragPath) {
  if (currentDragPath.length < 2) return false;
  const lastCell = currentDragPath[currentDragPath.length - 1];
  const firstCell = currentDragPath[0];

  if (playerConnections.get(lastCell)?.has(firstCell) || forceConnection(lastCell, firstCell)) {
    dragPath.push(firstCell);
    cleanupOrphanedCells();
    render();
    return true;
  }
  return false;
}

function handleBacktrack(backtrackIndex) {
  for (let i = dragPath.length - 1; i > backtrackIndex; i--) {
    const cellToRemove = dragPath[i];
    const prevCell = dragPath[i - 1];
    removeConnection(prevCell, cellToRemove);
  }
  dragPath = dragPath.slice(0, backtrackIndex + 1);
  cleanupOrphanedCells();
  render();
}

function extendDragPath(newCellKey, currentCellKey) {
  const path = findPathToCell(currentCellKey, newCellKey);
  if (!path || path.length === 0) return;

  let prevInDrag = currentCellKey;
  for (const pathCell of path) {
    if (!playerDrawnCells.has(pathCell)) {
      playerDrawnCells.add(pathCell);
      ensureConnectionMap(pathCell);
      cellsAddedThisDrag.add(pathCell);
    }

    if (playerConnections.get(prevInDrag)?.has(pathCell)) {
      dragPath.push(pathCell);
      prevInDrag = pathCell;
    } else if (forceConnection(prevInDrag, pathCell)) {
      dragPath.push(pathCell);
      prevInDrag = pathCell;
    } else {
      break;
    }
  }
  cleanupOrphanedCells();
  render();
}

/* ============================================================================
 * EVENT HANDLERS
 * ========================================================================= */

function handlePointerDown(event) {
  event.preventDefault();
  if (hasWon) return;

  const cell = getCellFromPointer(event);
  if (!cell) return;

  canvas.setPointerCapture(event.pointerId);
  isDragging = true;
  hasDragMoved = false;
  dragPath = [cell.key];
  cellsAddedThisDrag = new Set();

  if (!playerDrawnCells.has(cell.key)) {
    playerDrawnCells.add(cell.key);
    ensureConnectionMap(cell.key);
    cellsAddedThisDrag.add(cell.key);
  }

  render();
}

function handlePointerMove(event) {
  if (!isDragging) return;
  event.preventDefault();

  const cell = getCellFromPointer(event);
  if (!cell) return;

  const currentCell = dragPath[dragPath.length - 1];
  if (cell.key === currentCell) return;

  hasDragMoved = true;

  const backtrackIndex = dragPath.indexOf(cell.key);
  if (backtrackIndex !== -1 && backtrackIndex < dragPath.length - 1) {
    if (backtrackIndex === 0) {
      if (tryCloseLoop(dragPath)) {
        return;
      }
    }
    handleBacktrack(backtrackIndex);
    return;
  }

  extendDragPath(cell.key, currentCell);
}

function handlePointerUp(event) {
  if (!isDragging) return;

  canvas.releasePointerCapture(event.pointerId);

  const cell = getCellFromPointer(event);

  if (!hasDragMoved && cell && dragPath.length === 1 && dragPath[0] === cell.key) {
    if (!cellsAddedThisDrag.has(cell.key)) {
      const [row, col] = cell.key.split(',').map(Number);
      clearPlayerCell(row, col);
    }
  }

  resetDragState();
  cleanupOrphanedCells();
  render();
}

function handlePointerCancel(event) {
  canvas.releasePointerCapture(event.pointerId);
  resetDragState();
  cleanupOrphanedCells();
}

/* ============================================================================
 * GAME LIFECYCLE & RENDERING
 * ========================================================================= */

function calculateCellSize() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const availableHeight = viewportHeight - CONFIG.LAYOUT.TOP_BAR_HEIGHT - 100; // Extra space for tutorial info
  const availableWidth = viewportWidth - CONFIG.LAYOUT.HORIZONTAL_PADDING;
  const maxCellSize = Math.min(availableWidth / gridSize, availableHeight / gridSize);
  return Math.max(CONFIG.CELL_SIZE_MIN, Math.min(maxCellSize, CONFIG.CELL_SIZE_MAX));
}

function resizeCanvas() {
  cellSize = calculateCellSize();
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
  const totalSize = cellSize * gridSize;

  clearCanvas(ctx, totalSize, totalSize);
  renderGrid(ctx, gridSize, cellSize);

  // No hints or solution in tutorials
  renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);

  if (!hasWon && checkWin()) {
    hasWon = true;
    renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);
    requestAnimationFrame(() => {
      setTimeout(() => {
        alert('You got it!');
        // Navigate to next tutorial or complete screen
        if (currentConfig && currentConfig.nextRoute) {
          navigate(currentConfig.nextRoute);
        }
      }, 0);
    });
  }
}

function restartPuzzle() {
  playerDrawnCells.clear();
  playerConnections.clear();
  hasWon = false;
  render();
}

/* ============================================================================
 * TUTORIAL PAGE MANAGEMENT
 * ========================================================================= */

function showCompletScreen() {
  // Hide game elements
  canvas.style.display = 'none';
  headingEl.style.display = 'none';
  instructionEl.style.display = 'none';
  restartBtn.style.display = 'none';

  // Show complete screen
  completeScreen.classList.add('active');
}

function hideCompleteScreen() {
  // Show game elements
  canvas.style.display = 'block';
  headingEl.style.display = 'block';
  instructionEl.style.display = 'block';
  restartBtn.style.display = 'block';

  // Hide complete screen
  completeScreen.classList.remove('active');
}

function initTutorialGame(config) {
  currentConfig = config;
  gridSize = config.gridSize;

  // Set tutorial info
  headingEl.textContent = config.heading;
  instructionEl.textContent = config.instruction;

  // Reset state
  playerDrawnCells.clear();
  playerConnections.clear();
  hasWon = false;

  // Setup canvas
  resizeCanvas();
}

/* ============================================================================
 * INITIALIZATION & CLEANUP
 * ========================================================================= */

/**
 * Initialize the tutorial view
 * @param {URLSearchParams} params - URL parameters (page=1, page=2, or page=complete)
 * @returns {Function} Cleanup function
 */
export function initTutorial(params) {
  const page = params.get('page') || '1';

  // Get DOM elements
  canvas = document.getElementById('tutorial-canvas');
  ctx = canvas.getContext('2d');
  restartBtn = document.getElementById('tutorial-restart-btn');
  backBtn = document.getElementById('tutorial-back-btn');
  headingEl = document.getElementById('tutorial-heading');
  instructionEl = document.getElementById('tutorial-instruction');
  completeScreen = document.getElementById('tutorial-complete-screen');
  completeHomeBtn = document.getElementById('tutorial-complete-home-btn');

  // Reset event listeners array
  eventListeners = [];

  // Handle complete screen
  if (page === 'complete') {
    showCompletScreen();

    // Setup complete home button
    const handleCompleteHome = () => {
      navigate('/');
    };
    completeHomeBtn.addEventListener('click', handleCompleteHome);
    eventListeners.push({ element: completeHomeBtn, event: 'click', handler: handleCompleteHome });

    // Setup back button for complete screen
    const handleBack = () => {
      if (history.state?.fromHome) {
        history.back();
      } else {
        navigate('/', true);
      }
    };
    backBtn.addEventListener('click', handleBack);
    eventListeners.push({ element: backBtn, event: 'click', handler: handleBack });

    // Return cleanup function
    return () => {
      for (const { element, event, handler } of eventListeners) {
        element.removeEventListener(event, handler);
      }
      eventListeners = [];
    };
  }

  // Regular tutorial page (1 or 2)
  hideCompleteScreen();

  const config = TUTORIAL_CONFIGS[page];
  if (!config) {
    // Invalid page, redirect to tutorial 1
    navigate('/tutorial?page=1', true);
    return null;
  }

  // Initialize tutorial game
  initTutorialGame(config);

  // Setup event handlers
  const resizeHandler = () => resizeCanvas();
  const restartBtnHandler = () => restartPuzzle();
  const backBtnHandler = () => {
    if (history.state?.fromHome) {
      history.back();
    } else {
      navigate('/', true);
    }
  };
  const pointerDownHandler = (e) => handlePointerDown(e);
  const pointerMoveHandler = (e) => handlePointerMove(e);
  const pointerUpHandler = (e) => handlePointerUp(e);
  const pointerCancelHandler = (e) => handlePointerCancel(e);

  // Attach event listeners
  window.addEventListener('resize', resizeHandler);
  restartBtn.addEventListener('click', restartBtnHandler);
  backBtn.addEventListener('click', backBtnHandler);
  canvas.addEventListener('pointerdown', pointerDownHandler);
  canvas.addEventListener('pointermove', pointerMoveHandler);
  canvas.addEventListener('pointerup', pointerUpHandler);
  canvas.addEventListener('pointercancel', pointerCancelHandler);

  // Store event listener references for cleanup
  eventListeners = [
    { element: window, event: 'resize', handler: resizeHandler },
    { element: restartBtn, event: 'click', handler: restartBtnHandler },
    { element: backBtn, event: 'click', handler: backBtnHandler },
    { element: canvas, event: 'pointerdown', handler: pointerDownHandler },
    { element: canvas, event: 'pointermove', handler: pointerMoveHandler },
    { element: canvas, event: 'pointerup', handler: pointerUpHandler },
    { element: canvas, event: 'pointercancel', handler: pointerCancelHandler }
  ];

  // Return cleanup function
  return () => {
    for (const { element, event, handler } of eventListeners) {
      element.removeEventListener(event, handler);
    }
    eventListeners = [];
    resetDragState();
  };
}
