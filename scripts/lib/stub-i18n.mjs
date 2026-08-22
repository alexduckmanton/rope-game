/**
 * Stands in for `src/i18n/index.js` outside a browser.
 *
 * The real module's dictionary is bound by the `@i18n-messages` Vite alias, which
 * plain Node cannot resolve. Generation never renders a string; `config.js` only
 * needs `t()` to be callable for the difficulty labels.
 */
export const LOCALE = 'en';
export const ACTIVE_LOCALE = { code: 'en', path: '', htmlLang: 'en' };
export const BASE_PATH = '/';
export function t(key) {
  return key;
}
export function formatDate() {
  return '';
}
export function localeUrl() {
  return '/';
}
