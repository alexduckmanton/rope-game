/**
 * Game View - Loop Puzzle Game Logic
 *
 * Extracted game logic with initialization and cleanup functions
 * for use in a multi-view SPA
 */

import { renderGrid, clearCanvas, renderPath, renderCellNumbers, generateHintCellsWithMinDistance, renderPlayerPath, buildPlayerTurnMap, calculateBorderLayers } from '../renderer.js';
import { generateSolutionPath } from '../generator.js';
import { buildSolutionTurnMap, countTurnsInArea, parseCellKey, checkPartialStructuralLoop } from '../utils.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';
import { createGameCore } from '../gameCore.js';
import { createSeededRandom, getDailySeed, getPuzzleId } from '../seededRandom.js';
import { saveGameState, loadGameState, clearGameState, createThrottledSave, saveSettings, loadSettings, markDailyCompleted, markDailyCompletedWithViewedSolution, markDailyManuallyFinished } from '../persistence.js';
import { createBottomSheet, showBottomSheetAsync } from '../bottomSheet.js';
import { createGameTimer, formatTime } from '../game/timer.js';
import { handleShare as handleShareUtil } from '../game/share.js';
import { calculateCellSize as calculateCellSizeUtil } from '../game/canvasSetup.js';
import { checkPartialStructuralWin, validateHints, computeStateKey, calculateScore } from '../game/validation.js';
import { showTutorialSheet } from '../components/tutorialSheet.js';
import {
  trackGameStarted,
  trackGameCompleted,
  trackGameRestarted,
  trackPuzzleGenerated,
  trackUndoUsed,
  trackSolutionViewed,
  trackSettingsOpened,
  trackValidationError
} from '../analytics.js';

/* ============================================================================
 * CONSTANTS
 * ========================================================================= */

/**
 * Game state constants for UI state management
 * Used by setGameUIState() to ensure type safety and prevent typos
 */
const GAME_STATE = {
  IN_PROGRESS: 'in-progress',
  WON: 'won',
  VIEWED_SOLUTION: 'viewed-solution',
  NEW: 'new'
};

/**
 * Display names for difficulty levels
 * Maps internal lowercase difficulty strings to user-facing capitalized names
 */
const DIFFICULTY_DISPLAY_NAMES = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard'
};

/* ============================================================================
 * STATE VARIABLES
 * ========================================================================= */

// Game configuration
let gridSize = 4;
let cellSize = 0;
let isUnlimitedMode = false;
let isDailyMode = false;
let currentUnlimitedDifficulty = 'easy';
let currentGameDifficulty = 'easy';
let currentPuzzleId = null;

// DOM elements
let canvas;
let canvasContainer;
let ctx;
let gameTitle;
let gameTimerEl;
let newBtn;
let finishBtn;
let clearBtn;
let undoBtn;
let hintsCheckbox;
let countdownCheckbox;
let borderCheckbox;
let backBtn;
let helpBtn;
let settingsBtn;
let difficultySettingsItem;
let segmentedControl;
let segmentButtons;

// Bottom sheet instances
let settingsSheet;
let activeGameSheet;  // Track winning/feedback sheets for cleanup

// Puzzle state
let solutionPath = [];
let hintCells = new Set();
let hintMode = 'partial';
let borderMode = 'off';
let countdown = true;
let hasWon = false;
let hasShownPartialWinFeedback = false;
let hasViewedSolution = false;
let hasManuallyFinished = false;
let lastValidatedStateKey = '';  // Track state to avoid redundant validation

// Cached values for performance (recalculated when puzzle changes)
let cachedBorderLayers = null;
let cachedSolutionTurnMap = null;

// Timer instance (encapsulates all timer state)
let gameTimer = null;

// Animation state (owned by game view, isolated from other views)
const gamePathAnimationState = {
  animatingCells: new Map(),     // Map<cellKey, { startTime: number, predecessorKey: string }>
  previousDrawnCells: new Set(), // Set<cellKey> from previous render
};

const gameNumberAnimationState = {
  activeAnimations: new Map(),   // Map<cellKey, { startTime: number }>
  previousState: new Map(),      // Map<cellKey, { displayValue: number, color: string }>
};

// Game core instance
let gameCore;

// Event listener references for cleanup
let eventListeners = [];

// Throttled save function (max 1 save per 5 seconds)
let throttledSaveObj = createThrottledSave();
let throttledSave = throttledSaveObj.save;

// Animation frame tracking for number animations
let animationFrameId = null;

// Cached settings values to avoid re-reading localStorage
let cachedLastUnlimitedDifficulty = 'easy';

// Undo functionality
const UNDO_HISTORY_LIMIT = 50;
let undoHistory = [];

// Score tracking
let currentScore = null;  // { percentage: number, label: string } | null

/* ============================================================================
 * PERSISTENCE HELPERS
 * ========================================================================= */

/**
 * Capture current game state for saving
 */
function captureGameState() {
  const { playerDrawnCells, playerConnections } = gameCore.state;

  return {
    puzzleId: currentPuzzleId,
    difficulty: currentGameDifficulty,
    gridSize,
    isUnlimitedMode,
    playerDrawnCells,
    playerConnections,
    elapsedSeconds: gameTimer ? gameTimer.getElapsedSeconds() : 0,
    solutionPath,
    hintCells,
    hasWon,
    hasViewedSolution,
    hasManuallyFinished
  };
}

/**
 * Save current settings to localStorage
 */
function saveCurrentSettings() {
  const settings = {
    hintMode,
    borderMode,
    countdown,
    // Use cached value instead of re-reading from localStorage
    lastUnlimitedDifficulty: cachedLastUnlimitedDifficulty
  };

  saveSettings(settings);
}

/* ============================================================================
 * UNDO FUNCTIONALITY
 * ========================================================================= */

/**
 * Capture current game state for undo history
 * Deep copies playerDrawnCells and playerConnections to avoid reference issues
 */
function captureUndoState() {
  const { playerDrawnCells, playerConnections } = gameCore.state;

  return {
    playerDrawnCells: new Set(playerDrawnCells),
    playerConnections: new Map(
      Array.from(playerConnections.entries()).map(([key, val]) => [key, new Set(val)])
    ),
    hasWon,
    hasShownPartialWinFeedback,
    lastValidatedStateKey
  };
}

