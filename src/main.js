/**
 * Loopy - Main Entry Point
 *
 * A minimalist path-drawing puzzle game where players create a single
 * continuous loop through a grid, guided by numbered hints.
 *
 * This file initializes the SPA router and sets up global event handlers.
 */

import { initRouter } from './router.js';
import { initIcons } from './icons.js';
import { cleanupOldSaves } from './persistence.js';
import { CONFIG } from './config.js';
import tokens from './tokens.js';

// Preload critical fonts for faster loading
// Using Vite's ?url import to get correct paths in dev and production
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff2?url';
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import monoton400 from '@fontsource/monoton/files/monoton-latin-400-normal.woff2?url';

/**
 * Preload fonts to start downloading immediately
 * Creates <link rel="preload"> elements for critical fonts
 */
function preloadFonts() {
  const fonts = [
    { url: inter400, name: 'Inter 400' },
    { url: inter500, name: 'Inter 500' },
    { url: inter600, name: 'Inter 600' },
    { url: inter700, name: 'Inter 700' },
    { url: monoton400, name: 'Monoton 400' }
  ];

  fonts.forEach(font => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.href = font.url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

/**
 * Inject layout constants from config.js into CSS custom properties
 * This ensures CSS and JavaScript use the same values (single source of truth)
 */
function injectLayoutConstants() {
  const root = document.documentElement;
  root.style.setProperty('--layout-horizontal-padding', `${CONFIG.LAYOUT.HORIZONTAL_PADDING}px`);
  root.style.setProperty('--layout-top-bar-height', `${CONFIG.LAYOUT.TOP_BAR_HEIGHT}px`);
  root.style.setProperty('--cell-size-min', `${CONFIG.CELL_SIZE_MIN}px`);
  root.style.setProperty('--cell-size-max', `${CONFIG.CELL_SIZE_MAX}px`);
}

/**
 * Update the theme-color meta tag based on current color scheme
 * This changes the browser chrome color on mobile devices
 */
function updateThemeColor() {
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    // Read the current --color-theme value from CSS (automatically switches with dark mode)
    const themeColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-theme')
      .trim();
    metaThemeColor.setAttribute('content', themeColor);
  }
}

/**
 * Initialize the application
 */
function init() {
  // Inject layout constants from config.js into CSS immediately
  // This must happen before any rendering to ensure CSS has correct values
  injectLayoutConstants();

  // Reload color tokens from CSS now that DOM is ready
  // This ensures colors are read after stylesheets are loaded
  // (Initial module-level color load may happen before CSS is ready)
  tokens.reloadColors();

  // Preload fonts first for fastest loading
  preloadFonts();

  // Clean up old saved games from previous days
  cleanupOldSaves();

  // Set initial theme-color meta tag
  updateThemeColor();

  // Listen for theme changes and update meta tag
  window.addEventListener('themeChanged', updateThemeColor);

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

  // Initialize Lucide icons
  initIcons();

  // Initialize router
  initRouter();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
