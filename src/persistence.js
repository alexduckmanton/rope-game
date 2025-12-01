/**
 * Game State Persistence Module
 *
 * Handles saving and loading game progress to/from localStorage.
 * Supports both daily puzzles and unlimited mode with different storage strategies.
 */

/**
 * @typedef {Object} GameState
 * @property {string|null} puzzleId - Daily puzzle ID (format: "YYYY-MM-DD-difficulty") or null for unlimited
 * @property {string} difficulty - Game difficulty: "easy", "medium", or "hard"
 * @property {number} gridSize - Size of the game grid (4, 6, or 8)
 * @property {boolean} isUnlimitedMode - Whether this is an unlimited (random) game
 * @property {Set<string>} playerDrawnCells - Set of cell keys that player has drawn (format: "row,col")
 * @property {Map<string, Set<string>>} playerConnections - Map of cell connections (key: "row,col", value: Set of connected cell keys)
 * @property {number} elapsedSeconds - Time elapsed in seconds
 * @property {boolean} hasWon - Whether the player has completed the puzzle
 * @property {Array<{row: number, col: number}>} solutionPath - The solution path (saved only for unlimited mode)
 * @property {Set<string>} hintCells - Set of hint cell keys (saved only for unlimited mode)
 * @property {boolean} [hasShownPartialWinFeedback] - Whether partial win message has been shown
 */

/**
 * @typedef {Object} SerializedGameState
 * @property {number} version - Storage format version
 * @property {string|null} puzzleId - Daily puzzle ID or null for unlimited
 * @property {string} difficulty - Game difficulty
 * @property {number} gridSize - Size of the game grid
 * @property {boolean} isUnlimitedMode - Whether this is unlimited mode
 * @property {Array<string>} playerDrawnCells - Array of drawn cell keys
 * @property {Object<string, Array<string>>} playerConnections - Object mapping cell keys to arrays of connected cells
 * @property {number} elapsedSeconds - Elapsed time in seconds
 * @property {boolean} hasWon - Win status
 * @property {number} savedAt - Timestamp when state was saved
 * @property {Array<{row: number, col: number}>} [solutionPath] - Solution path (unlimited only)
 * @property {Array<string>} [hintCells] - Hint cells array (unlimited only)
 * @property {boolean} [hasShownPartialWinFeedback] - Partial win feedback flag
 */

/**
 * @typedef {Object} Settings
 * @property {string} hintMode - Hint display mode: "none", "partial", or "all"
 * @property {string} borderMode - Border display mode: "off", "center", or "full"
 * @property {boolean} showSolution - Whether to show the solution path
 * @property {string} lastUnlimitedDifficulty - Last selected unlimited difficulty
 */

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'loop-game';
const SAVE_COOLDOWN_MS = 5000;
const SETTINGS_ANIMATION_DURATION_MS = 300;

/* ============================================================================
 * STORAGE KEY MANAGEMENT
 * ========================================================================= */

/**
 * Generate storage key for a game session
 * @param {string|null} puzzleId - Puzzle ID for daily mode, null for unlimited
 * @param {string} difficulty - Game difficulty
 * @param {boolean} isUnlimitedMode - Whether this is unlimited mode
 * @returns {string} localStorage key
 */
function getStorageKey(puzzleId, difficulty, isUnlimitedMode) {
  if (isUnlimitedMode) {
    // Include difficulty so each unlimited difficulty has separate save slot
    // Format: "loop-game:unlimited:easy"
    return `${STORAGE_PREFIX}:unlimited:${difficulty}`;
  }

  // For daily puzzles, use puzzleId which includes date and difficulty
  // Format: "loop-game:daily:2025-11-30-easy"
  return `${STORAGE_PREFIX}:daily:${puzzleId}`;
}

/**
 * Parse a storage key to extract metadata
 * @param {string} key - localStorage key
 * @returns {Object|null} Parsed metadata or null if invalid
 */
