/**
 * Simple SPA Router
 *
 * Handles client-side routing with History API
 * - URL-based navigation without page reloads
 * - View switching with CSS transitions
 * - Browser back/forward support
 */

let currentViewId = null;
let currentCleanup = null;
let currentUrl = null;

// Route definitions
const routes = [
  { path: '/', viewId: 'home-view' },
  { path: '/tutorial', viewId: 'tutorial-view' },
  { path: '/play', viewId: 'play-view' }
];

/**
 * Navigate to a new path
 * @param {string} path - The path to navigate to (e.g., '/home', '/play?difficulty=easy')
 * @param {boolean} replace - If true, replaces current history entry instead of pushing
 * @param {Object} state - Optional state object to store with history entry
 */
export function navigate(path, replace = false, state = {}) {
  if (replace) {
    history.replaceState(state, '', path);
  } else {
    history.pushState(state, '', path);
  }
  renderRoute();
}

/**
 * Find the matching route for a given path
 * @param {string} path - The pathname to match
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
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const route = matchRoute(path);
  const newUrl = path + window.location.search;

  console.log('[ROUTER] renderRoute - currentUrl:', currentUrl, '-> newUrl:', newUrl);
  // If URL hasn't changed (including query params), don't re-render
  if (currentUrl === newUrl) {
    console.log('[ROUTER] URL unchanged, skipping re-render');
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
    console.log('[ROUTER] currentUrl updated to:', currentUrl);

    // Call view-specific initialization
    console.log('[ROUTER] Calling initView for:', route.viewId);
    const cleanup = await initView(route.viewId, params);
    console.log('[ROUTER] initView completed for:', route.viewId);
    if (cleanup) {
      currentCleanup = cleanup;
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

    case 'tutorial-view':
      const { initTutorial } = await import('./views/tutorial.js');
      return initTutorial(params);

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
