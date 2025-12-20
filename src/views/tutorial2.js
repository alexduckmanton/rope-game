/**
 * Tutorial 2 View - Progressive single-grid tutorial
 *
 * Teaches players game mechanics through step-by-step progression on a single 6x6 grid
 */

import { renderGrid, clearCanvas, renderPlayerPath, renderPath, renderCellNumbers, buildPlayerTurnMap, renderHintPulse, calculateBorderLayers, resetNumberAnimationState, resetPathAnimationState } from '../renderer.js';
import { buildSolutionTurnMap, countTurnsInArea, parseCellKey, createCellKey } from '../utils.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';
import { createGameCore } from '../gameCore.js';
import { calculateCellSize as calculateCellSizeUtil } from '../game/canvasSetup.js';
import { checkPartialStructuralWin, validateHints, computeStateKey } from '../game/validation.js';

/* ============================================================================
 * CONSTANTS
 * ========================================================================= */

const GRID_SIZE = 6;
const TUTORIAL_EXTRA_HEIGHT = 120; // Extra space for instruction text
const SOLUTION_ANIMATION_DELAY = 150; // ms between cells
const COUNTDOWN_ANIMATION_DELAY = 500; // ms per countdown step

const STEPS = {
  DRAW_LINE: 1,
  MAKE_LOOP: 2,
  INTRODUCE_NUMBER: 3,
  COUNTDOWN_DEMO: 4,
  TWO_NUMBERS: 5,
  PLAYER_SOLVES: 6
};

/* ============================================================================
 * STEP CONFIGURATIONS
 * ========================================================================= */

const STEP_CONFIGS = {
  [STEPS.DRAW_LINE]: {
    instruction: 'Draw a line by dragging across the grid',
    solutionPath: [[4,1], [4,2], [4,3], [4,4]], // Straight horizontal line
    hints: new Map(),
    showSolution: true,
    animateSolution: true,
    enableInteractionAfterAnimation: true,
    requiresExactPath: true
  },
  [STEPS.MAKE_LOOP]: {
    instruction: 'Now make a loop - a path that returns to its start',
    solutionPath: [[1,2], [1,3], [1,4], [2,4], [3,4], [3,3], [3,2], [2,2]], // Loop with 3 bends
    hints: new Map(),
    showSolution: true,
    animateSolution: true,
    enableInteractionAfterAnimation: true,
    requiresExactPath: true
  },
  [STEPS.INTRODUCE_NUMBER]: {
    instruction: 'Numbers show how many bends the path makes in the surrounding area',
    solutionPath: [[1,2], [1,3], [1,4], [2,4], [3,4], [3,3], [3,2], [2,2]], // Same loop
    hints: new Map([[createCellKey(1, 1), 3]]), // "3" at (1,1)
    showSolution: true,
    animateSolution: false,
    enableInteractionAfterAnimation: false,
    pulseHint: createCellKey(1, 1),
    autoAdvance: true // Next button appears immediately
  },
  [STEPS.COUNTDOWN_DEMO]: {
    instruction: 'Numbers count down with each bend they touch. To win, get all to zero!',
    solutionPath: [[1,2], [1,3], [1,4], [2,4], [3,4], [3,3], [3,2], [2,2]], // Same loop
    hints: new Map([[createCellKey(1, 1), 3]]), // "3" at (1,1)
    showSolution: true,
    animateSolution: false,
    enableInteractionAfterAnimation: false,
    pulseHint: createCellKey(1, 1),
    countdownAnimation: true,
    countdownFrom: 3
  },
  [STEPS.TWO_NUMBERS]: {
    instruction: 'Draw a path that makes both numbers zero',
    // Simple rectangular loop with strategic bends to satisfy both hints
    solutionPath: [
      [0,1], [0,2], [0,3], [0,4],
      [1,4], [2,4], [3,4], [4,4], [5,4],
      [5,3], [5,2], [5,1], [5,0],
      [4,0], [3,0], [2,0], [1,0], [0,0]
    ],
    hints: new Map([
      [createCellKey(1, 1), 3],
      [createCellKey(4, 4), 2]
    ]),
    showSolution: true,
    animateSolution: true,
    enableInteractionAfterAnimation: true,
    requiresValidConstraints: true
  },
  [STEPS.PLAYER_SOLVES]: {
    instruction: 'Now try it yourself! Draw a loop that makes all numbers zero',
    // Reference solution (not shown to player)
    // Large loop around the perimeter that satisfies all three hints
    solutionPath: [
      [0,1], [0,2], [0,3], [0,4],
      [1,4], [2,4], [3,4], [4,4], [5,4],
      [5,3], [5,2], [5,1], [5,0],
      [4,0], [3,0], [2,0], [1,0], [0,0]
    ],
    hints: new Map([
      [createCellKey(1, 1), 3],
      [createCellKey(4, 4), 2],
      [createCellKey(4, 0), 2]
    ]),
    showSolution: false,
    animateSolution: false,
    enableInteractionAfterAnimation: true,
    requiresValidConstraints: true
  }
};

