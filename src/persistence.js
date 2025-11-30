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
    return `${STORAGE_PREFIX}:unlimited`;
  }

  // For daily puzzles, use puzzleId which includes date and difficulty
  // Format: "loop-game:daily:2025-11-30:easy"
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

  if (parts[1] === 'unlimited') {
    return { type: 'unlimited' };
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
    const json = localStorage.getItem(key);

    if (!json) return null;

    const saved = JSON.parse(json);

    // Validate saved state
    if (!isValidSavedState(saved)) {
      console.warn('Invalid saved state, ignoring');
      return null;
    }

    // For daily puzzles, ensure the puzzleId matches
    // (in case there's a clock change or corrupted data)
    if (!isUnlimitedMode && saved.puzzleId !== puzzleId) {
      console.warn('Puzzle ID mismatch, ignoring saved state');
      return null;
    }

    return deserializeGameState(saved);
  } catch (error) {
    console.warn('Failed to load game state:', error);
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
    console.warn('Failed to clear game state:', error);
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
 * Create a debounced save function
 * Ensures we don't spam localStorage on every move
 * @param {number} delayMs - Debounce delay in milliseconds
 * @returns {Function} Debounced save function
 */
export function createDebouncedSave(delayMs = 5000) {
  let timeoutId = null;

  return function debouncedSave(state) {
    // Cancel any pending save
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Schedule new save
    timeoutId = setTimeout(() => {
      saveGameState(state);
      timeoutId = null;
    }, delayMs);
  };
}
