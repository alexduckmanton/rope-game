/**
 * Game View - Loop Puzzle Game Logic
 *
 * Extracted game logic with initialization and cleanup functions
 * for use in a multi-view SPA
 */

import { renderGrid, clearCanvas, renderPath, renderCellNumbers, generateHintCells, renderPlayerPath, buildPlayerTurnMap } from '../renderer.js';
import { generateSolutionPath } from '../generator.js';
import { buildSolutionTurnMap, countTurnsInArea, checkStructuralLoop } from '../utils.js';
import { CONFIG } from '../config.js';
import { navigate } from '../router.js';
import { createGameCore } from '../gameCore.js';
import { createSeededRandom, getDailySeed, getPuzzleId } from '../seededRandom.js';
import { saveGameState, loadGameState, clearGameState, createThrottledSave, saveSettings, loadSettings } from '../persistence.js';
import { createBottomSheet } from '../bottomSheet.js';

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
let solutionCheckbox;
let backBtn;
let settingsBtn;
let difficultySettingsItem;
let segmentedControl;
let segmentButtons;

// Bottom sheet instances
let settingsSheet;

// Puzzle state
let solutionPath = [];
let hintCells = new Set();
let hintMode = 'partial';
let borderMode = 'off';
let showSolution = false;
let countdown = true;
let hasWon = false;
let hasShownPartialWinFeedback = false;

// Timer state
let timerStartTime = 0;
let timerInterval = null;
let elapsedSeconds = 0;
let isPaused = false;
let pauseStartTime = 0;

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
    elapsedSeconds,
    solutionPath,
    hintCells
  };
}

/**
 * Save current settings to localStorage
 */
function saveCurrentSettings() {
  const settings = {
    hintMode,
    borderMode,
    showSolution,
    countdown,
    // Use cached value instead of re-reading from localStorage
    lastUnlimitedDifficulty: cachedLastUnlimitedDifficulty
  };

  saveSettings(settings);
}

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

  // Validate hint turn counts
  const { playerDrawnCells, playerConnections } = gameCore.state;
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
 * TIMER FUNCTIONS
 * ========================================================================= */

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
  if (gameTimerEl) {
    const difficultyLabel = currentGameDifficulty.charAt(0).toUpperCase() + currentGameDifficulty.slice(1);
    gameTimerEl.textContent = `${difficultyLabel} • ${formatTime(elapsedSeconds)}`;
  }
}