/* ============================================================================
 * STATE VARIABLES
 * ========================================================================= */

let currentStep = STEPS.DRAW_LINE;
let cellSize = 0;

// DOM elements
let canvas;
let ctx;
let instructionEl;
let nextBtn;
let backBtn;

// Animation state
let isAnimating = false;
let interactionEnabled = false;
let animatedSolutionPath = [];
let countdownValue = null;
let countdownActive = false;

// Game state
let hasCompletedStep = false;
let solutionPath = [];
let hintCells = new Map();
let lastValidatedStateKey = '';

// Cached values
let cachedSolutionTurnMap = null;
let cachedBorderLayers = null;

// Game core instance
let gameCore;

// Event listeners
let eventListeners = [];
let animationFrameId = null;

/* ============================================================================
 * UTILITY FUNCTIONS
 * ========================================================================= */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateCellSize() {
  return calculateCellSizeUtil(GRID_SIZE, TUTORIAL_EXTRA_HEIGHT);
}

function resizeCanvas() {
  cellSize = calculateCellSize();
  if (gameCore) {
    gameCore.setCellSize(cellSize);
  }

  const totalSize = cellSize * GRID_SIZE;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = totalSize * dpr;
  canvas.height = totalSize * dpr;
  canvas.style.width = totalSize + 'px';
  canvas.style.height = totalSize + 'px';

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  render();
}

/* ============================================================================
 * PATH MATCHING & VALIDATION
 * ========================================================================= */

function pathMatchesExactly(playerCells, expectedCells) {
  if (playerCells.size !== expectedCells.length) return false;
  return expectedCells.every(([r, c]) => playerCells.has(createCellKey(r, c)));
}

function checkStepCompletion() {
  const config = STEP_CONFIGS[currentStep];
  const { playerDrawnCells, playerConnections } = gameCore.state;

  // Auto-advance steps (no action required)
  if (config.autoAdvance) {
    return true;
  }

  // Countdown animation step (waits for animation to complete)
  if (config.countdownAnimation && !countdownActive) {
    return true;
  }

  // Steps requiring exact path match
  if (config.requiresExactPath) {
    const expectedCells = config.solutionPath;
    const hasValidStructure = checkPartialStructuralWin(playerDrawnCells, playerConnections);
    return hasValidStructure && pathMatchesExactly(playerDrawnCells, expectedCells);
  }

  // Steps requiring valid loop satisfying constraints
  if (config.requiresValidConstraints) {
    const hasValidStructure = checkPartialStructuralWin(playerDrawnCells, playerConnections);
    if (!hasValidStructure) return false;

    const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);
    return validateHints(cachedSolutionTurnMap, playerTurnMap, hintCells, GRID_SIZE);
  }

  return false;
}

/* ============================================================================
 * ANIMATION FUNCTIONS
 * ========================================================================= */

