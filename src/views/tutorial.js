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

  // Event handler
  const handleBack = () => navigate('/');

  // Attach listener
  backBtn.addEventListener('click', handleBack);

  // Return cleanup function
  return () => {
    backBtn.removeEventListener('click', handleBack);
  };
}
