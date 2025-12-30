/**
 * Home View
 *
 * Main landing page with game title and difficulty selection buttons
 */

import { navigate } from '../router.js';
import { getFormattedDate } from '../seededRandom.js';
import { isDailyCompleted, isTutorialCompleted, isDailyCompletedWithViewedSolution, isDailyManuallyFinished } from '../persistence.js';
import { initIcons } from '../icons.js';
import { showTutorialSheet } from '../components/tutorialSheet.js';
import { trackDifficultySelected } from '../analytics.js';

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
  console.log('[DEBUG HOME] updateDailyButtonState for difficulty:', difficulty);
  const won = isDailyCompleted(difficulty);
  const manuallyFinished = isDailyManuallyFinished(difficulty);
  const viewedSolution = isDailyCompletedWithViewedSolution(difficulty);
  console.log('[DEBUG HOME] won:', won, 'manuallyFinished:', manuallyFinished, 'viewedSolution:', viewedSolution);
  const isCompleted = won || manuallyFinished || viewedSolution;

  // Priority: trophy > check > skull
  let icon = 'skull'; // default
  if (won) {
    icon = 'trophy';
  } else if (manuallyFinished) {
    icon = 'check';
  }

  console.log('[DEBUG HOME] isCompleted:', isCompleted, 'icon:', icon);
  updateCompletedState(button, isCompleted, icon);
}

/**
 * Initialize the home view
 * Sets up button click handlers for navigation
 * @returns {Function|null} Cleanup function (none needed for home view)
 */
export function initHome() {
  // Update tagline with current date
  const tagline = document.querySelector('.game-tagline');
  if (tagline) {
    tagline.textContent = getFormattedDate();
  }

  // TEMPORARY DEBUG: Check manually finished status and display in page title
  const easyManuallyFinished = isDailyManuallyFinished('easy');
  const mediumManuallyFinished = isDailyManuallyFinished('medium');
  const hardManuallyFinished = isDailyManuallyFinished('hard');
  document.title = `Loopy [E:${easyManuallyFinished?'✓':'✗'} M:${mediumManuallyFinished?'✓':'✗'} H:${hardManuallyFinished?'✓':'✗'}]`;

  // Get button elements
  const tutorialBtn = document.getElementById('tutorial-btn');
  const easyBtn = document.getElementById('easy-btn');
  const mediumBtn = document.getElementById('medium-btn');
  const hardBtn = document.getElementById('hard-btn');
  // Temporarily hidden - page still works via direct URL
  // const unlimitedBtn = document.getElementById('unlimited-btn');

  // Update completed state icons
  updateCompletedState(tutorialBtn, isTutorialCompleted(), 'check');

  // Update daily puzzle buttons (trophy for wins, skull for viewed solutions)
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
    updateCompletedState(tutorialBtn, true, 'check');
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
