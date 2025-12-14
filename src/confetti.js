/**
 * Confetti Effects Module
 *
 * Handles confetti animations for win celebrations.
 * Uses canvas-confetti library to create particle effects.
 */

import confetti from 'canvas-confetti';

/**
 * Color palette matching the success color scheme (gold/amber theme)
 * @see bottomSheet.js COLOR_SCHEMES.success
 */
const CONFETTI_COLORS = [
  '#F59E0B', // Rich amber/gold (primary) - 50% of confetti
  '#FEF3C7', // Pale golden yellow (background) - 30% of confetti
  '#FBBF24'  // Medium gold (accent) - 20% of confetti
];

/**
 * Animation delay to wait for bottom sheet slide-up animation to complete
 * Bottom sheet animation duration is 300ms (see style.css line 559)
 * Adding 50ms buffer for smooth timing
 */
const ANIMATION_DELAY_MS = 350;

/**
 * Fire confetti from the bottom sheet icon position.
 *
 * Heavy configuration with particles shooting upward from the party-popper icon.
 * Waits for bottom sheet animation to complete before firing.
 *
 * Configuration:
 * - 150 particles (heavy density)
 * - Shoots straight up (90°) with wide spread (145°)
 * - High velocity for dramatic effect
 * - Gold/amber color scheme
 * - ~3 second animation duration
 *
 * Usage:
 *   fireConfettiFromIcon(); // Call after showWinCelebration()
 */
export function fireConfettiFromIcon() {
  setTimeout(() => {
    // Find the bottom sheet icon container to calculate origin position
    const iconContainer = document.querySelector('.bottom-sheet-icon-container');

    let originX = 0.5; // Fallback: horizontal center
    let originY = 0.7; // Fallback: lower portion of screen

    if (iconContainer) {
      // Icon is 80px × 80px circle, overlapping top edge of bottom sheet
      // Calculate center point of the icon
      const rect = iconContainer.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Normalize to canvas coordinates (0-1 range)
      originX = centerX / window.innerWidth;
      originY = centerY / window.innerHeight;
    }

    // Fire heavy confetti burst
    confetti({
      particleCount: 150,      // Heavy density (100+ particles)
      angle: 90,               // Straight up
      spread: 145,             // Wide spread for full dramatic effect
      startVelocity: 60,       // High velocity to shoot particles upward
      gravity: 1.0,            // Standard gravity
      decay: 0.91,             // Natural fade rate
      origin: { x: originX, y: originY }, // Shoot from icon center
      colors: CONFETTI_COLORS, // Gold/amber theme
      scalar: 1.2,             // Slightly larger particles for visibility
      ticks: 300               // Animation duration (~3 seconds)
    });
  }, ANIMATION_DELAY_MS);
}
