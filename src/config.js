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

  // Colors - Tropical Beachy Theme
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

    // Tropical Theme Colors
    TROPICAL: {
      OCEAN_BLUE: '#0077B6',        // Deep tropical ocean (home background)
      SUNSHINE_YELLOW: '#FFD60A',   // Bright beach sunshine (title)
      CORAL: '#FF6B6B',             // Tropical coral reef
      CORAL_RED: '#E63946',         // Deeper coral
      TURQUOISE: '#48BFE3',         // Shallow lagoon
      TROPICAL_TEAL: '#06A77D',     // Palm leaf green-blue
      PEACHY_CORAL: '#FF7B54',      // Peachy coral
      PALE_SKY: '#ADE8F4',          // Pale sky blue
      DEEP_NAVY: '#023E8A',         // Deep ocean
    },

    // Hints
    HINT_EXTRA: '#C0C0C0',       // Color for non-hint cells in 'all' mode
    HINT_VALIDATED: '#ACF39D',   // Color when hint is satisfied
    HINT_COLORS: [               // Tropical magnitude-based gradient (warm beach → cool ocean)
      '#FFD60A',  // Magnitude 1 - Sunshine yellow (warmest/brightest)
      '#FFBE0B',  // Magnitude 2 - Golden yellow
      '#FF9F1C',  // Magnitude 3 - Orange-yellow
      '#FF7B54',  // Magnitude 4 - Peachy coral
      '#FF6B6B',  // Magnitude 5 - Coral
      '#48BFE3',  // Magnitude 6 - Bright turquoise
      '#0096C7',  // Magnitude 7 - Ocean blue
      '#0077B6',  // Magnitude 8 - Deep ocean blue
      '#023E8A',  // Magnitude 9 - Navy blue (coolest/darkest)
    ],
  },

  // Puzzle generation
  GENERATION: {
    ATTEMPTS_4X4: 20,           // Warnsdorff attempts for 4x4 grid
    ATTEMPTS_6X6: 50,           // Warnsdorff attempts for 6x6 grid
    ATTEMPTS_8X8: 100,          // Warnsdorff attempts for 8x8 grid
  },
};
