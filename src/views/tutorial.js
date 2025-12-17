/**
 * Tutorial View - Interactive tutorial with progressive puzzles
 *
 * Teaches players the game mechanics through simple empty grid puzzles
 */

import { renderGrid, clearCanvas, renderPlayerPath, renderCellNumbers, buildPlayerTurnMap, renderHintPulse, calculateBorderLayers } from '../renderer.js';
import { buildSolutionTurnMap, countTurnsInArea, parseCellKey } from '../utils.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';
import { createGameCore } from '../gameCore.js';
import { showBottomSheetAsync } from '../bottomSheet.js';
import { calculateCellSize as calculateCellSizeUtil } from '../game/canvasSetup.js';
import { checkPartialStructuralWin, validateHints, checkShouldValidate } from '../game/validation.js';
import { markTutorialCompleted } from '../persistence.js';

/* ============================================================================
 * TUTORIAL CONFIGURATIONS
 * ========================================================================= */

const TUTORIAL_CONFIGS = {
  '1': {
    gridSize: 2,
    heading: 'Tutorial 1/4',
    instruction: 'Drag to make a loop',
    nextRoute: '/tutorial?page=2',
    hasHints: false,
    introTitle: 'Draw a circle',
    introContent: `
      <div class="bottom-sheet-message">
        <p>To win, draw a line that connects at both ends to form a closed loop.</p>
        <p>Try drawing a circle!</p>
      </div>
    `
  },
  '2': {
    gridSize: 4,
    heading: 'Tutorial 2/4',
    instruction: 'Your loop can be any shape.\nTap to erase parts of your loop.',
    nextRoute: '/tutorial?page=3',
    hasHints: false,
    introTitle: 'Draw any shape',
    introContent: `
      <div class="bottom-sheet-message">
        <p>Try another with a bigger grid. Your loop can be any shape, so long as it connects at both ends.</p>
        <p>Try drawing a bigger loop.</p>
      </div>
    `
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
    borderMode: 'off',
    introTitle: 'Crunch the numbers',
    introContent: `
      <div class="bottom-sheet-message">
        <p>Numbers count down every time your loop bends in the squares they touch. To win, all numbers must be 0.</p>
        <p>Try drawing a loop with 3 bends in the highlighted squares.</p>
      </div>
    `
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
    borderMode: 'off',
    introTitle: 'Multiple numbers',
    introContent: `
      <div class="bottom-sheet-message">
        <p>Things get trickier when there are multiple numbers. They can even overlap!</p>
        <p>Try drawing a loop that satisfies both numbers in the grid.</p>
      </div>
    `
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
let helpBtn;
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
let lastValidatedStateKey = '';  // Track state to avoid redundant validation

// Cached values for performance (recalculated when puzzle changes)
let cachedBorderLayers = null;
let cachedSolutionTurnMap = null;

// Game core instance
let gameCore;

// Bottom sheet instance for cleanup
let activeTutorialSheet;

// Animation tracking
let animationFrameId = null;
let isAnimationFramePending = false;

// Event listener references for cleanup
let eventListeners = [];

/* ============================================================================
 * VALIDATION
 * ========================================================================= */

const TUTORIAL_EXTRA_HEIGHT = 100; // Extra space for tutorial instruction text

function checkStructuralWin() {
  const { playerDrawnCells, playerConnections } = gameCore.state;
  return checkPartialStructuralWin(playerDrawnCells, playerConnections);
}

function checkWin(playerTurnMap = null) {
  // First check structural validity (any closed loop)
  if (!checkStructuralWin()) return false;

  // For tutorials with hints, validate hint turn counts
  if (currentConfig && currentConfig.hasHints) {
    const { playerDrawnCells, playerConnections } = gameCore.state;
    const sTurnMap = cachedSolutionTurnMap || buildSolutionTurnMap(solutionPath);
    const pTurnMap = playerTurnMap || buildPlayerTurnMap(playerDrawnCells, playerConnections);

    return validateHints(sTurnMap, pTurnMap, hintCells, gridSize);
  }

  // For tutorials without hints, any closed loop wins
  return true;
}


/* ============================================================================
 * GAME LIFECYCLE & RENDERING
 * ========================================================================= */

function calculateCellSize() {
  return calculateCellSizeUtil(gridSize, TUTORIAL_EXTRA_HEIGHT);
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

  // Build player turn map ONCE per render for reuse
  const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);

  clearCanvas(ctx, totalSize, totalSize);

  // Render pulsing hint backgrounds (before grid for proper layering)
  if (currentConfig && currentConfig.hasHints) {
    const animationTime = Date.now();
    renderHintPulse(ctx, gridSize, cellSize, solutionPath, hintCells, animationTime, playerDrawnCells, playerConnections, true, cachedSolutionTurnMap, playerTurnMap);
  }

  renderGrid(ctx, gridSize, cellSize);

  // Render hints for tutorial 3, otherwise no hints
  let hasNumberAnimations = false;
  if (currentConfig && currentConfig.hasHints) {
    const renderResult = renderCellNumbers(ctx, gridSize, cellSize, solutionPath, hintCells, 'partial', playerDrawnCells, playerConnections, borderMode, true, cachedSolutionTurnMap, playerTurnMap, cachedBorderLayers);
    hasNumberAnimations = renderResult && renderResult.hasActiveAnimations;
  }

  const pathRenderResult = renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);
  const hasPathAnimations = pathRenderResult && pathRenderResult.hasActiveAnimations;

  // Continue animation loop for tutorials with hints (for pulse animation) or active path animations
  const needsAnimationLoop =
    (currentConfig && currentConfig.hasHints) ||  // Pulse animation is always active when hints shown
    hasPathAnimations;                             // Path grow animations

  if (needsAnimationLoop && !isAnimationFramePending) {
    isAnimationFramePending = true;
    animationFrameId = requestAnimationFrame(render);
  }

  // Check if we should run validation based on state changes and drag state
  const { shouldValidate, currentStateKey } = checkShouldValidate({
    playerDrawnCells,
    playerConnections,
    gameCore,
    hasWon,
    lastValidatedStateKey
  });

  if (shouldValidate && checkStructuralWin()) {
    // Update last validated state now that we're actually validating
    lastValidatedStateKey = currentStateKey;

    // Check if this is a full win or partial win (valid loop but wrong hints)
    // Pass pre-built player turn map to avoid rebuilding
    if (checkWin(playerTurnMap)) {
      // Full win - all validation passed
      hasWon = true;
      hasShownPartialWinFeedback = false; // Reset flag
      // Re-render path with win color
      renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);

      // Show win bottom sheet with navigation on close
      // Destroy any previous tutorial sheet before showing new one
      if (activeTutorialSheet) {
        activeTutorialSheet.destroy();
      }
      activeTutorialSheet = showBottomSheetAsync({
        title: 'You made a loop!',
        content: '<div class="bottom-sheet-message">Great job! Let\'s continue.</div>',
        icon: 'party-popper',
        colorScheme: 'success',
        dismissLabel: 'Next',
        dismissVariant: 'primary',
        onClose: () => {
          // Navigate to next tutorial or complete screen
          if (currentConfig && currentConfig.nextRoute) {
            navigate(currentConfig.nextRoute);
          }
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
        const { row, col } = parseCellKey(cellKey);
        const expectedTurnCount = countTurnsInArea(row, col, gridSize, solutionTurnMap);
        const actualTurnCount = countTurnsInArea(row, col, gridSize, playerTurnMap);
        if (expectedTurnCount !== actualTurnCount) {
          mismatches.push({ expected: expectedTurnCount, actual: actualTurnCount });
        }
      }

      // Show feedback bottom sheet
      let feedbackContent;
      if (mismatches.length === 1) {
        // Single hint feedback (tutorial 3)
        const { expected, actual } = mismatches[0];
        feedbackContent = `<div class="bottom-sheet-message">This loop has ${actual} bends in the squares touching the ${expected}. Try a different loop shape to complete this tutorial.</div>`;
      } else {
        // Multiple hints feedback (tutorial 4+)
        feedbackContent = `<div class="bottom-sheet-message">This loop doesn't have the right number of bends for the numbers. Try a different loop shape to complete this tutorial.</div>`;
      }

      // Destroy any previous tutorial sheet before showing new one
      if (activeTutorialSheet) {
        activeTutorialSheet.destroy();
      }
      activeTutorialSheet = showBottomSheetAsync({
        title: 'Not quite!',
        content: feedbackContent,
        icon: 'circle-off',
        colorScheme: 'error',
        dismissLabel: 'Keep trying'
      });
    }
  } else if (shouldValidate) {
    // Update last validated state now that we're actually validating
    lastValidatedStateKey = currentStateKey;

    // Reset feedback flag if structural win is no longer valid
    if (!checkStructuralWin()) {
      hasShownPartialWinFeedback = false;
    }
  }
}

function restartPuzzle() {
  gameCore.restartPuzzle();
  hasWon = false;
  hasShownPartialWinFeedback = false;
  lastValidatedStateKey = '';
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
  lastValidatedStateKey = '';

  // Set up hints and border for tutorial 3
  if (config.hasHints) {
    solutionPath = config.solutionPath;
    hintCells = config.hintCells;
    borderMode = config.borderMode;

    // Cache values that don't change during gameplay for performance
    cachedSolutionTurnMap = buildSolutionTurnMap(solutionPath);
    cachedBorderLayers = calculateBorderLayers(hintCells, gridSize);
  } else {
    solutionPath = [];
    hintCells = new Set();
    borderMode = 'off';
    cachedSolutionTurnMap = null;
    cachedBorderLayers = null;
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
  helpBtn = document.getElementById('tutorial-help-btn');
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
      markTutorialCompleted();
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

      // Clean up any active bottom sheet
      if (activeTutorialSheet) {
        activeTutorialSheet.destroy();
        activeTutorialSheet = null;
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

  // Show intro bottom sheet for this lesson (if configured)
  if (config.introContent) {
    activeTutorialSheet = showBottomSheetAsync({
      title: config.introTitle,
      content: config.introContent,
      icon: 'graduation-cap',
      colorScheme: 'info',
      dismissLabel: 'Try it',
      dismissVariant: 'primary'
    });
  }

  // Setup event handlers
  const resizeHandler = () => resizeCanvas();
  const restartBtnHandler = () => restartPuzzle();
  const helpBtnHandler = () => {
    // Re-open the tutorial lesson sheet
    if (config.introContent) {
      activeTutorialSheet = showBottomSheetAsync({
        title: config.introTitle,
        content: config.introContent,
        icon: 'graduation-cap',
        colorScheme: 'info',
        dismissLabel: 'Try it',
        dismissVariant: 'primary'
      });
    }
  };
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
  helpBtn.addEventListener('click', helpBtnHandler);
  backBtn.addEventListener('click', backBtnHandler);
  canvas.addEventListener('pointerdown', pointerDownHandler);
  canvas.addEventListener('pointermove', pointerMoveHandler);
  canvas.addEventListener('pointerup', pointerUpHandler);
  canvas.addEventListener('pointercancel', pointerCancelHandler);

  // Store event listener references for cleanup
  eventListeners = [
    { element: window, event: 'resize', handler: resizeHandler },
    { element: restartBtn, event: 'click', handler: restartBtnHandler },
    { element: helpBtn, event: 'click', handler: helpBtnHandler },
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

    // Clean up any active bottom sheet
    if (activeTutorialSheet) {
      activeTutorialSheet.destroy();
      activeTutorialSheet = null;
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
