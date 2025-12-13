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
    HINT_COLORS: [               // Magnitude-based color palette (uses primary button blue)
      '#4A90E2',  // Magnitude 1 - Primary button blue
      '#4A90E2',  // Magnitude 2 - Primary button blue
      '#4A90E2',  // Magnitude 3 - Primary button blue
      '#4A90E2',  // Magnitude 4 - Primary button blue
      '#4A90E2',  // Magnitude 5 - Primary button blue
      '#4A90E2',  // Magnitude 6 - Primary button blue
      '#4A90E2',  // Magnitude 7 - Primary button blue
      '#4A90E2',  // Magnitude 8 - Primary button blue
      '#4A90E2',  // Magnitude 9 - Primary button blue
    ],
  },

  // Puzzle generation
  GENERATION: {
    ATTEMPTS_4X4: 20,           // Warnsdorff attempts for 4x4 grid
    ATTEMPTS_6X6: 50,           // Warnsdorff attempts for 6x6 grid
    ATTEMPTS_8X8: 100,          // Warnsdorff attempts for 8x8 grid
  },
};
