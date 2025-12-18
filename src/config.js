/**
 * Game configuration constants
 * Centralizes magic numbers for easier tuning and maintenance
 */

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
    PATH_LINE_WIDTH: 4,          // Width of path lines
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

  // Colors
  COLORS: {
    // Grid and background
    BACKGROUND: '#F5F5F5',
    GRID_LINE: '#E0E0E0',

    // Paths
    SOLUTION_PATH: '#4A90E2',
    PLAYER_PATH: '#000000',
    PLAYER_PATH_WIN: '#ACF39D',

    // UI elements
    UI_TEXT: '#34495E',

    // Hints
    HINT_EXTRA: '#C0C0C0',       // Color for non-hint cells in 'all' mode
    HINT_VALIDATED: '#ACF39D',   // Color when hint is satisfied
    HINT_COLORS: [               // Magnitude-based color palette (bright yellow-orange → dark magenta)
      '#FFB04A',  // Magnitude 1 - Bright orange-yellow (lightest)
      '#FF8C42',  // Magnitude 2 - Bright orange
      '#FF6347',  // Magnitude 3 - Tomato red
      '#FF4169',  // Magnitude 4 - Red-pink
      '#F03A7C',  // Magnitude 5 - Hot pink
      '#D4357F',  // Magnitude 6 - Pink-magenta
      '#B02D8A',  // Magnitude 7 - Magenta
      '#8C1F7D',  // Magnitude 8 - Dark magenta
      '#661565',  // Magnitude 9 - Very dark magenta (darkest)
    ],
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
};