/**
 * Compare two undo states for equality
 * Used to prevent duplicate consecutive states in history
 */
function statesEqual(state1, state2) {
  // Quick size check
  if (state1.playerDrawnCells.size !== state2.playerDrawnCells.size) {
    return false;
  }

  // Deep comparison of drawn cells
  for (const cell of state1.playerDrawnCells) {
    if (!state2.playerDrawnCells.has(cell)) {
      return false;
    }
  }

  return true;
}

/**
 * Push current state to undo history
 * Automatically enforces history limit and prevents duplicate states
 */
function pushUndoState() {
  const state = captureUndoState();

  // Don't push duplicate states (handles empty clicks, resize events, etc.)
  if (undoHistory.length > 0) {
    const lastState = undoHistory[undoHistory.length - 1];
    if (statesEqual(lastState, state)) {
      return;
    }
  }

  undoHistory.push(state);

  // Limit history size
  if (undoHistory.length > UNDO_HISTORY_LIMIT) {
    undoHistory.shift(); // Remove oldest
  }

  updateUndoButton();
}

/**
 * Perform undo operation - restore previous state from history
 */
function performUndo() {
  if (undoHistory.length === 0) return;

  // Track undo usage
  trackUndoUsed(currentGameDifficulty, isDailyMode ? 'daily' : 'unlimited');

  const previousState = undoHistory.pop();

  // Restore game state (deep copy to avoid reference issues)
  gameCore.state.playerDrawnCells = new Set(previousState.playerDrawnCells);
  gameCore.state.playerConnections = new Map(
    Array.from(previousState.playerConnections.entries()).map(([key, val]) => [key, new Set(val)])
  );
  hasWon = previousState.hasWon;
  hasShownPartialWinFeedback = previousState.hasShownPartialWinFeedback;
  lastValidatedStateKey = previousState.lastValidatedStateKey;

  // Update UI based on restored state
  if (hasWon) {
    setGameUIState(GAME_STATE.WON);
  } else {
    setGameUIState(GAME_STATE.IN_PROGRESS);
  }

  updateUndoButton();
  render();
}

/**
 * Helper to update button state with automatic completion check
 * @param {HTMLButtonElement} button - Button element to update
 * @param {Function} enabledCondition - Function that returns true if button should be enabled
 */
function updateButtonState(button, enabledCondition) {
  if (!button) return;

  // Always disable if game is already completed
  if (hasWon || hasViewedSolution || hasManuallyFinished) {
    button.disabled = true;
    return;
  }

  // Otherwise, evaluate the specific condition
  button.disabled = !enabledCondition();
}

/**
 * Update undo button enabled/disabled state
 * Button is enabled only if there's history AND game is not completed
 */
function updateUndoButton() {
  updateButtonState(undoBtn, () => undoHistory.length > 0);
}

/**
 * Check if all drawn cells form a single valid closed loop
 * Returns true only when:
 * - At least one cell is drawn
 * - Every drawn cell has exactly 2 connections (no branches, no dead ends)
 * - All drawn cells form a single connected loop
 * @returns {boolean} Whether there's a valid single closed loop
 */
function hasValidSingleLoop() {
  if (!gameCore) return false;
  const { playerDrawnCells, playerConnections } = gameCore.state;
  return checkPartialStructuralLoop(playerDrawnCells, playerConnections);
}

/**
 * Update finish button enabled/disabled state
 * Button is enabled only when there's a valid single closed loop AND game is not completed
 */
function updateFinishButton() {
  updateButtonState(finishBtn, hasValidSingleLoop);
}

/**
 * Update Clear button enabled/disabled state
 * Button is enabled only when there are cells drawn AND game is not completed
 */
function updateClearButton() {
  updateButtonState(clearBtn, () => {
    if (!gameCore) return false;
    return gameCore.state.playerDrawnCells.size > 0;
  });
}

/**
 * Clear undo history
 * Called on new puzzle, difficulty change, or puzzle load
 */
function clearUndoHistory() {
  undoHistory = [];
  updateUndoButton();
}

/* ============================================================================
 * VALIDATION
 * ========================================================================= */

/**
 * Get reference to view solution button (queries DOM each time)
 * This ensures we always have the correct reference even if sheets are recreated
 */
function getViewSolutionBtn() {
  return document.querySelector('.bottom-sheet-btn-destructive');
}

/**
 * Set game UI state (button visibility and enabled states)
 * Centralizes button state management to reduce duplication
 *
 * @param {string} state - Game state from GAME_STATE constants (IN_PROGRESS, WON, VIEWED_SOLUTION, or NEW)
 */
function setGameUIState(state) {
  const viewSolutionBtn = getViewSolutionBtn();

  if (state === GAME_STATE.IN_PROGRESS || state === GAME_STATE.NEW) {
    // Enable finish and Clear buttons, show view solution button
    if (finishBtn) {
      finishBtn.disabled = false;
    }
    if (clearBtn) {
      clearBtn.disabled = false;
    }
    if (viewSolutionBtn) {
      viewSolutionBtn.style.display = '';
    }
  } else if (state === GAME_STATE.WON || state === GAME_STATE.VIEWED_SOLUTION) {
    // Disable finish and Clear buttons, hide view solution button
    if (finishBtn) {
      finishBtn.disabled = true;
    }
    if (clearBtn) {
      clearBtn.disabled = true;
    }
    if (viewSolutionBtn) {
      viewSolutionBtn.style.display = 'none';
    }
  }
}

/* ============================================================================
 * TIMER FUNCTIONS
 * ========================================================================= */

/**
 * Wrapper functions for timer lifecycle operations (start, stop, pause, resume)
 * These wrappers provide:
 * - Null safety: safe to call even if gameTimer is not initialized
 * - Consistent API: all timer lifecycle changes go through these functions
 * - Testability: easier to mock in tests
 *
 * For timer getters/setters (getFormattedTime, setElapsedSeconds, setDifficulty, updateDisplay),
 * call gameTimer directly with optional chaining: gameTimer?.method()
 */

