/**
 * Tutorial View - Interactive tutorial
 *
 * Teaches players the game mechanics with a single guided puzzle
 */

import { renderGrid, clearCanvas, renderPlayerPath, renderCellNumbers, buildPlayerTurnMap, renderHintPulse, calculateBorderLayers, resetNumberAnimationState, resetPathAnimationState } from '../renderer.js';
import { buildSolutionTurnMap, countTurnsInArea, parseCellKey } from '../utils.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';
import { createGameCore } from '../gameCore.js';
import { showBottomSheetAsync } from '../bottomSheet.js';
import { initIcons } from '../icons.js';
import { calculateCellSize as calculateCellSizeUtil } from '../game/canvasSetup.js';
import { checkPartialStructuralWin, validateHints, computeStateKey } from '../game/validation.js';
import { markTutorialCompleted } from '../persistence.js';

/* ============================================================================
 * TUTORIAL CONFIGURATION
 * ========================================================================= */

// Single tutorial configuration
const TUTORIAL_CONFIG = {
  gridSize: 4,
  heading: 'Tutorial',
  instruction: 'Numbers count nearby bends in your loop.\nThis loop has 3 bends in the glowing squares.',
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
  // Multi-section lesson content
  lessonSections: [
    {
      body: 'To win, drag to draw a single continuous loop'
    },
    {
      body: 'Numbers count the bends of your loop in the squares they touch'
    },
    {
      body: 'To win, draw a loop that makes all numbers zero'
    }
  ]
};

/* ============================================================================
 * STATE VARIABLES
 * ========================================================================= */

// Tutorial configuration
let gridSize = 4;
let cellSize = 0;

// DOM elements
let canvas;
let ctx;
let tutorialTitle;
let restartBtn;
let helpBtn;
let backBtn;
let instructionEl;

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

