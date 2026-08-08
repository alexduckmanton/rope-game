/**
 * Translation runtime
 *
 * The active language is decided at **build time**, not in the browser: Vite
 * aliases `@i18n-messages` to one dictionary and defines `__LOCALE__`, so each
 * locale build ships exactly one language and there is no detection, no fetch
 * and no swap once the page is up. That is what keeps the first paint free of
 * any flash of the wrong language - the HTML arrives already translated.
 *
 * Locale selection happens one level up, at the URL: `/` serves English and
 * `/de/` serves German, with Netlify redirecting only the bare root based on
 * Accept-Language. See "Localisation" in CLAUDE.md.
 */

import messages from '@i18n-messages';
import { getLocale, localeBasePath, DEFAULT_LOCALE } from './locales.js';

/**
 * Active locale code, substituted by Vite's `define` at build time
 * @type {string}
 */
export const LOCALE = typeof __LOCALE__ === 'string' ? __LOCALE__ : DEFAULT_LOCALE;

/** Active locale descriptor from the registry */
export const ACTIVE_LOCALE = getLocale(LOCALE) || getLocale(DEFAULT_LOCALE);

/**
 * URL path prefix this build is served from, e.g. '/de/' or '/'
 *
 * Read from Vite's BASE_URL so it always matches how the bundle was built.
 * The itch build uses a relative base ('./'), which is not a routable prefix,
 * so it falls back to the root.
 */
export const BASE_PATH = (() => {
  const base = import.meta.env.BASE_URL || '/';
  return base.startsWith('/') ? base : '/';
})();

/**
 * Plural category selector for the active locale
 *
 * Built once. Intl.PluralRules knows the category set per language - two for
 * English and German, four for Polish - so dictionaries only have to supply
 * the forms, never the rules for choosing between them.
 */
const pluralRules = new Intl.PluralRules(ACTIVE_LOCALE.htmlLang);

/**
 * Substitute `{name}` placeholders
 *
 * Unknown placeholders are left untouched rather than blanked, so a mistake in
 * a dictionary shows up as visible `{name}` text instead of a silent gap.
 *
 * @param {string} template - Message with placeholders
 * @param {Object} [vars] - Values to substitute
 * @returns {string} Filled message
 */
function interpolate(template, vars) {
  if (!vars) return template;

  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/**
 * Translate a message key
 *
 * A missing key returns the key itself. That is deliberately ugly - it makes
 * the gap obvious in the UI - but it never throws, so a dictionary mistake can
 * never take the game down.
 *
 * For plural messages pass a `n` variable; the matching category is selected
 * from the message object, falling back to `other`.
 *
 * @param {string} key - Message key, e.g. 'win.title'
 * @param {Object} [vars] - Placeholder values. `n` also drives plural selection
 * @returns {string} Translated message
 */
export function t(key, vars) {
  const message = messages[key];

  if (message === undefined) {
    // Surfaced in the console rather than thrown - see above
    console.warn(`[i18n] Missing message for "${key}" in locale "${LOCALE}"`);
    return key;
  }

  if (typeof message === 'string') {
    return interpolate(message, vars);
  }

  const category = vars && typeof vars.n === 'number' ? pluralRules.select(vars.n) : 'other';
  return interpolate(message[category] ?? message.other, vars);
}

/**
 * Format a date in the active locale
 *
 * Used for the share text, which previously hardcoded en-US.
 *
 * @param {Date} date - Date to format
 * @param {Intl.DateTimeFormatOptions} options - Formatting options
 * @returns {string} Localised date
 */
export function formatDate(date, options) {
  return new Intl.DateTimeFormat(ACTIVE_LOCALE.htmlLang, options).format(date);
}

/**
 * Build an absolute in-site URL for a locale
 *
 * Used by the language switcher, which has to leave this build's bundle behind
 * and load another one - so it navigates with a full page load rather than
 * through the router.
 *
 * @param {string} code - Target locale code
 * @param {string} [path=''] - Route path without a leading slash, e.g. 'play'
 * @returns {string} Path such as '/de/play'
 */
export function localeUrl(code, path = '') {
  return `${localeBasePath(code)}${path}`;
}

export { LOCALES } from './locales.js';