/**
 * Start the game timer
 * @param {number} resumeFromSeconds - Seconds to resume from (default: 0 for new games)
 */
function startTimer(resumeFromSeconds = 0) {
  if (gameTimer) {
    gameTimer.start(resumeFromSeconds);
  }
}

/**
 * Stop the game timer
 * Used when game is completed (won or solution viewed)
 */
function stopTimer() {
  if (gameTimer) {
    gameTimer.stop();
  }
}

/**
 * Pause the game timer
 * Used when tab becomes hidden/backgrounded
 */
function pauseTimer() {
  if (gameTimer) {
    gameTimer.pause();
  }
}

/**
 * Resume the game timer
 * Used when tab becomes visible/foregrounded again
 */
function resumeTimer() {
  if (gameTimer) {
    gameTimer.resume();
  }
}

/* ============================================================================
 * UI FUNCTIONS
 * ========================================================================= */

function updateCheckboxState() {
  if (hintMode === 'partial') {
    hintsCheckbox.checked = false;
    hintsCheckbox.indeterminate = false;
  } else if (hintMode === 'all') {
    hintsCheckbox.checked = true;
    hintsCheckbox.indeterminate = false;
  }
}

function cycleHintMode() {
  if (hintMode === 'partial') {
    hintMode = 'all';
  } else {
    hintMode = 'partial';
  }
  setTimeout(updateCheckboxState, 0);
  saveCurrentSettings();
  // Don't trigger game state save for display-only changes
  render(false);
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
  saveCurrentSettings();
  // Don't trigger game state save for display-only changes
  render(false);
}

function showSettings() {
  // Track settings opened
  trackSettingsOpened();

  if (settingsSheet) {
    settingsSheet.show();

    // Hide view solution button if game is completed or solution was viewed
    // This ensures button stays hidden after initIcons() is called by sheet.show()
    if (hasWon || hasViewedSolution) {
      const viewSolutionBtn = getViewSolutionBtn();
      if (viewSolutionBtn) {
        viewSolutionBtn.style.display = 'none';
      }
    }
  }
}

function hideSettings() {
  if (settingsSheet) {
    settingsSheet.hide();
  }
}

/**
 * Show win celebration bottom sheet with completion time
 *
 * Displays different UI based on game mode:
 * - Daily mode: Shows "Close" button (secondary) + "Share" button (primary)
 * - Unlimited/Tutorial: Shows "Yay!" button (primary), no share option
 *
 * @param {string} finalTime - Formatted completion time (e.g., "Easy • 2:34")
 */
function showWinCelebration(finalTime) {
  // Build bottom sheet options
  const bottomSheetOptions = {
    title: 'Perfect loop!',
    content: `<div class="bottom-sheet-message">You finished in ${finalTime}.</div>`,
    icon: 'party-popper',
    colorScheme: 'success',
    dismissLabel: isDailyMode ? 'Close' : 'Yay!',
    dismissVariant: isDailyMode ? 'secondary' : 'primary'
  };

  // Add Share button only for daily mode (not unlimited or tutorial)
  if (isDailyMode) {
    bottomSheetOptions.primaryButton = {
      label: 'Share',
      icon: 'share-2',
      onClick: (buttonEl) => handleShare(buttonEl, finalTime, 100)
    };
  }

  // Show win bottom sheet with completion time
  // Destroy any previous game sheet before showing new one
  if (activeGameSheet) {
    activeGameSheet.destroy();
  }
  activeGameSheet = showBottomSheetAsync(bottomSheetOptions);
}

/**
 * Handle share button click - delegates to share module
 */
async function handleShare(buttonEl, finalTime, score) {
  await handleShareUtil(buttonEl, currentGameDifficulty, finalTime, score);
}

