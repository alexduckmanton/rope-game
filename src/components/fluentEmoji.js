/**
 * Fluent Emoji
 *
 * Microsoft's Fluent emoji, used for the streak flame and for the large icon
 * in the circle at the top of each bottom sheet. Every one of them comes from
 * here, so the whole set can be resized, swapped or removed in one place.
 *
 * Most of them animate: they are animated WebPs that loop on their own with no
 * JavaScript driving them. A few have no animated version in Microsoft's
 * collection - the set leans heavily towards faces, and the objects and
 * symbols are mostly still - so those are the static 3D renders instead, which
 * are the same artwork in the same style.
 *
 * Players who have asked their system for reduced motion get the Lucide icon
 * the emoji replaced. The choice is made in JavaScript rather than CSS so that
 * those players never download the animation at all - it is by far the largest
 * thing any of these screens would fetch.
 *
 * Sources and licence: see ATTRIBUTION.md.
 */

/**
 * Every emoji the app uses, keyed by the name call sites ask for
 *
 * - `src`: the asset, served straight out of public/
 * - `animated`: whether it moves, and so whether reduced motion should avoid
 *   it. The still ones are safe for everybody and have no fallback to pick.
 * - `fallbackIcon`: Lucide icon shown under reduced motion. Only meaningful
 *   for the animated ones, and each must be registered in icons.js.
 */
const EMOJI = {
  fire: {
    src: '/emoji/fire.webp',
    animated: true,
    fallbackIcon: 'flame'
  },
  'party-popper': {
    src: '/emoji/party-popper.webp',
    animated: true,
    fallbackIcon: 'party-popper'
  },
  'spiral-shell': {
    src: '/emoji/spiral-shell.webp',
    animated: true,
    fallbackIcon: 'shell'
  },
  // No fallbackIcon below: these two do not move, so there is nothing for
  // reduced motion to avoid and everyone sees the same emoji
  warning: {
    src: '/emoji/warning.webp',
    animated: false
  },
  gear: {
    src: '/emoji/gear.webp',
    animated: false
  }
};

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
 * Markup for one emoji
 *
 * Returned as a string so it can be dropped into innerHTML alongside whatever
 * sits beside it. The reduced-motion branch returns a data-lucide placeholder,
 * so callers must run initIcons() once the markup is in the document - the
 * bottom sheet and the home view both already do.
 *
 * Emoji here are decorative. The sheet title or the streak count beside them
 * carries the meaning, so they take an empty alt rather than a description a
 * screen reader would read out first.
 *
 * @param {string} name - Key from EMOJI
 * @param {Object} options
 * @param {number} options.size - Rendered size in CSS pixels
 * @param {number} [options.fallbackSize] - Size for the reduced-motion icon,
 *   which often wants to differ: the emoji are drawn with transparent padding
 *   around the artwork, so they need a slightly larger box to look the same
 * @param {string} [options.className] - Class for the img, for layout
 * @param {string} [options.fallbackColor] - CSS color for the reduced-motion
 *   icon. Emoji bring their own colour; the icons they fall back to do not
 * @returns {string} HTML for either the emoji or the fallback icon
 */
export function createEmojiMarkup(name, { size, fallbackSize, className, fallbackColor } = {}) {
  const emoji = EMOJI[name];
  if (!emoji) {
    console.warn(`Unknown emoji: ${name}`);
    return '';
  }

  if (emoji.animated && prefersReducedMotion()) {
    const iconSize = fallbackSize || size;
    const style = fallbackColor ? ` style="color: ${fallbackColor}"` : '';
    return `<i data-lucide="${emoji.fallbackIcon}" `
      + `width="${iconSize}" height="${iconSize}"${style}></i>`;
  }

  const classAttr = className ? ` class="${className}"` : '';
  return `<img${classAttr} src="${emoji.src}" alt="" `
    + `width="${size}" height="${size}">`;
}

/**
 * The streak flame, at the size both streak lines use
 *
 * The home screen and the win sheet call this rather than createEmojiMarkup()
 * directly, so the flame cannot end up a different size in one of them.
 *
 * It is rendered two pixels larger than the icon it falls back to because the
 * emoji is drawn with more transparent padding around it than most - matching
 * the icon's box would leave the flame itself looking smaller.
 *
 * @returns {string} HTML for the flame
 */
export function createStreakFlameMarkup() {
  return createEmojiMarkup('fire', {
    size: 20,
    fallbackSize: 18,
    className: 'streak-flame'
  });
}
