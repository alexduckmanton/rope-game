/**
 * Tutorial 2 View - Progressive Tutorial on a single 6x6 grid
 *
 * Teaches players through 6 progressive steps:
 * 1. Draw a line (4 cells, no loop)
 * 2. Make a loop (match solution)
 * 3. Introduce hint number (explanation, no action)
 * 4. Countdown animation (watch number count down)
 * 5. Second hint added (trace solution)
 * 6. Player solves independently (three hints)
 */

import { renderGrid, clearCanvas, renderPlayerPath, renderPath, renderCellNumbers, buildPlayerTurnMap, renderHintPulse, calculateBorderLayers, resetNumberAnimationState, resetPathAnimationState } from '../renderer.js';
import { buildSolutionTurnMap, countTurnsInArea, parseCellKey, createCellKey } from '../utils.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';
import { createGameCore } from '../gameCore.js';
import { showBottomSheetAsync } from '../bottomSheet.js';
import { calculateCellSize as calculateCellSizeUtil } from '../game/canvasSetup.js';
import { checkPartialStructuralWin, validateHints } from '../game/validation.js';

/* ============================================================================
 * CONSTANTS
 * ========================================================================= */

const GRID_SIZE = 6;
const TUTORIAL_EXTRA_HEIGHT = 140; // Extra space for instruction text + button

/* ============================================================================
 * STEP CONFIGURATIONS
 *
 * Each step defines:
 * - instruction: Text shown above the grid
 * - solutionPath: Path to show/validate (array of {row, col})
 * - hintCells: Set of "row,col" strings for hint positions
 * - showSolution: Whether to render the blue solution path
 * - requiresDrawing: Whether player needs to draw to complete
 * - completionType: How to validate completion
 *   - 'line': Player draws through specific cells
 *   - 'match': Player matches solution exactly
 *   - 'button': Just press Continue
 *   - 'solve': Player creates valid solution satisfying hints
 * ========================================================================= */

// Step 1: Simple horizontal line in second-from-bottom row
const STEP1_LINE = [
  { row: 4, col: 1 },
  { row: 4, col: 2 },
  { row: 4, col: 3 },
  { row: 4, col: 4 }
];

// Step 2-4: Loop with indented top-left corner creating 3 bends near (1,1)
// Path traced: forms a loop with the top-left having an inward notch
const STEP2_LOOP = [
  { row: 1, col: 2 },
  { row: 1, col: 3 },
  { row: 1, col: 4 },
  { row: 2, col: 4 },
  { row: 3, col: 4 },
  { row: 4, col: 4 },
  { row: 4, col: 3 },
  { row: 4, col: 2 },
  { row: 4, col: 1 },
  { row: 3, col: 1 },
  { row: 2, col: 1 },
  { row: 2, col: 2 },
  // Loop closes back to (1,2)
];

// Step 5: New solution with "3" at (1,1) and "2" at (5,5)
const STEP5_LOOP = [
  { row: 0, col: 1 },
  { row: 0, col: 2 },
  { row: 0, col: 3 },
  { row: 0, col: 4 },
  { row: 0, col: 5 },
  { row: 1, col: 5 },
  { row: 2, col: 5 },
  { row: 3, col: 5 },
  { row: 4, col: 5 },
  { row: 5, col: 5 },
  { row: 5, col: 4 },
  { row: 4, col: 4 },
  { row: 3, col: 4 },
  { row: 3, col: 3 },
  { row: 3, col: 2 },
  { row: 2, col: 2 },
  { row: 2, col: 1 },
  { row: 1, col: 1 },
  // Loop closes back to (0,1)
];

// Step 6: Solution for three hints - player must solve independently
// Uses same path as STEP5 - player doesn't see solution, just validates against hints
// Hint positions adjusted to work with this path
const STEP6_SOLUTION = STEP5_LOOP;