function startTimer(resumeFromSeconds = 0) {
  // Stop any existing timer
  stopTimer();

  // Set up timer state
  // If resuming, adjust start time so elapsed time calculation is correct
  if (resumeFromSeconds > 0) {
    elapsedSeconds = resumeFromSeconds;
    timerStartTime = Date.now() - (resumeFromSeconds * 1000);
  } else {
    elapsedSeconds = 0;
    timerStartTime = Date.now();
  }

  isPaused = false;
  pauseStartTime = 0;
  updateTimerDisplay();

  // Start interval to update every second
  timerInterval = setInterval(() => {
    // Only update if not paused
    if (!isPaused) {
      elapsedSeconds = Math.floor((Date.now() - timerStartTime) / 1000);
      updateTimerDisplay();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  // Reset pause state when stopping timer
  isPaused = false;
  pauseStartTime = 0;
}

function pauseTimer() {
  // Only pause if timer is running and not already paused
  if (!timerInterval || isPaused) return;

  isPaused = true;
  pauseStartTime = Date.now();
}

function resumeTimer() {
  // Only resume if actually paused
  if (!isPaused) return;

  // Calculate pause duration and shift start time forward
  // This keeps the elapsed time calculation correct
  const pauseDuration = Date.now() - pauseStartTime;
  timerStartTime += pauseDuration;

  isPaused = false;
  pauseStartTime = 0;
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
  }
}

function hideSettings() {
  if (settingsSheet) {
    settingsSheet.hide();
  }
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
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const availableHeight = viewportHeight - CONFIG.LAYOUT.TOP_BAR_HEIGHT;
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
  // Don't render here - let caller decide if render is needed
  // This prevents saving empty state before loadOrGeneratePuzzle() runs
}

function render(triggerSave = true) {
  const { playerDrawnCells, playerConnections } = gameCore.state;
  const totalSize = cellSize * gridSize;

  clearCanvas(ctx, totalSize, totalSize);
  renderGrid(ctx, gridSize, cellSize);
  renderCellNumbers(ctx, gridSize, cellSize, solutionPath, hintCells, hintMode, playerDrawnCells, playerConnections, borderMode, countdown);

  if (showSolution) {
    renderPath(ctx, solutionPath, cellSize);
  }

  renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);

  if (!hasWon && checkStructuralWin()) {
    // Check if this is a full win or partial win (valid loop but wrong hints)
    if (checkWin()) {
      // Full win - all validation passed
      hasWon = true;
      hasShownPartialWinFeedback = false; // Reset flag
      stopTimer();

      // Capture time BEFORE any rendering that might cause re-renders
      const finalTime = formatTime(elapsedSeconds);

      renderPlayerPath(ctx, playerDrawnCells, playerConnections, cellSize, hasWon);

      // Show win bottom sheet with completion time
      const winContent = `<div style="padding: 20px; text-align: center; font-size: 16px; color: #7F8C8D;">You finished in ${finalTime}.</div>`;
      const winSheet = createBottomSheet({
        title: 'You made a loop!',
        content: winContent
      });

      // Use requestAnimationFrame + setTimeout to ensure render completes before showing sheet
      requestAnimationFrame(() => {
        setTimeout(() => {
          winSheet.show();
        }, 0);
      });
    } else if (!hasShownPartialWinFeedback) {
      // Partial win - valid loop but hints don't match
      // Only show feedback once per structural completion
      hasShownPartialWinFeedback = true;

      // Show feedback bottom sheet
      const feedbackSheet = createBottomSheet({
        title: 'Almost there!',
        content: '<div style="padding: 20px; text-align: center; font-size: 16px; color: #7F8C8D;">Nice loop, but not all numbers have the correct amount of bends.</div>'
      });

      requestAnimationFrame(() => {
        setTimeout(() => {
          feedbackSheet.show();
        }, 0);
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

  gameCore.restartPuzzle();
  hasWon = false;
  hasShownPartialWinFeedback = false;
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

    // Restore player progress
    gameCore.state.playerDrawnCells = savedState.playerDrawnCells;
    gameCore.state.playerConnections = savedState.playerConnections;

    // Restore win state
    hasWon = savedState.hasWon;
    hasShownPartialWinFeedback = savedState.hasShownPartialWinFeedback || false;

    // Restore and resume timer
    if (hasWon) {
      // If game was already won, don't start timer
      elapsedSeconds = savedState.elapsedSeconds;
      updateTimerDisplay();
    } else {
      // Resume timer from saved elapsed time
      startTimer(savedState.elapsedSeconds);
    }

    // Render the restored state (don't save - it's already in localStorage)
    render(false);
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
  solutionCheckbox = document.getElementById('solution-checkbox');
  backBtn = document.getElementById('back-btn');
  settingsBtn = document.getElementById('settings-btn');
  difficultySettingsItem = document.getElementById('difficulty-settings-item');
  segmentedControl = document.getElementById('difficulty-segmented-control');
  segmentButtons = segmentedControl ? segmentedControl.querySelectorAll('.segment-btn') : [];

  // Create settings bottom sheet with the settings content
  const settingsContent = document.getElementById('settings-content');
  settingsSheet = createBottomSheet({
    title: 'Settings',
    content: settingsContent
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
  showSolution = settings.showSolution;
  countdown = settings.countdown;

  // Reset game state
  hasWon = false;
  hasShownPartialWinFeedback = false;
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
  const solutionHandler = () => {
    showSolution = solutionCheckbox.checked;
    saveCurrentSettings();
    // Don't trigger game state save for display-only changes
    render(false);
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
  const pointerDownHandler = (e) => {
    if (!hasWon) gameCore.handlePointerDown(e);
  };
  const pointerMoveHandler = (e) => gameCore.handlePointerMove(e);
  const pointerUpHandler = (e) => gameCore.handlePointerUp(e);
  const pointerCancelHandler = (e) => gameCore.handlePointerCancel(e);

  window.addEventListener('resize', resizeHandler);
  newBtn.addEventListener('click', newBtnHandler);
  restartBtn.addEventListener('click', restartBtnHandler);
  hintsCheckbox.addEventListener('click', hintsHandler);
  countdownCheckbox.addEventListener('change', countdownHandler);
  borderCheckbox.addEventListener('click', borderHandler);
  solutionCheckbox.addEventListener('change', solutionHandler);
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
    { element: solutionCheckbox, event: 'change', handler: solutionHandler },
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
  solutionCheckbox.checked = showSolution;
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
