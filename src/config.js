/**
 * Game configuration constants
 * Centralizes magic numbers for easier tuning and maintenance
 */

import tokens from './tokens.js';

/**
 * Get current color configuration
 * Returns a fresh colors object that reads from current token values
 * This ensures colors update when tokens are reloaded (e.g., on theme change)
 */
function getColors() {
  return {
    // Grid and background
    BACKGROUND: tokens.semantic.canvasBg,
    GRID_LINE: tokens.semantic.gridLine,

    // Paths
    SOLUTION_PATH: tokens.semantic.solutionPath,
    PLAYER_PATH: tokens.semantic.playerPath,
    PLAYER_PATH_WIN: tokens.semantic.playerPathWin,

    // UI elements
    UI_TEXT: tokens.semantic.textPrimary,

    // Hints
    HINT_EXTRA: tokens.semantic.hintExtra,         // Color for non-hint cells in 'all' mode
    HINT_VALIDATED: tokens.semantic.hintValidated, // Color when hint is satisfied
    HINT_COLORS: [                          // Magnitude-based color palette (bright yellow-orange → dark magenta)
      tokens.colors.hint[1],  // Magnitude 1 - Bright orange-yellow (lightest)
      tokens.colors.hint[2],  // Magnitude 2 - Bright orange
      tokens.colors.hint[3],  // Magnitude 3 - Tomato red
      tokens.colors.hint[4],  // Magnitude 4 - Red-pink
      tokens.colors.hint[5],  // Magnitude 5 - Hot pink
      tokens.colors.hint[6],  // Magnitude 6 - Pink-magenta
      tokens.colors.hint[7],  // Magnitude 7 - Magenta
      tokens.colors.hint[8],  // Magnitude 8 - Dark magenta
      tokens.colors.hint[9],  // Magnitude 9 - Very dark magenta (darkest)
    ],
  };
}

