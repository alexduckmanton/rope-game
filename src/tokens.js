/**
 * Design Tokens - JavaScript Exports
 *
 * JavaScript version of color tokens for use in canvas rendering and game logic.
 * These values mirror tokens.css but are exported as JavaScript constants.
 *
 * Usage:
 * import { colors } from './tokens.js';
 * ctx.fillStyle = colors.primary;
 * ctx.strokeStyle = colors.neutral[300];
 */

/**
 * Base color scales (primitive tokens)
 * Access via: colors.neutral[500], colors.blue[400], etc.
 */
export const colors = {
  // Neutral/Grey scale (10 shades)
  neutral: {
    50: '#F8F8F8',
    100: '#F3F4F6',
    200: '#E8E8E8',
    300: '#E0E0E0',
    400: '#C0C0C0',
    500: '#7F8C8D',
    600: '#6B7280',
    700: '#34495E',
    800: '#1F2937',
    900: '#000000',
  },

  // Blue scale
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    400: '#4A90E2',
    500: '#357ABD',
    600: '#2563EB',
    700: '#1D4ED8',
  },

  // Green scale
  green: {
    50: '#F0FDF4',
    100: '#D1FAE5',
    400: '#ACF39D',
    500: '#10B981',
    600: '#059669',
  },

  // Red scale
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },

  // Amber scale
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
  },

  // Hint magnitude gradient (special case - keep all 9 distinct values)
  hint: {
    1: '#FFB04A',
    2: '#FF8C42',
    3: '#FF6347',
    4: '#FF4169',
    5: '#F03A7C',
    6: '#D4357F',
    7: '#B02D8A',
    8: '#8C1F7D',
    9: '#661565',
  },

  // Pure white (often needed)
  white: '#FFFFFF',
};

/**
 * Semantic tokens (purpose-based)
 * Access via: semantic.primary, semantic.bgBase, etc.
 *
 * These provide clear intent and make it easy to update colors globally.
 * Prefer using these over direct scale access when they match your use case.
 */
export const semantic = {
  // Primary actions
  primary: colors.blue[400],
  primaryHover: colors.blue[500],
  primaryActive: colors.blue[600],

  // Backgrounds
  bgBase: colors.neutral[100],
  bgSurface: colors.neutral[50],
  bgElevated: '#FFFFFF',
  bgSecondary: colors.neutral[100],
  bgHover: colors.neutral[200],
  bgActive: colors.neutral[200],

  // Text
  textPrimary: colors.neutral[700],
  textSecondary: colors.neutral[500],
  textMuted: colors.neutral[600],
  textDisabled: colors.neutral[400],
  textOnPrimary: '#FFFFFF',
  textEmphasis: colors.neutral[800],

  // Borders
  border: colors.neutral[300],
  borderLight: colors.neutral[200],
  borderStrong: colors.neutral[400],

  // Game-specific
  canvasBg: colors.neutral[100],
  gridLine: colors.neutral[300],
  solutionPath: colors.blue[400],
  playerPath: colors.neutral[900],
  playerPathWin: colors.green[400],
  hintValidated: colors.green[400],
  hintExtra: colors.neutral[400],

  // Semantic states
  success: colors.green[400],
  successBg: colors.amber[100],
  successIcon: colors.amber[500],

  error: colors.red[500],
  errorBg: colors.red[100],

  warning: colors.amber[500],
  warningBg: colors.amber[100],

  info: colors.blue[400],
  infoBg: colors.blue[100],

  neutral: colors.neutral[600],
  neutralBg: colors.neutral[100],
};

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
 * Legacy color mapping for backwards compatibility
 * Maps old color names to new semantic tokens
 *
 * @deprecated Use semantic tokens directly instead
 */
export const legacy = {
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
};
