/**
 * Home View
 *
 * Main landing page with game title, streak line and difficulty selection buttons
 */

import { navigate } from '../router.js';
import { isDailyCompleted, isTutorialCompleted, isDailyCompletedWithViewedSolution, isDailyManuallyFinished, getStreak, getOverallStreak } from '../persistence.js';
import { initIcons } from '../icons.js';
import { showTutorialSheet } from '../components/tutorialSheet.js';
import { trackDifficultySelected } from '../analytics.js';

/**
 * Difficulties in the order they appear on screen, which is also the order the
 * streak line cycles through them
 */
const DIFFICULTIES = ['easy', 'medium', 'hard'];

/**
 * Update button completed state based on completion status
 * @param {HTMLElement} button - The button element
 * @param {boolean} isCompleted - Whether the associated puzzle is completed
 * @param {string} icon - Icon name to use ('trophy', 'skull', 'check', etc.)
 */
function updateCompletedState(button, isCompleted, icon = 'trophy') {
  if (isCompleted) {
    button.classList.add('completed');
    // Update the icon based on completion type
    const iconElement = button.querySelector('.btn-complete-icon');
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
  } else {
    button.classList.remove('completed');
  }
}

/**
 * Update daily puzzle button with appropriate completion icon
 * Shows trophy for legitimate wins, check for manually finished, skull for viewed solutions
 * Priority: trophy > check > skull
 *
 * @param {HTMLElement} button - The difficulty button element
 * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard')
 */
function updateDailyButtonState(button, difficulty) {
  const won = isDailyCompleted(difficulty);
  const manuallyFinished = isDailyManuallyFinished(difficulty);
  const viewedSolution = isDailyCompletedWithViewedSolution(difficulty);
  const isCompleted = won || manuallyFinished || viewedSolution;

  // Priority: trophy > check > skull
  let icon = 'skull'; // default
  if (won) {
    icon = 'trophy';
  } else if (manuallyFinished) {
    icon = 'check';
  }

  updateCompletedState(button, isCompleted, icon);
}

/**
 * Build the list of streaks the streak line cycles through
 *
 * The overall streak comes first, followed by every difficulty that currently
 * has a live streak of its own. Difficulties with no streak are left out, so
 * tapping never lands on "0 day streak".
 *
 * @returns {Array<{label: string}>} Streaks to cycle through, overall first
 */
function buildStreakCycle() {
  const overall = getOverallStreak();
  if (overall.current === 0) return [];

  const cycle = [{ label: `${overall.current} day streak` }];

  for (const difficulty of DIFFICULTIES) {
    const streak = getStreak(difficulty);
    if (streak.current === 0) continue;

    // Difficulty stays lowercase so the line reads as a sentence - a
    // capitalised word mid-phrase reads as a label instead
    cycle.push({ label: `${streak.current} day ${difficulty} streak` });
  }

  return cycle;
}

/**
 * Set up the streak line above the difficulty buttons
 *
 * Hidden entirely when there is no live streak. Tapping the line steps through
 * the per-difficulty streaks and wraps back to the overall one - an easter egg
 * rather than a control, so it carries no button affordance.
 *
 * @returns {Function|null} Cleanup function, or null if the line is hidden
 */
function initStreakLine() {
  const streakEl = document.getElementById('home-streak');
  const textEl = document.getElementById('home-streak-text');
  if (!streakEl || !textEl) return null;

  const cycle = buildStreakCycle();

  if (cycle.length === 0) {
    streakEl.classList.remove('visible');
    return null;
  }

  let index = 0;
  textEl.textContent = cycle[index].label;
  streakEl.classList.add('visible');

  // A single entry means there is nothing to cycle to
  if (cycle.length === 1) return null;

  const handleCycle = () => {
    index = (index + 1) % cycle.length;
    textEl.textContent = cycle[index].label;
  };

  streakEl.addEventListener('click', handleCycle);

  return () => streakEl.removeEventListener('click', handleCycle);
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

  // Once the tutorial has been seen it stops earning its place on the home
  // screen, so hide it rather than marking it complete
  tutorialBtn.style.display = isTutorialCompleted() ? 'none' : '';

  // Update daily puzzle buttons (trophy for wins, skull for viewed solutions)
  updateDailyButtonState(easyBtn, 'easy');
  updateDailyButtonState(mediumBtn, 'medium');
  updateDailyButtonState(hardBtn, 'hard');

  const cleanupStreakLine = initStreakLine();

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

  // Hide the tutorial button as soon as it is completed, without a reload
  const handleTutorialCompleted = () => {
    tutorialBtn.style.display = 'none';
  };
  window.addEventListener('tutorialCompleted', handleTutorialCompleted);

  // Return cleanup function
  return () => {
    tutorialBtn.removeEventListener('click', handleTutorial);
    easyBtn.removeEventListener('click', handleEasy);
    mediumBtn.removeEventListener('click', handleMedium);
    hardBtn.removeEventListener('click', handleHard);
    window.removeEventListener('tutorialCompleted', handleTutorialCompleted);
    if (cleanupStreakLine) cleanupStreakLine();
    // Temporarily hidden - page still works via direct URL
    // unlimitedBtn.removeEventListener('click', handleUnlimited);
  };
}