function updateSegmentedControlState() {
  if (!segmentButtons) return;

  segmentButtons.forEach(btn => {
    const difficulty = btn.getAttribute('data-difficulty');
    if (difficulty === currentUnlimitedDifficulty) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function changeDifficulty(newDifficulty) {
  if (currentUnlimitedDifficulty === newDifficulty) return;

  // Save current difficulty's state before switching
  // This preserves progress when switching between difficulties
  saveGameState(captureGameState());
  clearUndoHistory(); // Different difficulty = fresh start

  currentUnlimitedDifficulty = newDifficulty;
  currentGameDifficulty = newDifficulty;
  gridSize = getGridSizeFromDifficulty(newDifficulty);

  // Unlimited mode never uses daily puzzles
  isDailyMode = false;
  currentPuzzleId = null;

  // Update cached value and save settings
  cachedLastUnlimitedDifficulty = newDifficulty;
  saveCurrentSettings();

  // Update timer with new difficulty
  if (gameTimer) {
    gameTimer.setDifficulty(newDifficulty);
  }

  // Update segmented control UI
  updateSegmentedControlState();

  // Recreate game core with new grid size
  gameCore = createGameCore({
    gridSize,
    canvas,
    onRender: () => {
      if (!hasWon) {
        render();
      }
    }
  });

  // Resize canvas
  resizeCanvas();

  // Load saved game for new difficulty, or generate if none exists
  // This ensures switching back to a difficulty restores your progress
  loadOrGeneratePuzzle();
}

/* ============================================================================
 * GAME LIFECYCLE & RENDERING
 * ========================================================================= */

function calculateCellSize() {
  return calculateCellSizeUtil(gridSize);
}

function resizeCanvas() {
  cellSize = calculateCellSize();
  gameCore.setCellSize(cellSize);

  const totalSize = cellSize * gridSize;
  const dpr = window.devicePixelRatio || 1;

  // Set container size to prevent layout shift during loading
  if (canvasContainer) {
    canvasContainer.style.width = totalSize + 'px';
    canvasContainer.style.height = totalSize + 'px';
  }

  canvas.width = totalSize * dpr;
  canvas.height = totalSize * dpr;
  canvas.style.width = totalSize + 'px';
  canvas.style.height = totalSize + 'px';

  // DEFENSIVE: Clear animation state when cell size changes
  // Any animation data with old cellSize is now invalid
  gameNumberAnimationState.activeAnimations.clear();
  gameNumberAnimationState.previousState.clear();
  gamePathAnimationState.animatingCells.clear();
  gamePathAnimationState.previousDrawnCells.clear();

  // Note: Setting canvas.width/height resets the context (including transform)
  // Transform will be set at the start of each render() call
  // Don't render here - let caller decide if render is needed
  // This prevents saving empty state before loadOrGeneratePuzzle() runs
}

function render(triggerSave = true, animationMode = 'auto') {
  const { playerDrawnCells, playerConnections } = gameCore.state;
  const totalSize = cellSize * gridSize;
  const dpr = window.devicePixelRatio || 1;

  // Ensure transform is correct before rendering
  // (Setting canvas.width/height resets the context, so we must reapply the transform)
  ctx.setTransform(1, 0, 0, 1, 0, 0);  // Reset to identity
  ctx.scale(dpr, dpr);  // Apply device pixel ratio scaling

  // Build player turn map ONCE per render for reuse
  const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);

  // Calculate score (but don't update display yet - wait until after rendering)
  currentScore = calculateScore(hintCells, playerDrawnCells, gridSize, cachedSolutionTurnMap, playerTurnMap);

  clearCanvas(ctx, totalSize, totalSize);
  renderGrid(ctx, gridSize, cellSize);

  // Pass pre-built maps for performance
  const renderResult = renderCellNumbers(
    ctx, gridSize, cellSize, solutionPath, hintCells, hintMode,
    playerDrawnCells, playerConnections, borderMode, countdown,
    cachedSolutionTurnMap, playerTurnMap, cachedBorderLayers, animationMode,
    gameNumberAnimationState
  );

  // Render solution path if player has viewed it
  if (hasViewedSolution) {
    renderPath(ctx, solutionPath, cellSize);
  }

  // Compute current state key for validation
  const currentStateKey = computeStateKey(playerDrawnCells, playerConnections);
  const stateChanged = currentStateKey !== lastValidatedStateKey;

  // PHASE 1: Visual validation (continuous - runs even while dragging)
  // This determines if the path should be green, without showing modals
  let isCurrentlyWinning = false;
  let hasValidStructure = false;
  let hintsValid = false;

  if (!hasWon) {
    hasValidStructure = checkPartialStructuralWin(playerDrawnCells, playerConnections);

    if (hasValidStructure) {
      const solMap = cachedSolutionTurnMap;
      const playerMap = playerTurnMap;
      hintsValid = validateHints(solMap, playerMap, hintCells, gridSize);

      // Path is green if all win conditions are met
      isCurrentlyWinning = hintsValid;
    }
  }

  // Render path with visual win state (green if currently winning OR officially won)
  const pathRenderResult = renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, isCurrentlyWinning || hasWon, animationMode, gamePathAnimationState);

  // Now that all canvas rendering is complete, update timer display to show score
  // Skip only when solution has been viewed (shows "Viewed solution" text instead)
  if (gameTimer && !hasViewedSolution) {
    gameTimer.updateDisplay();
  }

  // PHASE 2: Modal validation (deferred - only runs when not dragging)
  // This shows modals and sets the official hasWon state
  if (stateChanged && !hasWon && !gameCore.state.isDragging) {
    // Update last validated state now that we're checking for modals
    lastValidatedStateKey = currentStateKey;

    // Get current score percentage
    const scorePercentage = currentScore ? currentScore.percentage : 0;
    const scoreLabel = currentScore ? currentScore.label : 'Okay';

    if (isCurrentlyWinning && scorePercentage === 100) {
      // PERFECT WIN (100%) - all hints satisfied AND all cells visited
      hasWon = true;
      hasShownPartialWinFeedback = false;
      stopTimer();

      // Update UI state for completed game
      setGameUIState(GAME_STATE.WON);
      updateUndoButton();
      updateFinishButton();
      updateClearButton();

      // Mark daily puzzle as completed (not for unlimited mode)
      if (isDailyMode) {
        markDailyCompleted(currentGameDifficulty);
      }

      // Capture time BEFORE any rendering that might cause re-renders
      const finalTime = gameTimer ? gameTimer.getFormattedTime() : '0:00';
      const completionTimeSeconds = gameTimer ? gameTimer.getElapsedSeconds() : 0;

      // Track game completion
      trackGameCompleted(
        currentGameDifficulty,
        isDailyMode ? 'daily' : 'unlimited',
        completionTimeSeconds,
        finalTime
      );

      // Re-render path with win color (already green from visual validation, but ensures consistency)
      const winPathRenderResult = renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, true, animationMode, gamePathAnimationState);

      // Show win celebration
      showWinCelebration(finalTime);
    }
    // Note: Automatic partial win modal removed - players must use Finish button to commit to ending
  }

  // Update finish and Clear button states based on current path
  updateFinishButton();
  updateClearButton();

  // Save game state (throttled to max once per 5 seconds)
  // Only save if triggered by user interaction, not by restore/display changes
  if (triggerSave) {
    throttledSave(captureGameState());
  }

  // Schedule next animation frame if there are active animations (numbers or path)
  const hasNumberAnimations = renderResult && renderResult.hasActiveAnimations;
  const hasPathAnimations = pathRenderResult && pathRenderResult.hasActiveAnimations;

  if (hasNumberAnimations || hasPathAnimations) {
    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null;
        render(false); // Don't trigger save for animation frames
      });
    }
  }
}

/**
 * Generate and start a new puzzle
 *
 * - Daily mode: Uses seeded random for consistent daily puzzles
 * - Unlimited mode: Uses true random for unique puzzles each time
 *
 * Clears any saved progress, resets game state, and starts a fresh timer.
 * Only available in unlimited mode (daily puzzles are fixed per day).
 */
