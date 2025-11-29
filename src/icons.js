/**
 * Loopy - Icon Management
 *
 * Centralized icon initialization using Lucide icons library.
 * Only imports the specific icons we use to minimize bundle size.
 *
 * Icons used:
 * - ArrowLeft: Back navigation button
 * - Settings: Settings/gear button
 * - X: Close button for bottom sheets
 * - Dices: New puzzle button
 * - RefreshCcw: Restart puzzle button
 */

import { createIcons, ArrowLeft, Settings, X, Dices, RefreshCcw } from 'lucide';

/**
 * Initialize all Lucide icons on the page
 *
 * Searches for elements with data-lucide attributes and replaces them
 * with the corresponding SVG icons. Should be called after DOM is ready.
 *
 * Icons automatically inherit:
 * - Color from parent element (via currentColor)
 * - Size from width/height attributes on the element
 * - stroke-width defaults to 2 (Lucide default)
 */
export function initIcons() {
  createIcons({
    icons: {
      ArrowLeft,
      Settings,
      X,
      Dices,
      RefreshCcw
    },
    attrs: {
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }
  });
}
