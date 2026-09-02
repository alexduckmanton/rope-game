/**
 * Service worker - offline support
 *
 * The game generates every puzzle locally and stores every result in
 * localStorage, so once its files are on the device there is nothing left for
 * it to ask a server for. This file is what puts them there.
 *
 * The strategy is deliberately lazy: **nothing is precached except the shell
 * and the offline page**, together under 5KB gzipped. Everything else is stored
 * the first time it is actually requested, so opening the game costs what it
 * always cost, and the parts a player never visits are never downloaded. Play
 * one puzzle online and that puzzle's code is there for good.
 *
 * Two caching rules, split by whether a URL's content can change:
 *
 *   `<base>assets/*`  Content-hashed by Vite, so a given URL is immutable.
 *                     Cache-first, never revalidated.
 *   everything else   Stable URLs with changeable content (the icons,
 *                     manifest.json, tutorial posters). Stale-while-revalidate:
 *                     served from cache instantly, refreshed in the background.
 *
 * Navigations are network-first instead, because `index.html` is the one file
 * Vite does *not* hash: it names the current hashed bundles, so a stale copy
 * would point at files that no longer exist. Online it always comes from the
 * network; offline it comes from cache, and only a device that has never
 * loaded this locale at all falls through to the offline page.
 *
 * One thing the fetch handler cannot see is the visit that installed it: the
 * page's own scripts, styles and fonts were all requested before there was a
 * worker to intercept them. So the page posts its resource list over once it is
 * controlled, and `cacheVisited` below stores exactly what that visit used -
 * which is the same lazy rule, applied retroactively to the first load.
 *
 * The tutorial clips are deliberately excluded - 2.1MB of video that a player
 * watches once is not worth putting on their phone. Their poster stills are
 * cached like any other image, so the tutorial degrades to a slideshow offline
 * rather than to empty boxes.
 *
 * ---
 *
 * THIS FILE IS A TEMPLATE. `dist/<locale>/sw.js` is generated from it by the
 * service worker plugin in vite.config.js, which substitutes the `__SW_*__`
 * tokens below. Edit this file; never edit the generated one.
 */

/** This build's path prefix, always with a trailing slash: '/' or '/de/' */
const BASE = '__SW_BASE__';

/**
 * Build stamp
 *
 * Unused at runtime - its only job is to change this file's bytes when the
 * build changes, which is how the browser notices there is a new worker.
 */
const VERSION = '__SW_VERSION__';

/**
 * One cache for the whole origin
 *
 * Every language build is served from the same origin and shares the icons and
 * tutorial posters, so a single cache stores those once rather than once per
 * language. The per-locale files are namespaced by their own base path, so
 * they cannot collide.
 */
const CACHE = 'loopy-v1';

/** The SPA shell. Every route in this locale is served from this one document */
const SHELL_URL = BASE;

/** The cold-start fallback, and the only file fetched purely to be cached */
const OFFLINE_URL = `${BASE}offline.html`;

/**
 * Options for every cache lookup
 *
 * `ignoreVary` is not optional here. Static hosts send `Vary: Accept-Encoding`,
 * and dev servers add `Vary: Origin`; the Cache API honours those by default,
 * so a stored file would fail to match a later request for the same URL made
 * with different headers - which is exactly what happens when the worker stores
 * a file with its own fetch and the page then asks for it as a script. The
 * entry would be there, the lookup would miss, and offline would break with a
 * full cache. These are static files keyed by URL; the negotiation Vary exists
 * for is not happening.
 */
const MATCH = { ignoreVary: true };

/** Where Vite puts content-hashed files, which are safe to cache forever */
const ASSET_DIR = `${BASE}assets/`;

/** This build's hashed files. Used only to evict a previous build's, on activate */
const BUILD_ASSETS = __SW_ASSETS__;

/**
 * The other languages' path prefixes, excluding this build's own and the root
 *
 * Only the root worker needs these. Its scope is `/`, which covers every
 * locale, so without this list it would answer an offline navigation to
 * `/de/play` with the English shell. A locale worker's own prefix already
 * excludes everything else.
 */
const OTHER_LOCALES = __SW_OTHER_LOCALES__;

/**
 * Whether a URL belongs to this build
 *
 * @param {URL} url
 * @returns {boolean}
 */
function inScope(url) {
  const path = url.pathname;

  if (BASE !== '/') {
    // '/de' and '/de/' are both this build - Netlify serves either
    return path === BASE.slice(0, -1) || path.startsWith(BASE);
  }

  return !OTHER_LOCALES.some(prefix => path === prefix.slice(0, -1) || path.startsWith(prefix));
}

/**
 * Whether a request is for a tutorial clip
 *
 * The `.webp` posters in the same directory are *not* matched: they are
 * kilobytes rather than hundreds of them, and they are what the tutorial falls
 * back to when the video cannot play.
 *
 * @param {Request} request
 * @param {URL} url
 * @returns {boolean}
 */
