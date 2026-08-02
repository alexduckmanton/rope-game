/**
 * Share Utilities
 *
 * Handles sharing puzzle completion via Web Share API
 * with clipboard fallback.
 */

import { CONFIG } from '../config.js';
import { getPuzzleNumber } from '../seededRandom.js';
import {
  trackShareAttempted,
  trackShareCompleted,
  trackShareFailed
} from '../analytics.js';

/**
 * Build share text for completed puzzle
 *
 * Format (three short lines so it reads well in any messaging app):
 *   💫 Loopy #233 · Medium
 *   2:34
 *   https://loopy.wtf
 *
 * The puzzle number gives the result a comparable identity ("did you get
 * #233?") and the URL means anyone receiving a share can actually find the
 * game. Both are load-bearing for word-of-mouth growth.
 *
 * @param {string} difficulty - Difficulty level
 * @param {string} time - Formatted completion time
 * @param {number} [score] - Score percentage (optional, defaults to 100 for perfect wins)
 * @returns {string} Share text
 */
export function buildShareText(difficulty, time, score = 100) {
  const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const header = `💫 Loopy #${getPuzzleNumber()} · ${label}`;

  // When early game ending is enabled, include score percentage
  // When disabled, use simpler format without score
  const result = CONFIG.FEATURES.ENABLE_EARLY_GAME_ENDING
    ? `${score}% in ${time}`
    : time;

  return `${header}\n${result}\n${CONFIG.SITE.URL}`;
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
 * @param {number} [score] - Score percentage (optional, for partial completion)
 */
export async function handleShare(button, difficulty, time, score) {
  const shareText = buildShareText(difficulty, time, score);

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
    showButtonFeedback(button, 'Copied!');
    // Track successful clipboard share
    trackShareCompleted(difficulty, 'clipboard');
  } catch (err) {
    showButtonFeedback(button, 'Failed');
    // Track clipboard failure
    trackShareFailed(difficulty, 'clipboard_failed');
  }
}
