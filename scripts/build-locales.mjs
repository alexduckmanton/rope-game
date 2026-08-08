/**
 * Multi-locale production build
 *
 * Runs one Vite build per language and assembles them into a single deploy
 * directory, then writes the routing and discovery files that tie them
 * together.
 *
 *   dist/                 English - the site root, and the x-default
 *   dist/de/              German
 *   dist/pt-br/           Brazilian Portuguese
 *   ...
 *   dist/_redirects       Root language dispatch + per-locale SPA fallbacks
 *   dist/sitemap.xml      Every route in every language, hreflang-annotated
 *
 * Shared binary assets (icons, og image, tutorial videos) are copied once by
 * the root build's publicDir and referenced absolutely from every locale, so
 * they are deployed once rather than once per language.
 *
 * Usage: npm run build
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { LOCALES, DEFAULT_LOCALE, localeBasePath } from '../src/i18n/locales.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = 'https://loopy.wtf';

/** Routes that exist in every language, relative to a locale's base path */
const ROUTES = [
  { path: '', changefreq: 'daily', priority: '1.0' },
  { path: 'play?difficulty=easy', changefreq: 'daily', priority: '0.8' },
  { path: 'play?difficulty=medium', changefreq: 'daily', priority: '0.8' },
  { path: 'play?difficulty=hard', changefreq: 'daily', priority: '0.8' },
];

/** XML-escape a URL for the sitemap (`&` in query strings is the live case) */
const xmlEscape = value =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Absolute URL for a route in a locale */
const routeUrl = (localeCode, routePath) => `${SITE_URL}${localeBasePath(localeCode)}${routePath}`;

/**
 * Run one Vite build
 *
 * @param {import('../src/i18n/locales.js').Locale} locale
 */
function buildLocale(locale) {
  const isRoot = !locale.path;
  const outDir = isRoot ? 'dist' : `dist/${locale.path}`;

  console.log(`\n▸ Building ${locale.code} → ${outDir}`);

  execFileSync('npx', ['vite', 'build', '--outDir', path.join(ROOT, outDir), '--emptyOutDir'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, LOCALE: locale.code },
  });
}

/**
 * Write a locale's PWA manifest
 *
 * Derived from the root manifest so icons and colours stay in one place, with
 * the translated name, description, shortcuts and - critically - a start_url
 * inside the locale, so an installed app opens in the language it was
 * installed in.
 *
 * @param {import('../src/i18n/locales.js').Locale} locale
 * @param {Object} messages - The locale's dictionary
 * @param {Object} baseManifest - Parsed public/manifest.json
 */
