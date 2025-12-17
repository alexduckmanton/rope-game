/**
 * Game View - Loop Puzzle Game Logic
 *
 * Extracted game logic with initialization and cleanup functions
 * for use in a multi-view SPA
 */

import { renderGrid, clearCanvas, renderPath, renderCellNumbers, generateHintCells, renderPlayerPath, buildPlayerTurnMap, calculateBorderLayers, resetNumberAnimationState, resetPathAnimationState } from '../renderer.js';
import { generateSolutionPath } from '../generator.js';
import { buildSolutionTurnMap, countTurnsInArea, checkStructuralLoop, parseCellKey } from '../utils.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';
import { createGameCore } from '../gameCore.js';
import { createSeededRandom, getDailySeed, getPuzzleId } from '../seededRandom.js';
import { saveGameState, loadGameState, clearGameState, createThrottledSave, saveSettings, loadSettings, markDailyCompleted, markDailyCompletedWithViewedSolution } from '../persistence.js';
import { createBottomSheet, showBottomSheetAsync } from '../bottomSheet.js';
import { createGameTimer, formatTime } from '../game/timer.js';
import { handleShare as handleShareUtil } from '../game/share.js';
import { calculateCellSize as calculateCellSizeUtil } from '../game/canvasSetup.js';
import { checkStructuralWin as checkStructuralWinUtil, checkFullWin, checkPartialStructuralWin, checkAllCellsVisited, validateHints, DIFFICULTY, checkShouldValidate } from '../game/validation.js';

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
let ctx;
let gameTitle;
let gameTimerEl;
let newBtn;
let restartBtn;
let hintsCheckbox;
let countdownCheckbox;
let borderCheckbox;
let backBtn;
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
let hasShownIncompleteLoopFeedback = false;
let hasViewedSolution = false;
let lastValidatedStateKey = '';  // Track state to avoid redundant validation

// Cached values for performance (recalculated when puzzle changes)
let cachedBorderLayers = null;
let cachedSolutionTurnMap = null;

// Timer instance (encapsulates all timer state)
let gameTimer = null;

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
    hasViewedSolution
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
    // Enable restart button and show view solution button
    if (restartBtn) {
      restartBtn.disabled = false;
    }
    if (viewSolutionBtn) {
      viewSolutionBtn.style.display = '';
    }
  } else if (state === GAME_STATE.WON || state === GAME_STATE.VIEWED_SOLUTION) {
    // Disable restart button and hide view solution button
    if (restartBtn) {
      restartBtn.disabled = true;
    }
    if (viewSolutionBtn) {
      viewSolutionBtn.style.display = 'none';
    }
  }
}

function checkStructuralWin() {
  const { playerDrawnCells, playerConnections } = gameCore.state;
  return checkStructuralWinUtil(playerDrawnCells, playerConnections, gridSize);
}

