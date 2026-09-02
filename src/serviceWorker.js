/**
 * Service worker registration
 *
 * The worker itself is src/sw.js, generated per locale at build time. This is
 * the handshake, and it is deliberately unremarkable: registration is
 * fire-and-forget, happens after the page has loaded so it never competes with
 * first paint, and a failure is swallowed. A browser with no service worker
 * support, a private window that refuses to register one, or a build with no
 * worker at all all end up in the same place - the game, working exactly as it
 * did before, just without the offline half.
 *
 * There is no update prompt and no reload. See the note on `skipWaiting` in
 * src/sw.js: a new build waits until every tab is closed rather than taking
 * over mid-puzzle.
 */

/**
 * URL of this build's worker, or null when it has none
 *
 * Substituted by Vite's `define`. Null for the itch build, which is a local
 * bundle with no origin to scope a worker to and nothing to fetch anyway.
 */
const SW_PATH = __SW_PATH__;

/**
 * Tell the worker what this page already loaded
 *
 * The chicken-and-egg problem of a first visit: the bundle, the stylesheet and
 * the fonts were all requested before there was a worker to intercept them, so
 * the worker would have nothing of the app itself stored and offline would only
 * start working on the *second* visit.
 *
 * The performance timeline knows exactly what was fetched, so it is handed over
 * and the worker stores that. Nothing extra is downloaded in the process: the
 * hashed files are served `immutable` and come straight back out of the HTTP
 * cache, and the handful that are not revalidate to a 304.
 *
 * On every later visit the page is controlled from the first byte, everything
 * has been cached on the way past, and this becomes a list of hits the worker
 * skips.
 *
 * @param {ServiceWorker} worker - The active worker
 */
function sendVisitedResources(worker) {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return;

  const urls = performance
    .getEntriesByType('resource')
    .map(entry => entry.name)
    .filter(name => name.startsWith(`${window.location.origin}/`));

  if (urls.length > 0) {
    worker.postMessage({ type: 'cache-visited', urls });
  }
}

/**
 * Register the service worker
 *
 * Skipped in development: the worker is emitted by a build-only plugin, so
 * `npm run dev` would register a 404. Use `npm run build && npm run preview` to
 * exercise offline behaviour.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!SW_PATH) return;
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register(SW_PATH, { scope: SW_PATH.replace(/sw\.js$/, '') })
    .then(async registration => {
      // `ready` resolves once *some* worker is active for this scope, which on
      // an update is the outgoing one - either will cache the same files
      const active = (await navigator.serviceWorker.ready).active || registration.active;
      if (active) sendVisitedResources(active);
    })
    .catch(() => {
      // Nothing to do and nothing to tell the player - the game is unaffected
    });
}
