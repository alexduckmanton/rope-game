/**
 * Design Tokens - JavaScript Exports
 *
 * JavaScript version of color tokens for use in canvas rendering and game logic.
 * Reads color values from CSS custom properties (tokens.css) to maintain single source of truth.
 *
 * Usage:
 * import { colors, semantic } from './tokens.js';
 * ctx.fillStyle = semantic.primary;
 * ctx.strokeStyle = colors.neutral[300];
 */

/**
 * Read a CSS custom property value from the document root
 * @param {string} propertyName - CSS custom property name (e.g., '--color-neutral-50')
 * @returns {string} - Computed color value (e.g., '#F8F8F8')
 */
function getCSSColor(propertyName) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(propertyName)
    .trim();
}

/**
 * Load base color scales from CSS custom properties
 * @returns {Object} - Color scales object matching previous structure
 */
function loadColorsFromCSS() {
  return {
    // Neutral/Grey scale (10 shades)
    neutral: {
      50: getCSSColor('--color-neutral-50'),
      100: getCSSColor('--color-neutral-100'),
      200: getCSSColor('--color-neutral-200'),
      300: getCSSColor('--color-neutral-300'),
      400: getCSSColor('--color-neutral-400'),
      500: getCSSColor('--color-neutral-500'),
      600: getCSSColor('--color-neutral-600'),
      700: getCSSColor('--color-neutral-700'),
      800: getCSSColor('--color-neutral-800'),
      900: getCSSColor('--color-neutral-900'),
    },

    // Blue scale
    blue: {
      50: getCSSColor('--color-blue-50'),
      100: getCSSColor('--color-blue-100'),
      400: getCSSColor('--color-blue-400'),
      500: getCSSColor('--color-blue-500'),
      600: getCSSColor('--color-blue-600'),
      700: getCSSColor('--color-blue-700'),
    },

    // Green scale
    green: {
      50: getCSSColor('--color-green-50'),
      100: getCSSColor('--color-green-100'),
      400: getCSSColor('--color-green-400'),
      500: getCSSColor('--color-green-500'),
      600: getCSSColor('--color-green-600'),
    },

    // Red scale
    red: {
      50: getCSSColor('--color-red-50'),
      100: getCSSColor('--color-red-100'),
      500: getCSSColor('--color-red-500'),
      600: getCSSColor('--color-red-600'),
      700: getCSSColor('--color-red-700'),
    },

    // Amber scale
    amber: {
      50: getCSSColor('--color-amber-50'),
      100: getCSSColor('--color-amber-100'),
      500: getCSSColor('--color-amber-500'),
      600: getCSSColor('--color-amber-600'),
    },

    // Hint magnitude gradient (special case - keep all 9 distinct values)
    hint: {
      1: getCSSColor('--color-hint-1'),
      2: getCSSColor('--color-hint-2'),
      3: getCSSColor('--color-hint-3'),
      4: getCSSColor('--color-hint-4'),
      5: getCSSColor('--color-hint-5'),
      6: getCSSColor('--color-hint-6'),
      7: getCSSColor('--color-hint-7'),
      8: getCSSColor('--color-hint-8'),
      9: getCSSColor('--color-hint-9'),
    },

    // Pure white (read from elevated bg which is white in light mode)
    white: getCSSColor('--color-bg-elevated'),
  };
}

/**
 * Load semantic tokens from CSS custom properties
 * @returns {Object} - Semantic tokens object matching previous structure
 */
