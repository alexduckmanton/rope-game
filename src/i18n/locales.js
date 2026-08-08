/**
 * Locale registry
 *
 * The single source of truth for which languages exist, where each one lives,
 * and which browser language codes should be routed to it. Imported by both
 * the runtime (for the language switcher) and the build scripts (for the Vite
 * builds, the Netlify redirects and the sitemap), so a new language is added
 * here once and everything downstream follows.
 *
 * This file must stay free of browser and Vite APIs - `scripts/build-locales.mjs`
 * imports it directly in Node.
 *
 * Only languages that Inter's `latin` and `latin-ext` subsets fully cover
 * belong here. Anything needing Cyrillic, Greek, Vietnamese or a CJK font
 * stack needs font work first (see "Adding a language" in CLAUDE.md).
 */

/**
 * @typedef {Object} Locale
 * @property {string} code       Internal locale key, and the dictionary filename
 * @property {string} path       URL path segment. Empty string means the site root
 * @property {string} htmlLang   Value for <html lang> and hreflang
 * @property {string} ogLocale   Value for the og:locale meta tag
 * @property {string} name       Language name, written in that language
 * @property {string[]} match    Browser language codes routed here from the root
 * @property {boolean} [latinExt] True when the language needs Inter's latin-ext
 *                                subset preloaded as well as latin
 */

/** @type {Locale[]} */
export const LOCALES = [
  {
    code: 'en',
    path: '',
    htmlLang: 'en',
    ogLocale: 'en_GB',
    name: 'English',
    // English is the fallback, so it never appears in a root redirect rule
    match: [],
  },
  {
    code: 'de',
    path: 'de',
    htmlLang: 'de',
    ogLocale: 'de_DE',
    name: 'Deutsch',
    match: ['de', 'de-DE', 'de-AT', 'de-CH', 'de-LI', 'de-LU'],
  },
  {
    code: 'es',
    path: 'es',
    htmlLang: 'es',
    ogLocale: 'es_ES',
    name: 'Español',
    match: ['es', 'es-ES', 'es-419', 'es-MX', 'es-AR', 'es-CO', 'es-CL', 'es-PE', 'es-VE', 'es-US'],
  },
  {
    code: 'fr',
    path: 'fr',
    htmlLang: 'fr',
    ogLocale: 'fr_FR',
    name: 'Français',
    match: ['fr', 'fr-FR', 'fr-BE', 'fr-CA', 'fr-CH', 'fr-LU'],
  },
  {
    code: 'it',
    path: 'it',
    htmlLang: 'it',
    ogLocale: 'it_IT',
    name: 'Italiano',
    match: ['it', 'it-IT', 'it-CH'],
  },
  {
    code: 'nl',
    path: 'nl',
    htmlLang: 'nl',
    ogLocale: 'nl_NL',
    name: 'Nederlands',
    match: ['nl', 'nl-NL', 'nl-BE'],
  },
  {
    code: 'pl',
    path: 'pl',
    htmlLang: 'pl',
    ogLocale: 'pl_PL',
    name: 'Polski',
    match: ['pl', 'pl-PL'],
    // ł ą ę ś ż ź ć ń all live in latin-ext
    latinExt: true,
  },
  {
    code: 'pt-BR',
    // Lowercased in the URL - paths are conventionally lowercase, and the
    // hreflang value below is what search engines actually read
    path: 'pt-br',
    htmlLang: 'pt-BR',
    ogLocale: 'pt_BR',
    name: 'Português',
    // European Portuguese is routed here too. Brazilian Portuguese is a closer
    // fit for a pt-PT speaker than English is, and shipping pt-PT separately
    // would mean a second set of translations for a handful of differences
    match: ['pt', 'pt-BR', 'pt-PT'],
  },
];

/** The locale served at the site root, and the fallback for anything unmatched */
export const DEFAULT_LOCALE = 'en';

/**
 * Look up a locale by its code
 * @param {string} code - Locale code, e.g. 'pt-BR'
 * @returns {Locale|undefined} The locale, or undefined if unknown
 */
export function getLocale(code) {
  return LOCALES.find(locale => locale.code === code);
}

/**
 * Build the URL path prefix for a locale
 *
 * Always ends in a slash so it can be concatenated with a route path, and is
 * exactly '/' for the root locale.
 *
 * @param {string} code - Locale code
 * @returns {string} Path prefix, e.g. '/de/' or '/'
 */
export function localeBasePath(code) {
  const locale = getLocale(code);
  return locale && locale.path ? `/${locale.path}/` : '/';
}
