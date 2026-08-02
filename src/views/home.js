/**
 * Home View
 *
 * Main landing page with game title and difficulty selection buttons
 */

import { navigate } from '../router.js';
import { isDailyCompleted, isTutorialCompleted, isDailyCompletedWithViewedSolution, isDailyManuallyFinished, getStreak, getDailyCompletionTime } from '../persistence.js';
import { initIcons } from '../icons.js';
import { showTutorialSheet } from '../components/tutorialSheet.js';
import { trackDifficultySelected } from '../analytics.js';

/**
 * Set the contents of a button's streak badge
 *
 * @param {HTMLElement} button - The button element
 * @param {string} icon - Icon name to use ('trophy', 'skull', 'check', etc.)
 * @param {number} [count] - Streak count (hidden when 0)
 */
function setButtonBadge(button, icon, count = 0) {
  const badge = button.querySelector('.btn-streak-badge');
  if (!badge) return;

  const iconElement = badge.querySelector('.btn-complete-icon');
  if (iconElement) {
    // Lucide replaces <i> tags with <svg> elements, so we need to replace the element entirely
    const newIcon = document.createElement('i');
    newIcon.className = 'btn-complete-icon';
    newIcon.setAttribute('data-lucide', icon);
    newIcon.setAttribute('width', '20');
    newIcon.setAttribute('height', '20');

    // Replace the old element (which is now an SVG) with a fresh <i> tag
    iconElement.replaceWith(newIcon);
  }

  const countElement = badge.querySelector('.btn-streak-count');
  if (countElement) {
    countElement.textContent = count > 0 ? `×${count}` : '';
  }
}

/**
 * Update the tutorial button's completed state
 * @param {HTMLElement} button - The tutorial button element
 */
function updateTutorialButtonState(button) {
  button.classList.toggle('completed', isTutorialCompleted());
  setButtonBadge(button, 'check');
}

/**
 * Set the "completed today" badge (check + completion time) on a button
 * @param {HTMLElement} button - The difficulty button element
 * @param {string|null} time - Formatted completion time, or null if unknown
 */
function setTodayBadge(button, time) {
  const timeElement = button.querySelector('.btn-today-time');
  if (timeElement) {
    timeElement.textContent = time || '';
  }
}

/**
 * Update daily puzzle button with today's result and its streak
 *
 * Two badges sit on the button, splitting "today" from "history" so the two
 * are never confused:
 *
 * - Left, green: only present when today's puzzle has been completed, showing
 *   a check and how long it took.
 * - Right, gold or transparent: the streak. Gold once today counts toward it,
 *   transparent while the streak is carried over from previous days, so the
 *   button doubles as a "you haven't played today" cue.
 *
 * The streak icon reflects today's result: trophy for a win, check for a
 * manual finish, skull for a viewed solution. When today hasn't been played,
 * the trophy stands in for the streak from previous days.
 *
 * @param {HTMLElement} button - The difficulty button element
 * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard')
 */
function updateDailyButtonState(button, difficulty) {
  const won = isDailyCompleted(difficulty);
  const manuallyFinished = isDailyManuallyFinished(difficulty);
  const viewedSolution = isDailyCompletedWithViewedSolution(difficulty);
  const isCompleted = won || manuallyFinished || viewedSolution;
  const streak = getStreak(difficulty);

  // Priority: trophy > check > skull
  let icon = 'trophy'; // default (also used for a streak with today unplayed)
  if (!won && manuallyFinished) {
    icon = 'check';
  } else if (!won && viewedSolution) {
    icon = 'skull';
  }

  // The green badge marks a genuine completion, so a viewed solution does not
  // qualify - that result is conveyed by the skull on the streak badge instead
  const completedToday = won || manuallyFinished;

  button.classList.toggle('completed', isCompleted);
  button.classList.toggle('completed-today', completedToday);
  button.classList.toggle('has-streak', streak.current > 0);
  button.classList.toggle('streak-active', streak.completedToday);

  setButtonBadge(button, icon, streak.current);
  setTodayBadge(button, completedToday ? getDailyCompletionTime(difficulty) : null);
}

/**
 * Initialize the home view
 * Sets up button click handlers for navigation
 * @returns {Function|null} Cleanup function (none needed for home view)
 */
export function initHome() {
  // Get button elements
  const tutorialBtn = document.getElementById('tutorial-btn');
  const easyBtn = document.getElementById('easy-btn');
  const mediumBtn = document.getElementById('medium-btn');
  const hardBtn = document.getElementById('hard-btn');
  // Temporarily hidden - page still works via direct URL
  // const unlimitedBtn = document.getElementById('unlimited-btn');

  // Update completed state icons
  updateTutorialButtonState(tutorialBtn);

  // Update daily puzzle buttons (icon for today's result, badge for the streak)
  updateDailyButtonState(easyBtn, 'easy');
  updateDailyButtonState(mediumBtn, 'medium');
  updateDailyButtonState(hardBtn, 'hard');

  // Re-initialize icons after updating attributes
  initIcons();

  // Event handlers - pass fromHome state to track navigation origin
  const handleTutorial = () => showTutorialSheet('home');
  const handleEasy = () => {
    trackDifficultySelected('easy');
    navigate('/play?difficulty=easy', false, { fromHome: true });
  };
  const handleMedium = () => {
    trackDifficultySelected('medium');
    navigate('/play?difficulty=medium', false, { fromHome: true });
  };
  const handleHard = () => {
    trackDifficultySelected('hard');
    navigate('/play?difficulty=hard', false, { fromHome: true });
  };
  // Temporarily hidden - page still works via direct URL
  // const handleUnlimited = () => navigate('/play?difficulty=unlimited', false, { fromHome: true });

  // Attach listeners
  tutorialBtn.addEventListener('click', handleTutorial);
  easyBtn.addEventListener('click', handleEasy);
  mediumBtn.addEventListener('click', handleMedium);
  hardBtn.addEventListener('click', handleHard);
  // Temporarily hidden - page still works via direct URL
  // unlimitedBtn.addEventListener('click', handleUnlimited);

  // Listen for tutorial completion to update checkmark immediately
  const handleTutorialCompleted = () => {
    updateTutorialButtonState(tutorialBtn);
    initIcons();
  };
  window.addEventListener('tutorialCompleted', handleTutorialCompleted);

  // Return cleanup function
  return () => {
    tutorialBtn.removeEventListener('click', handleTutorial);
    easyBtn.removeEventListener('click', handleEasy);
    mediumBtn.removeEventListener('click', handleMedium);
    hardBtn.removeEventListener('click', handleHard);
    window.removeEventListener('tutorialCompleted', handleTutorialCompleted);
    // Temporarily hidden - page still works via direct URL
    // unlimitedBtn.removeEventListener('click', handleUnlimited);
  };
}
