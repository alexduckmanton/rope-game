/**
 * Tutorial View - Interactive tutorial with progressive puzzles
 *
 * Teaches players the game mechanics through simple empty grid puzzles
 */

import { renderGrid, clearCanvas, renderPlayerPath, renderCellNumbers, buildPlayerTurnMap, renderHintPulse } from '../renderer.js';
import { buildSolutionTurnMap, countTurnsInArea, checkStructuralLoop, showAlertAsync } from '../utils.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';
import { createGameCore } from '../gameCore.js';

/* ============================================================================
 * TUTORIAL CONFIGURATIONS
 * ========================================================================= */

const TUTORIAL_CONFIGS = {
  '1': {
    gridSize: 2,
    heading: 'Tutorial 1/4',
    instruction: 'Drag to make a loop',
    nextRoute: '/tutorial?page=2',
    hasHints: false
  },
  '2': {
    gridSize: 4,
    heading: 'Tutorial 2/4',
    instruction: 'Loops must touch every square.\nTap to erase parts of your loop.',
    nextRoute: '/tutorial?page=3',
    hasHints: false
  },
  '3': {
    gridSize: 4,
    heading: 'Tutorial 3/4',
    instruction: 'Numbers count nearby bends in your loop.\nThis loop has 3 bends in the glowing squares.',
    nextRoute: '/tutorial?page=4',
    hasHints: true,
    // Snake pattern solution path for 4x4 grid
    // This creates 3 turns in the 3x3 area around [2,1]
    solutionPath: [
      {row: 0, col: 0},
      {row: 0, col: 1},
      {row: 0, col: 2},
      {row: 0, col: 3},
      {row: 1, col: 3},
      {row: 1, col: 2},
      {row: 1, col: 1},
      {row: 1, col: 0},
      {row: 2, col: 0},
      {row: 2, col: 1},
      {row: 2, col: 2},
      {row: 2, col: 3},
      {row: 3, col: 3},
      {row: 3, col: 2},
      {row: 3, col: 1},
      {row: 3, col: 0}
    ],
    hintCells: new Set(['2,1']),
    borderMode: 'off'
  },
  '4': {
    gridSize: 4,
    heading: 'Tutorial 4/4',
    instruction: 'Try another with two numbers.',
    nextRoute: '/tutorial?page=complete',
    hasHints: true,
    // Vertical snake pattern solution path for 4x4 grid
    // This creates 2 turns in the 3x3 area around [3,0] and 2 turns around [1,2]
    solutionPath: [
      {row: 0, col: 0},
      {row: 1, col: 0},
      {row: 2, col: 0},
      {row: 3, col: 0},
      {row: 3, col: 1},
      {row: 2, col: 1},
      {row: 1, col: 1},
      {row: 0, col: 1},
      {row: 0, col: 2},
      {row: 1, col: 2},
      {row: 2, col: 2},
      {row: 3, col: 2},
      {row: 3, col: 3},
      {row: 2, col: 3},
      {row: 1, col: 3},
      {row: 0, col: 3}
    ],
    hintCells: new Set(['3,0', '1,2']),
    borderMode: 'off'
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
let tutorialTitle;
let restartBtn;
let backBtn;
let headingEl;
let instructionEl;
let completeScreen;
let completeHomeBtn;

// Game state
let hasWon = false;
let hasShownPartialWinFeedback = false;
let solutionPath = [];
let hintCells = new Set();
let borderMode = 'off';

// Game core instance
let gameCore;

// Animation tracking
let animationFrameId = null;
let isAnimationFramePending = false;

// Event listener references for cleanup
let eventListeners = [];

/* ============================================================================
 * VALIDATION
 * ========================================================================= */

function checkStructuralWin() {
  const { playerDrawnCells, playerConnections } = gameCore.state;
  return checkStructuralLoop(playerDrawnCells, playerConnections, gridSize);
}

function checkWin() {
  // First check structural validity
  if (!checkStructuralWin()) return false;

  // For tutorials with hints, validate hint turn counts (like the main game)
  if (currentConfig && currentConfig.hasHints) {
    const { playerDrawnCells, playerConnections } = gameCore.state;
    const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);
    const solutionTurnMap = buildSolutionTurnMap(solutionPath);

    for (const cellKey of hintCells) {
      const [row, col] = cellKey.split(',').map(Number);
      const expectedTurnCount = countTurnsInArea(row, col, gridSize, solutionTurnMap);
      const actualTurnCount = countTurnsInArea(row, col, gridSize, playerTurnMap);
      if (expectedTurnCount !== actualTurnCount) return false;
    }
  }

  return true;
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
  // Clear the pending flag since we're now rendering
  isAnimationFramePending = false;

  const { playerDrawnCells, playerConnections } = gameCore.state;
  const totalSize = cellSize * gridSize;

  clearCanvas(ctx, totalSize, totalSize);

  // Render pulsing hint backgrounds (before grid for proper layering)
  if (currentConfig && currentConfig.hasHints) {
    const animationTime = Date.now();
    renderHintPulse(ctx, gridSize, cellSize, solutionPath, hintCells, animationTime, playerDrawnCells, playerConnections);
  }

  renderGrid(ctx, gridSize, cellSize);

  // Render hints for tutorial 3, otherwise no hints
  if (currentConfig && currentConfig.hasHints) {
    renderCellNumbers(ctx, gridSize, cellSize, solutionPath, hintCells, 'partial', playerDrawnCells, playerConnections, borderMode, true);
  }

  renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);

  // Continue animation loop for tutorials with hints (only if not already pending)
  if (currentConfig && currentConfig.hasHints && !isAnimationFramePending) {
    isAnimationFramePending = true;
    animationFrameId = requestAnimationFrame(render);
  }

  if (!hasWon && checkStructuralWin()) {
    // Check if this is a full win or partial win (valid loop but wrong hints)
    if (checkWin()) {
      // Full win - all validation passed
      hasWon = true;
      hasShownPartialWinFeedback = false; // Reset flag
      renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);
      showAlertAsync('You made a loop!', () => {
        // Navigate to next tutorial or complete screen
        if (currentConfig && currentConfig.nextRoute) {
          navigate(currentConfig.nextRoute);
        }
      });
    } else if (currentConfig && currentConfig.hasHints && !hasShownPartialWinFeedback) {
      // Partial win - valid loop but hints don't match
      // Only show feedback once per structural completion
      hasShownPartialWinFeedback = true;

      // Calculate turn counts for feedback
      const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);
      const solutionTurnMap = buildSolutionTurnMap(solutionPath);

      // Find which hints don't match and build feedback message
      const mismatches = [];
      for (const cellKey of hintCells) {
        const [row, col] = cellKey.split(',').map(Number);
        const expectedTurnCount = countTurnsInArea(row, col, gridSize, solutionTurnMap);
        const actualTurnCount = countTurnsInArea(row, col, gridSize, playerTurnMap);
        if (expectedTurnCount !== actualTurnCount) {
          mismatches.push({ expected: expectedTurnCount, actual: actualTurnCount });
        }
      }

      // Show feedback alert
      if (mismatches.length === 1) {
        // Single hint feedback (tutorial 3)
        const { expected, actual } = mismatches[0];
        showAlertAsync(`This loop has ${actual} bends in the squares touching the ${expected}. Try a different loop shape to complete this tutorial.`);
      } else {
        // Multiple hints feedback (tutorial 4+)
        showAlertAsync(`This loop doesn't have the right number of bends for the numbers. Try a different loop shape to complete this tutorial.`);
      }
    }
  } else {
    // If structural win is no longer valid, reset the feedback flag
    if (!checkStructuralWin()) {
      hasShownPartialWinFeedback = false;
    }
  }
}

