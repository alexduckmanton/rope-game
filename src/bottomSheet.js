/**
 * Bottom Sheet Component
 *
 * Reusable bottom sheet with slide-up animations, close button,
 * and click-outside dismissal
 */

import { initIcons } from './icons.js';
import { semantic } from './tokens.js';

/**
 * Animation duration for show/hide transitions (must match CSS transition duration)
 * @see style.css .bottom-sheet transition property (line 526)
 */
const ANIMATION_DURATION_MS = 300;

/**
 * Predefined color schemes for icon and background
 * Colors are imported from design tokens (see tokens.js)
 */
const COLOR_SCHEMES = {
  neutral: {
    iconColor: semantic.neutral,        // Medium grey
    backgroundColor: semantic.neutralBg // Light grey
  },
  success: {
    iconColor: semantic.successIcon,    // Rich amber/gold
    backgroundColor: semantic.successBg // Pale golden yellow
  },
  partial: {
    iconColor: semantic.partial,        // Rich green
    backgroundColor: semantic.partialBg // Pale green
  },
  error: {
    iconColor: semantic.error,          // Rich red
    backgroundColor: semantic.errorBg   // Pale red
  },
  info: {
    iconColor: semantic.info,           // Rich blue
    backgroundColor: semantic.infoBg    // Pale blue
  },
  warning: {
    iconColor: semantic.warning,        // Rich amber
    backgroundColor: semantic.warningBg // Pale amber
  }
};

/**
 * Create a bottom sheet component
 * @param {Object} options
 * @param {string} options.title - Title displayed in the header
 * @param {HTMLElement|string} options.content - Content to display (HTMLElement or HTML string)
 * @param {string} [options.icon] - Optional Lucide icon name (e.g., 'settings', 'party-popper', 'circle-off')
 * @param {string} [options.colorScheme='neutral'] - Color scheme: 'neutral', 'success', 'partial', 'error', 'info', 'warning'
 * @param {string|null} [options.dismissLabel='Close'] - Label for the dismiss button at bottom. Pass null to hide the dismiss button.
 * @param {string} [options.dismissVariant='secondary'] - Dismiss button variant: 'primary' or 'secondary'
 * @param {boolean} [options.showCloseIcon=false] - Show X icon button at top-right corner
 * @param {Object} [options.primaryButton] - Optional primary action button above dismiss
 * @param {string} options.primaryButton.label - Button text
 * @param {string} [options.primaryButton.icon] - Optional Lucide icon name for the button
 * @param {string} [options.primaryButton.variant='primary'] - Button variant: 'primary', 'secondary', or 'destructive'
 * @param {Function} options.primaryButton.onClick - Click handler (receives button element as argument)
 * @param {Function} [options.onClose] - Optional callback when sheet is closed (via dismiss button or click-outside)
 * @returns {Object} - Object with show(), hide(), destroy() methods
 */