function parseStorageKey(key) {
  if (!key.startsWith(STORAGE_PREFIX)) return null;

  const parts = key.split(':');

  if (parts[1] === 'unlimited' && parts.length === 3) {
    // Format: loop-game:unlimited:easy
    return {
      type: 'unlimited',
      difficulty: parts[2]
    };
  }

  if (parts[1] === 'daily' && parts.length === 3) {
    // Format: loop-game:daily:2025-11-30-easy
    // The puzzleId is the third part
    const puzzleId = parts[2];
    return {
      type: 'daily',
      puzzleId
    };
  }

  return null;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* ============================================================================
 * DATA SERIALIZATION
 * ========================================================================= */

/**
 * Convert game state to JSON-serializable format
 * @param {GameState} state - Current game state
 * @returns {SerializedGameState} Serialized state
 */
function serializeGameState(state) {
  const {
    puzzleId,
    difficulty,
    gridSize,
    isUnlimitedMode,
    playerDrawnCells,
    playerConnections,
    elapsedSeconds,
    hasWon,
    hasShownPartialWinFeedback,
    solutionPath,
    hintCells
  } = state;

  // Convert Set to Array
  const serializedCells = Array.from(playerDrawnCells);

  // Convert Map<string, Set<string>> to Object<string, Array<string>>
  const serializedConnections = Object.fromEntries(
    Array.from(playerConnections.entries()).map(([key, value]) => [
      key,
      Array.from(value)
    ])
  );

  const baseState = {
    version: STORAGE_VERSION,
    puzzleId,
    difficulty,
    gridSize,
    isUnlimitedMode,
    playerDrawnCells: serializedCells,
    playerConnections: serializedConnections,
    elapsedSeconds,
    hasWon,
    hasShownPartialWinFeedback: hasShownPartialWinFeedback || false,
    savedAt: Date.now()
  };

  // For unlimited mode, we MUST save the puzzle data since it's not deterministic
  if (isUnlimitedMode) {
    baseState.solutionPath = solutionPath;
    baseState.hintCells = Array.from(hintCells); // Convert Set to Array
  }

  return baseState;
}

/**
 * Convert saved JSON data back to game state format
 * @param {SerializedGameState} saved - Saved state from localStorage
 * @returns {GameState} Deserialized state
 */
function deserializeGameState(saved) {
  const {
    puzzleId,
    difficulty,
    gridSize,
    isUnlimitedMode,
    playerDrawnCells,
    playerConnections,
    elapsedSeconds,
    hasWon,
    hasShownPartialWinFeedback,
    solutionPath,
    hintCells
  } = saved;

  // Convert Array to Set
  const deserializedCells = new Set(playerDrawnCells);

  // Convert Object<string, Array<string>> to Map<string, Set<string>>
  const deserializedConnections = new Map(
    Object.entries(playerConnections).map(([key, value]) => [
      key,
      new Set(value)
    ])
  );

  const baseState = {
    puzzleId,
    difficulty,
    gridSize,
    isUnlimitedMode,
    playerDrawnCells: deserializedCells,
    playerConnections: deserializedConnections,
    elapsedSeconds,
    hasWon,
    hasShownPartialWinFeedback: hasShownPartialWinFeedback || false
  };

  // For unlimited mode, restore the puzzle data
  if (isUnlimitedMode && solutionPath && hintCells) {
    baseState.solutionPath = solutionPath;
    baseState.hintCells = new Set(hintCells); // Convert Array to Set
  }

  return baseState;
}

/* ============================================================================
 * VALIDATION
 * ========================================================================= */

/**
 * Validate that saved state has required fields and correct types
 * @param {any} saved - Data loaded from localStorage
 * @returns {boolean} Whether the saved state is valid
 */
function isValidSavedState(saved) {
  if (!saved || typeof saved !== 'object') return false;

  // Check version compatibility
  if (saved.version !== STORAGE_VERSION) return false;

  // Check required fields
  const requiredFields = [
    'difficulty',
    'gridSize',
    'isUnlimitedMode',
    'playerDrawnCells',
    'playerConnections',
    'elapsedSeconds',
    'hasWon',
    'savedAt'
  ];

  for (const field of requiredFields) {
    if (!(field in saved)) return false;
  }

  // Validate types
  if (typeof saved.gridSize !== 'number') return false;
  if (typeof saved.isUnlimitedMode !== 'boolean') return false;
  if (!Array.isArray(saved.playerDrawnCells)) return false;
  if (typeof saved.playerConnections !== 'object') return false;
  if (typeof saved.elapsedSeconds !== 'number') return false;
  if (typeof saved.hasWon !== 'boolean') return false;

  // For unlimited mode, validate puzzle data exists
  if (saved.isUnlimitedMode) {
    if (!Array.isArray(saved.solutionPath)) return false;
    if (!Array.isArray(saved.hintCells)) return false;
  }

  return true;
}

/* ============================================================================
 * CORE PERSISTENCE OPERATIONS
 * ========================================================================= */

/**
 * Save current game state to localStorage
 * @param {GameState} state - Current game state
 * @returns {boolean} Whether save was successful
 */
export function saveGameState(state) {
  try {
    const key = getStorageKey(state.puzzleId, state.difficulty, state.isUnlimitedMode);
    const serialized = serializeGameState(state);
    const json = JSON.stringify(serialized);

    localStorage.setItem(key, json);
    return true;
  } catch (error) {
    // localStorage might be full, disabled, or in private browsing mode
    console.warn('Failed to save game state:', error);
    return false;
  }
}

/**
 * Load saved game state from localStorage
 * @param {string|null} puzzleId - Puzzle ID for daily mode, null for unlimited
 * @param {string} difficulty - Game difficulty
 * @param {boolean} isUnlimitedMode - Whether this is unlimited mode
 * @returns {GameState|null} Deserialized game state or null if no save exists
 */
export function loadGameState(puzzleId, difficulty, isUnlimitedMode) {
  try {
    const key = getStorageKey(puzzleId, difficulty, isUnlimitedMode);
    const json = localStorage.getItem(key);

    if (!json) {
      return null;
    }

    const saved = JSON.parse(json);

    // Validate saved state
    if (!isValidSavedState(saved)) {
      console.warn('[Persistence] Invalid saved state, ignoring');
      return null;
    }

    // For daily puzzles, ensure the puzzleId matches
    // (in case there's a clock change or corrupted data)
    if (!isUnlimitedMode && saved.puzzleId !== puzzleId) {
      console.warn('[Persistence] Puzzle ID mismatch, ignoring saved state');
      return null;
    }

    return deserializeGameState(saved);
  } catch (error) {
    console.warn('[Persistence] Failed to load game state:', error);
    return null;
  }
}

/**
 * Clear saved game state from localStorage
 * @param {string|null} puzzleId - Puzzle ID for daily mode, null for unlimited
 * @param {string} difficulty - Game difficulty
 * @param {boolean} isUnlimitedMode - Whether this is unlimited mode
 */
export function clearGameState(puzzleId, difficulty, isUnlimitedMode) {
  try {
    const key = getStorageKey(puzzleId, difficulty, isUnlimitedMode);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('[Persistence] Failed to clear game state:', error);
  }
}

/* ============================================================================
 * CLEANUP & MAINTENANCE
 * ========================================================================= */

/**
 * Remove saved games from previous days
 * Should be called on app initialization
 */
export function cleanupOldSaves() {
  try {
    const today = getTodayDateString();
    const keysToRemove = [];

    // Iterate through all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

      const parsed = parseStorageKey(key);

      // Only clean up daily puzzle saves (not unlimited)
      if (parsed?.type === 'daily' && parsed.puzzleId) {
        // Extract date from puzzleId (format: YYYY-MM-DD-difficulty)
        // Split by '-' and take first 3 parts (year, month, day)
        const parts = parsed.puzzleId.split('-');
        if (parts.length >= 3) {
          const datePart = parts.slice(0, 3).join('-');

          if (datePart !== today) {
            keysToRemove.push(key);
          }
        }
      }
    }

    // Remove old saves
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn('Failed to cleanup old saves:', error);
  }
}

