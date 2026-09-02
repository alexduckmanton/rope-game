import { defineConfig } from 'vite'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { LOCALES, DEFAULT_LOCALE, getLocale, localeBasePath } from './src/i18n/locales.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const SITE_URL = 'https://loopy.wtf'

/**
 * Build the hreflang block for a locale build
 *
 * Every locale lists every locale including itself, plus an x-default pointing
 * at the root. The root is the only URL that language-detects, which is
 * exactly what x-default is reserved for - every locale path below serves its
 * own language to every visitor and crawler, and never redirects.
 *
 * @returns {string} Indented <link rel="alternate"> markup
 */
function buildHreflangLinks() {
  const links = LOCALES.map(
    locale =>
      `  <link rel="alternate" hreflang="${locale.htmlLang}" href="${SITE_URL}${localeBasePath(locale.code)}">`
  )

  links.push(`  <link rel="alternate" hreflang="x-default" href="${SITE_URL}/">`)

  return links.join('\n')
}

/**
 * Substitute build-time tokens in the HTML entries
 *
 * Both index.html and offline.html go through this.
 *
 * `{{message.key}}` comes from the locale dictionary; `{{@name}}` is one of the
 * computed values below. Doing this at build time rather than on load is the
 * whole point of the setup - the browser receives HTML that is already in the
 * right language, so there is nothing to swap and nothing to flash.
 *
 * @param {Object} options
 * @param {Object} options.messages - The active locale's dictionary
 * @param {Object} options.locale - The active locale descriptor
 * @param {boolean} options.isItch - Whether this is the single-locale itch build
 * @returns {import('vite').Plugin} Vite plugin
 */
function i18nHtmlPlugin({ messages, locale, isItch }) {
  const basePath = localeBasePath(locale.code)

  const computed = {
    '@htmlLang': locale.htmlLang,
    '@ogLocale': locale.ogLocale,
    // Same value as @htmlLang, kept as its own token so the reason for the
    // duplicate declaration in index.html stays legible - see the note there
    '@contentLanguage': locale.htmlLang,
    '@canonical': `${SITE_URL}${basePath}`,
    // Shared files (icons, og image, videos) are deployed once at the domain
    // root and referenced absolutely, so the locale builds do not each carry a
    // duplicate copy. The itch build has no server, so it keeps them relative.
    '@asset': isItch ? './' : '/',
    '@manifest': isItch ? './manifest.json' : `${basePath}manifest.json`,
    '@hreflang': isItch ? '' : buildHreflangLinks(),
  }

  return {
    name: 'loopy-i18n-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        return html.replace(/\{\{([@\w.]+)\}\}/g, (match, token) => {
          if (token.startsWith('@')) {
            return computed[token] !== undefined ? computed[token] : match
          }

          const value = messages[token]
          if (typeof value !== 'string') {
            throw new Error(
              `[i18n] ${ctx.path} references "${token}", which is missing from ` +
                `src/i18n/messages/${locale.code}.js (or is a plural message, which markup cannot use)`
            )
          }

          // Meta tags and attributes are quoted with ", so any " in a
          // translation would end the attribute early
          return value.replace(/"/g, '&quot;')
        })
      },
    },
  }
}

/**
 * Generate this locale's service worker
 *
 * `src/sw.js` is a template rather than a module: it never enters the bundle,
 * and the values it needs - its own base path, the current build's hashed
 * filenames, the other locales' prefixes - only exist once the build has run.
 * So it is read from disk at the end of the build, filled in, and written
 * verbatim to `sw.js`.
 *
 * Written with a fixed name and no hash, because the browser fetches it by
 * URL and compares it byte for byte against the copy it already has. The
 * `__SW_VERSION__` stamp is what guarantees a byte difference when the build
 * changes in a way the asset list alone would not show - a new `index.html`,
 * say, or a replaced icon.
 *
 * A worker's scope is its own directory, so `dist/de/sw.js` controls `/de/`
 * and nothing above it. That is exactly the boundary we want: one worker per
 * language, each caching its own bundle.
 *
 * @param {Object} options
 * @param {import('./src/i18n/locales.js').Locale} options.locale - The active locale
 * @param {boolean} options.isItch - Whether this is the single-locale itch build
 * @returns {import('vite').Plugin} Vite plugin
 */
