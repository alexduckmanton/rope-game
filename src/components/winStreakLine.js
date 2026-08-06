/**
 * Win Sheet Streak Line
 *
 * The body line of the perfect win sheet. It opens on the completion time,
 * then after a beat swaps that line out for the player's overall daily streak
 * - the reward for coming back tomorrow lands right as the win does.
 *
 * The two lines are stacked inside a window exactly one line tall, so the
 * swap is a single transform on the track with everything outside the window
 * cropped away. Tapping the line toggles between the two, which also cancels
 * the pending automatic reveal so a tap is never overridden a moment later.
 */

import { CONFIG } from '../config.js';
import { createStreakFlameMarkup } from './streakFlame.js';

/**
 * Create the swapping time/streak line
 *
 * The returned element is handed straight to the bottom sheet as its content.
 * A fresh instance is built for every sheet, so the reveal replays each time
 * the sheet is opened.
 *
 * @param {Object} options
 * @param {string} options.timeText - Line shown first (e.g. "You finished in 2:34.")
 * @param {string} options.streakText - Line revealed after the delay (e.g. "5 day streak")
 * @param {Function} [options.onToggle] - Called with true when a tap lands on the
 *   streak half, false for the time half. Only fires for taps, never for the
 *   automatic reveal, so the caller can report deliberate interaction alone.
 * @returns {{element: HTMLElement, start: Function, destroy: Function}} Line instance
 */
export function createWinStreakLine({ timeText, streakText, onToggle }) {
  const element = document.createElement('div');
  element.className = 'win-streak-line';

  const window_ = document.createElement('div');
  window_.className = 'win-streak-line-window';

  const track = document.createElement('div');
  track.className = 'win-streak-line-track';
  track.style.transitionDuration = `${CONFIG.WIN_STREAK.TRANSITION_MS}ms`;

  const timeEl = document.createElement('div');
  timeEl.className = 'win-streak-line-item';
  timeEl.textContent = timeText;

  const streakEl = document.createElement('div');
  streakEl.className = 'win-streak-line-item win-streak-line-streak';
  streakEl.innerHTML = `${createStreakFlameMarkup()}<span></span>`;
  streakEl.querySelector('span').textContent = streakText;

  track.appendChild(timeEl);
  track.appendChild(streakEl);
  window_.appendChild(track);
  element.appendChild(window_);

  let showingStreak = false;
  let revealTimeoutId = null;

  function setShowingStreak(next) {
    showingStreak = next;
    track.classList.toggle('showing-streak', showingStreak);
  }

  const handleToggle = () => {
    // A tap takes over from the automatic reveal, which would otherwise
    // undo the player's choice a moment later
    cancelReveal();
    setShowingStreak(!showingStreak);
    if (onToggle) onToggle(showingStreak);
  };

  function cancelReveal() {
    if (revealTimeoutId !== null) {
      clearTimeout(revealTimeoutId);
      revealTimeoutId = null;
    }
  }

  window_.addEventListener('click', handleToggle);

  /**
   * Arm the automatic reveal
   *
   * Called once the sheet has been told to show, so the delay is measured
   * from the sheet appearing rather than from this element being built.
   */
  function start() {
    cancelReveal();
    setShowingStreak(false);

    revealTimeoutId = setTimeout(() => {
      revealTimeoutId = null;
      setShowingStreak(true);
    }, CONFIG.WIN_STREAK.REVEAL_DELAY_MS);
  }

  /**
   * Drop the pending reveal and listener so a destroyed sheet leaves nothing
   * running behind it
   */
  function destroy() {
    cancelReveal();
    window_.removeEventListener('click', handleToggle);
  }

  return { element, start, destroy };
}
