/**
 * Loopy - Main Entry Point
 *
 * A minimalist path-drawing puzzle game where players create a single
 * continuous loop through a grid, guided by numbered hints.
 *
 * This file initializes the SPA router and sets up global event handlers.
 */

import { initRouter } from './router.js';

/**
 * Initialize the application
 */
function init() {
  // Prevent all forms of zooming on mobile devices

  // Prevent Safari gesture events (pinch zoom)
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('gestureend', (e) => e.preventDefault());

  // Prevent multi-touch zoom
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent double-tap zoom by handling touchstart
  let lastTouchStart = 0;
  document.addEventListener('touchstart', (e) => {
    const now = Date.now();
    if (e.touches.length === 1 && now - lastTouchStart <= 500) {
      e.preventDefault();
    }
    lastTouchStart = now;
  }, { passive: false });

  // Also prevent on touchend as a fallback
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 500) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  // Initialize router
  initRouter();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
