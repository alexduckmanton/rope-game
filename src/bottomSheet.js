/**
 * Bottom Sheet Component
 *
 * Reusable bottom sheet with slide-up animations, close button,
 * and click-outside dismissal
 */

import { initIcons } from './icons.js';

/**
 * Animation duration for show/hide transitions (must match CSS transition duration)
 * @see style.css .bottom-sheet transition property (line 526)
 */
const ANIMATION_DURATION_MS = 300;

/**
 * Create a bottom sheet component
 * @param {Object} options
 * @param {string} options.title - Title displayed in the header
 * @param {HTMLElement|string} options.content - Content to display (HTMLElement or HTML string)
 * @param {Function} [options.onClose] - Optional callback when sheet is closed (via X or click-outside)
 * @returns {Object} - Object with show(), hide(), destroy() methods
 */
export function createBottomSheet({ title, content, onClose }) {
  // Create overlay (backdrop + container)
  const overlay = document.createElement('div');
  overlay.className = 'bottom-sheet-overlay';

  // Create sheet (the actual sliding panel)
  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';

  // Create header with title and close button
  const header = document.createElement('div');
  header.className = 'bottom-sheet-header';

  const titleEl = document.createElement('h2');
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'bottom-sheet-close-btn';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '<i data-lucide="x" width="24" height="24"></i>';

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  // Create content container
  const contentContainer = document.createElement('div');
  contentContainer.className = 'bottom-sheet-content';

  // Track original parent for HTMLElement content (so we can restore it on destroy)
  let originalParent = null;
  let originalNextSibling = null;
  let contentElement = null;

  // Add content (either HTML string or HTMLElement)
  if (typeof content === 'string') {
    contentContainer.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    // Store reference to original location
    contentElement = content;
    originalParent = content.parentNode;
    originalNextSibling = content.nextSibling;

    // Remove any inline display style that might hide the content
    content.style.display = '';
    contentContainer.appendChild(content);
  }

  // Assemble the sheet
  sheet.appendChild(header);
  sheet.appendChild(contentContainer);
  overlay.appendChild(sheet);

  // Event handlers
  const handleClose = () => hide();
  const handleOverlayClick = (e) => {
    // Close if clicking on the overlay backdrop (not the sheet itself)
    if (e.target === overlay) {
      hide();
    }
  };

  closeBtn.addEventListener('click', handleClose);
  overlay.addEventListener('click', handleOverlayClick);

  /**
   * Show the bottom sheet with slide-up animation
   */
  function show() {
    // Add to DOM if not already present
    if (!overlay.parentNode) {
      document.body.appendChild(overlay);
    }

    // Show overlay (still off-screen due to transform)
    overlay.style.display = 'block';

    // Force reflow to ensure display:block is applied before transition
    overlay.offsetHeight;

    // Trigger slide-up animation
    overlay.classList.add('visible');

    // Initialize Lucide icons for the close button
    initIcons();
  }

  /**
   * Hide the bottom sheet with slide-down animation
   */
  function hide() {
    // Remove visible class to trigger slide-out animation
    overlay.classList.remove('visible');

    // Wait for animation to complete, then hide
    setTimeout(() => {
      overlay.style.display = 'none';

      // Call onClose callback if provided
      if (onClose && typeof onClose === 'function') {
        onClose();
      }
    }, ANIMATION_DURATION_MS);
  }

  /**
   * Destroy the bottom sheet and clean up event listeners
   */
  function destroy() {
    hide();

    // Clean up event listeners
    closeBtn.removeEventListener('click', handleClose);
    overlay.removeEventListener('click', handleOverlayClick);

    // Restore HTMLElement content to its original location before removing overlay
    setTimeout(() => {
      if (contentElement && originalParent) {
        // Hide the content before moving it back
        contentElement.style.display = 'none';

        // Restore to original location
        if (originalNextSibling) {
          originalParent.insertBefore(contentElement, originalNextSibling);
        } else {
          originalParent.appendChild(contentElement);
        }
      }

      // Remove overlay from DOM
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, ANIMATION_DURATION_MS);
  }

  return {
    show,
    hide,
    destroy
  };
}

/**
 * Create and show a bottom sheet asynchronously after render completes
 *
 * This is a convenience helper for one-time notifications (win/feedback messages)
 * that need to wait for render to complete before showing.
 *
 * For persistent sheets that are shown/hidden multiple times (like settings),
 * use createBottomSheet() directly and call show()/hide() as needed.
 *
 * @param {Object} options - Same options as createBottomSheet
 * @param {string} options.title - Title displayed in the header
 * @param {HTMLElement|string} options.content - Content to display
 * @param {Function} [options.onClose] - Optional callback when sheet is closed
 * @returns {Object} - The created bottom sheet instance (with show, hide, destroy methods)
 *
 * @example
 * // One-time notification (no need to store reference)
 * showBottomSheetAsync({
 *   title: 'Success!',
 *   content: '<div class="bottom-sheet-message">You won!</div>'
 * });
 *
 * // With navigation callback
 * showBottomSheetAsync({
 *   title: 'Complete!',
 *   content: '<div class="bottom-sheet-message">Moving on...</div>',
 *   onClose: () => navigate('/next')
 * });
 */
export function showBottomSheetAsync(options) {
  const sheet = createBottomSheet(options);

  // Wait for render to complete before showing
  // This prevents visual glitches when showing immediately after state changes
  requestAnimationFrame(() => {
    setTimeout(() => {
      sheet.show();
    }, 0);
  });

  return sheet;
}
