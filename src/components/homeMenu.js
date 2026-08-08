/**
 * Home Screen Menu
 *
 * A hamburger button in the top-left of the home screen toggles a sheet that
 * slides in from the left. It holds the destinations that do not earn a place
 * in the main button stack: the tutorial, Unlimited mode, and the support and
 * feedback links that used to sit in the footer.
 *
 * All open/closed styling hangs off a single `menu-open` class on the home
 * view, so the toggle icon, the scrim and the sheet stay in step without the
 * JavaScript having to touch each of them.
 */

import { navigate } from '../router.js';
import { showTutorialSheet } from './tutorialSheet.js';
import { t } from '../i18n/index.js';
import { initLanguageMenu } from './languageMenu.js';

const OPEN_CLASS = 'menu-open';

/**
 * Initialize the home screen menu
 *
 * @returns {Function|null} Cleanup function, or null if the markup is missing
 */
export function initHomeMenu() {
  const view = document.getElementById('home-view');
  const toggle = document.getElementById('home-menu-toggle');
  const scrim = document.getElementById('home-menu-scrim');
  const sheet = document.getElementById('home-menu-sheet');
  const tutorialItem = document.getElementById('home-menu-tutorial');
  const unlimitedItem = document.getElementById('home-menu-unlimited');

  if (!view || !toggle || !scrim || !sheet) return null;

  // Built before the item list is read, so the language row's own control is
  // included in the tabindex handling below
  const cleanupLanguage = initLanguageMenu();

  const items = sheet.querySelectorAll('.home-menu-item, .home-menu-language-row select');

  const isOpen = () => view.classList.contains(OPEN_CLASS);

  /**
   * Apply the open or closed state
   *
   * Items are pulled out of the tab order while the sheet is off-screen, so
   * keyboard users never land on a link they cannot see.
   *
   * @param {boolean} open - Whether the sheet should be open
   */
  const setOpen = (open) => {
    view.classList.toggle(OPEN_CLASS, open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? t('menu.close') : t('menu.open'));
    sheet.setAttribute('aria-hidden', String(!open));
    items.forEach(item => item.setAttribute('tabindex', open ? '0' : '-1'));
  };

  const close = () => setOpen(false);
  const handleToggle = () => setOpen(!isOpen());

  const handleKeyDown = (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    event.preventDefault();
    close();
  };

  // Close before acting so the sheet slides out behind whatever comes next
  const handleTutorial = () => {
    close();
    showTutorialSheet('home');
  };

  const handleUnlimited = () => {
    close();
    navigate('/play?difficulty=unlimited', false, { fromHome: true });
  };

  // External links keep their default behaviour and just close the sheet
  const handleItemClick = (event) => {
    if (event.currentTarget.tagName === 'A') close();
  };

  toggle.addEventListener('click', handleToggle);
  scrim.addEventListener('click', close);
  window.addEventListener('keydown', handleKeyDown);
  if (tutorialItem) tutorialItem.addEventListener('click', handleTutorial);
  if (unlimitedItem) unlimitedItem.addEventListener('click', handleUnlimited);
  items.forEach(item => item.addEventListener('click', handleItemClick));

  return () => {
    toggle.removeEventListener('click', handleToggle);
    scrim.removeEventListener('click', close);
    window.removeEventListener('keydown', handleKeyDown);
    if (tutorialItem) tutorialItem.removeEventListener('click', handleTutorial);
    if (unlimitedItem) unlimitedItem.removeEventListener('click', handleUnlimited);
    items.forEach(item => item.removeEventListener('click', handleItemClick));
    if (cleanupLanguage) cleanupLanguage();

    // Leave the view closed so navigating back to home never restores an
    // open sheet mid-animation
    setOpen(false);
  };
}
