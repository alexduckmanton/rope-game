/**
 * Home View
 *
 * Main landing page with game title and difficulty selection buttons
 */

import { navigate } from '../router.js';
import { getFormattedDate } from '../seededRandom.js';
import { isDailyCompleted, isTutorialCompleted, isDailyCompletedWithViewedSolution } from '../persistence.js';
import { initIcons } from '../icons.js';

/**
 * Update button completed state based on completion status
 * @param {HTMLElement} button - The button element
 * @param {boolean} isCompleted - Whether the associated puzzle is completed
 * @param {string} icon - Icon name to use ('trophy', 'x-circle', 'check', etc.)
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

  // Get button elements
  const tutorialBtn = document.getElementById('tutorial-btn');
  const easyBtn = document.getElementById('easy-btn');
  const mediumBtn = document.getElementById('medium-btn');
  const hardBtn = document.getElementById('hard-btn');
  const unlimitedBtn = document.getElementById('unlimited-btn');

  // Update completed state icons
  updateCompletedState(tutorialBtn, isTutorialCompleted(), 'check');

  // Check if daily puzzles were completed with viewed solution (x-circle icon) or normally (trophy icon)
  const easyViewedSolution = isDailyCompletedWithViewedSolution('easy');
  const mediumViewedSolution = isDailyCompletedWithViewedSolution('medium');
  const hardViewedSolution = isDailyCompletedWithViewedSolution('hard');

  updateCompletedState(easyBtn, isDailyCompleted('easy') || easyViewedSolution, easyViewedSolution ? 'x-circle' : 'trophy');
  updateCompletedState(mediumBtn, isDailyCompleted('medium') || mediumViewedSolution, mediumViewedSolution ? 'x-circle' : 'trophy');
  updateCompletedState(hardBtn, isDailyCompleted('hard') || hardViewedSolution, hardViewedSolution ? 'x-circle' : 'trophy');

  // Re-initialize icons after updating attributes
  initIcons();

  // Event handlers - pass fromHome state to track navigation origin
  const handleTutorial = () => navigate('/tutorial?page=1', false, { fromHome: true });
  const handleEasy = () => navigate('/play?difficulty=easy', false, { fromHome: true });
  const handleMedium = () => navigate('/play?difficulty=medium', false, { fromHome: true });
  const handleHard = () => navigate('/play?difficulty=hard', false, { fromHome: true });
  const handleUnlimited = () => navigate('/play?difficulty=unlimited', false, { fromHome: true });

  // Attach listeners
  tutorialBtn.addEventListener('click', handleTutorial);
  easyBtn.addEventListener('click', handleEasy);
  mediumBtn.addEventListener('click', handleMedium);
  hardBtn.addEventListener('click', handleHard);
  unlimitedBtn.addEventListener('click', handleUnlimited);

  // Return cleanup function
  return () => {
    tutorialBtn.removeEventListener('click', handleTutorial);
    easyBtn.removeEventListener('click', handleEasy);
    mediumBtn.removeEventListener('click', handleMedium);
    hardBtn.removeEventListener('click', handleHard);
    unlimitedBtn.removeEventListener('click', handleUnlimited);
  };
}
