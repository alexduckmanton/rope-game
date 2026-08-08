/**
 * Language switcher
 *
 * A row in the home screen hamburger menu showing the current language and
 * opening a native picker for the rest. It lives here rather than in the
 * in-game settings sheet on purpose: a language control buried two taps into
 * a game screen is one nobody finds, and the menu is one tap from the landing
 * screen and visible before a puzzle starts.
 *
 * Most players never need it - the root URL routes them by Accept-Language on
 * arrival - but an explicit choice has to be able to beat that guess, and to
 * stick.
 *
 * Switching language means loading a different build, so this is a full page
 * navigation rather than a router call.
 */

import { LOCALES, LOCALE, localeUrl } from '../i18n/index.js';
import { t } from '../i18n/index.js';
import { initIcons } from '../icons.js';
import { trackLanguageSelected } from '../analytics.js';

/**
 * Cookie Netlify reads to override its Accept-Language matching on the root
 *
 * Documented as part of Netlify's language-based redirects: when present, it
 * wins over the browser header. That is what makes an explicit choice
 * permanent - without it, a German browser would be bounced back to /de/ every
 * time the player typed the bare domain.
 */
const LANG_COOKIE = 'nf_lang';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Remember the player's language choice for the root redirect
 *
 * Scoped to the whole site (`path=/`) so it applies to the bare root, which is
 * the only URL that ever language-detects.
 *
 * @param {string} htmlLang - Language tag, e.g. 'de' or 'pt-BR'
 */
function rememberLanguage(htmlLang) {
  document.cookie =
    `${LANG_COOKIE}=${encodeURIComponent(htmlLang)};` +
    `path=/;max-age=${COOKIE_MAX_AGE_SECONDS};SameSite=Lax`;
}

/**
 * Rendered size of the row's icon, in CSS pixels
 *
 * The standalone-icon size from the design system, which sits right beside the
 * menu's 18px text.
 */
const ICON_SIZE = 20;

/**
 * Build the language row and wire up switching
 *
 * Styled as an ordinary menu item - same size, weight and colour as the
 * destinations above it - with the Lucide `languages` icon, a chevron marking
 * it as a picker, and a transparent native <select> covering the row so the OS
 * renders the list. There is no "Language" label: the icon plus the language's
 * own name says what the row is without spending a line on it.
 *
 * Deliberately not a flag per language. Flags are the only per-language mark
 * available and they are wrong for most of this set: a Spanish flag excludes
 * the ~90% of Spanish speakers outside Spain, a German one excludes Austria
 * and Switzerland, and choosing between Taiwan and Hong Kong for Traditional
 * Chinese is a political statement a puzzle game has no business making.
 *
 * @returns {Function|null} Cleanup function, or null if the row is missing
 */
export function initLanguageMenu() {
  const container = document.getElementById('home-menu-language');
  if (!container) return null;

  // A single-language deployment has nothing to switch to
  if (LOCALES.length < 2) {
    container.remove();
    return null;
  }

  const row = document.createElement('div');
  // home-menu-item carries the shared menu styling; the modifier only adds the
  // flex layout and the positioning context the <select> overlay needs
  row.className = 'home-menu-item home-menu-language-row';

  // Placeholder; initIcons() below swaps it for an SVG, carrying the class
  // across so the styling in style.css still applies
  const icon = document.createElement('i');
  icon.className = 'home-menu-language-icon';
  icon.setAttribute('data-lucide', 'languages');
  icon.setAttribute('width', String(ICON_SIZE));
  icon.setAttribute('height', String(ICON_SIZE));

  const value = document.createElement('span');
  value.className = 'home-menu-language-name';

  const chevron = document.createElement('i');
  chevron.className = 'home-menu-language-chevron';
  chevron.setAttribute('data-lucide', 'chevron-down');
  chevron.setAttribute('width', '16');
  chevron.setAttribute('height', '16');

  const select = document.createElement('select');
  // The visible label is gone, so the select carries the accessible name
  select.setAttribute('aria-label', t('menu.language'));

  for (const locale of LOCALES) {
    const option = document.createElement('option');
    option.value = locale.code;
    // Each language is named in itself, never translated. Someone looking for
    // their own language scans for the word they recognise, and "German" is
    // no help to a reader who does not already read English.
    //
    // No emoji on the options: a globe repeated twelve times in the OS picker
    // is noise, and it is the row rather than the list that needs marking.
    option.textContent = locale.name;
    option.lang = locale.htmlLang;
    if (locale.code === LOCALE) {
      option.selected = true;
      value.textContent = locale.name;
      value.lang = locale.htmlLang;
    }
    select.appendChild(option);
  }

  row.appendChild(icon);
  row.appendChild(value);
  row.appendChild(chevron);
  row.appendChild(select);
  container.appendChild(row);

  // Lucide replaces both <i> placeholders in place
  initIcons();

  const handleChange = () => {
    const code = select.value;
    if (code === LOCALE) return;

    const target = LOCALES.find(locale => locale.code === code);
    if (!target) return;

    rememberLanguage(target.htmlLang);
    trackLanguageSelected(target.code);

    // The switcher only exists on the home screen, so the destination is
    // always that locale's root. A full load, not a router navigation: the
    // strings are compiled into the bundle, so another language is another
    // bundle.
    window.location.assign(localeUrl(target.code));
  };

  select.addEventListener('change', handleChange);

  return () => {
    select.removeEventListener('change', handleChange);
    container.replaceChildren();
  };
}
