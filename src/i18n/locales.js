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
 * Languages Inter's `latin` and `latin-ext` subsets cover need nothing beyond
 * an entry here and a dictionary. Languages in another script need a font
 * stack in style.css first, keyed off the `htmlLang` value below - see the
 * "Locale font stacks" block there, and "Adding a language" in CLAUDE.md.
 * Cyrillic, Greek and Vietnamese have no stack yet.
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
  {
    code: 'ja',
    path: 'ja',
    htmlLang: 'ja',
    ogLocale: 'ja_JP',
    name: '日本語',
    match: ['ja', 'ja-JP'],
  },
  {
    code: 'ko',
    path: 'ko',
    htmlLang: 'ko',
    ogLocale: 'ko_KR',
    name: '한국어',
    match: ['ko', 'ko-KR'],
  },
  // Chinese is split by script, not by region: Simplified and Traditional are
  // not mutually readable the way pt-BR and pt-PT are, so routing one to the
  // other would be a real degradation rather than a mild compromise.
  //
  // Traditional is listed FIRST deliberately. The redirect rules are generated
  // in this order and Netlify applies the first match, so a browser sending
  // zh-TW or zh-HK meets the Traditional rule before it can be caught by the
  // bare `zh` in the Simplified rule below.
  {
    code: 'zh-Hant',
    path: 'zh-hant',
    htmlLang: 'zh-Hant',
    // Taiwan is the largest Traditional-reading market, and its Mandarin
    // vocabulary is what these translations use
    ogLocale: 'zh_TW',
    name: '繁體中文',
    match: ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant'],
  },
  {
    code: 'zh-Hans',
    path: 'zh-hans',
    htmlLang: 'zh-Hans',
    ogLocale: 'zh_CN',
    name: '简体中文',
    // Bare `zh` defaults here. Mainland China is largely unreachable from this
    // deploy anyway (CDN latency, and PostHog's US endpoint is blocked), so in
    // practice this serves Singapore, Malaysia and the diaspora
    match: ['zh', 'zh-CN', 'zh-Hans', 'zh-SG', 'zh-MY'],
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
