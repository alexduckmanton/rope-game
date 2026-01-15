/**
 * Google Analytics integration for SPA
 *
 * Handles page view and event tracking for client-side route changes.
 * The gtag script is loaded in index.html.
 *
 * CRITICAL: All analytics calls are wrapped in try-catch blocks to ensure
 * analytics failures never interrupt gameplay.
 */

const GA_MEASUREMENT_ID = 'G-9BFMVX4CLE';

/**
 * Debug mode - logs analytics events to console
 * Enabled automatically in development or via localStorage flag
 */
const DEBUG_ANALYTICS =
  import.meta.env.DEV ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('analytics-debug') === 'true');

/**
 * Referrer tracking for SPA
 *
 * In SPAs, document.referrer is only set on initial page load and never updates
 * during client-side navigation. We need to:
 * 1. Capture the original external referrer on first load (for attribution)
 * 2. Track internal page URLs for subsequent navigation (for user journey)
 */
const originalReferrer = document.referrer || '';
let lastPageUrl = '';

/**
 * Safe wrapper for gtag calls with error handling
 * @param {string} command - The gtag command ('event', 'config', etc.)
 * @param {string} eventName - The event/config name
 * @param {Object} [params] - Optional parameters
 */
function safeGtag(command, eventName, params = {}) {
  try {
    if (DEBUG_ANALYTICS) {
      console.log(`[Analytics] ${eventName}`, params);
    }

    if (typeof gtag !== 'function') {
      if (DEBUG_ANALYTICS) {
        console.log('[Analytics] gtag not available (likely blocked)');
      }
      return;
    }

    gtag(command, eventName, params);
  } catch (error) {
    // Silent fail - never interrupt gameplay
    console.debug('[Analytics] Error:', error);
  }
}

/**
 * Track a page view for SPA navigation
 * Call this when the route changes to track virtual page views
 *
 * IMPORTANT: Since we use send_page_view: false in the gtag config,
 * we must manually provide page_referrer for proper attribution.
 * - First page view: Uses document.referrer (external traffic source)
 * - Subsequent views: Uses the previous internal page URL
 *
 * @param {string} path - The page path (e.g., '/', '/play', '/tutorial')
 * @param {string} [title] - Optional page title
 */
export function trackPageView(path, title) {
  const currentPageUrl = window.location.origin + path;

  // For the first page view, use the original external referrer
  // For subsequent views, use the last internal page URL
  const referrer = lastPageUrl || originalReferrer;

  safeGtag('event', 'page_view', {
    page_location: currentPageUrl,
    page_title: title || document.title,
    page_referrer: referrer,
  });

  // Update last page URL for next navigation
  lastPageUrl = currentPageUrl;
}

/**
 * Track a custom event
 * @param {string} eventName - The event name (e.g., 'game_completed', 'tutorial_completed')
 * @param {Object} [params] - Optional event parameters
 */
export function trackEvent(eventName, params = {}) {
  safeGtag('event', eventName, params);
}

/* ============================================================================
 * TUTORIAL EVENTS
 * ========================================================================= */

/**
 * Track tutorial opened
 * @param {string} source - Where tutorial was opened from ('home', 'game')
 */
export function trackTutorialOpened(source) {
  trackEvent('tutorial_opened', { source });
}

/**
 * Track tutorial section viewed
 * @param {number} sectionIndex - Section index (0-2)
 * @param {string} sectionName - Human-readable section name
 * @param {string} method - How section was viewed ('scroll', 'dot_click')
 */
export function trackTutorialSectionViewed(sectionIndex, sectionName, method = 'scroll') {
  trackEvent('tutorial_section_viewed', {
    section_index: sectionIndex,
    section_name: sectionName,
    method
  });
}

/**
 * Track tutorial completed
 */
export function trackTutorialCompleted() {
  trackEvent('tutorial_completed');
}

/* ============================================================================
 * GAME EVENTS
 * ========================================================================= */