function restartPuzzle() {
  gameCore.restartPuzzle();
  hasWon = false;
  hasShownPartialWinFeedback = false;
  render();
}

/* ============================================================================
 * TUTORIAL PAGE MANAGEMENT
 * ========================================================================= */

function showCompletScreen() {
  // Hide game elements
  canvas.style.display = 'none';
  instructionEl.style.display = 'none';
  restartBtn.style.display = 'none';

  // Show complete screen
  completeScreen.classList.add('active');
}

function hideCompleteScreen() {
  // Show game elements
  canvas.style.display = 'block';
  instructionEl.style.display = 'block';
  restartBtn.style.display = 'block';

  // Hide complete screen
  completeScreen.classList.remove('active');
}

function initTutorialGame(config) {
  currentConfig = config;
  gridSize = config.gridSize;

  // Set tutorial info
  tutorialTitle.textContent = config.heading;
  instructionEl.textContent = config.instruction;

  // Reset state
  hasWon = false;
  hasShownPartialWinFeedback = false;

  // Set up hints and border for tutorial 3
  if (config.hasHints) {
    solutionPath = config.solutionPath;
    hintCells = config.hintCells;
    borderMode = config.borderMode;
  } else {
    solutionPath = [];
    hintCells = new Set();
    borderMode = 'off';
  }

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
  tutorialTitle = document.getElementById('tutorial-title');
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
    tutorialTitle.textContent = 'Tutorial';
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
      // Cancel animation frame if running
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        isAnimationFramePending = false;
      }

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

  // Use gameCore methods for pointer events
  const pointerDownHandler = (e) => {
    if (!hasWon) gameCore.handlePointerDown(e);
  };
  const pointerMoveHandler = (e) => gameCore.handlePointerMove(e);
  const pointerUpHandler = (e) => gameCore.handlePointerUp(e);
  const pointerCancelHandler = (e) => gameCore.handlePointerCancel(e);

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
    // Cancel animation frame if running
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      isAnimationFramePending = false;
    }

    for (const { element, event, handler } of eventListeners) {
      element.removeEventListener(event, handler);
    }
    eventListeners = [];
    if (gameCore) {
      gameCore.resetDragState();
    }
  };
}
