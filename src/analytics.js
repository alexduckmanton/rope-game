/**
 * Google Analytics integration for SPA
 *
 * Handles page view and event tracking for client-side route changes.
 * The gtag script is loaded in index.html.
 */

const GA_MEASUREMENT_ID = 'G-9BFMVX4CLE';

/**
 * Track a page view for SPA navigation
 * Call this when the route changes to track virtual page views
 * @param {string} path - The page path (e.g., '/', '/play', '/tutorial')
 * @param {string} [title] - Optional page title
 */
export function trackPageView(path, title) {
  if (typeof gtag !== 'function') {
    return;
  }

  // GA4 uses page_location (full URL) instead of deprecated page_path
  gtag('event', 'page_view', {
    page_location: window.location.origin + path,
    page_title: title || document.title,
  });
}

/**
 * Track a custom event
 * @param {string} eventName - The event name (e.g., 'puzzle_complete', 'tutorial_complete')
 * @param {Object} [params] - Optional event parameters
 */
export function trackEvent(eventName, params = {}) {
  if (typeof gtag !== 'function') {
    return;
  }

  gtag('event', eventName, params);
}