function generateNewPuzzle() {
  // Clear any saved progress when generating a new puzzle
  // (Important for unlimited mode when user clicks "New")
  clearGameState(currentPuzzleId, currentGameDifficulty, isUnlimitedMode);
  clearUndoHistory(); // New puzzle = fresh start

  if (isDailyMode) {
    // Generate daily puzzle with seeded random
    const seed = getDailySeed(currentGameDifficulty);
    const random = createSeededRandom(seed);

    solutionPath = generateSolutionPath(gridSize, random);
    const hintConfig = CONFIG.DIFFICULTY.HINT_CONFIG[currentGameDifficulty];
    hintCells = generateHintCellsWithMinDistance(gridSize, hintConfig.count, hintConfig.minDistance, random);
  } else {
    // Unlimited mode - truly random puzzles
    solutionPath = generateSolutionPath(gridSize);
    const hintConfig = CONFIG.DIFFICULTY.HINT_CONFIG[currentUnlimitedDifficulty];
    hintCells = generateHintCellsWithMinDistance(gridSize, hintConfig.count, hintConfig.minDistance, Math.random);
  }

  // Cache values that don't change during gameplay for performance
  cachedSolutionTurnMap = buildSolutionTurnMap(solutionPath);
  cachedBorderLayers = calculateBorderLayers(hintCells, gridSize);

  gameCore.clearPuzzle();
  hasWon = false;
  hasShownPartialWinFeedback = false;
  hasViewedSolution = false;
  hasManuallyFinished = false;
  lastValidatedStateKey = '';

  // Update UI state for new puzzle
  setGameUIState(GAME_STATE.NEW);

  // Reset timer display in case it was showing "Viewed solution"
  if (gameTimerEl) {
    gameTimerEl.textContent = '0:00';
  }

  // Track analytics events
  if (isUnlimitedMode) {
    // Track puzzle generation (unlimited mode only - daily puzzles are deterministic)
    trackPuzzleGenerated(currentUnlimitedDifficulty);
  }
  // Track game started (both daily and unlimited for fresh puzzles)
  trackGameStarted(currentGameDifficulty, isDailyMode ? 'daily' : 'unlimited');

  startTimer();
  render();
}

/**
 * Restore or regenerate puzzle data (solution path and hint cells)
 * @param {Object|null} savedState - Saved game state, or null to skip restoration
 */
function restorePuzzleData(savedState) {
  if (isDailyMode) {
    // For daily puzzles, regenerate from seed (deterministic)
    const seed = getDailySeed(currentGameDifficulty);
    const random = createSeededRandom(seed);
    solutionPath = generateSolutionPath(gridSize, random);
    const hintConfig = CONFIG.DIFFICULTY.HINT_CONFIG[currentGameDifficulty];
    hintCells = generateHintCellsWithMinDistance(gridSize, hintConfig.count, hintConfig.minDistance, random);
  } else if (savedState) {
    // For unlimited mode, restore saved puzzle data (was truly random)
    solutionPath = savedState.solutionPath;
    hintCells = savedState.hintCells;
  }
}

/**
 * Cache computed values that don't change during gameplay
 * Improves performance by avoiding repeated calculations
 */
function cachePuzzleComputations() {
  cachedSolutionTurnMap = buildSolutionTurnMap(solutionPath);
  cachedBorderLayers = calculateBorderLayers(hintCells, gridSize);
}

/**
 * Restore player progress from saved state
 * @param {Object} savedState - Saved game state
 */
function restorePlayerProgress(savedState) {
  // Restore drawn cells and connections
  gameCore.state.playerDrawnCells = savedState.playerDrawnCells;
  gameCore.state.playerConnections = savedState.playerConnections;

  // Restore game state flags
  hasWon = savedState.hasWon;
  hasShownPartialWinFeedback = savedState.hasShownPartialWinFeedback || false;
  hasViewedSolution = savedState.hasViewedSolution || false;
  hasManuallyFinished = savedState.hasManuallyFinished || false;
}

/**
 * Restore timer state based on game completion status
 * @param {Object} savedState - Saved game state with elapsedSeconds
 */
function restoreTimerState(savedState) {
  if (hasViewedSolution) {
    // Show "Viewed solution" text (takes priority over win time)
    stopTimer();
    // Preserve elapsed seconds for partial win modal and stats
    if (gameTimer) {
      gameTimer.setElapsedSeconds(savedState.elapsedSeconds);
    }
    if (gameTimerEl) {
      gameTimerEl.textContent = 'Viewed solution';
    }
  } else if (hasWon || hasManuallyFinished) {
    // Show final completion time (but don't resume timer)
    stopTimer();
    if (gameTimer) {
      gameTimer.setElapsedSeconds(savedState.elapsedSeconds);
      gameTimer.updateDisplay();
    }
  } else {
    // Resume timer for in-progress game
    startTimer(savedState.elapsedSeconds);
  }
}

/**
 * Load saved game state or generate new puzzle
 * Called during initialization to restore progress if available
 */
function loadOrGeneratePuzzle() {
  clearUndoHistory(); // Undo is session-only, not persisted

  // Try to load saved state
  const savedState = loadGameState(currentPuzzleId, currentGameDifficulty, isUnlimitedMode);

  if (savedState) {
    // Restore puzzle, progress, and UI state
    restorePuzzleData(savedState);
    cachePuzzleComputations();
    restorePlayerProgress(savedState);

    // Update UI based on completion status
    if (hasViewedSolution) {
      setGameUIState(GAME_STATE.VIEWED_SOLUTION);
    } else if (hasWon || hasManuallyFinished) {
      setGameUIState(GAME_STATE.WON);
    } else {
      setGameUIState(GAME_STATE.IN_PROGRESS);
    }

    // Restore timer state
    restoreTimerState(savedState);

    // Render restored state (don't trigger save, no animation on restore)
    render(false, 'none');

    // Show win celebration if applicable
    if (hasWon && !hasViewedSolution) {
      const finalTime = gameTimer ? gameTimer.getFormattedTime() : '0:00';
      showWinCelebration(finalTime);
    } else if (hasManuallyFinished) {
      // Show partial win modal for manually finished games
      const finalTime = gameTimer ? gameTimer.getFormattedTime() : '0:00';
      const scorePercentage = currentScore ? currentScore.percentage : 0;

      // Destroy any previous game sheet before showing new one
      if (activeGameSheet) {
        activeGameSheet.destroy();
      }

      // Build bottom sheet options
      const bottomSheetOptions = {
        title: `You got ${scorePercentage}% in ${finalTime}`,
        content: `<div class="bottom-sheet-message">Make a loop where all numbers are zero for a perfect score. Try again tomorrow!</div>`,
        icon: 'shell',
        colorScheme: 'partial',
        dismissLabel: 'Close',
        onClose: () => {
          // Don't resume timer - game is finished
        }
      };

      // Add Share button only for daily mode
      if (isDailyMode) {
        bottomSheetOptions.primaryButton = {
          label: 'Share',
          icon: 'share-2',
          onClick: async (buttonEl) => {
            await handleShare(buttonEl, finalTime, scorePercentage);
          }
        };
      }

      activeGameSheet = showBottomSheetAsync(bottomSheetOptions);
    }
  } else {
    // No saved state - generate fresh puzzle
    generateNewPuzzle();
  }

  // Trigger canvas fade-in after rendering completes
  // Use requestAnimationFrame to ensure render has painted
  if (canvasContainer) {
    requestAnimationFrame(() => {
      canvasContainer.classList.add('canvas-ready');
    });
  }
}

