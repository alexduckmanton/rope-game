/**
 * Bottom Sheet Component
 *
 * Reusable bottom sheet with slide-up animations, close button,
 * and click-outside dismissal
 */

/**
 * Create a bottom sheet component
 * @param {Object} options
 * @param {string} options.title - Title displayed in the header
 * @param {HTMLElement|string} options.content - Content to display (HTMLElement or HTML string)
 * @returns {Object} - Object with show(), hide(), destroy() methods
 */
export function createBottomSheet({ title, content }) {
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

  // Add content (either HTML string or HTMLElement)
  if (typeof content === 'string') {
    contentContainer.innerHTML = content;
  } else if (content instanceof HTMLElement) {
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

    // Re-render Lucide icons for the close button
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  /**
   * Hide the bottom sheet with slide-down animation
   */
  function hide() {
    // Remove visible class to trigger slide-out animation
    overlay.classList.remove('visible');

    // Wait for animation to complete (300ms), then hide
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }

  /**
   * Destroy the bottom sheet and clean up event listeners
   */
  function destroy() {
    hide();

    // Clean up event listeners
    closeBtn.removeEventListener('click', handleClose);
    overlay.removeEventListener('click', handleOverlayClick);

    // Remove from DOM after animation completes
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 300);
  }

  return {
    show,
    hide,
    destroy
  };
}
