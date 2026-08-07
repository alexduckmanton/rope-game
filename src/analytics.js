/**
 * PostHog analytics integration for SPA
 *
 * Handles page view and event tracking for client-side route changes.
 * PostHog is initialised on module load, before the router renders its first
 * route, so the initial page view is never missed.
 *
 * CRITICAL: All analytics calls are wrapped in try-catch blocks to ensure
 * analytics failures never interrupt gameplay.
 */

// Slim, self-contained build: excludes autocapture, session replay, surveys and
// web vitals (all unused here) and loads no extra scripts at runtime. Roughly
// half the bundle size of the default posthog-js entry point.
//
// IT ALSO EXCLUDES FEATURE FLAGS - not just the extra payload, the network call
// itself. `posthog.getFeatureFlag()` exists here and returns `undefined`
// forever, silently. Verified by diffing the dist builds: `module.js` contains
// the `flags/?v=` endpoint, `module.slim.no-external.js` does not.
//
// So nothing in this app can read a flag or run a PostHog Experiment. The hint
// generation experiment randomises client-side instead (see experiment.js).
// Restoring flags means moving to `module.no-external.js`, which costs about
// +38KB gzipped - roughly doubling this game's JS payload.
import posthog from 'posthog-js/dist/module.slim.no-external.js';

/**
 * PostHog project credentials
 *
 * The project API key is a public, client-side key by design - it can only
 * write events, never read them - so it is safe to ship in the bundle. Both
 * values can still be overridden at build time via environment variables
 * (e.g. to point a fork or a staging deploy at a different project).
 */
const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_KEY || 'phc_AhkvYZopskAH4WgPiAoLE8izgfCYKjZsNj6LbLRSBHx8';
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

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
 * during client-side navigation. PostHog handles external attribution itself,
 * so we only track the previous internal page to reconstruct user journeys.
 */
let lastPageUrl = '';

/**
 * Whether PostHog initialised successfully
 * When false, every tracking call becomes a no-op
 */
let isInitialized = false;

/**
 * Initialise PostHog
 *
 * Configuration notes:
 * - persistence: localStorage only, so the game sets no cookies at all, which
 *   keeps the privacy/consent story simple.
 * - person_profiles: 'always' because the game has no accounts. Without it,
 *   anonymous players get no person profiles and retention analysis - the main
 *   reason for using PostHog here - would not work.
 * - capture_pageview: false because the router tracks SPA navigation manually.
 * - autocapture: false because the game already emits explicit, meaningful
 *   events; autocapture on a canvas game is mostly noise.
 */
function initAnalytics() {
  try {
    if (!POSTHOG_KEY) {
      console.warn('[Analytics] No PostHog key configured - tracking disabled');
      return;
    }

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      persistence: 'localStorage',
      person_profiles: 'always',
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      disable_session_recording: true,
      debug: DEBUG_ANALYTICS,
    });

    isInitialized = true;
  } catch (error) {
    // Silent fail - never interrupt gameplay
    console.debug('[Analytics] Init error:', error);
  }
}

initAnalytics();

/**
 * Safe wrapper for PostHog capture calls with error handling
 * @param {string} eventName - The event name
 * @param {Object} [properties] - Optional event properties
 */
function safeCapture(eventName, properties = {}) {
  try {
    if (DEBUG_ANALYTICS) {
      console.log(`[Analytics] ${eventName}`, properties);
    }

    if (!isInitialized) {
      return;
    }

    posthog.capture(eventName, properties);
  } catch (error) {
    // Silent fail - never interrupt gameplay
    console.debug('[Analytics] Error:', error);
  }
}

/**
 * Track a page view for SPA navigation
 * Call this when the route changes to track virtual page views
 *
 * PostHog derives external attribution ($referrer, UTM parameters) from the
 * initial page load itself, so we only attach the previous internal page here
 * rather than overriding PostHog's own referrer handling.
 *
 * @param {string} path - The page path (e.g., '/', '/play', '/tutorial')
 * @param {string} [title] - Optional page title
 */
