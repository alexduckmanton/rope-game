/**
 * Game View - Loop Puzzle Game Logic
 *
 * Extracted game logic with initialization and cleanup functions
 * for use in a multi-view SPA
 */

import { renderGrid, clearCanvas, renderPath, renderCellNumbers, generateHintCells, renderPlayerPath, buildPlayerTurnMap, calculateBorderLayers } from '../renderer.js';
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
import { checkStructuralWin as checkStructuralWinUtil, checkFullWin } from '../game/validation.js';

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
let hasViewedSolution = false;

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
 * TIMER FUNCTIONS (thin wrappers around gameTimer instance)
 * ========================================================================= */

function updateTimerDisplay() {
  if (gameTimer) {
    gameTimer.updateDisplay();
  }
}

function startTimer(resumeFromSeconds = 0) {
  if (gameTimer) {
    gameTimer.start(resumeFromSeconds);
  }
}

function stopTimer() {
  if (gameTimer) {
    gameTimer.stop();
  }
}

function pauseTimer() {
  if (gameTimer) {
    gameTimer.pause();
  }
}

function resumeTimer() {
  if (gameTimer) {
    gameTimer.resume();
  }
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
 * Show win celebration bottom sheet
 * @param {string} finalTime - Formatted completion time (e.g., "2:34")
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

function render(triggerSave = true) {
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
  renderCellNumbers(
    ctx, gridSize, cellSize, solutionPath, hintCells, hintMode,
    playerDrawnCells, playerConnections, borderMode, countdown,
    cachedSolutionTurnMap, playerTurnMap, cachedBorderLayers
  );

  // Render solution path if player has viewed it
  if (hasViewedSolution) {
    renderPath(ctx, solutionPath, cellSize);
  }

  renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);

  if (!hasWon && checkStructuralWin()) {
    // Check if this is a full win or partial win (valid loop but wrong hints)
    // Pass pre-built player turn map to avoid rebuilding
    if (checkWin(playerTurnMap)) {
      // Full win - all validation passed
      hasWon = true;
      hasShownPartialWinFeedback = false; // Reset flag
      stopTimer();

      // Disable restart button when game is completed
      if (restartBtn) {
        restartBtn.disabled = true;
      }

      // Hide view solution button after winning (they can view it freely now)
      const viewSolutionBtn = getViewSolutionBtn();
      if (viewSolutionBtn) {
        viewSolutionBtn.style.display = 'none';
      }

      // Mark daily puzzle as completed (not for unlimited mode)
      if (isDailyMode) {
        markDailyCompleted(currentGameDifficulty);
      }

      // Capture time BEFORE any rendering that might cause re-renders
      const finalTime = gameTimer ? gameTimer.getFormattedTime() : '0:00';

      renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);

      // Show win celebration
      showWinCelebration(finalTime);
    } else if (!hasShownPartialWinFeedback) {
      // Partial win - valid loop but hints don't match
      // Only show feedback once per structural completion
      hasShownPartialWinFeedback = true;

      // Show feedback bottom sheet
      // Destroy any previous game sheet before showing new one
      if (activeGameSheet) {
        activeGameSheet.destroy();
      }
      activeGameSheet = showBottomSheetAsync({
        title: 'Almost there!',
        content: '<div class="bottom-sheet-message">Nice loop, but not all numbers have the correct amount of bends.</div>',
        icon: 'circle-off',
        colorScheme: 'error',
        dismissLabel: 'Keep trying'
      });
    }
  } else {
    // If structural win is no longer valid, reset the feedback flag
    if (!checkStructuralWin()) {
      hasShownPartialWinFeedback = false;
    }
  }

  // Save game state (throttled to max once per 5 seconds)
  // Only save if triggered by user interaction, not by restore/display changes
  if (triggerSave) {
    throttledSave(captureGameState());
  }
}

function generateNewPuzzle() {
  // Clear any saved progress when generating a new puzzle
  // (Important for unlimited mode when user clicks "New")
  clearGameState(currentPuzzleId, currentGameDifficulty, isUnlimitedMode);

  if (isDailyMode) {
    // Generate daily puzzle with seeded random
    const seed = getDailySeed(currentGameDifficulty);
    const random = createSeededRandom(seed);

    solutionPath = generateSolutionPath(gridSize, random);
    hintCells = generateHintCells(gridSize, CONFIG.HINT.PROBABILITY, random);
  } else {
    // Unlimited mode - truly random puzzles
    solutionPath = generateSolutionPath(gridSize);
    hintCells = generateHintCells(gridSize, CONFIG.HINT.PROBABILITY);
  }

  // Cache values that don't change during gameplay for performance
  cachedSolutionTurnMap = buildSolutionTurnMap(solutionPath);
  cachedBorderLayers = calculateBorderLayers(hintCells, gridSize);

  gameCore.restartPuzzle();
  hasWon = false;
  hasShownPartialWinFeedback = false;
  hasViewedSolution = false;

  // Re-enable restart button for new puzzle
  if (restartBtn) {
    restartBtn.disabled = false;
  }

  // Reset timer display in case it was showing "Viewed solution"
  if (gameTimerEl) {
    gameTimerEl.textContent = '0:00';
  }

  // Show view solution button for new puzzle
  const viewSolutionBtn = getViewSolutionBtn();
  if (viewSolutionBtn) {
    viewSolutionBtn.style.display = '';
  }

  startTimer();
  render();
}

