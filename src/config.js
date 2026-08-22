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

    // Hint placement per difficulty
    //
    // Each difficulty names the placement that generates its hints:
    //
    //   'spaced'   - generateHintCellsWithMinDistance() in renderer.js. Shuffles
    //                every cell and takes the first `count` that are at least
    //                `minDistance` (Chebyshev) apart. Knows nothing about the
    //                solution, so what each hint ends up reading is chance.
    //   'covering' - generateHintCellsCovering() in generation/hintPlacement.js.
    //                Greedy maximum-coverage selection, then overlap, then swaps
    //                for low-value "anchor" hints.
    //
    // Round 1 of the hint placement experiment (2026-08-06 to 08-22, 579 starts)
    // settled two of the three difficulties. Completion rate, spaced -> covering:
    //
    //   Easy        66.2% -> 43.3%   (p < 0.0001)  spaced wins, kept
    //   Tricky      34.4% -> 38.8%   (p = 0.57)    no effect, still testing
    //   Diabolical  25.0% -> 66.7%   (p < 0.0001)  covering wins, shipped
    //
    // The driver is hint COUNT, not placement. Diabolical was the only arm that
    // held its count fixed (16) and changed placement alone - and it was the only
    // clear win. Easy quadrupled its hints (1.73 -> 4) and tripled its constraint
    // load (7.1 -> 21.9 expected turns), which buried the placement benefit.
    //
    // count:           hints to place
    // minDistance:     'spaced' only - minimum Chebyshev gap (0 = no constraint)
    // lowValueAnchors: 'covering' only - anchors to guarantee, budget permitting
    // anchorMaxValue:  turn count at or below which a hint counts as an anchor.
    //                  Also the threshold describePuzzle() measures at, so both
    //                  Tricky arms must declare the SAME value or their
    //                  anchor_hints analytics are not comparable to each other.
    HINT_PLACEMENT: {
      // Kept exactly as it always was. Note it places 1.73 hints on average, not
      // 2: minDistance 3 is unsatisfiable from any interior cell of a 4x4, so
      // roughly a quarter of days ship a single-hint Easy. Round 1 measured
      // players completing this far more often than a fully covered 4x4, so the
      // quirk stays - on this grid, sparse is the feature.
      easy: {
        strategy: 'spaced',
        count: 2,
        minDistance: 3,
      },
      // Control arm of the Tricky re-test. Do not tune while it runs.
      medium: {
        strategy: 'spaced',
        count: 5,
        minDistance: 2,
        anchorMaxValue: 2,   // measurement only - see note above
      },
      // Shipped from round 1: the same 16 hints as before, placed to cover.
      hard: {
        strategy: 'covering',
        count: 16,
        lowValueAnchors: 2,
        anchorMaxValue: 1,
      },
    },

    // Challenger arm for the Tricky re-test (round 2)
    //
    // Round 1's Tricky arm changed placement AND raised the count 5 -> 8, which
    // doubled time-to-win (112s -> 235s) for no completion gain. This holds the
    // count at 5 so placement is the only thing differing from the control above
    // - the same isolation that made Diabolical's result readable.
    //
    // Measured over 365 daily seeds, against medium's control:
    //
    //   |                | spaced (control) | covering (this) |
    //   |----------------|------------------|-----------------|
    //   | hints          | 5                | 5               |
    //   | coverage       | 77.2%            | 97.8%           |
    //   | redundancy     | 1.24             | 1.16            |
    //   | anchors        | 1.18             | 0.79            |
    //   | expected turns | 20.6             | 23.9            |
    //
    // **Coverage is the only thing this buys, and that is the point.** Redundancy
    // dips slightly, as it did on Diabolical (2.13 -> 1.97): spreading hints to
    // cover the grid necessarily overlaps them less. Anchors dip too. So this is a
    // clean test of one property - does constraining every cell help? - rather
    // than the three-way change round 1 shipped.
    //
    // Note the anchor figures are BOTH measured at threshold 2. Round 1 compared
    // control anchors at threshold 1 (0.31) against the dense arm at threshold 2
    // (1.82) and reported it as a 6x gain; measured consistently, spaced placement
    // actually yields MORE low-value hints than covering does. That is why medium
    // control carries an explicit anchorMaxValue above.
    //
    // A quota above 2 changes nothing - the 6x6 cannot supply more low-value
    // positions without giving up a covering one, so the anchor stage saturates
    // at 0.79 whether it is asked for 2, 3 or 4.
    TRICKY_COVERING: {
      strategy: 'covering',
      count: 5,
      lowValueAnchors: 2,
      anchorMaxValue: 2,
    },
  },

  // Tricky hint placement experiment (round 2)
  //
  // Round 1 tested covering placement on all three difficulties at once and
  // confounded it with hint count. Easy and Diabolical are now settled and fixed
  // for everyone; this arm applies to Tricky alone, so a player's assignment
  // changes nothing outside the 6x6 grid.
  //
  // Variant values are deliberately distinct from round 1's 'control'/'dense' so
  // the two rounds can never be conflated in analysis. The property names
  // (generator_variant, variant_source) stay the same - only the values change.
  //
  // See "Tricky hint placement experiment" in CLAUDE.md for the teardown checklist.
  EXPERIMENT: {
    TRICKY_HINTS: {
      CONTROL: 'tricky-control',
      VARIANT: 'tricky-covering',
      // Assignment is a coin flip cached in localStorage, NOT a PostHog feature
      // flag - the slim posthog build we ship has no flag support at all. See the
      // module comment in experiment.js. A fresh storage key re-randomises
      // everyone rather than inheriting round 1's assignment, which would carry
      // round-1 exposure through into round-2 behaviour.
      STORAGE_KEY: 'loop-game:experiment:tricky-hints',
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