/**
 * Restart the current puzzle (clear player progress but keep same puzzle)
 *
 * Clears all drawn cells and connections, resets game state flags,
 * and restarts the timer (if game was won) or keeps it running.
 * Does not generate a new puzzle - same solution path and hint cells.
 */
function clearPuzzle() {
  // Track game restart
  trackGameRestarted(currentGameDifficulty, isDailyMode ? 'daily' : 'unlimited');

  pushUndoState(); // Save state before restart (enables undoing the restart)

  gameCore.clearPuzzle();

  // Only restart timer if the game was already won or manually finished (timer was stopped)
  // If game is in progress, keep the timer running
  if (hasWon || hasManuallyFinished) {
    startTimer();
  }

  hasWon = false;
  hasShownPartialWinFeedback = false;
  hasManuallyFinished = false;
  lastValidatedStateKey = '';

  // Update UI state for in-progress game
  setGameUIState(GAME_STATE.IN_PROGRESS);

  updateUndoButton(); // Button becomes enabled after hasWon reset
  updateFinishButton(); // Button becomes disabled after clearing
  updateClearButton(); // Button becomes disabled after clearing (no cells drawn)

  render();
}

/**
 * View the solution path (disqualifies the player from legitimate completion)
 *
 * This function:
 * - Marks the puzzle as viewed (shows skull icon for daily puzzles)
 * - Stops the timer and displays "Viewed solution"
 * - Disables Clear button and hides view solution button
 * - Renders the solution path overlay on the canvas
 * - Saves the disqualified state to localStorage
 * - Closes the settings sheet
 */
function viewSolution() {
  // Track solution viewed
  trackSolutionViewed(currentGameDifficulty, isDailyMode ? 'daily' : 'unlimited');

  // Mark solution as viewed (disqualifies the player)
  hasViewedSolution = true;

  // Stop the timer
  stopTimer();

  // Update timer display to show "Viewed solution"
  if (gameTimerEl) {
    gameTimerEl.textContent = 'Viewed solution';
  }

  // Update UI state for viewed solution
  setGameUIState(GAME_STATE.VIEWED_SOLUTION);

  // Disable undo, finish, and Clear buttons
  updateUndoButton();
  updateFinishButton();
  updateClearButton();

  // For daily puzzles, mark as completed with viewed solution (skull icon)
  if (isDailyMode) {
    markDailyCompletedWithViewedSolution(currentGameDifficulty);
  }

  // Close the settings sheet
  hideSettings();

  // Save game state
  saveGameState(captureGameState());

  // Render to show the solution path
  render();
}

/**
 * Show confirmation modal before ending the game
 * Prevents accidental game endings by requiring confirmation
 */
function showFinishConfirmation() {
  // Get display name for difficulty
  const difficultyName = DIFFICULTY_DISPLAY_NAMES[currentGameDifficulty];

  // Build confirmation message - only show "until tomorrow" for daily mode
  let bodyMessage = '';
  if (isDailyMode) {
    bodyMessage = `You won't be able to play the ${difficultyName} Loopy until tomorrow.`;
  }

  // Destroy any previous game sheet before showing new one
  if (activeGameSheet) {
    activeGameSheet.destroy();
  }

  // Build bottom sheet options for confirmation
  const confirmationOptions = {
    title: 'End this game?',
    content: bodyMessage ? `<div class="bottom-sheet-message">${bodyMessage}</div>` : '',
    icon: 'octagon-alert',
    colorScheme: 'error',
    dismissLabel: 'Keep playing',
    dismissVariant: 'secondary',
    primaryButton: {
      label: 'End game',
      variant: 'destructive',
      onClick: () => {
        // finishGame() will handle closing this modal and showing the result modal
        finishGame();
      }
    }
  };

  activeGameSheet = showBottomSheetAsync(confirmationOptions);
}

/**
 * Finish the current puzzle manually (player commits to ending with current score)
 *
 * This function:
 * - Marks the puzzle as manually finished
 * - Stops the timer permanently
 * - Shows partial win modal with current score
 * - Locks the game (prevents further drawing/erasing)
 * - Disables finish and Clear buttons
 */
