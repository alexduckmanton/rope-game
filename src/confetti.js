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
 * Total duration of confetti animation (ticks / 60fps ≈ 3 seconds)
 * Adding buffer for cleanup timing
 */
const CONFETTI_DURATION_MS = 3500;

/**
 * Z-index for confetti canvas (must be above bottom sheet which is at 1001)
 */
const CONFETTI_Z_INDEX = 1002;

/**
 * Fire confetti from the bottom sheet icon position.
 *
 * Heavy configuration with particles shooting upward from the party-popper icon.
 * Waits for bottom sheet animation to complete before firing.
 *
 * Configuration:
 * - 150 particles (heavy density)
 * - Shoots straight up (90°) with focused spread (90°)
 * - Medium velocity for balanced effect
 * - Gold/amber color scheme
 * - ~3 second animation duration
 * - Renders above bottom sheet (z-index 1002)
 * - Non-blocking (pointer-events: none)
 *
 * Usage:
 *   fireConfettiFromIcon(); // Call after showWinCelebration()
 */
export function fireConfettiFromIcon() {
  setTimeout(() => {
    // Create dedicated canvas element for confetti
    // Positioned above bottom sheet with pointer-events: none to avoid blocking interactions
    const canvas = document.createElement('canvas');

    // Get device pixel ratio for high-DPI screens (Retina, etc.)
    const dpr = window.devicePixelRatio || 1;

    // Set canvas internal dimensions to match physical pixels for crisp rendering
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    // Set CSS dimensions to match viewport (100%)
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = CONFETTI_Z_INDEX.toString();
    canvas.style.pointerEvents = 'none'; // Don't block clicks on bottom sheet buttons
    document.body.appendChild(canvas);

    // Create confetti instance bound to this canvas
    const myConfetti = confetti.create(canvas, {
      resize: true, // Auto-resize canvas on window resize (handles DPR automatically)
      useWorker: true // Use web worker for better performance
    });

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
    myConfetti({
      particleCount: 150,      // Heavy density (100+ particles)
      angle: 90,               // Straight up
      spread: 90,              // Focused upward spread for concentrated effect
      startVelocity: 30,       // Medium velocity to shoot particles upward
      gravity: 1.0,            // Standard gravity
      decay: 0.91,             // Natural fade rate
      origin: { x: originX, y: originY }, // Shoot from icon center
      colors: CONFETTI_COLORS, // Gold/amber theme
      scalar: 1.2,             // Slightly larger particles for visibility
      ticks: 300               // Animation duration (~3 seconds)
    });

    // Clean up canvas after animation completes
    setTimeout(() => {
      document.body.removeChild(canvas);
    }, CONFETTI_DURATION_MS);
  }, ANIMATION_DELAY_MS);
}