export const CONFIG = {
  // Site metadata
  SITE: {
    URL: 'https://loopy.wtf',  // Canonical site URL (used in share text)
  },

  // Daily puzzle configuration
  DAILY: {
    // Epoch date for puzzle numbering (YYYY-MM-DD, local time).
    // The puzzle on this date is #1; every day after increments by one.
    // Change this to the game's real launch date if it differs.
    PUZZLE_NUMBER_EPOCH: '2025-12-13',
  },

  // Cell sizing
  CELL_SIZE_MIN: 50,           // Minimum cell size in pixels
  CELL_SIZE_MAX: 100,          // Maximum cell size in pixels

  // Layout spacing
  LAYOUT: {
    TOP_BAR_HEIGHT: 100,       // Space reserved for top bar (80px + 20px padding)
    HORIZONTAL_PADDING: 40,    // Total horizontal padding (20px each side)
  },

  // Rendering
  RENDERING: {
    CORNER_RADIUS_FACTOR: 0.35,  // Multiplier for cellSize to get corner radius
    PATH_LINE_WIDTH: 4,          // Width of player path lines
    SOLUTION_LINE_WIDTH: 16,     // Width of solution path line (thicker for visibility)
    GRID_LINE_WIDTH: 1,          // Width of grid lines
    DOT_RADIUS: 6,               // Radius for isolated cell dots
  },

  // Hint system
  HINT: {
    FONT_SIZE_FACTOR: 0.75,      // Multiplier for cellSize to get font size
    PULSE_DURATION: 2000,        // Full pulse cycle duration in milliseconds (1s fade in + 1s fade out)
    PULSE_MAX_OPACITY: 0.2,      // Maximum opacity during pulse (20%)
  },

  // Border styling
  BORDER: {
    WIDTH: 3,                    // Border thickness in pixels
    INSET: 2,                    // Base inset from cell edges
    LAYER_OFFSET: 6,             // Additional inset per layer for concentric borders
  },

  // Colors - imported from design tokens
  // See src/tokens.js for full color system
  // Getter ensures colors always reflect current token values (even after reload/theme change)
  get COLORS() {
    return getColors();
  },

  // Puzzle generation
  GENERATION: {
    ATTEMPTS_4X4: 20,           // Warnsdorff attempts for 4x4 grid
    ATTEMPTS_6X6: 50,           // Warnsdorff attempts for 6x6 grid
    ATTEMPTS_8X8: 100,          // Warnsdorff attempts for 8x8 grid
  },

  // Interaction behavior
  INTERACTION: {
    // Backtracking distance threshold (prevents accidental long-path erasure)
    //
    // When user drags backwards over their existing path, backtracking only occurs
    // if they're within this many cells from the end. Beyond this distance, the
    // touch is ignored to prevent accidentally destroying long paths.
    //
    // Example with path A→B→C→D→E→F (threshold = 4):
    //   - Drag to C (3 cells back): Erases D→E→F ✓ (within threshold)
    //   - Drag to B (4 cells back): Erases C→D→E→F ✓ (within threshold)
    //   - Drag to A (5 cells back): Ignored ✗ (beyond threshold)
    //
    // This allows users to easily correct recent mistakes while protecting against
    // accidental destruction when their hand crosses over earlier parts of the path.
    BACKTRACK_THRESHOLD: 1,
  },

  // Difficulty settings
  DIFFICULTY: {
    // Player-facing labels for each difficulty.
    //
    // These are deliberately decoupled from the internal difficulty keys,
    // which stay 'easy' / 'medium' / 'hard' throughout - in URLs, storage
    // keys, daily seeds and analytics - so renaming what players see never
    // migrates data or changes which puzzle a given day produces.
    //
    // Read them through getDifficultyLabel() rather than reaching in here, so
    // every surface stays in step.
    LABELS: {
      easy: 'Easy',
      medium: 'Tricky',
      hard: 'Diabolical',
    },

    // Hint generation configuration per difficulty level - CONTROL arm
    //
    // This is the placement that has always shipped: shuffle every cell, take
    // the first N that are at least minDistance apart. It is retained as the
    // control arm of the hint-generation experiment (see EXPERIMENT below) and
    // should not be tuned while that experiment is running - changing it would
    // move the baseline mid-test.
    //
    // count: fixed number of hints to place
    // minDistance: minimum Chebyshev distance between hints (0 = no constraint)
    //
    // Known quirks, left deliberately intact so the control keeps behaving as
    // it did for the players already measured against it:
    //   - easy places 1.73 hints on average, not 2: minDistance 3 is
    //     unsatisfiable from any interior cell of a 4x4, so roughly a quarter
    //     of days ship a single-hint Easy.
    //   - minDistance 1 would be a no-op (Chebyshev >= 1 is any distinct cell).
    HINT_CONFIG: {
      easy: {
        count: 2,         // 2 hints on 4x4 grid
        minDistance: 3,   // Hints must be at least 3 cells apart
      },
      medium: {
        count: 5,         // 5 hints on 6x6 grid
        minDistance: 2,   // Hints must be at least 2 cells apart
      },
      hard: {
        count: 16,        // 16 hints on 8x8 grid
        minDistance: 0,   // No distance constraint
      },
    },

    // Hint generation configuration per difficulty level - DENSE arm
    //
    // Used by generateHintCellsCovering() in generation/hintPlacement.js, which
    // guarantees every cell sits inside at least one hint area and then spends
    // the remaining budget on overlap and on low-value "anchor" hints.
    //
    // count:           total hints to place
    // lowValueAnchors: hints reading <= anchorMaxValue to guarantee, budget and
    //                  solution permitting
    // anchorMaxValue:  turn count at or below which a hint counts as an anchor
    //
    // Measured over 365 daily seeds, against the control above:
    //
    //   |            | hints       | coverage      | redundancy  | anchors     |
    //   |------------|-------------|---------------|-------------|-------------|
    //   | Easy       | 1.73 -> 4   | 62.6% -> 100% | 1.00 -> 1.87| n/a         |
    //   | Tricky     | 5    -> 8   | 77.2% -> 100% | 1.24 -> 1.69| 0.31 -> 1.82|
    //   | Diabolical | 16   -> 16  | 88.9% -> 100% | 2.13 -> 1.97| 2.29 -> 2.45|
    //
    // Easy asks for no anchors because it cannot have any: a 4x4 Hamiltonian
    // cycle packs ~11 turns into 16 cells, so every 3x3 window on it holds at
    // least two turns. Tricky uses a threshold of 2 rather than 1 for a milder
    // version of the same constraint - only 2.0 positions per 6x6 puzzle read
    // 0 or 1, so a quota of two at threshold 1 would be demanding both of them.
    HINT_CONFIG_DENSE: {
      easy: {
        count: 4,              // 4 hints fully cover a 4x4
        lowValueAnchors: 0,    // Impossible on this grid - see above
      },
      medium: {
        count: 8,              // 8 hints fully cover a 6x6 on every seed tested
        lowValueAnchors: 2,
        anchorMaxValue: 2,
      },
      hard: {
        count: 16,             // Unchanged, so Diabolical's density looks the same
        lowValueAnchors: 2,
        anchorMaxValue: 1,
      },
    },
  },

  // Hint generation experiment
  //
  // A/B test of the two HINT_CONFIG blocks above. Motivated by the observation
  // that Tricky completes at 37% while Diabolical - a bigger grid - completes
  // at 53% and solves faster, which traced back to Diabolical's hint areas
  // overlapping enough to make deduction possible where Tricky's do not.
  //
  // Assignment is per person via PostHog and is pinned into each saved game, so
  // a puzzle already in progress can never be regenerated under a player.
  //
  // See "Hint generation experiment" in CLAUDE.md for the teardown checklist.
  EXPERIMENT: {
    HINT_GENERATION: {
      CONTROL: 'control',
      VARIANT: 'dense',
      // Assignment is a coin flip cached in localStorage, NOT a PostHog feature
      // flag - the slim posthog build we ship has no flag support at all. See
      // the module comment in experiment.js. The matching PostHog experiment
      // (id 405364) exists only as a record of dates and configuration; it
      // cannot compute results, so the analysis runs on the generator_variant
      // event property instead.
      STORAGE_KEY: 'loop-game:experiment:hint-generation',
    },
  },

  // Scoring system
  SCORING: {
    // Percentage bonus for visiting all cells (Hamiltonian cycle)
    // Hints satisfaction: 0 to (100 - HAMILTONIAN_BONUS_PERCENT)%
    // Cell coverage: 0 to HAMILTONIAN_BONUS_PERCENT% (proportional)
    // Total score: hints% + coverage%
    HAMILTONIAN_BONUS_PERCENT: 0,
  },

  // Win sheet streak reveal - the completion time swapping out for the streak
  WIN_STREAK: {
    // How long the completion time stays on screen before the streak slides in.
    // Measured from the moment the sheet starts sliding up.
    REVEAL_DELAY_MS: 1500,
    // Length of the slide itself. Kept short so the swap reads as snappy
    // rather than as an animation the player has to wait out.
    TRANSITION_MS: 300,
  },

};

/**
 * Get the player-facing label for a difficulty
 *
 * Falls back to a capitalised form of the key itself, which covers
 * 'unlimited' and anything added later without a label.
 *
 * @param {string} difficulty - Internal difficulty key
 * @returns {string} Label for display, e.g. "Diabolical"
 */
export function getDifficultyLabel(difficulty) {
  if (!difficulty) return '';

  return (
    CONFIG.DIFFICULTY.LABELS[difficulty] ||
    difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
  );
}

/**
 * Get the player-facing label in lowercase, for use mid-sentence
 * (e.g. "5 day diabolical streak")
 *
 * @param {string} difficulty - Internal difficulty key
 * @returns {string} Lowercase label
 */
export function getDifficultyLabelLower(difficulty) {
  return getDifficultyLabel(difficulty).toLowerCase();
}