function isVideo(request, url) {
  return (
    request.destination === 'video' ||
    request.destination === 'audio' ||
    /\.(mp4|webm)$/.test(url.pathname)
  );
}

/**
 * Store a response, if it is one worth storing
 *
 * Only same-origin 200s. An opaque cross-origin response has no readable
 * status, and a redirect or an error page cached under a real URL would
 * outlive the condition that produced it.
 *
 * @param {Cache} cache
 * @param {Request|string} key
 * @param {Response} response
 */
function put(cache, key, response) {
  // `redirected` is excluded because cache.put rejects on it outright - a
  // redirect chain cannot be replayed from a cache entry
  if (response && response.ok && response.type === 'basic' && !response.redirected) {
    cache.put(key, response.clone()).catch(() => {});
  }
}

/**
 * Serve a navigation: network first, cached shell second, offline page last
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleNavigation(request) {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request);

    // Every route in this locale is the same document, so it is stored once
    // under the locale root rather than once per URL. The offline page is
    // itself a navigable URL and must never be mistaken for the shell.
    const isShell =
      inScope(url) &&
      url.pathname !== OFFLINE_URL &&
      (response.headers.get('content-type') || '').includes('text/html');

    if (isShell) put(cache, SHELL_URL, response);

    return response;
  } catch (error) {
    if (inScope(url)) {
      const shell = await cache.match(SHELL_URL, MATCH);
      if (shell) return shell;
    }

    const offline = await cache.match(OFFLINE_URL, MATCH);
    return offline || Response.error();
  }
}

/**
 * Serve a subresource
 *
 * A miss with no network rejects, which is the honest answer: the router turns
 * a failed view import into the offline notice, and the browser's own fallbacks
 * cover images and fonts.
 *
 * @param {Request} request
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function handleAsset(request, url) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, MATCH);

  // Hashed: the URL names its own content, so a hit is always current
  if (cached && url.pathname.startsWith(ASSET_DIR)) return cached;

  const network = fetch(request)
    .then(response => {
      put(cache, request, response);
      return response;
    })
    .catch(error => {
      if (cached) return cached;
      throw error;
    });

  // Unhashed and already cached: serve the copy we have and refresh behind it
  return cached || network;
}

/**
 * Drop hashed files from previous builds
 *
 * Safe to do wholesale because these URLs are immutable: anything under this
 * locale's asset directory that the current build does not name can never be
 * requested again.
 */
async function pruneStaleAssets() {
  const cache = await caches.open(CACHE);
  const current = new Set(BUILD_ASSETS);

  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith(ASSET_DIR) && !current.has(path)) {
      await cache.delete(request);
    }
  }
}

/**
 * Store the files a visit has already used
 *
 * Called with what `performance.getEntriesByType('resource')` saw on the page,
 * which on a first visit is everything the worker missed. These are all URLs
 * the browser fetched moments ago, and the hashed ones are served `immutable`,
 * so in practice this reads from the HTTP cache rather than the network. A URL
 * already stored is skipped outright.
 *
 * @param {string[]} urls - Absolute URLs from the controlled page
 */
async function cacheVisited(urls) {
  const cache = await caches.open(CACHE);

  await Promise.allSettled(
    urls.map(async href => {
      const url = new URL(href, self.location.origin);

      if (url.origin !== self.location.origin) return;
      if (/\.(mp4|webm)$/.test(url.pathname)) return;
      if (await cache.match(url.href, MATCH)) return;

      put(cache, url.href, await fetch(url.href, { credentials: 'same-origin' }));
    })
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // Two files, and only these two.
      //
      // The offline page can never be fetched on demand, because the demand for
      // it is the absence of a network.
      //
      // The shell has to be here rather than caught in passing, because the
      // navigation that loaded this page happened before there was a worker to
      // see it: without this, offline would not work until the second visit.
      // It costs one conditional request for a document the browser downloaded
      // seconds ago, so in practice a 304.
      await Promise.allSettled([
        cache.add(new Request(OFFLINE_URL, { cache: 'reload' })),
        cache.add(SHELL_URL),
      ]);
    })()
  );

  // No skipWaiting, deliberately. A new build takes over once every tab is
  // closed, so a deploy can never reload a half-drawn puzzle out from under
  // the player.
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      await pruneStaleAssets();

      // Claim the page that just installed us, so the first visit starts
      // caching immediately rather than from the second load onwards
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'cache-visited') return;
  if (!Array.isArray(event.data.urls)) return;

  event.waitUntil(cacheVisited(event.data.urls));
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // PostHog and anything else off-origin: not ours to cache, and it fails
  // closed on its own when there is no network
  if (url.origin !== self.location.origin) return;

  // A range request cannot be stored - the Cache API rejects a 206 - and
  // intercepting one only to pass it through breaks media seeking in Safari
  if (request.headers.has('range')) return;

  if (isVideo(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request, url));
});