export function trackPageView(path, title) {
  const currentPageUrl = window.location.origin + path;

  safeCapture('$pageview', {
    $current_url: currentPageUrl,
    title: title || document.title,
    previous_page: lastPageUrl || undefined,
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
  safeCapture(eventName, params);
}

/* ============================================================================
 * TUTORIAL EVENTS
 * ========================================================================= */

/**
 * Track tutorial opened
 * @param {string} source - Where tutorial was opened from ('home', 'game')
 * @param {string} [difficulty] - Difficulty being played, when opened from a game
 */
export function trackTutorialOpened(source, difficulty) {
  trackEvent('tutorial_opened', {
    source,
    difficulty: difficulty || 'none'
  });
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
 * Flatten a puzzle's measured shape into event properties
 *
 * Sent with every game lifecycle event so puzzle characteristics can be
 * correlated with completion directly. This is what makes it possible to tell
 * "this difficulty is mistuned" from "that particular day's puzzle was unlucky"
 * - a distinction the difficulty label alone can never make.
 *
 * @param {Object|null} shape - From describePuzzle() in generation/hintPlacement.js
 * @param {{variant: string, source: string}|null} assignment - Experiment arm actually used
 * @returns {Object} Event properties (empty when nothing is known)
 */
function puzzleProperties(shape, assignment) {
  const props = {};

  if (assignment) {
    // The arm this puzzle was generated with. This is the ONLY record of the
    // assignment - the slim posthog build cannot read flags, so there is no
    // $feature/... property to fall back on. Every analysis of the hint
    // generation experiment reads this. See experiment.js.
    props.generator_variant = assignment.variant;
    props.variant_source = assignment.source;
  }

  if (shape) {
    props.hint_count = shape.hintCount;
    props.expected_turns_total = shape.expectedTurnsTotal;
    props.hint_coverage_percent = shape.coveragePercent;
    props.hint_redundancy = shape.redundancy;
    props.anchor_hints = shape.anchorHints;
    props.solution_turns = shape.solutionTurns;
  }

  return props;
}

/**
 * Track game started
 * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard')
 * @param {string} mode - Game mode ('daily', 'unlimited')
 * @param {Object} [shape] - Measured puzzle shape from describePuzzle()
 * @param {{variant: string, source: string}} [assignment] - Experiment arm used
 */
export function trackGameStarted(difficulty, mode, shape = null, assignment = null) {
  trackEvent('game_started', {
    difficulty,
    mode,
    ...puzzleProperties(shape, assignment)
  });
}

/**
 * Track game completed
 * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard')
 * @param {string} mode - Game mode ('daily', 'unlimited')
 * @param {number} completionTimeSeconds - Time in seconds
 * @param {string} completionTimeFormatted - Formatted time (e.g., "Easy • 2:34")
 * @param {number} score - Score percentage at completion
 * @param {Object} [shape] - Measured puzzle shape from describePuzzle()
 * @param {{variant: string, source: string}} [assignment] - Experiment arm used
 */
export function trackGameCompleted(difficulty, mode, completionTimeSeconds, completionTimeFormatted, score, shape = null, assignment = null) {
  trackEvent('game_completed', {
    difficulty,
    mode,
    completion_time_seconds: completionTimeSeconds,
    completion_time_formatted: completionTimeFormatted,
    score,
    ...puzzleProperties(shape, assignment)
  });
}

/**
 * Track a game left unfinished
 *
 * The counterpart to game_completed, and the piece that was missing: without
 * it, "started and never completed" is indistinguishable from "still playing",
 * so a completion rate says nothing about *where* players give up. The progress
 * fields turn a drop-off into a diagnosis - a player who left at 20% never got
 * going, one who left at 90% got stuck on the last constraint.
 *
 * Fires on navigation away or tab close while a puzzle has been touched but not
 * finished. Best effort by nature: a hard tab kill may not deliver it, so treat
 * the count as a lower bound.
 *
 * @param {string} difficulty - Difficulty level
 * @param {string} mode - Game mode ('daily', 'unlimited')
 * @param {number} elapsedSeconds - Time spent on the puzzle
 * @param {number} score - Score percentage when the player left
 * @param {number} cellsDrawn - Cells in the player's path at exit
 * @param {number} hintsSatisfied - Hints reading zero at exit
 * @param {Object} [shape] - Measured puzzle shape from describePuzzle()
 * @param {{variant: string, source: string}} [assignment] - Experiment arm used
 */
export function trackGameAbandoned(difficulty, mode, elapsedSeconds, score, cellsDrawn, hintsSatisfied, shape = null, assignment = null) {
  trackEvent('game_abandoned', {
    difficulty,
    mode,
    elapsed_seconds: elapsedSeconds,
    score,
    cells_drawn: cellsDrawn,
    hints_satisfied: hintsSatisfied,
    ...puzzleProperties(shape, assignment)
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

/* ============================================================================
 * STREAK EVENTS
 * ========================================================================= */

/**
 * Track a streak being extended or restarted
 *
 * Reports both the streak for the difficulty just completed and the overall
 * streak, which any difficulty can extend. Both are also stored as person
 * properties so streak length can be used to segment retention analysis
 * (e.g. how long players with a 7+ day streak stick around).
 *
 * @param {string} difficulty - Difficulty level just completed
 * @param {{current: number, best: number}} difficultyStreak - Streak for that difficulty
 * @param {{current: number, best: number}} overallStreak - Streak across all difficulties
 */
export function trackStreakUpdated(difficulty, difficultyStreak, overallStreak) {
  trackEvent('streak_updated', {
    difficulty,
    streak_current: difficultyStreak.current,
    streak_best: difficultyStreak.best,
    streak_overall_current: overallStreak.current,
    streak_overall_best: overallStreak.best
  });

  setPersonProperties({
    [`streak_current_${difficulty}`]: difficultyStreak.current,
    [`streak_best_${difficulty}`]: difficultyStreak.best,
    streak_current_overall: overallStreak.current,
    streak_best_overall: overallStreak.best
  });
}

/* ============================================================================
 * PERSON PROPERTIES
 * ========================================================================= */

/**
 * Set person properties, no-op when PostHog is unavailable
 *
 * @param {Object} properties - Properties to set on the person profile
 */
export function setPersonProperties(properties) {
  try {
    if (DEBUG_ANALYTICS) {
      console.log('[Analytics] setPersonProperties', properties);
    }

    if (!isInitialized) return;

    posthog.setPersonProperties(properties);
  } catch (error) {
    // Silent fail - never interrupt gameplay
    console.debug('[Analytics] Error:', error);
  }
}
