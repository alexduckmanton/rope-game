/**
 * Loopy - Icon Management
 *
 * Centralized icon initialization using Lucide icons library.
 * Only imports the specific icons we use to minimize bundle size.
 *
 * Icons used:
 * - ArrowLeft: Back navigation button
 * - Settings: Settings/gear button
 * - X: Close state of the home screen hamburger menu
 * - Menu: Open state of the home screen hamburger menu
 * - Dices: New puzzle button
 * - RefreshCcw: Restart puzzle button
 * - Undo2: Undo button in game view
 * - PartyPopper: Win/celebration bottom sheets
 * - CircleOff: Error/incorrect feedback bottom sheets (legacy)
 * - Shell: Partial win bottom sheets
 * - Share2: Share button in win bottom sheet
 * - Check: Tutorial completed icon on home screen
 * - Trophy: Daily puzzle completed icon on home screen
 * - Skull: Viewed solution completed icon on home screen
 * - Eye: View solution button icon in settings
 * - GraduationCap: Tutorial lesson intro bottom sheets
 * - CircleHelp: Help button in tutorial navigation to re-open lesson sheet
 * - CircleCheckBig: End/Finish button in game view (legacy)
 * - HeartCrack: End/Finish button in game view (legacy)
 * - OctagonAlert: End game confirmation modal icon
 * - ChevronDown: Settings select dropdown indicator
 * - Languages: Language switcher row in the home screen menu
 * - RotateCcw: Replay button on the tutorial clips
 * - Flame: Daily streak indicator, for players on reduced motion. Everyone
 *   else gets the animated emoji instead - see components/streakFlame.js
 */

import { createIcons, ArrowLeft, Settings, X, Menu, Dices, RefreshCcw, Undo2, PartyPopper, CircleOff, Shell, Share2, Check, Trophy, Skull, Eye, GraduationCap, CircleHelp, CircleCheckBig, HeartCrack, OctagonAlert, ChevronDown, Flame, Languages, RotateCcw } from 'lucide';

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
      Menu,
      Dices,
      RefreshCcw,
      Undo2,
      PartyPopper,
      CircleOff,
      Shell,
      Share2,
      Check,
      Trophy,
      Skull,
      Eye,
      GraduationCap,
      CircleHelp,
      CircleCheckBig,
      HeartCrack,
      OctagonAlert,
      ChevronDown,
      Flame,
      RotateCcw,
      Languages
    },
    attrs: {
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }
  });
}