function loadSemanticFromCSS() {
  return {
    // Primary actions
    primary: getCSSColor('--color-primary'),
    primaryHover: getCSSColor('--color-primary-hover'),
    primaryActive: getCSSColor('--color-primary-active'),

    // Backgrounds
    bgBase: getCSSColor('--color-bg-base'),
    bgSurface: getCSSColor('--color-bg-surface'),
    bgElevated: getCSSColor('--color-bg-elevated'),
    bgSecondary: getCSSColor('--color-bg-secondary'),
    bgHover: getCSSColor('--color-bg-hover'),
    bgActive: getCSSColor('--color-bg-active'),

    // Text
    textPrimary: getCSSColor('--color-text-primary'),
    textSecondary: getCSSColor('--color-text-secondary'),
    textMuted: getCSSColor('--color-text-muted'),
    textDisabled: getCSSColor('--color-text-disabled'),
    textOnPrimary: getCSSColor('--color-text-on-primary'),
    textEmphasis: getCSSColor('--color-text-emphasis'),

    // Borders
    border: getCSSColor('--color-border'),
    borderLight: getCSSColor('--color-border-light'),
    borderStrong: getCSSColor('--color-border-strong'),

    // Game-specific
    canvasBg: getCSSColor('--color-canvas-bg'),
    gridLine: getCSSColor('--color-grid-line'),
    solutionPath: getCSSColor('--color-solution-path'),
    playerPath: getCSSColor('--color-player-path'),
    playerPathWin: getCSSColor('--color-player-path-win'),
    hintValidated: getCSSColor('--color-hint-validated'),
    hintExtra: getCSSColor('--color-hint-extra'),

    // Semantic states
    success: getCSSColor('--color-success'),
    successBg: getCSSColor('--color-success-bg'),
    successIcon: getCSSColor('--color-success-icon'),

    error: getCSSColor('--color-error'),
    errorBg: getCSSColor('--color-error-bg'),

    warning: getCSSColor('--color-warning'),
    warningBg: getCSSColor('--color-warning-bg'),

    info: getCSSColor('--color-info'),
    infoBg: getCSSColor('--color-info-bg'),

    neutral: getCSSColor('--color-neutral'),
    neutralBg: getCSSColor('--color-neutral-bg'),
  };
}

/**
 * Base color scales (primitive tokens)
 * Access via: colors.neutral[500], colors.blue[400], etc.
 *
 * Note: These are loaded from CSS and updated on theme changes
 */
export let colors = loadColorsFromCSS();

/**
 * Semantic tokens (purpose-based)
 * Access via: semantic.primary, semantic.bgBase, etc.
 *
 * These provide clear intent and make it easy to update colors globally.
 * Prefer using these over direct scale access when they match your use case.
 *
 * Note: These are loaded from CSS and updated on theme changes
 */
export let semantic = loadSemanticFromCSS();

/**
 * Opacity-based colors for overlays and shadows
 * Access via: opacity.overlayHover, opacity.shadowMd, etc.
 */
export const opacity = {
  overlayHover: 'rgba(52, 73, 94, 0.08)',
  overlayActive: 'rgba(52, 73, 94, 0.12)',
  overlaySubtle: 'rgba(0, 0, 0, 0.04)',

  shadowSm: 'rgba(0, 0, 0, 0.1)',
  shadowMd: 'rgba(0, 0, 0, 0.15)',
  shadowLg: 'rgba(0, 0, 0, 0.2)',

  backdrop: 'rgba(0, 0, 0, 0.5)',
};

/**
 * Reload color tokens from CSS
 * Call this when theme changes to update all JavaScript color values
 */
function reloadColors() {
  colors = loadColorsFromCSS();
  semantic = loadSemanticFromCSS();
}

/**
 * Set up theme change detection and automatic color reloading
 * Listens for prefers-color-scheme changes and dispatches custom event
 */
if (typeof window !== 'undefined') {
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  darkModeQuery.addEventListener('change', (e) => {
    // Reload colors from CSS (CSS media query has already updated values)
    reloadColors();

    // Dispatch custom event so canvas/game can re-render
    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { isDark: e.matches }
    }));
  });
}

/**
 * Legacy color mapping for backwards compatibility
 * Maps old color names to new semantic tokens
 *
 * @deprecated Use semantic tokens directly instead
 * @returns {Object} Legacy color mappings (dynamically generated from current colors)
 */
export function getLegacyColors() {
  return {
    BACKGROUND: semantic.canvasBg,
    GRID_LINE: semantic.gridLine,
    SOLUTION_PATH: semantic.solutionPath,
    PLAYER_PATH: semantic.playerPath,
    PLAYER_PATH_WIN: semantic.playerPathWin,
    UI_TEXT: semantic.textPrimary,
    HINT_EXTRA: semantic.hintExtra,
    HINT_VALIDATED: semantic.hintValidated,
    HINT_COLORS: [
      colors.hint[1],
      colors.hint[2],
      colors.hint[3],
      colors.hint[4],
      colors.hint[5],
      colors.hint[6],
      colors.hint[7],
      colors.hint[8],
      colors.hint[9],
    ],
  };
}

// Export legacy as a getter that always returns current values
export const legacy = getLegacyColors();

/**
 * Helper function to get hint color by magnitude (1-9)
 * @param {number} magnitude - Hint magnitude value (1-9)
 * @returns {string} Hex color code
 */
export function getHintColor(magnitude) {
  return colors.hint[magnitude] || colors.hint[5]; // Default to mid-range if invalid
}

/**
 * Default export for convenient importing
 */
export default {
  colors,
  semantic,
  opacity,
  legacy,
  getHintColor,
  reloadColors,
};
