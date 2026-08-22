/**
 * Game View - Loop Puzzle Game Logic
 *
 * Extracted game logic with initialization and cleanup functions
 * for use in a multi-view SPA
 */

import { renderGrid, clearCanvas, renderPath, renderCellNumbers, generateHintCellsWithMinDistance, renderPlayerPath, buildPlayerTurnMap, calculateBorderLayers } from '../renderer.js';
import { generateSolutionPath } from '../generator.js';
import { buildSolutionTurnMap, countTurnsInArea, parseCellKey } from '../utils.js';
import { CONFIG, getDifficultyLabel } from '../config.js';
import { navigate } from '../router.js';
import { createGameCore } from '../gameCore.js';
import { createSeededRandom, getDailySeed, getPuzzleId } from '../seededRandom.js';
import { saveGameState, loadGameState, clearGameState, createThrottledSave, saveSettings, loadSettings, markDailyCompleted, markDailyCompletedWithViewedSolution, isDailyCompleted, recordDailyStreak, getOverallStreak, formatStreakLabel } from '../persistence.js';
import { createBottomSheet, showBottomSheetAsync } from '../bottomSheet.js';
import { createWinStreakLine } from '../components/winStreakLine.js';
import { createGameTimer, formatTime } from '../game/timer.js';
import { handleShare as handleShareUtil } from '../game/share.js';
import { calculateCellSize as calculateCellSizeUtil } from '../game/canvasSetup.js';
import { checkPartialStructuralWin, validateHints, computeStateKey, calculateScore } from '../game/validation.js';
import { t } from '../i18n/index.js';
import { showTutorialSheet } from '../components/tutorialSheet.js';
import { generateHintCellsCovering, describePuzzle } from '../generation/hintPlacement.js';
import { getTrickyHintsAssignment, variantForSavedGame, isTrickyCoveringVariant } from '../experiment.js';
import {
  trackGameStarted,
  trackGameCompleted,
  trackGameAbandoned,
  trackGameRestarted,
  trackPuzzleGenerated,
  trackUndoUsed,
  trackSolutionViewed,
  trackSettingsOpened,
  trackValidationError,
  trackStreakUpdated
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
let clearBtn;
let undoBtn;
let hintsSelect;
let hintsValue;
let countdownSelect;
let countdownValue;
let bordersSelect;
let bordersValue;
let backBtn;
let helpBtn;
let settingsBtn;
let difficultySettingsItem;
let segmentedControl;
let segmentButtons;

// Bottom sheet instances
let settingsSheet;
let activeGameSheet;  // Track winning/feedback sheets for cleanup
let activeWinStreakLine;  // Swapping time/streak line inside the win sheet

// Puzzle state
let solutionPath = [];
let hintCells = new Set();
let hintMode = 'partial';
let borderMode = 'off';
let countdown = 'on';
let hasWon = false;
let hasViewedSolution = false;
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

// Hint generation experiment - the arm this puzzle was actually generated with,
// and where that assignment came from. Both ride along on every game event so
// the experiment can be analysed on what was really played rather than on what
// PostHog would report now (see experiment.js).
let currentVariant = null;
let currentVariantSource = null;

// Measured shape of the current puzzle (hint count, coverage, redundancy...).
// Sent with game_started / game_completed / game_abandoned so puzzle quality can
// be correlated with completion independently of the experiment.
let currentPuzzleShape = null;

// Whether the player has touched the current puzzle and not yet finished it.
// Drives the abandon event on exit.
let hasUnfinishedProgress = false;

/* ============================================================================
 * EXPERIMENT & ANALYTICS HELPERS
 * ========================================================================= */

/**
 * The arm the current puzzle was generated with, shaped for analytics
 *
 * @returns {{variant: string, source: string}|null} Assignment, or null before a puzzle exists
 */
function currentAssignment() {
  if (!currentVariant) return null;
  return { variant: currentVariant, source: currentVariantSource };
}

/**
 * Report a puzzle left unfinished, if there is one
 *
 * Called when the player navigates away or the tab goes away for good. Clears
 * the flag first so a navigation that also triggers a page hide cannot report
 * the same abandonment twice.
 */
function reportAbandonmentIfAny() {
  if (!hasUnfinishedProgress) return;
  hasUnfinishedProgress = false;

  const { playerDrawnCells, playerConnections } = gameCore.state;

  // validateHints() answers all-or-nothing; the useful signal on an abandon is
  // how far they got, so count the satisfied hints here
  let hintsSatisfied = 0;
  if (cachedSolutionTurnMap) {
    const playerTurnMap = buildPlayerTurnMap(playerDrawnCells, playerConnections);
    for (const cellKey of hintCells) {
      const { row, col } = parseCellKey(cellKey);
      const expected = countTurnsInArea(row, col, gridSize, cachedSolutionTurnMap);
      const actual = countTurnsInArea(row, col, gridSize, playerTurnMap);
      if (expected === actual) hintsSatisfied++;
    }
  }

  trackGameAbandoned(
    currentGameDifficulty,
    isDailyMode ? 'daily' : 'unlimited',
    gameTimer ? gameTimer.getElapsedSeconds() : 0,
    currentScore ? currentScore.percentage : 0,
    playerDrawnCells.size,
    hintsSatisfied,
    currentPuzzleShape,
    currentAssignment()
  );
}

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
    // Pinned so a daily puzzle, whose hints are rebuilt from the seed on every
    // load, can never be regenerated under a different arm mid-game
    generatorVariant: currentVariant
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
  if (hasWon || hasViewedSolution) {
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
    // Enable Clear button, show view solution button
    if (clearBtn) {
      clearBtn.disabled = false;
    }
    if (viewSolutionBtn) {
      viewSolutionBtn.style.display = '';
    }
  } else if (state === GAME_STATE.WON || state === GAME_STATE.VIEWED_SOLUTION) {
    // Disable Clear button, hide view solution button
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

function updateHintsSelectState() {
  if (hintsSelect) {
    hintsSelect.value = hintMode;
  }
  if (hintsValue) {
    hintsValue.textContent = hintMode === 'partial'
      ? t('settings.numbersPartial')
      : t('settings.numbersAll');
  }
}

function handleHintsChange() {
  if (hintsSelect) {
    hintMode = hintsSelect.value;
    updateHintsSelectState();
    saveCurrentSettings();
    // Don't trigger game state save for display-only changes
    render(false);
  }
}

function updateBordersSelectState() {
  if (bordersSelect) {
    bordersSelect.value = borderMode;
  }
  if (bordersValue) {
    const labels = {
      off: t('settings.bordersOff'),
      center: t('settings.bordersCenter'),
      full: t('settings.bordersFull'),
    };
    bordersValue.textContent = labels[borderMode] || labels.off;
  }
}

function handleBordersChange() {
  if (bordersSelect) {
    borderMode = bordersSelect.value;
    updateBordersSelectState();
    saveCurrentSettings();
    // Don't trigger game state save for display-only changes
    render(false);
  }
}

function updateCountdownSelectState() {
  if (countdownSelect) {
    countdownSelect.value = countdown;
  }
  if (countdownValue) {
    const labels = {
      on: t('settings.behaviourOn'),
      off: t('settings.behaviourOff'),
      both: t('settings.behaviourBoth'),
    };
    countdownValue.textContent = labels[countdown] || labels.on;
  }
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
 * Find the next incomplete daily difficulty to play
 *
 * Searches in order:
 * 1. Next highest difficulties (e.g., medium -> hard)
 * 2. Next lowest difficulties (e.g., medium -> easy)
 *
 * @param {string} currentDifficulty - Current difficulty ('easy', 'medium', 'hard')
 * @returns {string|null} Next incomplete difficulty, or null if all complete
 */
function getNextIncompleteDifficulty(currentDifficulty) {
  const difficulties = ['easy', 'medium', 'hard'];
  const currentIndex = difficulties.indexOf(currentDifficulty);

  // Check higher difficulties first
  for (let i = currentIndex + 1; i < difficulties.length; i++) {
    if (!isDailyCompleted(difficulties[i])) {
      return difficulties[i];
    }
  }

  // Then check lower difficulties
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (!isDailyCompleted(difficulties[i])) {
      return difficulties[i];
    }
  }

  // All difficulties complete
  return null;
}

/**
 * Show win celebration bottom sheet with completion time
 *
 * Displays different UI based on game mode:
 * - Daily mode: Shows "Play another" or "Close" button (secondary) + "Share" button (primary)
 * - Unlimited/Tutorial: Shows "Yay!" button (primary), no share option
 *
 * The body line opens on the completion time and, in daily mode, swaps itself
 * out for the player's overall streak after a beat - see winStreakLine.js.
 * Unlimited games do not touch the daily streak, so there they simply show the
 * time.
 *
 * @param {string} finalTime - Formatted completion time (e.g., "Easy • 2:34")
 */
function showWinCelebration(finalTime) {
  const timeText = t('win.finishedIn', { time: finalTime });

  // A win in daily mode has just recorded the streak, so this reads the value
  // the player has this second
  const streakDays = isDailyMode ? getOverallStreak().current : 0;

  if (activeWinStreakLine) {
    activeWinStreakLine.destroy();
    activeWinStreakLine = null;
  }

  if (streakDays > 0) {
    activeWinStreakLine = createWinStreakLine({
      timeText,
      streakText: formatStreakLabel(streakDays)
    });
  }

  // Build bottom sheet options
  const bottomSheetOptions = {
    title: t('win.title'),
    content: activeWinStreakLine
      ? activeWinStreakLine.element
      : `<div class="bottom-sheet-message">${timeText}</div>`,
    icon: 'party-popper',
    colorScheme: 'success',
    dismissVariant: isDailyMode ? 'secondary' : 'primary',
    showCloseIcon: true
  };

  // Determine dismiss button behavior based on mode
  if (isDailyMode) {
    const nextDifficulty = getNextIncompleteDifficulty(currentGameDifficulty);
    if (nextDifficulty) {
      bottomSheetOptions.dismissLabel = t('win.playAnother');
      bottomSheetOptions.onClose = () => {
        // Defer navigation to next tick to avoid timing issues with cleanup
        // (cleanup destroys the sheet we're currently inside)
        setTimeout(() => {
          navigate(`/play?difficulty=${nextDifficulty}`);
        }, 0);
      };
    } else {
      // All difficulties complete - no dismiss button, just X icon to close
      bottomSheetOptions.dismissLabel = null;
    }
    // Support link lives in the home screen menu, not in the win sheet
  } else {
    bottomSheetOptions.dismissLabel = t('win.yay');
  }

  // Add Share button only for daily mode (not unlimited or tutorial)
  if (isDailyMode) {
    bottomSheetOptions.primaryButton = {
      label: t('win.share'),
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

  // Arm the streak reveal only once the sheet has been told to show, so the
  // delay runs from the sheet appearing. Mirrors showBottomSheetAsync's own
  // scheduling, which puts this immediately after its show() call.
  if (activeWinStreakLine) {
    const line = activeWinStreakLine;
    requestAnimationFrame(() => {
      setTimeout(() => line.start(), 0);
    });
  }
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
    const scoreLabel = currentScore ? currentScore.label : t('score.okay');

    if (isCurrentlyWinning && scorePercentage === 100) {
      // PERFECT WIN (100%) - all hints satisfied AND all cells visited
      hasWon = true;
      stopTimer();

      // Update UI state for completed game
      setGameUIState(GAME_STATE.WON);
      updateUndoButton();
      updateClearButton();

      // Capture time BEFORE any rendering that might cause re-renders
      const finalTime = gameTimer ? gameTimer.getFormattedTime() : '0:00';
      const completionTimeSeconds = gameTimer ? gameTimer.getElapsedSeconds() : 0;

      // Mark daily puzzle as completed (not for unlimited mode)
      if (isDailyMode) {
        markDailyCompleted(currentGameDifficulty);
        const streak = recordDailyStreak(currentGameDifficulty);
        trackStreakUpdated(currentGameDifficulty, streak.difficulty, streak.overall);
      }

      // Track game completion. The score is passed explicitly rather than left
      // to a default: it is always 100 today, because the win gate below is
      // `scorePercentage === 100`, but a hardcoded value would silently start
      // lying the moment that gate changes.
      hasUnfinishedProgress = false;
      trackGameCompleted(
        currentGameDifficulty,
        isDailyMode ? 'daily' : 'unlimited',
        completionTimeSeconds,
        finalTime,
        scorePercentage,
        currentPuzzleShape,
        currentAssignment()
      );

      // Re-render path with win color (already green from visual validation, but ensures consistency)
      const winPathRenderResult = renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, true, animationMode, gamePathAnimationState);

      // Show win celebration
      showWinCelebration(finalTime);
    }
    // Note: Automatic partial win modal removed - players must use Finish button to commit to ending
  }

  // Update finish and Clear button states based on current path
  updateClearButton();

  // Save game state (throttled to max once per 5 seconds)
  // Only save if triggered by user interaction, not by restore/display changes
  if (triggerSave) {
    throttledSave(captureGameState());

    // triggerSave marks a real player action, which is exactly the condition
    // that makes leaving worth reporting as an abandon
    if (!hasWon && !hasViewedSolution && gameCore.state.playerDrawnCells.size > 0) {
      hasUnfinishedProgress = true;
    }
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
/**
 * Hint placement this puzzle should be generated with
 *
 * Only Tricky consults the experiment arm. Easy and Diabolical were settled in
 * round 1 and now use one fixed placement for every player, so an assignment
 * changes nothing outside the 6x6 grid.
 *
 * @param {string} difficulty - Difficulty key
 * @param {string} variant - Experiment arm
 * @returns {Object} Placement config: strategy plus its parameters
 */
function placementFor(difficulty, variant) {
  if (difficulty === 'medium' && isTrickyCoveringVariant(variant)) {
    return CONFIG.DIFFICULTY.TRICKY_COVERING;
  }
  return CONFIG.DIFFICULTY.HINT_PLACEMENT[difficulty];
}

/**
 * Build a puzzle with whichever hint placement this difficulty and arm call for
 *
 * Both arms consume the random source in the same order - solution first, hints
 * second - so on any given day the two arms share an identical solution loop
 * and differ only in where the hints sit on it. That keeps the comparison to
 * the one thing being tested.
 *
 * @param {number} size - Grid size
 * @param {string} difficulty - Difficulty key for hint configuration
 * @param {function(): number} randomFn - Seeded random (daily) or Math.random
 * @param {string} variant - Experiment arm
 * @returns {{solution: Array, turnMap: Map<string, boolean>, hints: Set<string>, shape: Object}} Puzzle
 */
function buildPuzzle(size, difficulty, randomFn, variant) {
  const solution = generateSolutionPath(size, randomFn);

  // The covering placement needs to know what each candidate hint would read,
  // so the turn map has to exist before hints are chosen rather than after
  const turnMap = buildSolutionTurnMap(solution);
  const placement = placementFor(difficulty, variant);

  const hints = placement.strategy === 'covering'
    ? generateHintCellsCovering(size, placement, turnMap, randomFn)
    : generateHintCellsWithMinDistance(size, placement.count, placement.minDistance, randomFn);

  // anchorMaxValue is the threshold anchor_hints is measured at, not just a
  // generation input - both Tricky arms declare 2 so their figures compare
  return { solution, turnMap, hints, shape: describePuzzle(size, hints, turnMap, placement.anchorMaxValue) };
}

function generateNewPuzzle() {
  // Clear any saved progress when generating a new puzzle
  // (Important for unlimited mode when user clicks "New")
  clearGameState(currentPuzzleId, currentGameDifficulty, isUnlimitedMode);
  clearUndoHistory(); // New puzzle = fresh start

  // A fresh puzzle always takes the player's current assignment, and pins it
  // (see captureGameState) so reloading this puzzle regenerates it identically
  const assignment = getTrickyHintsAssignment();
  currentVariant = assignment.variant;
  currentVariantSource = assignment.source;

  let puzzle;
  if (isDailyMode) {
    // Generate daily puzzle with seeded random
    const seed = getDailySeed(currentGameDifficulty);
    puzzle = buildPuzzle(gridSize, currentGameDifficulty, createSeededRandom(seed), currentVariant);
  } else {
    // Unlimited mode - truly random puzzles
    puzzle = buildPuzzle(gridSize, currentUnlimitedDifficulty, Math.random, currentVariant);
  }

  solutionPath = puzzle.solution;
  hintCells = puzzle.hints;
  currentPuzzleShape = puzzle.shape;

  // Cache values that don't change during gameplay for performance
  cachedSolutionTurnMap = puzzle.turnMap;
  cachedBorderLayers = calculateBorderLayers(hintCells, gridSize);

  gameCore.clearPuzzle();
  hasWon = false;
  hasViewedSolution = false;
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
  trackGameStarted(
    currentGameDifficulty,
    isDailyMode ? 'daily' : 'unlimited',
    currentPuzzleShape,
    currentAssignment()
  );

  // A fresh puzzle is unfinished by definition, but nothing has been drawn yet,
  // so opening a puzzle and immediately leaving is not counted as an abandon
  hasUnfinishedProgress = false;

  startTimer();
  render();
}

/**
 * Restore or regenerate puzzle data (solution path and hint cells)
 * @param {Object|null} savedState - Saved game state, or null to skip restoration
 */
function restorePuzzleData(savedState) {
  // A daily save holds no puzzle data - the hints are rebuilt from the date
  // seed every time - so the arm the save was created under has to be honoured
  // here, or a player whose assignment changed between visits would find their
  // half-finished puzzle rearranged around the path they had already drawn.
  const assignment = variantForSavedGame(savedState?.generatorVariant);
  currentVariant = assignment.variant;
  currentVariantSource = assignment.source;

  if (isDailyMode) {
    // For daily puzzles, regenerate from seed (deterministic)
    const seed = getDailySeed(currentGameDifficulty);
    const puzzle = buildPuzzle(gridSize, currentGameDifficulty, createSeededRandom(seed), currentVariant);
    solutionPath = puzzle.solution;
    hintCells = puzzle.hints;
    currentPuzzleShape = puzzle.shape;
  } else if (savedState) {
    // For unlimited mode, restore saved puzzle data (was truly random)
    solutionPath = savedState.solutionPath;
    hintCells = savedState.hintCells;
    currentPuzzleShape = describePuzzle(gridSize, hintCells, buildSolutionTurnMap(solutionPath));
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
    // Preserve elapsed seconds for partial win modal and stats
    if (gameTimer) {
      gameTimer.setElapsedSeconds(savedState.elapsedSeconds);
    }
    if (gameTimerEl) {
      gameTimerEl.textContent = t('game.viewedSolution');
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
  if (hasWon) {
    startTimer();
  }

  hasWon = false;
  lastValidatedStateKey = '';

  // Update UI state for in-progress game
  setGameUIState(GAME_STATE.IN_PROGRESS);

  updateUndoButton(); // Button becomes enabled after hasWon reset
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
    gameTimerEl.textContent = t('game.viewedSolution');
  }

  // Update UI state for viewed solution
  setGameUIState(GAME_STATE.VIEWED_SOLUTION);

  // Disable undo, finish, and Clear buttons
  updateUndoButton();
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
  // Recreate throttled save (may have been destroyed by previous cleanup)
  throttledSaveObj = createThrottledSave();
  throttledSave = throttledSaveObj.save;

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
  clearBtn = document.getElementById('restart-btn');
  undoBtn = document.getElementById('undo-btn');

  // Get settings content and play-view elements
  const settingsContent = document.getElementById('settings-content');
  const playView = document.getElementById('play-view');

  hintsSelect = document.getElementById('hints-select');
  hintsValue = document.getElementById('hints-value');
  countdownSelect = document.getElementById('countdown-select');
  countdownValue = document.getElementById('countdown-value');
  bordersSelect = document.getElementById('borders-select');
  bordersValue = document.getElementById('borders-value');
  backBtn = document.getElementById('back-btn');
  helpBtn = document.getElementById('help-btn');
  settingsBtn = document.getElementById('settings-btn');
  difficultySettingsItem = document.getElementById('difficulty-settings-item');
  segmentedControl = document.getElementById('difficulty-segmented-control');
  segmentButtons = segmentedControl ? segmentedControl.querySelectorAll('.segment-btn') : [];

  // Create settings bottom sheet with the settings content and view solution button
  settingsSheet = createBottomSheet({
    title: t('settings.title'),
    content: settingsContent,
    icon: 'settings',
    colorScheme: 'neutral',
    dismissLabel: t('common.close'),
    primaryButton: {
      label: t('settings.viewSolution'),
      icon: 'eye',
      variant: 'destructive',
      onClick: () => viewSolution()
    }
  });

  // Create timer instance
  gameTimer = createGameTimer({
    onUpdate: (text) => {
      if (gameTimerEl) {
        gameTimerEl.textContent = text;
      }
    },
    difficulty: currentGameDifficulty
  });

  // Clear title text (difficulty is shown in timer display)
  gameTitle.textContent = '';

  // Add unlimited-mode class to play-view for CSS targeting
  // (playView already declared above for settingsContent fix)
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
  const hintsHandler = () => handleHintsChange();
  const bordersHandler = () => handleBordersChange();
  const countdownHandler = () => {
    if (countdownSelect) {
      countdown = countdownSelect.value;
      updateCountdownSelectState();
      saveCurrentSettings();
      // Don't trigger game state save for display-only changes
      render(false);
    }
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
  const helpBtnHandler = () => showTutorialSheet('game', currentGameDifficulty);
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
    if (!hasWon && !hasViewedSolution) {
      pushUndoState(); // Save state before drawing action starts
      gameCore.handlePointerDown(e);
    }
  };
  const pointerMoveHandler = (e) => {
    if (!hasWon && !hasViewedSolution) gameCore.handlePointerMove(e);
  };
  const pointerUpHandler = (e) => {
    if (!hasWon && !hasViewedSolution) {
      gameCore.handlePointerUp(e);
    }
  };
  const pointerCancelHandler = (e) => {
    if (!hasWon && !hasViewedSolution) gameCore.handlePointerCancel(e);
  };
  const themeChangeHandler = () => {
    // Re-render canvas with updated colors when theme changes
    render(false); // Don't trigger save on theme change
  };
  // pagehide rather than beforeunload: beforeunload is unreliable on mobile
  // Safari and blocks the back/forward cache. This still is not a guarantee -
  // a force-quit delivers nothing - so game_abandoned is a lower bound.
  const pageHideHandler = () => {
    reportAbandonmentIfAny();
  };

  window.addEventListener('resize', resizeHandler);
  window.addEventListener('themeChanged', themeChangeHandler);
  newBtn.addEventListener('click', newBtnHandler);
  clearBtn.addEventListener('pointerdown', clearBtnHandler);
  undoBtn.addEventListener('pointerdown', undoBtnHandler);
  hintsSelect.addEventListener('change', hintsHandler);
  countdownSelect.addEventListener('change', countdownHandler);
  bordersSelect.addEventListener('change', bordersHandler);
  backBtn.addEventListener('click', backBtnHandler);
  helpBtn.addEventListener('click', helpBtnHandler);
  settingsBtn.addEventListener('click', settingsBtnHandler);
  document.addEventListener('visibilitychange', visibilityChangeHandler);
  window.addEventListener('pagehide', pageHideHandler);
  canvas.addEventListener('pointerdown', pointerDownHandler);
  canvas.addEventListener('pointermove', pointerMoveHandler);
  canvas.addEventListener('pointerup', pointerUpHandler);
  canvas.addEventListener('pointercancel', pointerCancelHandler);

  // Store event listener references for cleanup
  eventListeners = [
    { element: window, event: 'resize', handler: resizeHandler },
    { element: window, event: 'themeChanged', handler: themeChangeHandler },
    { element: newBtn, event: 'click', handler: newBtnHandler },
    { element: clearBtn, event: 'pointerdown', handler: clearBtnHandler },
    { element: undoBtn, event: 'pointerdown', handler: undoBtnHandler },
    { element: hintsSelect, event: 'change', handler: hintsHandler },
    { element: countdownSelect, event: 'change', handler: countdownHandler },
    { element: bordersSelect, event: 'change', handler: bordersHandler },
    { element: backBtn, event: 'click', handler: backBtnHandler },
    { element: helpBtn, event: 'click', handler: helpBtnHandler },
    { element: settingsBtn, event: 'click', handler: settingsBtnHandler },
    { element: document, event: 'visibilitychange', handler: visibilityChangeHandler },
    { element: window, event: 'pagehide', handler: pageHideHandler },
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

  // Set initial select states
  updateHintsSelectState();
  updateBordersSelectState();
  updateCountdownSelectState();

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
  // Guard against undefined gameCore (shouldn't happen, but defensive)
  if (gameCore) {
    saveGameState(captureGameState());

    // Navigating away from a puzzle in progress. Covers the in-app exits (back
    // button, difficulty change); the pagehide handler covers closing the tab.
    reportAbandonmentIfAny();
  }

  // Clean up throttle timer to prevent memory leak
  if (throttledSaveObj) {
    throttledSaveObj.destroy();
  }

  // Stop timer
  stopTimer();

  // Clean up bottom sheets
  if (settingsSheet) {
    settingsSheet.destroy();
    settingsSheet = null;
  }
  if (activeGameSheet) {
    activeGameSheet.destroy();
    activeGameSheet = null;
  }
  if (activeWinStreakLine) {
    activeWinStreakLine.destroy();
    activeWinStreakLine = null;
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