/**
 * Create a throttled save function with trailing save
 *
 * Behavior:
 * - First save: Happens immediately
 * - Cooldown: 5 seconds after each save where no saves occur
 * - During cooldown: If moves are made, flag is set and state is stored
 * - After cooldown: If flag is set, saves immediately and starts new cooldown
 *
 * This ensures:
 * - Players don't lose more than 5 seconds of progress
 * - Rapid moves during cooldown are batched into one save
 * - Final state is always saved after player stops drawing
 *
 * @param {number} cooldownMs - Cooldown period in milliseconds
 * @returns {{save: (state: GameState) => void, destroy: () => void}} Object with save function and destroy method
 */
export function createThrottledSave(cooldownMs = SAVE_COOLDOWN_MS) {
  let lastSaveTime = 0;
  let hasPendingChanges = false;
  let pendingState = null;
  let cooldownTimer = null;

  /**
   * Save game state with throttling
   * @param {GameState} state - Current game state
   */
  function save(state) {
    const now = Date.now();
    const timeSinceLastSave = now - lastSaveTime;

    if (timeSinceLastSave >= cooldownMs) {
      // Cooldown period has passed - save immediately
      saveGameState(state);
      lastSaveTime = now;
      hasPendingChanges = false;
      pendingState = null;

      // Clear any pending timer
      if (cooldownTimer) {
        clearTimeout(cooldownTimer);
        cooldownTimer = null;
      }
    } else {
      // Still in cooldown - mark for later save
      hasPendingChanges = true;
      pendingState = state;

      // Schedule save for when cooldown expires (if not already scheduled)
      if (!cooldownTimer) {
        const remainingTime = cooldownMs - timeSinceLastSave;
        cooldownTimer = setTimeout(() => {
          if (hasPendingChanges && pendingState) {
            saveGameState(pendingState);
            lastSaveTime = Date.now();
            hasPendingChanges = false;
            pendingState = null;
          }
          cooldownTimer = null;
        }, remainingTime);
      }
      // If timer already scheduled, pendingState is just updated
      // Multiple calls during cooldown all update the same state variable
    }
  }

  /**
   * Clean up any pending timers (prevents memory leaks)
   */
  function destroy() {
    if (cooldownTimer) {
      clearTimeout(cooldownTimer);
      cooldownTimer = null;
    }
    hasPendingChanges = false;
    pendingState = null;
  }

  return { save, destroy };
}

/* ============================================================================
 * SETTINGS PERSISTENCE
 * ========================================================================= */

const DEFAULT_SETTINGS = {
  hintMode: 'partial',
  borderMode: 'off',
  showSolution: false,
  lastUnlimitedDifficulty: 'easy'
};

/**
 * Save user settings to localStorage
 * @param {Settings} settings - Settings object
 * @returns {boolean} Whether save was successful
 */
export function saveSettings(settings) {
  try {
    const key = `${STORAGE_PREFIX}:settings`;
    localStorage.setItem(key, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.warn('Failed to save settings:', error);
    return false;
  }
}

/**
 * Load user settings from localStorage
 * @returns {Settings} Settings object (merged with defaults)
 */
export function loadSettings() {
  try {
    const key = `${STORAGE_PREFIX}:settings`;
    const json = localStorage.getItem(key);

    if (!json) {
      return { ...DEFAULT_SETTINGS };
    }

    const settings = JSON.parse(json);
    // Merge with defaults in case new settings are added in future
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error) {
    console.warn('Failed to load settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}
