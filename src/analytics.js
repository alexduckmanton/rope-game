/**
 * Google Analytics integration for SPA
 *
 * Handles page view tracking for client-side route changes.
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

  gtag('config', GA_MEASUREMENT_ID, {
    page_path: path,
    page_title: title || document.title,
  });
}
