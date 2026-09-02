---
paths:
  - "src/sw.js"
  - "src/serviceWorker.js"
  - "src/components/offlineNotice.js"
  - "src/router.js"
  - "offline.html"
  - "vite.config.js"
---

# Offline

The game already generated every puzzle locally and stored every result in localStorage. The service worker only has to put the *files* on the device, and it does that lazily rather than up front.

### The shape of it

| File | Role |
|---|---|
| `src/sw.js` | The worker. **A template, not a module** — never bundled, never imported |
| `vite.config.js` → `serviceWorkerPlugin` | Fills in the `__SW_*__` tokens and writes `dist/<locale>/sw.js` |
| `src/serviceWorker.js` | Registration, and the one message the page sends the worker |
| `offline.html` | Cold-start fallback. A second HTML entry, so it ships translated |
| `src/components/offlineNotice.js` | The same message, rendered in-app when a view's chunk is missing |

**One worker per language.** A worker's scope is its own directory, so `dist/de/sw.js` controls `/de/` and caches `/de/assets/`. They share one cache (`loopy-v1`) because they share an origin and the icons and tutorial posters with it; the per-locale files are namespaced by their base path and cannot collide.

**Nothing is precached but the shell and the offline page**, together under 5KB gzipped. Everything else is stored the first time it is requested. Play one puzzle online and that puzzle's code is there for good; never open the tutorial and its files are never downloaded.

### The four rules

| Request | Strategy | Why |
|---|---|---|
| `<base>assets/*` | Cache-first, never revalidated | Content-hashed by Vite, so the URL *is* the version |
| Other same-origin files | Stale-while-revalidate | Stable URL, changeable content (icons, `manifest.json`, posters) |
| Navigations | Network-first, cached shell, then `offline.html` | `index.html` is the one file Vite does not hash — it names the current bundles, so a stale copy points at files that no longer exist |
| `.mp4` / `.webm`, and anything cross-origin | Passed straight through | 2.1MB of tutorial video is not worth putting on a phone. PostHog is not ours to cache |

The clips' `.webp` posters *are* cached, so the tutorial degrades to a slideshow offline rather than to empty boxes.

### Four things that will bite

- **Every cache lookup must pass `ignoreVary: true`.** Static hosts send `Vary: Accept-Encoding` and dev servers add `Vary: Origin`. The Cache API honours those, so a file stored by the worker's own `fetch` will not match the page's later request for the same URL. The failure mode is the worst kind: a full cache and a blank page.
- **The first visit is invisible to the `fetch` handler.** The bundle, the stylesheet and the fonts are all requested before there is a worker to intercept them. The page posts its `performance.getEntriesByType('resource')` list across once it is controlled, and the worker stores that — which is why offline works from the *first* visit rather than the second. Nothing extra is downloaded: the hashed files are `immutable` and come out of the HTTP cache.
- **A view's chunk is not a navigation.** Tapping a difficulty offline, having only ever seen the home screen, fails at the dynamic import — which the worker never sees and `offline.html` never gets a chance to answer. `router.js` catches it and shows `offlineNotice.js` instead.
- **A failed dynamic import cannot be retried in place.** Chromium records the failure in the document's module map and answers every later import of that URL from the record, without touching the network, for as long as the page is open. Reconnecting and tapping again fails instantly and silently. Both offline screens listen for `online` and reload instead — a fresh document is the only thing that clears it, and the address bar already holds where the player was going.

### Updates

**No `skipWaiting`, deliberately.** A new build installs quietly and takes over once every tab is closed, so a deploy can never reload a half-drawn puzzle out from under a player. On activate it prunes the previous build's hashed files, which is safe precisely because those URLs are immutable — anything under this locale's asset directory that the current build does not name can never be requested again.

The `__SW_VERSION__` stamp exists only to guarantee the worker's bytes change when the build does; the browser compares the script byte for byte and installs nothing if it matches.

### Testing it

`npm run dev` does not register a worker — it is emitted by a build-only plugin, so dev would register a 404. Use `npm run build && npm run preview`, then DevTools → Application → Service Workers, and the Network panel's offline toggle. The itch build has no worker at all: `__SW_PATH__` is null there and the registration tree-shakes out.