function checkWin(playerTurnMap = null) {
  const { playerDrawnCells, playerConnections } = gameCore.state;
  const sTurnMap = cachedSolutionTurnMap || buildSolutionTurnMap(solutionPath);
  const pTurnMap = playerTurnMap || buildPlayerTurnMap(playerDrawnCells, playerConnections);

  return checkFullWin(
    { playerDrawnCells, playerConnections },
    solutionPath,
    hintCells,
    gridSize,
    sTurnMap,
    pTurnMap
  );
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
    title: 'You made a loop!',
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
      onClick: (buttonEl) => handleShare(buttonEl, finalTime)
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
async function handleShare(buttonEl, finalTime) {
  await handleShareUtil(buttonEl, currentGameDifficulty, finalTime);
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

  canvas.width = totalSize * dpr;
  canvas.height = totalSize * dpr;
  canvas.style.width = totalSize + 'px';
  canvas.style.height = totalSize + 'px';

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

  clearCanvas(ctx, totalSize, totalSize);
  renderGrid(ctx, gridSize, cellSize);

  // Pass pre-built maps for performance
  const renderResult = renderCellNumbers(
    ctx, gridSize, cellSize, solutionPath, hintCells, hintMode,
    playerDrawnCells, playerConnections, borderMode, countdown,
    cachedSolutionTurnMap, playerTurnMap, cachedBorderLayers, animationMode
  );

  // Render solution path if player has viewed it
  if (hasViewedSolution) {
    renderPath(ctx, solutionPath, cellSize);
  }

  const pathRenderResult = renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon, animationMode);

  // Check if we should run validation based on state changes and drag state
  const { shouldValidate, currentStateKey } = checkShouldValidate({
    playerDrawnCells,
    playerConnections,
    gameCore,
    hasWon,
    lastValidatedStateKey
  });

  // Validation flow (only runs when validation should occur):
  // 1. Check if drawn cells form a valid closed loop (not necessarily all cells)
  // 2. If yes, check if all hints are validated
  // 3. For easy/medium: hints valid = win; for hard: also requires all cells visited
  // 4. Show appropriate error/win message based on difficulty and conditions
  if (shouldValidate && checkPartialStructuralWin(playerDrawnCells, playerConnections)) {
    // Update last validated state now that we're actually validating
    lastValidatedStateKey = currentStateKey;

    // Player has drawn a valid closed loop (single connected loop, each cell has 2 connections)

    // Build turn maps for validation
    const solMap = cachedSolutionTurnMap;
    const playerMap = playerTurnMap;

    // Check if all hints in the grid are validated correctly
    const hintsValid = validateHints(solMap, playerMap, hintCells, gridSize);

    // Hard mode requires visiting all cells; easy/medium only require satisfying hints
    const requiresAllCells = currentGameDifficulty === DIFFICULTY.HARD;
    const allCellsVisited = checkAllCellsVisited(playerDrawnCells, gridSize);

    if (hintsValid) {
      // All hints are correct! Check win condition based on difficulty
      if (!requiresAllCells || allCellsVisited) {
        // WIN - either all cells not required (easy/medium), or all cells visited (hard)
        hasWon = true;
        hasShownPartialWinFeedback = false;
        hasShownIncompleteLoopFeedback = false;
        stopTimer();

        // Update UI state for completed game
        setGameUIState(GAME_STATE.WON);

        // Mark daily puzzle as completed (not for unlimited mode)
        if (isDailyMode) {
          markDailyCompleted(currentGameDifficulty);
        }

        // Capture time BEFORE any rendering that might cause re-renders
        const finalTime = gameTimer ? gameTimer.getFormattedTime() : '0:00';

        // Re-render path with win color (updates pathRenderResult)
        const winPathRenderResult = renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon, animationMode);

        // Show win celebration
        showWinCelebration(finalTime);
      } else if (!hasShownIncompleteLoopFeedback) {
        // Hard mode only: Valid loop, all hints correct, but not all cells visited
        hasShownIncompleteLoopFeedback = true;

        // Destroy any previous game sheet before showing new one
        if (activeGameSheet) {
          activeGameSheet.destroy();
        }
        activeGameSheet = showBottomSheetAsync({
          title: 'Almost there',
          content: '<div class="bottom-sheet-message">In hard mode, your loop must pass through every square in the grid.</div>',
          icon: 'circle-off',
          colorScheme: 'error',
          dismissLabel: 'Keep trying'
        });
      }
    } else {
      // Hints are wrong
      // For easy/medium: show error on any complete loop
      // For hard: show error only when all cells visited
      const shouldShowHintsError = requiresAllCells ? allCellsVisited : true;

      if (shouldShowHintsError && !hasShownPartialWinFeedback) {
        // "Almost there!" error - hints don't match
        hasShownPartialWinFeedback = true;

        // Destroy any previous game sheet before showing new one
        if (activeGameSheet) {
          activeGameSheet.destroy();
        }
        activeGameSheet = showBottomSheetAsync({
          title: 'Almost there!',
          content: '<div class="bottom-sheet-message"><p style="margin-bottom: 1em;">Some numbers are touching the wrong amount of bends in your loop.</p><p>Draw a loop that satisfies all numbers.</p></div>',
          icon: 'circle-off',
          colorScheme: 'error',
          dismissLabel: 'Keep trying'
        });
      }
    }
  } else if (shouldValidate) {
    // Update last validated state now that we're actually validating
    lastValidatedStateKey = currentStateKey;

    // Reset feedback flags if structural win is no longer valid
    if (!checkPartialStructuralWin(playerDrawnCells, playerConnections)) {
      hasShownPartialWinFeedback = false;
      hasShownIncompleteLoopFeedback = false;
    }
  }

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

  if (isDailyMode) {
    // Generate daily puzzle with seeded random
    const seed = getDailySeed(currentGameDifficulty);
    const random = createSeededRandom(seed);

    solutionPath = generateSolutionPath(gridSize, random);
    const maxHints = getMaxHintsForDifficulty(currentGameDifficulty, isDailyMode);
    const probability = getHintProbabilityForDifficulty(currentGameDifficulty);
    hintCells = generateHintCells(gridSize, probability, random, maxHints);
  } else {
    // Unlimited mode - truly random puzzles (no hint limit)
    solutionPath = generateSolutionPath(gridSize);
    const maxHints = getMaxHintsForDifficulty(currentUnlimitedDifficulty, isDailyMode);
    const probability = getHintProbabilityForDifficulty(currentUnlimitedDifficulty);
    hintCells = generateHintCells(gridSize, probability, Math.random, maxHints);
  }

  // Cache values that don't change during gameplay for performance
  cachedSolutionTurnMap = buildSolutionTurnMap(solutionPath);
  cachedBorderLayers = calculateBorderLayers(hintCells, gridSize);

  gameCore.restartPuzzle();
  hasWon = false;
  hasShownPartialWinFeedback = false;
  hasShownIncompleteLoopFeedback = false;
  hasViewedSolution = false;
  lastValidatedStateKey = '';

  // Update UI state for new puzzle
  setGameUIState(GAME_STATE.NEW);

  // Reset timer display in case it was showing "Viewed solution"
  if (gameTimerEl) {
    gameTimerEl.textContent = '0:00';
  }

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
    const maxHints = getMaxHintsForDifficulty(currentGameDifficulty, isDailyMode);
    const probability = getHintProbabilityForDifficulty(currentGameDifficulty);
    hintCells = generateHintCells(gridSize, probability, random, maxHints);
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
}

