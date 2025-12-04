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
 * Predefined color schemes for icon and background
 */
const COLOR_SCHEMES = {
  neutral: {
    iconColor: '#6B7280',      // Medium grey
    backgroundColor: '#F3F4F6' // Light grey
  },
  success: {
    iconColor: '#10B981',      // Rich green
    backgroundColor: '#D1FAE5' // Pale green
  },
  error: {
    iconColor: '#EF4444',      // Rich red
    backgroundColor: '#FEE2E2' // Pale red
  },
  info: {
    iconColor: '#3B82F6',      // Rich blue
    backgroundColor: '#DBEAFE' // Pale blue
  },
  warning: {
    iconColor: '#F59E0B',      // Rich amber
    backgroundColor: '#FEF3C7' // Pale amber
  }
};

/**
 * Create a bottom sheet component
 * @param {Object} options
 * @param {string} options.title - Title displayed in the header
 * @param {HTMLElement|string} options.content - Content to display (HTMLElement or HTML string)
 * @param {string} [options.icon] - Optional Lucide icon name (e.g., 'settings', 'party-popper', 'circle-off')
 * @param {string} [options.colorScheme='neutral'] - Color scheme: 'neutral', 'success', 'error', 'info', 'warning'
 * @param {string} [options.dismissLabel='Close'] - Label for the dismiss button at bottom
 * @param {Function} [options.onClose] - Optional callback when sheet is closed (via dismiss button or click-outside)
 * @returns {Object} - Object with show(), hide(), destroy() methods
 */
export function createBottomSheet({ title, content, icon, colorScheme = 'neutral', dismissLabel = 'Close', onClose }) {
  // Create overlay (backdrop + container)
  const overlay = document.createElement('div');
  overlay.className = 'bottom-sheet-overlay';

  // Create sheet (the actual sliding panel)
  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';

  // Get color scheme
  const colors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.neutral;

  // Create optional icon container (if icon is specified)
  let iconContainer = null;
  if (icon) {
    iconContainer = document.createElement('div');
    iconContainer.className = 'bottom-sheet-icon-container';
    iconContainer.style.backgroundColor = colors.backgroundColor;
    iconContainer.innerHTML = `<i data-lucide="${icon}" width="40" height="40" style="color: ${colors.iconColor}"></i>`;
  }

  // Create header with centered title (no close button)
  const header = document.createElement('div');
  header.className = 'bottom-sheet-header';

  const titleEl = document.createElement('h2');
  titleEl.textContent = title;

  header.appendChild(titleEl);

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

  // Create dismiss button at bottom
  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'bottom-sheet-dismiss-btn';
  dismissBtn.textContent = dismissLabel;

  // Assemble the sheet
  if (iconContainer) {
    sheet.appendChild(iconContainer);
  }
  sheet.appendChild(header);
  sheet.appendChild(contentContainer);
  sheet.appendChild(dismissBtn);
  overlay.appendChild(sheet);

  // Event handlers
  const handleClose = () => hide();
  const handleOverlayClick = (e) => {
    // Close if clicking on the overlay backdrop (not the sheet itself)
    if (e.target === overlay) {
      hide();
    }
  };

  dismissBtn.addEventListener('click', handleClose);
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

    // Initialize Lucide icons for the icon container (if present)
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
    dismissBtn.removeEventListener('click', handleClose);
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