function writeManifest(locale, messages, baseManifest) {
  const base = localeBasePath(locale.code);

  const fill = (template, vars) =>
    template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));

  const gridSizes = { easy: '4×4', medium: '6×6', hard: '8×8' };

  const manifest = {
    ...baseManifest,
    lang: locale.htmlLang,
    description: messages['meta.description'],
    start_url: base,
    scope: base,
    shortcuts: ['easy', 'medium', 'hard'].map(difficulty => {
      const label = messages[`difficulty.${difficulty}`];
      const source = baseManifest.shortcuts.find(shortcut =>
        shortcut.url.endsWith(`difficulty=${difficulty}`)
      );

      return {
        ...source,
        name: fill(messages['pwa.shortcutName'], { difficulty: label }),
        short_name: label,
        description: fill(messages['pwa.shortcutDescription'], {
          difficulty: label,
          size: gridSizes[difficulty],
        }),
        url: `${base}play?difficulty=${difficulty}`,
      };
    }),
  };

  const target = path.join(DIST, locale.path, 'manifest.json');
  writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Write dist/_redirects
 *
 * Netlify applies the first matching rule, so ordering carries the whole
 * design:
 *
 *   1. Locale SPA fallbacks come first, so `/de/play` is served German and is
 *      never seen by the language rules below. This is the important half -
 *      the failure mode that de-indexes multilingual sites is redirecting the
 *      locale URLs themselves. These never redirect, for anyone, ever.
 *   2. The bare root is the *only* URL that language-detects, which is exactly
 *      what hreflang's x-default is reserved for. A crawler arriving with no
 *      Accept-Language header (Googlebot's default) falls through to English,
 *      and reaches the other languages via the sitemap and hreflang links.
 *   3. English lives at the root and is the fallback for anything unmatched.
 *
 * Netlify reads an `nf_lang` cookie in preference to the Accept-Language
 * header, so the in-app language switcher sets that cookie and an explicit
 * choice permanently outranks the browser's guess.
 */
function writeRedirects() {
  const localised = LOCALES.filter(locale => locale.path);
  const lines = [];

  lines.push('# Generated by scripts/build-locales.mjs - do not edit by hand.');
  lines.push('#');
  lines.push('# Netlify applies the FIRST matching rule, so the order below matters.');
  lines.push('');
  lines.push('# 1. Locale URLs. These serve their own language to every visitor and');
  lines.push('#    crawler and never redirect - which is what keeps each language');
  lines.push('#    independently indexable.');

  // Column widths sized to the longest locale path so the generated file stays
  // readable - Netlify itself only needs whitespace
  const longest = Math.max(...localised.map(locale => locale.path.length));
  const rule = (from, to, status, condition = '') =>
    `${from.padEnd(longest + 6)}${to.padEnd(longest + 16)}${status}${condition ? `  ${condition}` : ''}`;

  for (const locale of localised) {
    lines.push(rule(`/${locale.path}`, `/${locale.path}/`, '301'));
    lines.push(rule(`/${locale.path}/*`, `/${locale.path}/index.html`, '200'));
  }

  lines.push('');
  lines.push('# 2. The bare root, and only the bare root, detects language. Requests');
  lines.push('#    with no Accept-Language match (including Googlebot, which sends no');
  lines.push('#    such header by default) fall through to English below.');
  lines.push('#    An nf_lang cookie set by the in-app switcher overrides this.');

  for (const locale of localised) {
    lines.push(rule('/', `/${locale.path}/`, '302', `Language=${locale.match.join(',')}`));
  }

  lines.push('');
  lines.push('# 3. English at the root, plus the SPA fallback for its own routes.');
  lines.push(rule('/*', '/index.html', '200'));
  lines.push('');

  writeFileSync(path.join(DIST, '_redirects'), lines.join('\n'));
}

/**
 * Write dist/sitemap.xml
 *
 * Every route appears once per language, and each entry lists every language
 * as an alternate. This is how the non-English pages get discovered at all:
 * nothing links to them from the root, because the root redirects rather than
 * linking.
 */
function writeSitemap() {
  const entries = [];

  for (const route of ROUTES) {
    for (const locale of LOCALES) {
      const alternates = LOCALES.map(
        alternate =>
          `    <xhtml:link rel="alternate" hreflang="${alternate.htmlLang}" href="${xmlEscape(routeUrl(alternate.code, route.path))}"/>`
      );

      alternates.push(
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(routeUrl(DEFAULT_LOCALE, route.path))}"/>`
      );

      entries.push(
        [
          '  <url>',
          `    <loc>${xmlEscape(routeUrl(locale.code, route.path))}</loc>`,
          ...alternates,
          `    <changefreq>${route.changefreq}</changefreq>`,
          `    <priority>${route.priority}</priority>`,
          '  </url>',
        ].join('\n')
      );
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  writeFileSync(path.join(DIST, 'sitemap.xml'), xml);
}

/**
 * Write a single locale's sitemap, e.g. dist/ko/sitemap.xml
 *
 * The combined sitemap above is what Google reads, and its hreflang
 * annotations are the point of it. These per-locale files exist for the search
 * engines that do not understand hreflang at all - Naver being the one that
 * matters, since it holds roughly half of Korean search and wants a
 * single-language sitemap submitted through its own console.
 *
 * So they carry that locale's URLs and nothing else: no alternates, no
 * cross-language references. A URL appearing in more than one sitemap is fine
 * - sitemaps are discovery hints, not an exclusive index.
 *
 * The root locale is skipped: its file would collide with the combined sitemap,
 * and English is already the one language every crawler reaches without help.
 *
 * @param {import('../src/i18n/locales.js').Locale} locale
 */
function writeLocaleSitemap(locale) {
  if (!locale.path) return;

  const entries = ROUTES.map(route =>
    [
      '  <url>',
      `    <loc>${xmlEscape(routeUrl(locale.code, route.path))}</loc>`,
      `    <changefreq>${route.changefreq}</changefreq>`,
      `    <priority>${route.priority}</priority>`,
      '  </url>',
    ].join('\n')
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  writeFileSync(path.join(DIST, locale.path, 'sitemap.xml'), xml);
}

async function main() {
  // The root build runs with --emptyOutDir, which would wipe locale output if
  // it ran second. Clear once here and build the root first.
  if (existsSync(DIST)) {
    rmSync(DIST, { recursive: true });
  }

  const root = LOCALES.find(locale => locale.code === DEFAULT_LOCALE);
  const rest = LOCALES.filter(locale => locale.code !== DEFAULT_LOCALE);

  buildLocale(root);
  for (const locale of rest) {
    buildLocale(locale);
  }

  const baseManifest = JSON.parse(readFileSync(path.join(ROOT, 'public/manifest.json'), 'utf8'));

  for (const locale of LOCALES) {
    const { default: messages } = await import(`../src/i18n/messages/${locale.code}.js`);
    writeManifest(locale, messages, baseManifest);
    writeLocaleSitemap(locale);
  }

  writeRedirects();
  writeSitemap();

  const localeSitemaps = LOCALES.filter(locale => locale.path).length;

  console.log(
    `\n✓ Built ${LOCALES.length} locales: ${LOCALES.map(l => l.code).join(', ')}` +
      `\n  dist/_redirects and dist/sitemap.xml written` +
      `\n  ${localeSitemaps} per-locale sitemaps written (for engines that ignore hreflang)`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
