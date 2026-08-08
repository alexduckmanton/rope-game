/**
 * Share Utilities
 *
 * Handles sharing puzzle completion via Web Share API
 * with clipboard fallback.
 */

import { getDifficultyLabel } from '../config.js';
import { t, formatDate } from '../i18n/index.js';
import {
  trackShareAttempted,
  trackShareCompleted,
  trackShareFailed
} from '../analytics.js';

/**
 * Format the share date in the player's language
 *
 * Day / abbreviated month / year, ordered and named by Intl for the active
 * locale - so "26 Jan 2025" in English and "26 janv. 2025" in French, rather
 * than the hardcoded en-US this used to emit for everyone.
 *
 * @param {Date} [date] - Date to format (defaults to today)
 * @returns {string} Formatted date string
 */
export function formatShareDate(date = new Date()) {
  return formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Build share text for completed puzzle
 *
 * NOTE: Adding a puzzle number and the site URL to this text is a pending
 * change, held until there is enough `share_attempted` data to measure its
 * effect. `getPuzzleNumber()` in seededRandom.js and `CONFIG.SITE.URL` are
 * already in place for it. When it lands, the URL must be the *locale* URL
 * (`CONFIG.SITE.URL + localeUrl(LOCALE)`) so a shared link opens in the
 * sender's language and previews in it too - that is most of the reason the
 * localised builds have their own URLs.
 *
 * @param {string} difficulty - Difficulty level
 * @param {string} time - Formatted completion time
 * @returns {string} Share text
 */
export function buildShareText(difficulty, time) {
  const dateStr = formatShareDate();
  const label = getDifficultyLabel(difficulty);

  return `💫 ${label} Loopy ${time}\n${dateStr}`;
}

/**
 * Show temporary feedback on a button
 * @param {HTMLButtonElement} button - Button element
 * @param {string} text - Feedback text to show
 * @param {number} [duration=2000] - Duration in ms
 */
function showButtonFeedback(button, text, duration = 2000) {
  const spanEl = button.querySelector('span');
  const originalText = spanEl?.textContent || button.textContent;

  if (spanEl) {
    spanEl.textContent = text;
  } else {
    button.textContent = text;
  }

  setTimeout(() => {
    if (spanEl) {
      spanEl.textContent = originalText;
    } else {
      button.textContent = originalText;
    }
  }, duration);
}

/**
 * Handle share button click - uses Web Share API with clipboard fallback
 * @param {HTMLButtonElement} button - The share button element
 * @param {string} difficulty - Current difficulty
 * @param {string} time - Formatted completion time
 */
export async function handleShare(button, difficulty, time) {
  const shareText = buildShareText(difficulty, time);

  // Track share attempt
  trackShareAttempted(difficulty, time);

  // Try native share first (iOS/Android)
  if (navigator.share) {
    try {
      await navigator.share({ text: shareText });
      // Track successful native share
      trackShareCompleted(difficulty, 'native');
      return; // Share was successful or cancelled
    } catch (err) {
      // User cancelled or share failed - fall through to clipboard
      if (err.name === 'AbortError') {
        // User cancelled - track as failed with specific error type
        trackShareFailed(difficulty, 'user_cancelled');
        return; // User cancelled, don't fall through
      }
      // Other native share error - track and fall through to clipboard
      trackShareFailed(difficulty, 'native_failed');
    }
  }

  // Fallback to clipboard copy
  try {
    await navigator.clipboard.writeText(shareText);
    showButtonFeedback(button, t('share.copied'));
    // Track successful clipboard share
    trackShareCompleted(difficulty, 'clipboard');
  } catch (err) {
    showButtonFeedback(button, t('share.failed'));
    // Track clipboard failure
    trackShareFailed(difficulty, 'clipboard_failed');
  }
}