// Lesson section tracking
let currentLessonSection = 0;

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

  // Validate hint turn counts
  const { playerDrawnCells, playerConnections } = gameCore.state;
  const sTurnMap = cachedSolutionTurnMap || buildSolutionTurnMap(solutionPath);
  const pTurnMap = playerTurnMap || buildPlayerTurnMap(playerDrawnCells, playerConnections);

  return validateHints(sTurnMap, pTurnMap, hintCells, gridSize);
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
  const animationTime = Date.now();
  renderHintPulse(ctx, gridSize, cellSize, solutionPath, hintCells, animationTime, playerDrawnCells, playerConnections, true, cachedSolutionTurnMap, playerTurnMap);

  renderGrid(ctx, gridSize, cellSize);

  // Render hints
  const renderResult = renderCellNumbers(ctx, gridSize, cellSize, solutionPath, hintCells, 'partial', playerDrawnCells, playerConnections, borderMode, true, cachedSolutionTurnMap, playerTurnMap, cachedBorderLayers);
  const hasNumberAnimations = renderResult && renderResult.hasActiveAnimations;

  const pathRenderResult = renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);
  const hasPathAnimations = pathRenderResult && pathRenderResult.hasActiveAnimations;

  // Continue animation loop for pulse animation and path animations
  const needsAnimationLoop = true;  // Pulse animation is always active

  if (needsAnimationLoop && !isAnimationFramePending) {
    isAnimationFramePending = true;
    animationFrameId = requestAnimationFrame(render);
  }

  // Compute current state key for validation
  const currentStateKey = computeStateKey(playerDrawnCells, playerConnections);
  const stateChanged = currentStateKey !== lastValidatedStateKey;

  // PHASE 1: Visual validation (continuous - runs even while dragging)
  // This determines if the path should be green, without showing modals
  let isCurrentlyWinning = false;
  let hasValidStructure = false;

  if (!hasWon) {
    hasValidStructure = checkStructuralWin();

    if (hasValidStructure) {
      // Check if current state is a full win
      isCurrentlyWinning = checkWin(playerTurnMap);
    }
  }

  // Render path with visual win state (green if currently winning OR officially won)
  renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, isCurrentlyWinning || hasWon);

  // PHASE 2: Modal validation (deferred - only runs when not dragging)
  // This shows modals and sets the official hasWon state
  if (!hasWon && !gameCore.state.isDragging) {
    if (isCurrentlyWinning) {
      // Full win - set official win state and show modal
      hasWon = true;
      hasShownPartialWinFeedback = false; // Reset flag
      lastValidatedStateKey = currentStateKey;

      // Mark tutorial as completed
      markTutorialCompleted();

      // Show win bottom sheet
      // Destroy any previous tutorial sheet before showing new one
      if (activeTutorialSheet) {
        activeTutorialSheet.destroy();
      }
      activeTutorialSheet = showBottomSheetAsync({
        title: 'You made a loop!',
        content: '<div class="bottom-sheet-message">You\'re ready to play</div>',
        icon: 'party-popper',
        colorScheme: 'success',
        dismissLabel: 'Yay!',
        dismissVariant: 'primary',
        onClose: () => navigate('/')
      });
    } else if (hasValidStructure && stateChanged) {
      // Partial win - valid loop but hints don't match
      // Only show feedback when state changes to avoid spam
      if (!hasShownPartialWinFeedback) {
        hasShownPartialWinFeedback = true;
        lastValidatedStateKey = currentStateKey;

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
        const { expected, actual } = mismatches[0];
        const feedbackContent = `<div class="bottom-sheet-message">This loop has ${actual} bends in the squares touching the ${expected}. Try a different loop shape to complete this tutorial.</div>`;

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
    } else if (!hasValidStructure) {
      // No valid structure - reset feedback flag
      hasShownPartialWinFeedback = false;
      if (stateChanged) {
        lastValidatedStateKey = currentStateKey;
      }
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
 * LESSON SHEET MANAGEMENT
 * ========================================================================= */

/**
 * Update the lesson sheet content for the current section
 */
function updateLessonContent(messageEl, nextBtn) {
  const sections = TUTORIAL_CONFIG.lessonSections;
  const section = sections[currentLessonSection];
  const isLastSection = currentLessonSection === sections.length - 1;

  // Update message content
  messageEl.innerHTML = `<p>${section.body}</p>`;

  // Update next button text
  nextBtn.textContent = isLastSection ? 'Try it' : 'Next';
}

/**
 * Show the multi-section lesson sheet
 */
function showLessonSheet() {
  const sections = TUTORIAL_CONFIG.lessonSections;
  const section = sections[currentLessonSection];
  const isLastSection = currentLessonSection === sections.length - 1;

  // Build the content with navigation buttons
  const content = document.createElement('div');
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.gap = '0';

  // Message content
  const message = document.createElement('div');
  message.className = 'bottom-sheet-message';
  message.style.paddingBottom = '16px';
  message.innerHTML = `<p>${section.body}</p>`;
  content.appendChild(message);

  // Navigation buttons container
  const navButtons = document.createElement('div');
  navButtons.style.display = 'flex';
  navButtons.style.gap = '12px';
  navButtons.style.alignItems = 'center';
  navButtons.style.width = 'calc(100% - 40px)';
  navButtons.style.margin = '24px 20px 20px 20px';

  // Next button (full width)
  const nextBtn = document.createElement('button');
  nextBtn.className = 'bottom-sheet-btn bottom-sheet-btn-primary';
  nextBtn.style.flex = '1';
  nextBtn.textContent = isLastSection ? 'Try it' : 'Next';
  nextBtn.onclick = () => {
    if (currentLessonSection === sections.length - 1) {
      // Dismiss the sheet on last section
      activeTutorialSheet.destroy();
    } else {
      // Go to next section
      currentLessonSection++;
      updateLessonContent(message, nextBtn);
    }
  };
  navButtons.appendChild(nextBtn);

  content.appendChild(navButtons);

  // Create and show the bottom sheet without a default dismiss button
  const sheetInstance = showBottomSheetAsync({
    title: ' ', // Empty title - content speaks for itself
    content: content,
    icon: 'graduation-cap',
    colorScheme: 'info',
    dismissLabel: null // No default dismiss button - we use custom navigation
  });

  // Initialize icons for the navigation buttons after the sheet is created
  setTimeout(() => {
    initIcons();
  }, 0);

  activeTutorialSheet = sheetInstance;
}

/* ============================================================================
 * TUTORIAL PAGE MANAGEMENT
 * ========================================================================= */

function initTutorialGame() {
  gridSize = TUTORIAL_CONFIG.gridSize;

  // Set tutorial info
  tutorialTitle.textContent = TUTORIAL_CONFIG.heading;
  instructionEl.textContent = TUTORIAL_CONFIG.instruction;

  // Reset state
  hasWon = false;
  hasShownPartialWinFeedback = false;
  lastValidatedStateKey = '';

  // Set up hints and border
  solutionPath = TUTORIAL_CONFIG.solutionPath;
  hintCells = TUTORIAL_CONFIG.hintCells;
  borderMode = TUTORIAL_CONFIG.borderMode;

  // Cache values that don't change during gameplay for performance
  cachedSolutionTurnMap = buildSolutionTurnMap(solutionPath);
  cachedBorderLayers = calculateBorderLayers(hintCells, gridSize);

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
 * @returns {Function} Cleanup function
 */
export function initTutorial() {
  // Get DOM elements
  canvas = document.getElementById('tutorial-canvas');
  ctx = canvas.getContext('2d');
  tutorialTitle = document.getElementById('tutorial-title');
  restartBtn = document.getElementById('tutorial-restart-btn');
  helpBtn = document.getElementById('tutorial-help-btn');
  backBtn = document.getElementById('tutorial-back-btn');
  instructionEl = document.getElementById('tutorial-instruction');

  // Reset event listeners array
  eventListeners = [];

  // Initialize tutorial game
  initTutorialGame();

  // Reset lesson section and show lesson sheet
  currentLessonSection = 0;
  showLessonSheet();

  // Setup event handlers
  const resizeHandler = () => resizeCanvas();
  const restartBtnHandler = () => restartPuzzle();
  const helpBtnHandler = () => {
    // Re-open the tutorial lesson sheet from the beginning
    if (activeTutorialSheet) {
      activeTutorialSheet.destroy();
    }
    currentLessonSection = 0;
    showLessonSheet();
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
  const themeChangeHandler = () => {
    // Re-render canvas with updated colors when theme changes
    render();
  };

  // Attach event listeners
  window.addEventListener('resize', resizeHandler);
  window.addEventListener('themeChanged', themeChangeHandler);
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
    { element: window, event: 'themeChanged', handler: themeChangeHandler },
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

    // Clear animation state
    resetNumberAnimationState();
    resetPathAnimationState();

    if (gameCore) {
      gameCore.resetDragState();
    }
  };
}
