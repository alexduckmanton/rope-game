/**
 * Simple SPA Router
 *
 * Handles client-side routing with History API
 * - URL-based navigation without page reloads
 * - View switching with CSS transitions
 * - Browser back/forward support
 *
 * Localised builds are served from a path prefix (`/de/`, `/pt-br/`), so every
 * route is expressed here without that prefix and translated to and from real
 * URLs by withBase() / stripBase(). Callers pass '/play?difficulty=easy' and
 * never think about the locale.
 */

import { trackPageView } from './analytics.js';
import { getDifficultyLabel } from './config.js';
import { showOfflineNotice } from './components/offlineNotice.js';
import { t, BASE_PATH } from './i18n/index.js';

let currentViewId = null;
let currentCleanup = null;
let currentUrl = null;

/**
 * This build's path prefix without its trailing slash
 * '' at the site root, '/de' for the German build
 */
const BASE_PREFIX = BASE_PATH.replace(/\/$/, '');

// Route definitions, expressed relative to the locale's base path
const routes = [
  { path: '/', viewId: 'home-view' },
  { path: '/play', viewId: 'play-view' }
];

/**
 * Strip this build's locale prefix from a real pathname
 *
 * Tolerates the prefix with or without a trailing slash, since Netlify serves
 * both `/de` and `/de/`.
 *
 * @param {string} pathname - Real pathname, e.g. '/de/play'
 * @returns {string} Route path, e.g. '/play'
 */
function stripBase(pathname) {
  if (!BASE_PREFIX) return pathname || '/';
  if (pathname === BASE_PREFIX) return '/';
  if (pathname.startsWith(`${BASE_PREFIX}/`)) {
    return pathname.slice(BASE_PREFIX.length) || '/';
  }
  return pathname;
}

/**
 * Add this build's locale prefix to a route path
 *
 * @param {string} path - Route path, e.g. '/play?difficulty=easy'
 * @returns {string} Real path, e.g. '/de/play?difficulty=easy'
 */
function withBase(path) {
  return `${BASE_PREFIX}${path}`;
}

/**
 * Build the document title for a route
 *
 * Distinct per-route titles help search engines treat the play routes as
 * separate pages rather than duplicates of the home page.
 *
 * @param {Object} route - The matched route
 * @param {URLSearchParams} params - URL search parameters
 * @returns {string} Document title
 */
function getRouteTitle(route, params) {
  if (route.viewId !== 'play-view') {
    return t('meta.title');
  }

  const difficulty = params.get('difficulty') || 'medium';
  return t('meta.playTitle', { difficulty: getDifficultyLabel(difficulty) });
}

/**
 * Navigate to a new path
 * @param {string} path - Locale-independent path (e.g., '/', '/play?difficulty=easy')
 * @param {boolean} replace - If true, replaces current history entry instead of pushing
 * @param {Object} state - Optional state object to store with history entry
 */
export function navigate(path, replace = false, state = {}) {
  const url = withBase(path);

  if (replace) {
    history.replaceState(state, '', url);
  } else {
    history.pushState(state, '', url);
  }
  renderRoute();
}

/**
 * Find the matching route for a given path
 * @param {string} path - The route path to match (locale prefix already stripped)
 * @returns {Object} The matching route or home route as fallback
 */
function matchRoute(path) {
  // Normalize path
  const normalizedPath = path === '' ? '/' : path;

  // Find exact match
  const route = routes.find(r => r.path === normalizedPath);

  // Fallback to home if no match
  return route || routes[0];
}

/**
 * Render the current route based on URL
 * - Hides all views
 * - Shows matching view
 * - Calls view handler with URL params
 */
async function renderRoute() {
  const path = stripBase(window.location.pathname);
  const params = new URLSearchParams(window.location.search);
  const route = matchRoute(path);
  const newUrl = path + window.location.search;

  // If URL hasn't changed (including query params), don't re-render
  if (currentUrl === newUrl) {
    return;
  }

  // Cleanup previous view if it has a cleanup function
  if (currentCleanup) {
    await currentCleanup();
    currentCleanup = null;
  }

  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  // Show matching view
  const viewElement = document.getElementById(route.viewId);
  if (viewElement) {
    viewElement.classList.add('active');
    currentViewId = route.viewId;
    currentUrl = newUrl;

    // Set the title before tracking so the page view records the right one
    document.title = getRouteTitle(route, params);

    // Track page view for analytics. The locale prefix is included so paths
    // from different language builds stay distinguishable in PostHog.
    trackPageView(withBase(newUrl));

    // Call view-specific initialization
    try {
      const cleanup = await initView(route.viewId, params);
      if (cleanup) {
        currentCleanup = cleanup;
      }
    } catch (error) {
      // Views are loaded on demand, so a route the player has never opened has
      // no chunk on the device. Offline, that import is the thing that fails -
      // before the view has rendered anything, and out of the service worker's
      // reach, since no navigation ever happened.
      console.warn(`[router] Could not load ${route.viewId}`, error);
      showOfflineNotice();

      // Forget where we are. Returning to this URL then re-renders instead of
      // being short-circuited as unchanged - which matters because the notice
      // reloads the page on `online`, and a route it had already recorded as
      // current would render nothing at all.
      currentUrl = null;
      currentViewId = null;
    }
  }
}

/**
 * Initialize view-specific logic
 * @param {string} viewId - The view ID to initialize
 * @param {URLSearchParams} params - URL search parameters
 * @returns {Function|null} Optional cleanup function for the view
 */
async function initView(viewId, params) {
  switch (viewId) {
    case 'home-view':
      const { initHome } = await import('./views/home.js');
      return initHome();

    case 'play-view':
      const { initGame, cleanupGame } = await import('./views/game.js');
      const difficulty = params.get('difficulty') || 'medium';
      initGame(difficulty);
      return cleanupGame;

    default:
      return null;
  }
}

/**
 * Initialize the router
 * - Sets up popstate listener for browser back/forward
 * - Renders initial route
 */
export function initRouter() {
  // Handle browser back/forward buttons
  window.addEventListener('popstate', () => {
    renderRoute();
  });

  // Render initial route
  renderRoute();
}
