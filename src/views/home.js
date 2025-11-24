/**
 * Home View
 *
 * Main landing page with game title and difficulty selection buttons
 */

import { navigate } from '../router.js';

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

  // Event handlers - pass fromHome state to track navigation origin
  const handleTutorial = () => navigate('/tutorial', false, { fromHome: true });
  const handleEasy = () => navigate('/play?difficulty=easy', false, { fromHome: true });
  const handleMedium = () => navigate('/play?difficulty=medium', false, { fromHome: true });
  const handleHard = () => navigate('/play?difficulty=hard', false, { fromHome: true });

  // Attach listeners
  tutorialBtn.addEventListener('click', handleTutorial);
  easyBtn.addEventListener('click', handleEasy);
  mediumBtn.addEventListener('click', handleMedium);
  hardBtn.addEventListener('click', handleHard);

  // Return cleanup function
  return () => {
    tutorialBtn.removeEventListener('click', handleTutorial);
    easyBtn.removeEventListener('click', handleEasy);
    mediumBtn.removeEventListener('click', handleMedium);
    hardBtn.removeEventListener('click', handleHard);
  };
}