/**
 * Restore timer state based on game completion status
 * @param {Object} savedState - Saved game state with elapsedSeconds
 */
function restoreTimerState(savedState) {
  if (hasViewedSolution) {
    // Show "Viewed solution" text (takes priority over win time)
    stopTimer();
    if (gameTimerEl) {
      gameTimerEl.textContent = 'Viewed solution';
    }
  } else if (hasWon) {
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
    } else if (hasWon) {
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
    }
  } else {
    // No saved state - generate fresh puzzle
    generateNewPuzzle();
  }
}

/**
 * Restart the current puzzle (clear player progress but keep same puzzle)
 *
 * Clears all drawn cells and connections, resets game state flags,
 * and restarts the timer (if game was won) or keeps it running.
 * Does not generate a new puzzle - same solution path and hint cells.
 */
function restartPuzzle() {
  gameCore.restartPuzzle();

  // Only restart timer if the game was already won (timer was stopped)
  // If game is in progress, keep the timer running
  if (hasWon) {
    startTimer();
  }

  hasWon = false;
  hasShownPartialWinFeedback = false;
  hasShownIncompleteLoopFeedback = false;
  lastValidatedStateKey = '';

  // Update UI state for in-progress game
  setGameUIState(GAME_STATE.IN_PROGRESS);

  render();
}

/**
 * View the solution path (disqualifies the player from legitimate completion)
 *
 * This function:
 * - Marks the puzzle as viewed (shows skull icon for daily puzzles)
 * - Stops the timer and displays "Viewed solution"
 * - Disables restart button and hides view solution button
 * - Renders the solution path overlay on the canvas
 * - Saves the disqualified state to localStorage
 * - Closes the settings sheet
 */
