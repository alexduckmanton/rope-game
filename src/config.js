/**
 * Game configuration constants
 * Centralizes magic numbers for easier tuning and maintenance
 */

import tokens from './tokens.js';
import { t, ACTIVE_LOCALE } from './i18n/index.js';

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
    // How far back along the current drag a pointer may land and still count as
    // backtracking rather than as drawing onward.
    //
    // At 1 - the shipped value - only the cell you just came from erases. Land on
    // anything earlier in the same drag and the path is NOT erased and the touch is
    // NOT ignored: it falls through to normal extension and draws on through the
    // crossing, exactly as it would over a path from an earlier drag.
    //
    // Example with drag path A→B→C→D→E→F:
    //   - Drag to E (1 cell back):  erases F              ✓ within threshold
    //   - Drag to C (3 cells back): draws on through C    → self-intersection
    //   - Drag to A (the drag's first cell): always tries to close the loop, and
    //     backtracks if that fails. Distance is not consulted - see handlePointerMove
    //     in gameCore.js, which special-cases index 0 so deliberate loop closing
    //     always works.
    //
    // Raising this makes long-distance backtracking possible again but reinstates
    // the original problem: on a long crossing loop, briefly clipping an earlier
    // cell wipes everything after it. 1 is deliberate - erasure is never accidental,
    // and larger corrections go through the Undo button instead.
    BACKTRACK_THRESHOLD: 1,
  },

  // Difficulty settings
  DIFFICULTY: {
    // Difficulty keys that have a player-facing label in the dictionaries.
    //
    // The labels themselves live in src/i18n/messages/<locale>.js under
    // `difficulty.<key>`, because they are translated. The keys here stay
    // 'easy' / 'medium' / 'hard' throughout - in URLs, storage keys, daily
    // seeds and analytics - so neither renaming nor translating what players
    // see ever migrates data or changes which puzzle a given day produces.
    //
    // Read labels through getDifficultyLabel() rather than calling t()
    // directly, so every surface stays in step.
    KEYS: ['easy', 'medium', 'hard', 'unlimited'],

    // Hint generation per difficulty
    //
    // generateHintCellsWithMinDistance() in renderer.js shuffles every cell and
    // takes the first `count` that are at least `minDistance` (Chebyshev) apart.
    // It knows nothing about the solution, so what each hint reads is chance.
    //
    // count:       hints to place
    // minDistance: minimum Chebyshev gap between hints (0 = no constraint)
    //
    // Two quirks, both deliberate:
    //   - Easy places 1.73 hints on average, not 2. minDistance 3 is
    //     unsatisfiable from any interior cell of a 4x4, so roughly a quarter of
    //     days ship a single-hint Easy. Players complete that far more often
    //     than a fully covered 4x4 (54.8% vs 38.4% of players in the hint
    //     placement experiment, p = 0.01) - on this grid, sparse is the feature.
    //   - minDistance 1 would be a no-op (Chebyshev >= 1 is any distinct cell).
    //
    // A coverage-first alternative was A/B tested on every difficulty from
    // 2026-08-06 to 2026-09-26 and removed: counted per player, it made Easy
    // worse and Tricky and Diabolical no better. Before tuning anything here,
    // read "Hint placement experiments" in docs/experiments.md - especially
    // the part about counting players rather than starts.
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

  if (CONFIG.DIFFICULTY.KEYS.includes(difficulty)) {
    return t(`difficulty.${difficulty}`);
  }

  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

/**
 * Get the player-facing label in lowercase, for use mid-sentence
 * (e.g. "5 day diabolical streak")
 *
 * @param {string} difficulty - Internal difficulty key
 * @returns {string} Lowercase label
 */
export function getDifficultyLabelLower(difficulty) {
  // Locale-aware, because lowercasing is not universal - Turkish dotted and
  // dotless I being the classic case. Costs nothing for the languages we ship
  // today and removes a trap from the ones we might add.
  return getDifficultyLabel(difficulty).toLocaleLowerCase(ACTIVE_LOCALE.htmlLang);
}
