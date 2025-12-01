/**
 * Game State Persistence Module
 *
 * Handles saving and loading game progress to/from localStorage.
 * Supports both daily puzzles and unlimited mode with different storage strategies.
 */

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'loop-game';

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
 * @param {Object} state - Current game state
 * @returns {Object} Serialized state
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
 * @param {Object} saved - Saved state from localStorage
 * @returns {Object} Deserialized state
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
    hasWon
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
 * @param {Object} state - Current game state
 * @returns {boolean} Whether save was successful
 */
export function saveGameState(state) {
  try {
    const key = getStorageKey(state.puzzleId, state.difficulty, state.isUnlimitedMode);
    const serialized = serializeGameState(state);
    const json = JSON.stringify(serialized);

    localStorage.setItem(key, json);
    console.log('[Persistence] Saved game state to:', key);
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
 * @returns {Object|null} Deserialized game state or null if no save exists
 */
export function loadGameState(puzzleId, difficulty, isUnlimitedMode) {
  try {
    const key = getStorageKey(puzzleId, difficulty, isUnlimitedMode);
    console.log('[Persistence] Attempting to load from:', key);
    const json = localStorage.getItem(key);

    if (!json) {
      console.log('[Persistence] No saved state found');
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
      console.warn('[Persistence] Puzzle ID mismatch, ignoring saved state. Expected:', puzzleId, 'Got:', saved.puzzleId);
      return null;
    }

    console.log('[Persistence] Successfully loaded saved state');
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
    console.log('[Persistence] Clearing saved state from:', key);
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

    if (keysToRemove.length > 0) {
      console.log(`Cleaned up ${keysToRemove.length} old saved game(s)`);
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
 * @returns {Function} Throttled save function
 */
export function createDebouncedSave(cooldownMs = 5000) {
  let lastSaveTime = 0;
  let hasPendingChanges = false;
  let pendingState = null;
  let cooldownTimer = null;

  return function throttledSave(state) {
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
  };
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
 * @param {Object} settings - Settings object
 * @returns {boolean} Whether save was successful
 */
export function saveSettings(settings) {
  try {
    const key = `${STORAGE_PREFIX}:settings`;
    localStorage.setItem(key, JSON.stringify(settings));
    console.log('[Persistence] Saved settings');
    return true;
  } catch (error) {
    console.warn('Failed to save settings:', error);
    return false;
  }
}

/**
 * Load user settings from localStorage
 * @returns {Object} Settings object (merged with defaults)
 */
export function loadSettings() {
  try {
    const key = `${STORAGE_PREFIX}:settings`;
    const json = localStorage.getItem(key);

    if (!json) {
      console.log('[Persistence] No saved settings, using defaults');
      return { ...DEFAULT_SETTINGS };
    }

    const settings = JSON.parse(json);
    // Merge with defaults in case new settings are added in future
    console.log('[Persistence] Loaded settings');
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error) {
    console.warn('Failed to load settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}
