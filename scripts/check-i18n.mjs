/**
 * Dictionary parity check
 *
 * Compares every locale against src/i18n/messages/en.js - the reference - and fails on:
 *
 *   - a key present in English and missing from a locale (it would render as
 *     the raw key at runtime)
 *   - a key present in a locale and not in English (dead weight, usually a typo)
 *   - a plural message missing a category its language actually uses, or a
 *     string where the reference has a plural object and vice versa
 *   - a placeholder in a translation that the English message does not have
 *
 * Runs as part of `npm run build`, so a half-translated dictionary cannot ship.
 *
 * Usage: npm run check:i18n
 */

import { LOCALES, DEFAULT_LOCALE } from '../src/i18n/locales.js';

/** Placeholders like {n} or {difficulty} used in a message */
function placeholders(value) {
  const found = new Set();
  const collect = text => {
    for (const match of text.matchAll(/\{(\w+)\}/g)) found.add(match[1]);
  };

  if (typeof value === 'string') collect(value);
  else for (const form of Object.values(value)) collect(form);

  return found;
}

/** Plural categories a language actually uses for whole numbers */
function requiredCategories(htmlLang) {
  const rules = new Intl.PluralRules(htmlLang);
  const categories = new Set();

  // 0-200 covers every category boundary in the languages we ship; Polish
  // needs values in the 20s to reach 'few' again, Welsh-style rules would
  // need more, and 'other' is required everywhere as the fallback.
  for (let n = 0; n <= 200; n++) categories.add(rules.select(n));
  categories.add('other');

  return categories;
}

const { default: reference } = await import(`../src/i18n/messages/${DEFAULT_LOCALE}.js`);
const referenceKeys = Object.keys(reference);

const problems = [];

for (const locale of LOCALES) {
  if (locale.code === DEFAULT_LOCALE) continue;

  const { default: messages } = await import(`../src/i18n/messages/${locale.code}.js`);
  const report = message => problems.push(`${locale.code}: ${message}`);

  for (const key of referenceKeys) {
    const expected = reference[key];
    const actual = messages[key];

    if (actual === undefined) {
      report(`missing key "${key}"`);
      continue;
    }

    const expectedIsPlural = typeof expected === 'object';
    const actualIsPlural = typeof actual === 'object';

    // English only needs two categories, so a language with more may add them;
    // what is never right is a language dropping the plural object entirely
    if (expectedIsPlural && !actualIsPlural) {
      report(`"${key}" must be a plural object, like the reference`);
      continue;
    }

    if (!expectedIsPlural && actualIsPlural) {
      report(`"${key}" is a plural object but the reference is a plain string`);
      continue;
    }

    if (actualIsPlural) {
      for (const category of requiredCategories(locale.htmlLang)) {
        if (typeof actual[category] !== 'string') {
          report(`"${key}" is missing the "${category}" plural form`);
        }
      }
    }

    const expectedVars = placeholders(expected);
    for (const name of placeholders(actual)) {
      if (!expectedVars.has(name)) {
        report(`"${key}" uses unknown placeholder {${name}}`);
      }
    }
  }

  for (const key of Object.keys(messages)) {
    if (!(key in reference)) {
      report(`unknown key "${key}" (not in ${DEFAULT_LOCALE}.js)`);
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} dictionary problem(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `✓ ${LOCALES.length} dictionaries agree on ${referenceKeys.length} keys ` +
    `(${LOCALES.map(l => l.code).join(', ')})`
);