/**
 * Track game started
 * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard')
 * @param {string} mode - Game mode ('daily', 'unlimited')
 */
export function trackGameStarted(difficulty, mode) {
  trackEvent('game_started', {
    difficulty,
    mode
  });
}

/**
 * Track game completed
 * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard')
 * @param {string} mode - Game mode ('daily', 'unlimited')
 * @param {number} completionTimeSeconds - Time in seconds
 * @param {string} completionTimeFormatted - Formatted time (e.g., "Easy • 2:34")
 */
export function trackGameCompleted(difficulty, mode, completionTimeSeconds, completionTimeFormatted) {
  trackEvent('game_completed', {
    difficulty,
    mode,
    completion_time_seconds: completionTimeSeconds,
    completion_time_formatted: completionTimeFormatted
  });
}

/**
 * Track game restarted
 * @param {string} difficulty - Difficulty level
 * @param {string} mode - Game mode ('daily', 'unlimited')
 */
export function trackGameRestarted(difficulty, mode) {
  trackEvent('game_restarted', {
    difficulty,
    mode
  });
}

/**
 * Track new puzzle generated (unlimited mode only)
 * @param {string} difficulty - Difficulty level
 */
export function trackPuzzleGenerated(difficulty) {
  trackEvent('puzzle_generated', {
    difficulty
  });
}

/**
 * Track path validation error (player made loop but hints don't match)
 * @param {string} difficulty - Difficulty level
 * @param {string} mode - Game mode ('daily', 'unlimited')
 */
export function trackValidationError(difficulty, mode) {
  trackEvent('validation_error', {
    difficulty,
    mode,
    error_type: 'hints_mismatch'
  });
}

/* ============================================================================
 * PLAYER ACTIONS
 * ========================================================================= */

/**
 * Track undo button used
 * @param {string} difficulty - Difficulty level
 * @param {string} mode - Game mode ('daily', 'unlimited')
 */
export function trackUndoUsed(difficulty, mode) {
  trackEvent('undo_used', {
    difficulty,
    mode
  });
}

/**
 * Track solution viewed
 * @param {string} difficulty - Difficulty level
 * @param {string} mode - Game mode ('daily', 'unlimited')
 */
export function trackSolutionViewed(difficulty, mode) {
  trackEvent('solution_viewed', {
    difficulty,
    mode
  });
}

/* ============================================================================
 * SETTINGS EVENTS
 * ========================================================================= */

/**
 * Track settings opened
 */
export function trackSettingsOpened() {
  trackEvent('settings_opened');
}

/* ============================================================================
 * SHARE EVENTS
 * ========================================================================= */

/**
 * Track share attempted
 * @param {string} difficulty - Difficulty level
 * @param {string} completionTime - Formatted completion time
 */
export function trackShareAttempted(difficulty, completionTime) {
  trackEvent('share_attempted', {
    difficulty,
    completion_time: completionTime
  });
}

/**
 * Track share completed successfully
 * @param {string} difficulty - Difficulty level
 * @param {string} method - Share method used ('native', 'clipboard')
 */
export function trackShareCompleted(difficulty, method) {
  trackEvent('share_completed', {
    difficulty,
    method
  });
}

/**
 * Track share failed
 * @param {string} difficulty - Difficulty level
 * @param {string} errorType - Type of error ('not_supported', 'user_cancelled', 'clipboard_failed', 'unknown')
 */
export function trackShareFailed(difficulty, errorType) {
  trackEvent('share_failed', {
    difficulty,
    error_type: errorType
  });
}

/* ============================================================================
 * NAVIGATION EVENTS
 * ========================================================================= */

/**
 * Track difficulty selected from home page
 * @param {string} difficulty - Difficulty level selected
 */
export function trackDifficultySelected(difficulty) {
  trackEvent('difficulty_selected', {
    difficulty,
    source: 'home'
  });
}