const STEP_CONFIGS = {
  1: {
    instruction: 'Draw a line by dragging across the grid.',
    solutionPath: STEP1_LINE,
    hintCells: new Set(),
    showSolution: true,
    requiresDrawing: true,
    completionType: 'line',
    targetCells: new Set(['4,1', '4,2', '4,3', '4,4'])
  },
  2: {
    instruction: 'Now make a loop. Connect the ends to close it.',
    solutionPath: STEP2_LOOP,
    hintCells: new Set(),
    showSolution: true,
    requiresDrawing: true,
    completionType: 'match'
  },
  3: {
    instruction: 'Numbers count bends in the highlighted area.\nThis "3" means 3 bends in the glowing squares.',
    solutionPath: STEP2_LOOP,
    hintCells: new Set(['1,1']),
    showSolution: false,
    requiresDrawing: false,
    completionType: 'button',
    preservePlayerPath: true // Keep the path from step 2
  },
  4: {
    instruction: 'Numbers count down as you draw bends.\nTo win, all numbers must reach zero.',
    solutionPath: STEP2_LOOP,
    hintCells: new Set(['1,1']),
    showSolution: false,
    requiresDrawing: false,
    completionType: 'button',
    preservePlayerPath: true,
    runCountdownAnimation: true
  },
  5: {
    instruction: 'Now there are two numbers.\nTrace over the solution to continue.',
    solutionPath: STEP5_LOOP,
    hintCells: new Set(['1,1', '5,5']),
    showSolution: true,
    requiresDrawing: true,
    completionType: 'match'
  },
  6: {
    instruction: 'Your turn! Draw a loop that makes all numbers zero.',
    solutionPath: STEP6_SOLUTION,
    hintCells: new Set(['1,1', '3,3', '5,5']),
    showSolution: false,
    requiresDrawing: true,
    completionType: 'solve'
  }
};

/* ============================================================================
 * STATE VARIABLES
 * ========================================================================= */

let currentStep = 1;
let cellSize = 0;
let hasCompletedStep = false;

// DOM elements
let canvas;
let ctx;
let instructionEl;
let nextBtn;
let restartBtn;
let backBtn;

// Game state
let gameCore;
let solutionPath = [];
let hintCells = new Set();

// Cached values for performance
let cachedBorderLayers = null;
let cachedSolutionTurnMap = null;

// Animation tracking
let animationFrameId = null;
let isAnimationFramePending = false;

// Countdown animation state
let countdownAnimationActive = false;
let countdownStartTime = 0;
let countdownCurrentValue = 0;

// Event listener references for cleanup
let eventListeners = [];

// Bottom sheet instance
let activeSheet = null;

/* ============================================================================
 * STEP COMPLETION VALIDATION
 * ========================================================================= */

/**
 * Check if player has completed the current step
 */
function checkStepCompletion() {
  const config = STEP_CONFIGS[currentStep];
  if (!config) return false;

  const { playerDrawnCells, playerConnections } = gameCore.state;

  switch (config.completionType) {
    case 'line':
      // Player must draw through all target cells
      return checkLineCoverage(playerDrawnCells, config.targetCells);

    case 'match':
      // Player must match the solution path exactly
      return checkPathMatch(playerDrawnCells, playerConnections, config.solutionPath);

    case 'button':
      // No drawing required, just press Continue
      return true;

    case 'solve':
      // Player must create any valid loop satisfying all hints
      return checkSolveCompletion(playerDrawnCells, playerConnections);

    default:
      return false;
  }
}

/**
 * Check if player has drawn through all target cells (for line step)
 */