export function createBottomSheet({ title, content, icon, colorScheme = 'neutral', dismissLabel = 'Close', dismissVariant = 'secondary', showCloseIcon = false, primaryButton, onClose }) {
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

  // Create optional close icon button (top-right corner)
  let closeIconBtn = null;
  if (showCloseIcon) {
    closeIconBtn = document.createElement('button');
    closeIconBtn.className = 'bottom-sheet-close-icon';
    closeIconBtn.setAttribute('aria-label', 'Close');
    closeIconBtn.innerHTML = '<i data-lucide="x" width="24" height="24"></i>';
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

  // Create buttons container and buttons
  let buttonsContainer;
  let primaryBtn = null;
  let dismissBtn = null;

  // Only create dismiss button if dismissLabel is provided (not null/undefined)
  const hasDismissButton = dismissLabel !== null && dismissLabel !== undefined;

  // Determine dismiss button class based on variant
  const dismissBtnClass = dismissVariant === 'primary'
    ? 'bottom-sheet-btn bottom-sheet-btn-primary'
    : 'bottom-sheet-btn bottom-sheet-btn-secondary';

  if (primaryButton) {
    // Use buttons container when we have multiple buttons
    buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'bottom-sheet-buttons';

    // Determine primary button class based on variant
    const primaryBtnVariant = primaryButton.variant || 'primary';
    let primaryBtnClass;
    if (primaryBtnVariant === 'destructive') {
      primaryBtnClass = 'bottom-sheet-btn bottom-sheet-btn-destructive';
    } else if (primaryBtnVariant === 'secondary') {
      primaryBtnClass = 'bottom-sheet-btn bottom-sheet-btn-secondary';
    } else {
      primaryBtnClass = 'bottom-sheet-btn bottom-sheet-btn-primary';
    }

    // Create primary button
    primaryBtn = document.createElement('button');
    primaryBtn.className = primaryBtnClass;
    if (primaryButton.icon) {
      primaryBtn.innerHTML = `<i data-lucide="${primaryButton.icon}"></i><span>${primaryButton.label}</span>`;
    } else {
      primaryBtn.textContent = primaryButton.label;
    }

    buttonsContainer.appendChild(primaryBtn);

    // Create dismiss button only if dismissLabel is provided
    if (hasDismissButton) {
      dismissBtn = document.createElement('button');
      dismissBtn.className = dismissBtnClass;
      dismissBtn.textContent = dismissLabel;
      buttonsContainer.appendChild(dismissBtn);
    }
  } else if (hasDismissButton) {
    // Single dismiss button (only if dismissLabel is provided)
    dismissBtn = document.createElement('button');
    dismissBtn.className = dismissBtnClass;
    // Add margin styles for standalone button (not in container)
    dismissBtn.style.width = 'calc(100% - 40px)';
    dismissBtn.style.margin = '24px 20px 20px 20px';
    dismissBtn.textContent = dismissLabel;
  }

  // Assemble the sheet
  if (closeIconBtn) {
    sheet.appendChild(closeIconBtn);
  }
  if (iconContainer) {
    sheet.appendChild(iconContainer);
  }
  sheet.appendChild(header);
  sheet.appendChild(contentContainer);
  if (buttonsContainer) {
    sheet.appendChild(buttonsContainer);
  } else if (dismissBtn) {
    sheet.appendChild(dismissBtn);
  }
  overlay.appendChild(sheet);

  // Event handlers
  const handleClose = () => hide();
  const handleCloseIconClick = () => hide(true); // Close icon dismisses only, doesn't trigger onClose
  const handleOverlayClick = (e) => {
    // Close if clicking on the overlay backdrop (not the sheet itself)
    if (e.target === overlay) {
      hide();
    }
  };
  const handlePrimaryClick = primaryButton ? () => primaryButton.onClick(primaryBtn) : null;

  if (closeIconBtn) {
    closeIconBtn.addEventListener('click', handleCloseIconClick);
  }
  if (dismissBtn) {
    dismissBtn.addEventListener('click', handleClose);
  }
  overlay.addEventListener('click', handleOverlayClick);
  if (primaryBtn && handlePrimaryClick) {
    primaryBtn.addEventListener('click', handlePrimaryClick);
  }

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
   * @param {boolean} suppressOnClose - If true, don't call onClose callback (used by destroy)
   */
  function hide(suppressOnClose = false) {
    // Remove visible class to trigger slide-out animation
    overlay.classList.remove('visible');

    // Wait for animation to complete, then hide
    setTimeout(() => {
      overlay.style.display = 'none';

      // Call onClose callback if provided (unless suppressed by destroy)
      if (!suppressOnClose && onClose && typeof onClose === 'function') {
        onClose();
      }
    }, ANIMATION_DURATION_MS);
  }

  /**
   * Destroy the bottom sheet and clean up event listeners
   * Note: Does NOT trigger onClose callback - use for cleanup only
   */
  function destroy() {
    // Suppress onClose when destroying (cleanup should not trigger navigation)
    hide(true);

    // Clean up event listeners
    if (closeIconBtn) {
      closeIconBtn.removeEventListener('click', handleCloseIconClick);
    }
    if (dismissBtn) {
      dismissBtn.removeEventListener('click', handleClose);
    }
    overlay.removeEventListener('click', handleOverlayClick);
    if (primaryBtn && handlePrimaryClick) {
      primaryBtn.removeEventListener('click', handlePrimaryClick);
    }

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
