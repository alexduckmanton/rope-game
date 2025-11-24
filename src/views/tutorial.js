/**
 * Tutorial View
 *
 * Placeholder tutorial page with back button
 * Will be enhanced later with interactive tutorial steps
 */

import { navigate } from '../router.js';

/**
 * Initialize the tutorial view
 * Sets up back button handler
 * @returns {Function|null} Cleanup function
 */
export function initTutorial() {
  // Get button element
  const backBtn = document.getElementById('tutorial-back-btn');

  // Event handler - smart navigation based on how user arrived
  const handleBack = () => {
    // If we came from home, go back to original entry
    // Otherwise (direct URL visit), replace with home
    if (history.state?.fromHome) {
      history.back();
    } else {
      navigate('/', true);
    }
  };

  // Attach listener
  backBtn.addEventListener('click', handleBack);

  // Return cleanup function
  return () => {
    backBtn.removeEventListener('click', handleBack);
  };
}