function checkLineCoverage(playerDrawnCells, targetCells) {
  for (const cellKey of targetCells) {
    if (!playerDrawnCells.has(cellKey)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if player's path matches the solution path exactly
 */
function checkPathMatch(playerDrawnCells, playerConnections, solutionPathArray) {
  // First check structural validity (forms a closed loop)
  if (!checkPartialStructuralWin(playerDrawnCells, playerConnections)) {
    return false;
  }

  // Build set of solution cells
  const solutionCells = new Set(solutionPathArray.map(c => createCellKey(c.row, c.col)));

  // Check same number of cells
  if (playerDrawnCells.size !== solutionCells.size) {
    return false;
  }

  // Check all player cells are in solution
  for (const cellKey of playerDrawnCells) {
    if (!solutionCells.has(cellKey)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if player has solved the puzzle (valid loop + hints satisfied)
 */
function checkSolveCompletion(playerDrawnCells, playerConnections) {
  // Check structural validity
  if (!checkPartialStructuralWin(playerDrawnCells, playerConnections)) {
    return false;
  }

  // Check hints are satisfied
  const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);
  return validateHints(cachedSolutionTurnMap, playerTurnMap, hintCells, GRID_SIZE);
}

/* ============================================================================
 * RENDERING
 * ========================================================================= */

function calculateCellSize() {
  return calculateCellSizeUtil(GRID_SIZE, TUTORIAL_EXTRA_HEIGHT);
}

function resizeCanvas() {
  cellSize = calculateCellSize();
  gameCore.setCellSize(cellSize);

  const totalSize = cellSize * GRID_SIZE;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = totalSize * dpr;
  canvas.height = totalSize * dpr;
  canvas.style.width = totalSize + 'px';
  canvas.style.height = totalSize + 'px';

  ctx.scale(dpr, dpr);
  render();
}

function render() {
  isAnimationFramePending = false;

  const config = STEP_CONFIGS[currentStep];
  const { playerDrawnCells, playerConnections } = gameCore.state;
  const totalSize = cellSize * GRID_SIZE;

  // Build player turn map for reuse
  const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);

  clearCanvas(ctx, totalSize, totalSize);

  // Render pulsing hint backgrounds (if hints are shown)
  if (hintCells.size > 0) {
    const animationTime = Date.now();
    renderHintPulse(ctx, GRID_SIZE, cellSize, solutionPath, hintCells, animationTime, playerDrawnCells, playerConnections, true, cachedSolutionTurnMap, playerTurnMap);
  }

  renderGrid(ctx, GRID_SIZE, cellSize);

  // Render solution path if configured
  if (config.showSolution && solutionPath.length > 0) {
    renderPath(ctx, solutionPath, cellSize);
  }

  // Render hint numbers
  if (hintCells.size > 0) {
    // For countdown animation step, override the display value
    if (countdownAnimationActive) {
      renderCountdownNumbers(ctx, playerTurnMap);
    } else {
      renderCellNumbers(ctx, GRID_SIZE, cellSize, solutionPath, hintCells, 'partial', playerDrawnCells, playerConnections, 'off', true, cachedSolutionTurnMap, playerTurnMap, cachedBorderLayers);
    }
  }

  // Render player path
  const isCompleted = hasCompletedStep && config.completionType !== 'button';
  const pathRenderResult = renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, isCompleted);
  const hasPathAnimations = pathRenderResult && pathRenderResult.hasActiveAnimations;

  // Continue animation loop if needed
  const needsAnimationLoop = hintCells.size > 0 || countdownAnimationActive || hasPathAnimations;
  if (needsAnimationLoop && !isAnimationFramePending) {
    isAnimationFramePending = true;
    animationFrameId = requestAnimationFrame(render);
  }

  // Check step completion
  if (!hasCompletedStep && config.requiresDrawing && !gameCore.state.isDragging) {
    if (checkStepCompletion()) {
      hasCompletedStep = true;
      showNextButton();
    }
  }
}

/**
 * Render numbers with countdown animation override
 */
function renderCountdownNumbers(ctx, playerTurnMap) {
  ctx.font = `bold ${Math.floor(cellSize * CONFIG.HINT.FONT_SIZE_FACTOR)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const cellKey of hintCells) {
    const { row, col } = parseCellKey(cellKey);

    // Use animated countdown value instead of actual turn count
    const displayValue = countdownCurrentValue;
    const isValid = displayValue === 0;

    // Get color based on magnitude
    let color;
    if (isValid || displayValue === 0) {
      color = CONFIG.COLORS.HINT_VALIDATED;
    } else {
      const magnitude = Math.abs(displayValue);
      const clampedMagnitude = Math.max(1, Math.min(9, magnitude));
      color = CONFIG.COLORS.HINT_COLORS[clampedMagnitude - 1];
    }

    ctx.fillStyle = color;
    const x = col * cellSize + cellSize / 2;
    const y = row * cellSize + cellSize / 2;
    ctx.fillText(displayValue.toString(), x, y);
  }
}

/* ============================================================================
 * COUNTDOWN ANIMATION (Step 4)
 * ========================================================================= */

function startCountdownAnimation() {
  // Get the expected turn count for the hint at (1,1)
  const expectedTurns = countTurnsInArea(1, 1, GRID_SIZE, cachedSolutionTurnMap);
  countdownCurrentValue = expectedTurns;
  countdownAnimationActive = true;
  countdownStartTime = Date.now();

  // Animate countdown: 500ms per decrement
  const animateCountdown = () => {
    const elapsed = Date.now() - countdownStartTime;
    const decrements = Math.floor(elapsed / 500);
    countdownCurrentValue = Math.max(0, expectedTurns - decrements);

    render();

    if (countdownCurrentValue > 0) {
      setTimeout(animateCountdown, 100);
    } else {
      countdownAnimationActive = false;
      hasCompletedStep = true;
      showNextButton();
    }
  };

  animateCountdown();
}

/* ============================================================================
 * STEP MANAGEMENT
 * ========================================================================= */

function initStep(stepNumber) {
  currentStep = stepNumber;
  const config = STEP_CONFIGS[stepNumber];

  if (!config) {
    // Tutorial complete - show success
    showCompletionSheet();
    return;
  }

  // Update instruction
  instructionEl.textContent = config.instruction;

  // Set up solution path and hints
  solutionPath = config.solutionPath || [];
  hintCells = config.hintCells || new Set();

  // Cache computed values
  if (solutionPath.length > 0) {
    cachedSolutionTurnMap = buildSolutionTurnMap(solutionPath);
  } else {
    cachedSolutionTurnMap = new Map();
  }

  if (hintCells.size > 0) {
    cachedBorderLayers = calculateBorderLayers(hintCells, GRID_SIZE);
  } else {
    cachedBorderLayers = null;
  }

  // Reset step completion state
  hasCompletedStep = false;
  countdownAnimationActive = false;

  // Clear player path unless preserving from previous step
  if (!config.preservePlayerPath) {
    gameCore.restartPuzzle();
  }

  // Hide/show next button based on step type
  if (config.completionType === 'button') {
    if (config.runCountdownAnimation) {
      hideNextButton();
      // Start countdown after a brief delay
      setTimeout(() => startCountdownAnimation(), 500);
    } else {
      hasCompletedStep = true;
      showNextButton();
    }
  } else {
    hideNextButton();
  }

  // Reset animation state
  resetNumberAnimationState();
  resetPathAnimationState();

  render();
}

function advanceToNextStep() {
  const nextStep = currentStep + 1;
  if (nextStep > 6) {
    showCompletionSheet();
  } else {
    initStep(nextStep);
  }
}

function restartCurrentStep() {
  const config = STEP_CONFIGS[currentStep];

  // Clear player drawing
  gameCore.restartPuzzle();

  // Reset step state
  hasCompletedStep = false;
  hideNextButton();

  // Reset animation state
  resetNumberAnimationState();
  resetPathAnimationState();

  // For countdown step, restart the animation
  if (config.runCountdownAnimation) {
    setTimeout(() => startCountdownAnimation(), 500);
  } else if (config.completionType === 'button') {
    hasCompletedStep = true;
    showNextButton();
  }

  render();
}

/* ============================================================================
 * UI HELPERS
 * ========================================================================= */

function showNextButton() {
  nextBtn.classList.remove('hidden');
  nextBtn.disabled = false;
}

function hideNextButton() {
  nextBtn.classList.add('hidden');
  nextBtn.disabled = true;
}

function showCompletionSheet() {
  if (activeSheet) {
    activeSheet.destroy();
  }

  activeSheet = showBottomSheetAsync({
    title: 'Tutorial Complete!',
    content: '<div class="bottom-sheet-message">You\'ve learned the basics. Time to play!</div>',
    icon: 'party-popper',
    colorScheme: 'success',
    dismissLabel: 'Let\'s go!',
    dismissVariant: 'primary',
    onClose: () => {
      navigate('/');
    }
  });
}

/* ============================================================================
 * INITIALIZATION & CLEANUP
 * ========================================================================= */

/**
 * Initialize the Tutorial 2 view
 * @param {URLSearchParams} params - URL parameters (not used currently)
 * @returns {Function} Cleanup function
 */
export function initTutorial2(params) {
  // Get DOM elements
  canvas = document.getElementById('tutorial2-canvas');
  ctx = canvas.getContext('2d');
  instructionEl = document.getElementById('tutorial2-instruction');
  nextBtn = document.getElementById('tutorial2-next-btn');
  restartBtn = document.getElementById('tutorial2-restart-btn');
  backBtn = document.getElementById('tutorial2-back-btn');

  // Reset event listeners array
  eventListeners = [];

  // Create game core instance
  gameCore = createGameCore({
    gridSize: GRID_SIZE,
    canvas,
    onRender: render
  });

  // Initialize first step
  initStep(1);

  // Setup canvas
  resizeCanvas();

  // Event handlers
  const resizeHandler = () => resizeCanvas();
  const nextBtnHandler = () => advanceToNextStep();
  const restartBtnHandler = () => restartCurrentStep();
  const backBtnHandler = () => {
    if (history.state?.fromHome) {
      history.back();
    } else {
      navigate('/', true);
    }
  };

  // Pointer event handlers
  const pointerDownHandler = (e) => {
    const config = STEP_CONFIGS[currentStep];
    if (config.requiresDrawing && !hasCompletedStep) {
      gameCore.handlePointerDown(e);
    }
  };
  const pointerMoveHandler = (e) => gameCore.handlePointerMove(e);
  const pointerUpHandler = (e) => gameCore.handlePointerUp(e);
  const pointerCancelHandler = (e) => gameCore.handlePointerCancel(e);

  const themeChangeHandler = () => render();

  // Attach event listeners
  window.addEventListener('resize', resizeHandler);
  window.addEventListener('themeChanged', themeChangeHandler);
  nextBtn.addEventListener('click', nextBtnHandler);
  restartBtn.addEventListener('click', restartBtnHandler);
  backBtn.addEventListener('click', backBtnHandler);
  canvas.addEventListener('pointerdown', pointerDownHandler);
  canvas.addEventListener('pointermove', pointerMoveHandler);
  canvas.addEventListener('pointerup', pointerUpHandler);
  canvas.addEventListener('pointercancel', pointerCancelHandler);

  // Store for cleanup
  eventListeners = [
    { element: window, event: 'resize', handler: resizeHandler },
    { element: window, event: 'themeChanged', handler: themeChangeHandler },
    { element: nextBtn, event: 'click', handler: nextBtnHandler },
    { element: restartBtn, event: 'click', handler: restartBtnHandler },
    { element: backBtn, event: 'click', handler: backBtnHandler },
    { element: canvas, event: 'pointerdown', handler: pointerDownHandler },
    { element: canvas, event: 'pointermove', handler: pointerMoveHandler },
    { element: canvas, event: 'pointerup', handler: pointerUpHandler },
    { element: canvas, event: 'pointercancel', handler: pointerCancelHandler }
  ];

  // Return cleanup function
  return () => {
    // Cancel animation frame
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      isAnimationFramePending = false;
    }

    // Clean up bottom sheet
    if (activeSheet) {
      activeSheet.destroy();
      activeSheet = null;
    }

    // Remove event listeners
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
