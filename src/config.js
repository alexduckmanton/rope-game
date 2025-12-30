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
    PROBABILITY: 0.3,            // Probability of showing a hint (0-1)
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

  // Scoring system
  SCORING: {
    // Percentage bonus for visiting all cells (Hamiltonian cycle)
    // Hints satisfaction: 0 to (100 - HAMILTONIAN_BONUS_PERCENT)%
    // Cell coverage: 0 to HAMILTONIAN_BONUS_PERCENT% (proportional)
    // Total score: hints% + coverage%
    HAMILTONIAN_BONUS_PERCENT: 0,
  },
};
