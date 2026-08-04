/**
 * Streak Flame
 *
 * The flame that sits beside every streak count - on the home screen and in
 * the win sheet. Both places render it through here so the two can never
 * drift apart.
 *
 * Normally this is Microsoft's animated Fluent fire emoji, an animated WebP
 * that loops on its own with no JavaScript driving it. Players who have asked
 * their system for reduced motion get the original Lucide flame instead, which
 * is a still stroke icon tinted with --color-streak.
 *
 * The choice is made in JavaScript rather than CSS so that a player on reduced
 * motion never downloads the 75KB animation at all. It is read once per call,
 * which is enough: a fresh line is built every time the home view initialises
 * or the win sheet opens, so the preference is picked up on the next screen.
 */

/** Path to the animated emoji, served straight out of public/ */
const FLAME_SRC = '/streak-flame.webp';

/**
 * Rendered size of the emoji, in CSS pixels
 *
 * Two pixels larger than the Lucide icon it replaces. The emoji is authored
 * with transparent padding around the flame, so matching the icon's box would
 * leave the artwork itself looking smaller than the one it replaced.
 */
const FLAME_SIZE = 20;

/** Rendered size of the reduced-motion icon, matching the rest of the UI */
const ICON_SIZE = 18;

/**
 * Whether the player has asked their system for reduced motion
 *
 * Guarded for the sake of environments without matchMedia, where the safe
 * answer is the animation everyone else gets.
 *
 * @returns {boolean} True when motion should be avoided
 */
function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Markup for the streak flame
 *
 * Returned as a string so it can be dropped into innerHTML alongside the
 * streak text. When the icon is returned it carries a data-lucide attribute,
 * so the caller must run initIcons() once the markup is in the document -
 * both call sites already do.
 *
 * The flame is decorative: the streak count beside it carries the meaning, so
 * the emoji is given an empty alt rather than a description a screen reader
 * would have to read out before the number.
 *
 * @returns {string} HTML for either the animated emoji or the static icon
 */
export function createStreakFlameMarkup() {
  if (prefersReducedMotion()) {
    return `<i data-lucide="flame" width="${ICON_SIZE}" height="${ICON_SIZE}"></i>`;
  }

  return `<img class="streak-flame" src="${FLAME_SRC}" alt="" `
    + `width="${FLAME_SIZE}" height="${FLAME_SIZE}">`;
}