/**
 * Load saved game state or generate new puzzle
 * Called during initialization to restore progress if available
 */
function loadOrGeneratePuzzle() {
  // Try to load saved state
  const savedState = loadGameState(currentPuzzleId, currentGameDifficulty, isUnlimitedMode);

  if (savedState) {
    // Saved state exists - restore the game

    // For daily puzzles, regenerate the puzzle from seed
    // (we don't save puzzle data for daily since it's deterministic)
    if (isDailyMode) {
      const seed = getDailySeed(currentGameDifficulty);
      const random = createSeededRandom(seed);
      solutionPath = generateSolutionPath(gridSize, random);
      hintCells = generateHintCells(gridSize, CONFIG.HINT.PROBABILITY, random);
    } else {
      // For unlimited mode, restore the saved puzzle data
      // (we can't regenerate it since it was truly random)
      solutionPath = savedState.solutionPath;
      hintCells = savedState.hintCells;
    }

    // Cache values that don't change during gameplay for performance
    cachedSolutionTurnMap = buildSolutionTurnMap(solutionPath);
    cachedBorderLayers = calculateBorderLayers(hintCells, gridSize);

    // Restore player progress
    gameCore.state.playerDrawnCells = savedState.playerDrawnCells;
    gameCore.state.playerConnections = savedState.playerConnections;

    // Restore win state
    hasWon = savedState.hasWon;
    hasShownPartialWinFeedback = savedState.hasShownPartialWinFeedback || false;
    hasViewedSolution = savedState.hasViewedSolution || false;

    // Disable restart button if game was already won
    if (hasWon && restartBtn) {
      restartBtn.disabled = true;
    }

    // Hide view solution button if game was already won
    const viewSolutionBtn = getViewSolutionBtn();
    if (hasWon && viewSolutionBtn) {
      viewSolutionBtn.style.display = 'none';
    }

    // Apply restrictions if solution was viewed
    if (hasViewedSolution) {
      // Disable restart button
      if (restartBtn) {
        restartBtn.disabled = true;
      }
      // Hide view solution button (already viewed)
      if (viewSolutionBtn) {
        viewSolutionBtn.style.display = 'none';
      }
    }

    // Enable restart button for in-progress games
    // (Button may be disabled from a previous game, so explicitly enable it)
    if (!hasWon && !hasViewedSolution && restartBtn) {
      restartBtn.disabled = false;
    }

    // Restore and resume timer
    if (hasViewedSolution) {
      // Always show "Viewed solution" if they viewed it (takes priority over win time)
      if (gameTimerEl) {
        gameTimerEl.textContent = 'Viewed solution';
      }
    } else if (hasWon) {
      // If game was already won (without viewing solution), show final time
      if (gameTimer) {
        gameTimer.setElapsedSeconds(savedState.elapsedSeconds);
        gameTimer.updateDisplay();
      }
    } else {
      // Resume timer from saved elapsed time
      startTimer(savedState.elapsedSeconds);
    }

    // Render the restored state (don't save - it's already in localStorage)
    render(false);

    // Show win celebration if game was won (but not if solution was viewed)
    if (hasWon && !hasViewedSolution) {
      const finalTime = gameTimer ? gameTimer.getFormattedTime() : '0:00';
      showWinCelebration(finalTime);
    }
  } else {
    // No saved state - generate fresh puzzle
    generateNewPuzzle();
  }
}

function restartPuzzle() {
  gameCore.restartPuzzle();

  // Only restart timer if the game was already won (timer was stopped)
  // If game is in progress, keep the timer running
  if (hasWon) {
    startTimer();
  }

  hasWon = false;
  hasShownPartialWinFeedback = false;

  // Re-enable restart button when restarting
  if (restartBtn) {
    restartBtn.disabled = false;
  }

  render();
}

function viewSolution() {
  // Mark solution as viewed (disqualifies the player)
  hasViewedSolution = true;

  // Stop the timer
  stopTimer();

  // Update timer display to show "Viewed solution"
  if (gameTimerEl) {
    gameTimerEl.textContent = 'Viewed solution';
  }

  // Disable restart button (can't retry after viewing solution)
  if (restartBtn) {
    restartBtn.disabled = true;
  }

  // Hide view solution button (already viewed)
  const viewSolutionBtn = getViewSolutionBtn();
  if (viewSolutionBtn) {
    viewSolutionBtn.style.display = 'none';
  }

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
  hasViewedSolution = false;
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
    if (!hasViewedSolution) gameCore.handlePointerMove(e);
  };
  const pointerUpHandler = (e) => {
    if (!hasViewedSolution) gameCore.handlePointerUp(e);
  };
  const pointerCancelHandler = (e) => {
    if (!hasViewedSolution) gameCore.handlePointerCancel(e);
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

  // Reset drag state in core
  if (gameCore) {
    gameCore.resetDragState();
  }
}