async function animateSolutionPath(path) {
  isAnimating = true;
  interactionEnabled = false;
  animatedSolutionPath = [];

  // Convert path array to cell coordinates
  const cells = path.map(([r, c]) => ({ row: r, col: c }));

  for (const cell of cells) {
    animatedSolutionPath.push(cell);
    render();
    await sleep(SOLUTION_ANIMATION_DELAY);
  }

  isAnimating = false;
  const config = STEP_CONFIGS[currentStep];
  if (config.enableInteractionAfterAnimation) {
    interactionEnabled = true;
  }

  render();
}

async function animateCountdown(fromValue, hintKey) {
  countdownActive = true;
  countdownValue = fromValue;

  for (let val = fromValue; val >= 0; val--) {
    countdownValue = val;
    render();
    await sleep(COUNTDOWN_ANIMATION_DELAY);
  }

  countdownActive = false;
  checkAndShowNextButton();
}

/* ============================================================================
 * RENDERING
 * ========================================================================= */

function render() {
  const { playerDrawnCells, playerConnections } = gameCore.state;
  const totalSize = cellSize * GRID_SIZE;
  const dpr = window.devicePixelRatio || 1;

  // Ensure transform is correct before rendering
  // (Setting canvas.width/height resets the context, so we must reapply the transform)
  ctx.setTransform(1, 0, 0, 1, 0, 0);  // Reset to identity
  ctx.scale(dpr, dpr);  // Apply device pixel ratio scaling

  clearCanvas(ctx, totalSize, totalSize);

  // Build turn maps
  const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);

  // Render pulsing hint backgrounds if configured
  const config = STEP_CONFIGS[currentStep];
  if (config.pulseHint && hintCells.size > 0) {
    const animationTime = Date.now();
    renderHintPulse(
      ctx, GRID_SIZE, cellSize, solutionPath, hintCells,
      animationTime, playerDrawnCells, playerConnections,
      true, cachedSolutionTurnMap, playerTurnMap
    );
  }

  renderGrid(ctx, GRID_SIZE, cellSize);

  // Render hint numbers
  if (hintCells.size > 0) {
    // Use countdown value if in countdown animation
    let displayHints = hintCells;
    if (countdownActive && countdownValue !== null) {
      const hintKey = config.pulseHint;
      displayHints = new Map([[hintKey, countdownValue]]);
    }

    renderCellNumbers(
      ctx, GRID_SIZE, cellSize, solutionPath, displayHints, 'all',
      playerDrawnCells, playerConnections, 'off', true,
      cachedSolutionTurnMap, playerTurnMap, cachedBorderLayers, 'auto'
    );
  }

  // Render animated solution path (blue)
  if (animatedSolutionPath.length > 0 && config.showSolution) {
    renderPath(ctx, animatedSolutionPath, cellSize, CONFIG.COLORS.SOLUTION);
  }

  // Render player path (black)
  if (playerDrawnCells.size > 0) {
    renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, false, 'auto');
  }

  // Check step completion
  if (!hasCompletedStep && !isAnimating && interactionEnabled) {
    if (checkStepCompletion()) {
      hasCompletedStep = true;
      checkAndShowNextButton();
    }
  }
}

function checkAndShowNextButton() {
  if (hasCompletedStep) {
    nextBtn.style.display = 'block';
  }
}

/* ============================================================================
 * STEP MANAGEMENT
 * ========================================================================= */

async function enterStep(step) {
  currentStep = step;
  hasCompletedStep = false;
  isAnimating = false;
  interactionEnabled = false;
  animatedSolutionPath = [];
  countdownValue = null;
  countdownActive = false;

  const config = STEP_CONFIGS[step];

  // Update instruction text
  instructionEl.textContent = config.instruction;

  // Hide next button
  nextBtn.style.display = 'none';

  // Clear player path when entering new step
  // (Steps 3-4 will show solution path instead of keeping player's drawing)
  gameCore.restartPuzzle();

  // Setup solution path and hints
  solutionPath = config.solutionPath.map(([r, c]) => ({ row: r, col: c }));
  hintCells = new Map(config.hints);

  // Cache turn maps
  cachedSolutionTurnMap = buildSolutionTurnMap(solutionPath);
  cachedBorderLayers = calculateBorderLayers(hintCells, GRID_SIZE);

  // Render initial state
  render();

  // Trigger animations or enable interaction
  if (config.animateSolution) {
    await animateSolutionPath(config.solutionPath);
  } else if (config.showSolution) {
    // Show full solution immediately without animation
    animatedSolutionPath = solutionPath;
    if (config.enableInteractionAfterAnimation) {
      interactionEnabled = true;
    }
    render();
  } else {
    // No solution shown
    interactionEnabled = true;
    render();
  }

  // Handle countdown animation
  if (config.countdownAnimation) {
    const hintKey = config.pulseHint;
    await animateCountdown(config.countdownFrom, hintKey);
  }

  // Auto-advance steps
  if (config.autoAdvance) {
    hasCompletedStep = true;
    checkAndShowNextButton();
  }
}