function viewSolution() {
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
 * Get maximum hint count for a difficulty level
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @param {boolean} isDailyMode - Whether this is a daily puzzle (unused, kept for API consistency)
 * @returns {number|null} Maximum hints (null for unlimited)
 */
function getMaxHintsForDifficulty(difficulty, isDailyMode) {
  // Easy puzzles (both daily and unlimited) are capped at 2 hints to make them easier
  // Medium and hard have unlimited hints
  return (difficulty === 'easy') ? 2 : null;
}

/**
 * Get hint probability for a difficulty level
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @returns {number} Probability value between 0 and 1
 *
 * Easy: 30% (0.3) - higher chance but capped at 2 hints
 * Medium: 20% (0.2) - lower probability, unlimited hints
 * Hard: 30% (0.3) - same as easy but unlimited hints on larger grid
 */
function getHintProbabilityForDifficulty(difficulty) {
  const probabilityMap = {
    'easy': 0.3,
    'medium': 0.2,
    'hard': 0.3
  };
  return probabilityMap[difficulty] || 0.3; // Default to 30%
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
  ctx = canvas.getContext('2d');
  gameTitle = document.getElementById('game-title');
  gameTimerEl = document.getElementById('game-timer');
  newBtn = document.getElementById('new-btn');
  restartBtn = document.getElementById('restart-btn');
  hintsCheckbox = document.getElementById('hints-checkbox');
  countdownCheckbox = document.getElementById('countdown-checkbox');
  borderCheckbox = document.getElementById('border-checkbox');
  backBtn = document.getElementById('back-btn');
  settingsBtn = document.getElementById('settings-btn');
  difficultySettingsItem = document.getElementById('difficulty-settings-item');
  segmentedControl = document.getElementById('difficulty-segmented-control');
  segmentButtons = segmentedControl ? segmentedControl.querySelectorAll('.segment-btn') : [];

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
      if (gameTimerEl) gameTimerEl.textContent = text;
    },
    difficulty: currentGameDifficulty
  });

  // Clear title text (difficulty is shown in timer display)
  gameTitle.textContent = '';

  // Show/hide difficulty control based on mode
  if (isUnlimitedMode && difficultySettingsItem) {
    difficultySettingsItem.classList.add('visible');
  } else if (difficultySettingsItem) {
    difficultySettingsItem.classList.remove('visible');
  }

  // Hide "New" button in daily modes (only show in unlimited mode)
  if (isDailyMode && newBtn) {
    newBtn.style.display = 'none';
  } else if (newBtn) {
    newBtn.style.display = '';
  }

  // Apply saved settings (or defaults)
  hintMode = settings.hintMode;
  borderMode = settings.borderMode;
  countdown = settings.countdown;

  // Reset game state
  hasWon = false;
  hasShownPartialWinFeedback = false;
  hasShownIncompleteLoopFeedback = false;
  hasViewedSolution = false;
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
  const restartBtnHandler = () => restartPuzzle();
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
  // Prevent drawing if game is won or solution was viewed
  const pointerDownHandler = (e) => {
    if (!hasWon && !hasViewedSolution) gameCore.handlePointerDown(e);
  };
  const pointerMoveHandler = (e) => {
    if (!hasWon && !hasViewedSolution) gameCore.handlePointerMove(e);
  };
  const pointerUpHandler = (e) => {
    if (!hasWon && !hasViewedSolution) gameCore.handlePointerUp(e);
  };
  const pointerCancelHandler = (e) => {
    if (!hasWon && !hasViewedSolution) gameCore.handlePointerCancel(e);
  };

  window.addEventListener('resize', resizeHandler);
  newBtn.addEventListener('click', newBtnHandler);
  restartBtn.addEventListener('click', restartBtnHandler);
  hintsCheckbox.addEventListener('click', hintsHandler);
  countdownCheckbox.addEventListener('change', countdownHandler);
  borderCheckbox.addEventListener('click', borderHandler);
  backBtn.addEventListener('click', backBtnHandler);
  settingsBtn.addEventListener('click', settingsBtnHandler);
  document.addEventListener('visibilitychange', visibilityChangeHandler);
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
    { element: countdownCheckbox, event: 'change', handler: countdownHandler },
    { element: borderCheckbox, event: 'click', handler: borderHandler },
    { element: backBtn, event: 'click', handler: backBtnHandler },
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
  resetNumberAnimationState();
  resetPathAnimationState();

  // Reset drag state in core
  if (gameCore) {
    gameCore.resetDragState();
  }
}
