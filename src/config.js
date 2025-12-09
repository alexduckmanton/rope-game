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
    HINT_COLORS: [               // Magnitude-based color palette (light to dark for magnitudes 1-9)
      '#E09F7D',  // Magnitude 1 - Peachy orange (lightest)
      '#ED8C6E',  // Magnitude 2 - Coral peach
      '#EF5D60',  // Magnitude 3 - Coral red
      '#EE4F64',  // Magnitude 4 - Red pink
      '#EC4067',  // Magnitude 5 - Pink magenta
      '#D14376',  // Magnitude 6 - Deep pink
      '#B54585',  // Magnitude 7 - Light purple
      '#C72072',  // Magnitude 8 - Pink purple
      '#A01A7D',  // Magnitude 9 - Purple (darkest)
    ],
  },

  // Puzzle generation
  GENERATION: {
    ATTEMPTS_4X4: 20,           // Warnsdorff attempts for 4x4 grid
    ATTEMPTS_6X6: 50,           // Warnsdorff attempts for 6x6 grid
    ATTEMPTS_8X8: 100,          // Warnsdorff attempts for 8x8 grid
  },
};