function advanceStep() {
  if (currentStep < STEPS.PLAYER_SOLVES) {
    enterStep(currentStep + 1);
  } else {
    // Tutorial complete
    navigate('/');
  }
}

/* ============================================================================
 * EVENT HANDLERS
 * ========================================================================= */

function handleNext() {
  advanceStep();
}

function handleBack() {
  if (history.state?.fromHome) {
    history.back();
  } else {
    navigate('/', true);
  }
}

/* ============================================================================
 * INITIALIZATION & CLEANUP
 * ========================================================================= */

export function initTutorial2() {
  // Get DOM elements
  canvas = document.getElementById('tutorial2-canvas');
  ctx = canvas.getContext('2d');
  instructionEl = document.getElementById('tutorial2-instruction');
  nextBtn = document.getElementById('tutorial2-next-btn');
  backBtn = document.getElementById('tutorial2-back-btn');

  // Reset animation state
  resetNumberAnimationState();
  resetPathAnimationState();

  // Create game core
  gameCore = createGameCore({
    gridSize: GRID_SIZE,
    canvas,
    onRender: () => {
      // Always render, just like game.js does
      // Don't add conditions here - let render() decide what to show
      render();
    }
  });

  // Setup canvas
  resizeCanvas();

  // Setup event listeners
  const resizeHandler = () => resizeCanvas();
  const nextHandler = () => handleNext();
  const backHandler = () => handleBack();
  const themeChangeHandler = () => render();

  // Pointer events - simple gating like game.js does
  const pointerDownHandler = (e) => {
    if (interactionEnabled) gameCore.handlePointerDown(e);
  };
  const pointerMoveHandler = (e) => {
    if (interactionEnabled) gameCore.handlePointerMove(e);
  };
  const pointerUpHandler = (e) => {
    if (interactionEnabled) gameCore.handlePointerUp(e);
  };
  const pointerCancelHandler = (e) => {
    if (interactionEnabled) gameCore.handlePointerCancel(e);
  };

  window.addEventListener('resize', resizeHandler);
  window.addEventListener('themeChanged', themeChangeHandler);
  nextBtn.addEventListener('click', nextHandler);
  backBtn.addEventListener('click', backHandler);
  canvas.addEventListener('pointerdown', pointerDownHandler);
  canvas.addEventListener('pointermove', pointerMoveHandler);
  canvas.addEventListener('pointerup', pointerUpHandler);
  canvas.addEventListener('pointercancel', pointerCancelHandler);

  eventListeners = [
    { element: window, event: 'resize', handler: resizeHandler },
    { element: window, event: 'themeChanged', handler: themeChangeHandler },
    { element: nextBtn, event: 'click', handler: nextHandler },
    { element: backBtn, event: 'click', handler: backHandler },
    { element: canvas, event: 'pointerdown', handler: pointerDownHandler },
    { element: canvas, event: 'pointermove', handler: pointerMoveHandler },
    { element: canvas, event: 'pointerup', handler: pointerUpHandler },
    { element: canvas, event: 'pointercancel', handler: pointerCancelHandler }
  ];

  // Enter first step
  enterStep(STEPS.DRAW_LINE);
}

export function cleanupTutorial2() {
  // Cancel any pending animations
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
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
}
