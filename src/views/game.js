/**
 * Game View - Loop Puzzle Game Logic
 *
 * Extracted game logic with initialization and cleanup functions
 * for use in a multi-view SPA
 */

import { renderGrid, clearCanvas, renderPath, renderCellNumbers, generateHintCells, renderPlayerPath, buildPlayerTurnMap } from '../renderer.js';
import { generateSolutionPath } from '../generator.js';
import { isAdjacent, buildSolutionTurnMap, countTurnsInArea, determineConnectionToBreak, findShortestPath } from '../utils.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';

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

  if (playerDrawnCells.size !== totalCells) return false;

  for (const cellKey of playerDrawnCells) {
    const connections = playerConnections.get(cellKey);
    if (!connections || connections.size !== 2) return false;
  }

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
  renderCellNumbers(ctx, gridSize, cellSize, solutionPath, hintCells, hintMode, playerDrawnCells, playerConnections, borderMode);

  if (showSolution) {
    renderPath(ctx, solutionPath, cellSize);
  }

  renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);

  if (!hasWon && checkWin()) {
    hasWon = true;
    renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);
    requestAnimationFrame(() => {
      setTimeout(() => {
        alert('You win!');
      }, 0);
    });
  }
}

function generateNewPuzzle() {
  solutionPath = generateSolutionPath(gridSize);
  hintCells = generateHintCells(gridSize, CONFIG.HINT.PROBABILITY);
  playerDrawnCells.clear();
  playerConnections.clear();
  hasWon = false;
  render();
}

function restartPuzzle() {
  playerDrawnCells.clear();
  playerConnections.clear();
  hasWon = false;
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
  playerDrawnCells.clear();
  playerConnections.clear();
  hintMode = 'partial';
  borderMode = 'off';
  showSolution = false;
  hasWon = false;
  eventListeners = [];

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
  const backBtnHandler = () => navigate('/home');
  const pointerDownHandler = (e) => handlePointerDown(e);
  const pointerMoveHandler = (e) => handlePointerMove(e);
  const pointerUpHandler = (e) => handlePointerUp(e);
  const pointerCancelHandler = (e) => handlePointerCancel(e);

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

  // Reset drag state
  resetDragState();
}