function serviceWorkerPlugin({ locale, isItch }) {
  const base = localeBasePath(locale.code)

  return {
    name: 'loopy-service-worker',
    apply: 'build',
    // writeBundle, not generateBundle: Vite drops the empty JS chunk it
    // generates for a script-less HTML entry (offline.html) partway through
    // generateBundle, and the asset list should not name a file that will not
    // exist. By writeBundle the bundle is final.
    writeBundle(options, bundle) {
      // The itch build is a zip the player already has on disk, served from a
      // path we do not control. There is nothing for a worker to cache and no
      // origin to scope it to.
      if (isItch) return

      const names = Object.keys(bundle).sort()

      // Hashed files, as the URLs they will be requested by. Not precached -
      // the worker uses this only to evict the previous build's leftovers.
      const assets = names.filter(name => name.startsWith('assets/')).map(name => `${base}${name}`)

      // index.html carries the translated strings and the bundle references, so
      // hashing it alongside the filenames catches changes that leave every
      // hash untouched
      const html = bundle['index.html']

      const version = createHash('sha256')
        .update(names.join('\n'))
        .update(html && html.source ? String(html.source) : '')
        .digest('hex')
        .slice(0, 12)

      // Only the root worker needs these - see the note on OTHER_LOCALES in
      // src/sw.js
      const otherLocales = LOCALES.map(entry => localeBasePath(entry.code)).filter(
        prefix => prefix !== '/' && prefix !== base
      )

      const source = readFileSync(path.resolve(dirname, 'src/sw.js'), 'utf8')
        .replace(/__SW_BASE__/g, base)
        .replace(/__SW_VERSION__/g, version)
        .replace(/__SW_ASSETS__/g, JSON.stringify(assets))
        .replace(/__SW_OTHER_LOCALES__/g, JSON.stringify(otherLocales))

      writeFileSync(path.join(options.dir, 'sw.js'), source)
    },
  }
}

export default defineConfig(async () => {
  const isItch = process.env.BUILD_TARGET === 'itch'

  // The itch build is a single self-contained bundle with no server to route
  // locales, so it always ships the default language.
  const localeCode = isItch ? DEFAULT_LOCALE : process.env.LOCALE || DEFAULT_LOCALE
  const locale = getLocale(localeCode)

  if (!locale) {
    throw new Error(
      `[i18n] Unknown locale "${localeCode}". Known locales: ${LOCALES.map(l => l.code).join(', ')}`
    )
  }

  const messagesPath = path.resolve(dirname, `src/i18n/messages/${locale.code}.js`)

  // Imported by explicit file URL rather than a template-literal specifier:
  // Vite bundles this config with esbuild, and a template-literal import gets
  // glob-expanded over the whole directory, which would drag src/i18n/index.js
  // and its `@i18n-messages` alias into a plain Node context where it cannot
  // resolve.
  const { default: messages } = await import(pathToFileURL(messagesPath).href)

  return {
    base: isItch ? './' : localeBasePath(locale.code),

    // Only the root build copies public/ into its output. The locale builds
    // reference those same files absolutely from the domain root, so the icons,
    // og image and ~1MB of tutorial videos are deployed once rather than once
    // per language. Their manifest.json is generated by scripts/build-locales.mjs.
    publicDir: isItch || !locale.path ? 'public' : false,

    resolve: {
      alias: {
        '@i18n-messages': messagesPath,
      },
    },

    build: {
      rollupOptions: {
        // offline.html is a second HTML entry rather than a file in public/, so
        // it goes through the same token substitution index.html does and ships
        // translated. It references nothing, so it adds no chunks. The itch
        // build has no worker to serve it, so it does not carry it either.
        input: isItch
          ? path.resolve(dirname, 'index.html')
          : {
              index: path.resolve(dirname, 'index.html'),
              offline: path.resolve(dirname, 'offline.html'),
            },
      },
    },

    define: {
      __LOCALE__: JSON.stringify(locale.code),
      // Where the generated worker will live, or null when this build has none
      __SW_PATH__: JSON.stringify(isItch ? null : `${localeBasePath(locale.code)}sw.js`),
    },

    plugins: [i18nHtmlPlugin({ messages, locale, isItch }), serviceWorkerPlugin({ locale, isItch })],
  }
})