function finishGame() {
  // Set manually finished flag
  hasManuallyFinished = true;

  // Stop timer permanently
  stopTimer();

  // Update UI state to lock game
  setGameUIState(GAME_STATE.WON); // Reuse WON state for locking behavior

  // Disable undo, finish, and Clear buttons
  updateUndoButton();
  updateFinishButton();
  updateClearButton();

  // Mark as manually finished for daily puzzles
  if (isDailyMode) {
    markDailyManuallyFinished(currentGameDifficulty);
  }

  // Capture current score and time
  const finalTime = gameTimer ? gameTimer.getFormattedTime() : '0:00';
  const scorePercentage = currentScore ? currentScore.percentage : 0;

  // Show partial win modal with "Close" button (no timer resume)
  // Destroy any previous game sheet before showing new one
  if (activeGameSheet) {
    activeGameSheet.destroy();
  }

  // Build bottom sheet options
  const bottomSheetOptions = {
    title: `You got ${scorePercentage}% in ${finalTime}`,
    content: `<div class="bottom-sheet-message">Make a loop where all numbers are zero for a perfect score. Try again tomorrow!</div>`,
    icon: 'shell',
    colorScheme: 'partial',
    dismissLabel: 'Close',
    onClose: () => {
      // Don't resume timer - game is finished
    }
  };

  // Add Share button only for daily mode
  if (isDailyMode) {
    bottomSheetOptions.primaryButton = {
      label: 'Share',
      icon: 'share-2',
      onClick: async (buttonEl) => {
        await handleShare(buttonEl, finalTime, scorePercentage);
      }
    };
  }

  activeGameSheet = showBottomSheetAsync(bottomSheetOptions);

  // Save game state
  saveGameState(captureGameState());

  // Re-render to ensure UI is correct
  render(false);
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
 * @param {string} difficulty - 'easy', 'medium', 'hard', or 'unlimited'
 */
export function initGame(difficulty) {
  // Detect unlimited mode
  isUnlimitedMode = (difficulty === 'unlimited');

  // Daily mode is any non-unlimited difficulty (easy, medium, hard)
  isDailyMode = !isUnlimitedMode;

  // Load saved settings (applies to all modes)
  const settings = loadSettings();

  // Cache lastUnlimitedDifficulty to avoid re-reading localStorage on every settings save
  cachedLastUnlimitedDifficulty = settings.lastUnlimitedDifficulty;

  // Set grid size from difficulty
  if (isUnlimitedMode) {
    // In unlimited mode, use last selected difficulty (or default to easy)
    currentUnlimitedDifficulty = cachedLastUnlimitedDifficulty;
    currentGameDifficulty = cachedLastUnlimitedDifficulty;
    gridSize = getGridSizeFromDifficulty(cachedLastUnlimitedDifficulty);
    currentPuzzleId = null; // Unlimited mode has no puzzle ID
  } else {
    currentGameDifficulty = difficulty;
    gridSize = getGridSizeFromDifficulty(difficulty);
    currentPuzzleId = getPuzzleId(difficulty); // Set daily puzzle ID
  }

  // Get DOM elements
  canvas = document.getElementById('game-canvas');
  canvasContainer = document.getElementById('canvas-container');
  ctx = canvas.getContext('2d');
  gameTitle = document.getElementById('game-title');
  gameTimerEl = document.getElementById('game-timer');
  newBtn = document.getElementById('new-btn');
  finishBtn = document.getElementById('finish-btn');
  clearBtn = document.getElementById('restart-btn');
  undoBtn = document.getElementById('undo-btn');
  hintsCheckbox = document.getElementById('hints-checkbox');
  countdownCheckbox = document.getElementById('countdown-checkbox');
  borderCheckbox = document.getElementById('border-checkbox');
  backBtn = document.getElementById('back-btn');
  helpBtn = document.getElementById('help-btn');
  settingsBtn = document.getElementById('settings-btn');
  difficultySettingsItem = document.getElementById('difficulty-settings-item');
  segmentedControl = document.getElementById('difficulty-segmented-control');
  segmentButtons = segmentedControl ? segmentedControl.querySelectorAll('.segment-btn') : [];

  // Show End button only if early game ending feature is enabled
  if (CONFIG.FEATURES.ENABLE_EARLY_GAME_ENDING && finishBtn) {
    finishBtn.style.display = '';
  }

  // Create settings bottom sheet with the settings content and view solution button
  const settingsContent = document.getElementById('settings-content');
  settingsSheet = createBottomSheet({
    title: 'Settings',
    content: settingsContent,
    icon: 'settings',
    colorScheme: 'neutral',
    dismissLabel: 'Close',
    primaryButton: {
      label: 'View solution',
      icon: 'eye',
      variant: 'destructive',
      onClick: () => viewSolution()
    }
  });

  // Create timer instance
  gameTimer = createGameTimer({
    onUpdate: (text) => {
      if (gameTimerEl) {
        // Append score to timer display if available and feature is enabled
        if (CONFIG.FEATURES.ENABLE_EARLY_GAME_ENDING && currentScore) {
          gameTimerEl.textContent = `${text} • ${currentScore.percentage}%`;
        } else {
          gameTimerEl.textContent = text;
        }
      }
    },
    difficulty: currentGameDifficulty
  });

  // Clear title text (difficulty is shown in timer display)
  gameTitle.textContent = '';

  // Add unlimited-mode class to play-view for CSS targeting
  const playView = document.getElementById('play-view');
  if (isUnlimitedMode && playView) {
    playView.classList.add('unlimited-mode');
  } else if (playView) {
    playView.classList.remove('unlimited-mode');
  }

  // Show/hide difficulty control based on mode
  if (isUnlimitedMode && difficultySettingsItem) {
    difficultySettingsItem.classList.add('visible');
  } else if (difficultySettingsItem) {
    difficultySettingsItem.classList.remove('visible');
  }

  // Apply saved settings (or defaults)
  hintMode = settings.hintMode;
  borderMode = settings.borderMode;
  countdown = settings.countdown;

  // Reset game state
  hasWon = false;
  hasShownPartialWinFeedback = false;
  hasViewedSolution = false;
  hasManuallyFinished = false;
  lastValidatedStateKey = '';
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
  const resizeHandler = () => {
    resizeCanvas();
    // Don't trigger save on resize - just redraw
    render(false);
  };
  const newBtnHandler = () => generateNewPuzzle();
  const finishBtnHandler = (e) => {
    if (finishBtn.disabled) return; // Ignore if button is disabled
    e.preventDefault(); // Prevent click event from also firing
    showFinishConfirmation();
  };
  const clearBtnHandler = (e) => {
    if (clearBtn.disabled) return; // Ignore if button is disabled
    e.preventDefault(); // Prevent click event from also firing
    clearPuzzle();
  };
  const undoBtnHandler = (e) => {
    if (undoBtn.disabled) return; // Ignore if button is disabled
    e.preventDefault(); // Prevent click event from also firing
    performUndo();
  };
  const hintsHandler = (e) => {
    e.preventDefault();
    cycleHintMode();
  };
  const borderHandler = (e) => {
    e.preventDefault();
    cycleBorderMode();
  };
  const countdownHandler = () => {
    countdown = countdownCheckbox.checked;
    saveCurrentSettings();
    // Don't trigger game state save for display-only changes
    render(false);
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
  const helpBtnHandler = () => showTutorialSheet('game');
  const settingsBtnHandler = () => showSettings();
  const visibilityChangeHandler = () => {
    if (document.hidden) {
      pauseTimer();
      // Save immediately when backgrounding to preserve timer state
      // Bypass throttle to ensure we don't lose progress
      saveGameState(captureGameState());
    } else {
      resumeTimer();
    }
  };

  // Use gameCore methods for pointer events
  // Prevent drawing if game is won, solution was viewed, or manually finished
  const pointerDownHandler = (e) => {
    if (!hasWon && !hasViewedSolution && !hasManuallyFinished) {
      pushUndoState(); // Save state before drawing action starts
      gameCore.handlePointerDown(e);
    }
  };
  const pointerMoveHandler = (e) => {
    if (!hasWon && !hasViewedSolution && !hasManuallyFinished) gameCore.handlePointerMove(e);
  };
  const pointerUpHandler = (e) => {
    if (!hasWon && !hasViewedSolution && !hasManuallyFinished) {
      gameCore.handlePointerUp(e);
    }
  };
  const pointerCancelHandler = (e) => {
    if (!hasWon && !hasViewedSolution && !hasManuallyFinished) gameCore.handlePointerCancel(e);
  };
  const themeChangeHandler = () => {
    // Re-render canvas with updated colors when theme changes
    render(false); // Don't trigger save on theme change
  };

  window.addEventListener('resize', resizeHandler);
  window.addEventListener('themeChanged', themeChangeHandler);
  newBtn.addEventListener('click', newBtnHandler);
  finishBtn.addEventListener('pointerdown', finishBtnHandler);
  clearBtn.addEventListener('pointerdown', clearBtnHandler);
  undoBtn.addEventListener('pointerdown', undoBtnHandler);
  hintsCheckbox.addEventListener('click', hintsHandler);
  countdownCheckbox.addEventListener('change', countdownHandler);
  borderCheckbox.addEventListener('click', borderHandler);
  backBtn.addEventListener('click', backBtnHandler);
  helpBtn.addEventListener('click', helpBtnHandler);
  settingsBtn.addEventListener('click', settingsBtnHandler);
  document.addEventListener('visibilitychange', visibilityChangeHandler);
  canvas.addEventListener('pointerdown', pointerDownHandler);
  canvas.addEventListener('pointermove', pointerMoveHandler);
  canvas.addEventListener('pointerup', pointerUpHandler);
  canvas.addEventListener('pointercancel', pointerCancelHandler);

  // Store event listener references for cleanup
  eventListeners = [
    { element: window, event: 'resize', handler: resizeHandler },
    { element: window, event: 'themeChanged', handler: themeChangeHandler },
    { element: newBtn, event: 'click', handler: newBtnHandler },
    { element: finishBtn, event: 'pointerdown', handler: finishBtnHandler },
    { element: clearBtn, event: 'pointerdown', handler: clearBtnHandler },
    { element: undoBtn, event: 'pointerdown', handler: undoBtnHandler },
    { element: hintsCheckbox, event: 'click', handler: hintsHandler },
    { element: countdownCheckbox, event: 'change', handler: countdownHandler },
    { element: borderCheckbox, event: 'click', handler: borderHandler },
    { element: backBtn, event: 'click', handler: backBtnHandler },
    { element: helpBtn, event: 'click', handler: helpBtnHandler },
    { element: settingsBtn, event: 'click', handler: settingsBtnHandler },
    { element: document, event: 'visibilitychange', handler: visibilityChangeHandler },
    { element: canvas, event: 'pointerdown', handler: pointerDownHandler },
    { element: canvas, event: 'pointermove', handler: pointerMoveHandler },
    { element: canvas, event: 'pointerup', handler: pointerUpHandler },
    { element: canvas, event: 'pointercancel', handler: pointerCancelHandler }
  ];

  // Set up difficulty segmented control (only in unlimited mode)
  if (isUnlimitedMode && segmentButtons) {
    segmentButtons.forEach(btn => {
      const segmentHandler = () => {
        const newDifficulty = btn.getAttribute('data-difficulty');
        changeDifficulty(newDifficulty);
      };
      btn.addEventListener('click', segmentHandler);
      eventListeners.push({ element: btn, event: 'click', handler: segmentHandler });
    });

    // Set initial active state
    updateSegmentedControlState();
  }

  // Initial canvas setup
  resizeCanvas();

  // Load saved game or generate new puzzle
  loadOrGeneratePuzzle();

  // Set initial checkbox state
  updateCheckboxState();
  updateBorderCheckboxState();
  countdownCheckbox.checked = countdown;

  // Initialize undo button state
  updateUndoButton();
}

/**
 * Cleanup function - removes all event listeners
 * Called when navigating away from game view
 */
export function cleanupGame() {
  // Save current state immediately before cleanup
  // This ensures we don't lose timer state or recent draws when navigating away
  // Bypasses throttle for immediate save
  saveGameState(captureGameState());

  // Clean up throttle timer to prevent memory leak
  throttledSaveObj.destroy();

  // Stop timer
  stopTimer();

  // Clean up bottom sheets
  if (settingsSheet) {
    settingsSheet.destroy();
  }
  if (activeGameSheet) {
    activeGameSheet.destroy();
    activeGameSheet = null;
  }

  // Remove all event listeners
  for (const { element, event, handler } of eventListeners) {
    element.removeEventListener(event, handler);
  }
  eventListeners = [];

  // Cancel any pending animation frame
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Clear animation state
  gameNumberAnimationState.activeAnimations.clear();
  gameNumberAnimationState.previousState.clear();
  gamePathAnimationState.animatingCells.clear();
  gamePathAnimationState.previousDrawnCells.clear();

  // Reset drag state in core
  if (gameCore) {
    gameCore.resetDragState();
  }

  // Reset canvas loading state for next visit
  if (canvasContainer) {
    canvasContainer.classList.remove('canvas-ready');
  }

  // Remove unlimited-mode class from play-view
  const playView = document.getElementById('play-view');
  if (playView) {
    playView.classList.remove('unlimited-mode');
  }
}
