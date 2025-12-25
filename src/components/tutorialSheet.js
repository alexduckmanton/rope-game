/**
 * Tutorial Bottom Sheet Component
 *
 * Self-contained tutorial that can be opened from anywhere in the app.
 * Shows a multi-section walkthrough with video demonstrations.
 */

import { showBottomSheetAsync } from '../bottomSheet.js';
import { initIcons } from '../icons.js';
import { markTutorialCompleted } from '../persistence.js';
import {
  trackTutorialOpened,
  trackTutorialSectionViewed,
  trackTutorialCompleted
} from '../analytics.js';

// Tutorial lesson content
const LESSON_SECTIONS = [
  {
    body: 'Drag to draw a closed loop of any shape. Tap to erase parts of your loop.',
    name: 'Drawing loops'
  },
  {
    body: 'Whenever your path bends in the squares on or around a number, the number counts down.',
    name: 'Counting bends'
  },
  {
    body: 'To win, draw a single continuous loop that makes all numbers zero.',
    name: 'Win condition'
  }
];

// Configuration constants
const VIDEO_VISIBILITY_THRESHOLD = 0.5; // Video plays when 50% visible

// Module state - videos created once and cached for entire session
let tutorialVideos = [];
let activeSheet = null;
let scrollContainer = null;
let pagingDots = [];
let intersectionObserver = null;
let lastTrackedSection = -1; // Track last section to avoid duplicate analytics events

/**
 * Create a single video element with sources and attributes
 * @param {number} videoNumber - The tutorial video number (1-3)
 * @returns {HTMLVideoElement} Configured video element
 */
function buildVideoElement(videoNumber) {
  const video = document.createElement('video');
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  video.muted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = 'auto';

  // Prefer webm, fallback to mp4
  const webmSource = document.createElement('source');
  webmSource.src = `/videos/tutorial-${videoNumber}.webm`;
  webmSource.type = 'video/webm';
  video.appendChild(webmSource);

  const mp4Source = document.createElement('source');
  mp4Source.src = `/videos/tutorial-${videoNumber}.mp4`;
  mp4Source.type = 'video/mp4';
  video.appendChild(mp4Source);

  return video;
}

/**
 * Create a tutorial section with video and message
 * @param {number} sectionIndex - The lesson section index (0-2)
 * @returns {HTMLElement} Section element with video and message
 */
function createTutorialSection(sectionIndex) {
  const section = document.createElement('div');
  section.className = 'tutorial-section';
  section.dataset.sectionIndex = sectionIndex;

  // Video container with skeleton loader
  const videoContainer = document.createElement('div');
  videoContainer.className = 'bottom-sheet-video-container';

  const skeleton = document.createElement('div');
  skeleton.className = 'bottom-sheet-video-skeleton';
  videoContainer.appendChild(skeleton);

  // Get the pre-created video
  const video = tutorialVideos[sectionIndex];
  video.currentTime = 0; // Reset to beginning

  // Remove skeleton when video is ready
  const removeSkeletonHandler = () => {
    if (skeleton.parentNode) {
      skeleton.remove();
    }
  };

  if (video.readyState >= 3) {
    removeSkeletonHandler();
  } else {
    video.addEventListener('canplay', removeSkeletonHandler, { once: true });
  }

  videoContainer.appendChild(video);
  section.appendChild(videoContainer);

  // Message below video
  const message = document.createElement('div');
  message.className = 'tutorial-section-message';
  message.innerHTML = `<p>${LESSON_SECTIONS[sectionIndex].body}</p>`;
  section.appendChild(message);

  return section;
}

/**
 * Get current section index based on scroll position
 * @returns {number} Current section index (0-2)
 */
function getCurrentSectionIndex() {
  if (!scrollContainer) return 0;
  const scrollLeft = scrollContainer.scrollLeft;
  const sectionWidth = scrollContainer.offsetWidth;
  return Math.round(scrollLeft / sectionWidth);
}

/**
 * Update paging dots to reflect current section
 */
function updatePagingDots() {
  const currentIndex = getCurrentSectionIndex();
  pagingDots.forEach((dot, index) => {
    if (index === currentIndex) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });

  // Track section view when scrolling (only once per section)
  if (currentIndex !== lastTrackedSection && currentIndex >= 0 && currentIndex < LESSON_SECTIONS.length) {
    lastTrackedSection = currentIndex;
    trackTutorialSectionViewed(
      currentIndex,
      LESSON_SECTIONS[currentIndex].name,
      'scroll'
    );
  }
}

/**
 * Update next button text based on current section
 * @param {HTMLElement} nextBtn - Next button element
 */
function updateNextButton(nextBtn) {
  const currentIndex = getCurrentSectionIndex();
  const isLastSection = currentIndex === LESSON_SECTIONS.length - 1;
  nextBtn.textContent = isLastSection ? 'Got it' : 'Next';
}

/**
 * Scroll to next section or dismiss sheet if on last section
 * @param {HTMLElement} nextBtn - Next button element
 */
function handleNextClick(nextBtn) {
  const currentIndex = getCurrentSectionIndex();

  if (currentIndex === LESSON_SECTIONS.length - 1) {
    // Track tutorial completion
    trackTutorialCompleted();

    // Mark tutorial as completed when user clicks "Got it"
    markTutorialCompleted();

    // Dispatch event to notify that tutorial was completed
    window.dispatchEvent(new CustomEvent('tutorialCompleted'));

    // Dismiss the sheet on last section
    activeSheet.destroy();
  } else {
    // Scroll to next section
    const nextSection = scrollContainer.children[currentIndex + 1];
    nextSection.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  }
}

/**
 * Setup Intersection Observer to play/pause videos based on visibility
 */
function setupVideoObserver() {
  // Clean up existing observer if any
  if (intersectionObserver) {
    intersectionObserver.disconnect();
  }

  // Create new observer
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target.querySelector('video');
        if (entry.isIntersecting && entry.intersectionRatio >= VIDEO_VISIBILITY_THRESHOLD) {
          // Section is visible, play video
          video.currentTime = 0;
          video.play().catch(() => {
            // Autoplay might be blocked
          });
        } else {
          // Section not visible, pause video
          video.pause();
        }
      });
    },
    {
      root: scrollContainer,
      threshold: [VIDEO_VISIBILITY_THRESHOLD]
    }
  );

  // Observe all sections
  const sections = scrollContainer.querySelectorAll('.tutorial-section');
  sections.forEach((section) => {
    intersectionObserver.observe(section);
  });
}

/**
 * Show the multi-section tutorial lesson sheet with horizontal carousel
 */
function showLessonSheet() {
  // Build the content container
  const content = document.createElement('div');
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.gap = '0';

  // Horizontal scroll container with all 3 sections
  scrollContainer = document.createElement('div');
  scrollContainer.className = 'tutorial-scroll-container';

  // Create all 3 sections
  for (let i = 0; i < LESSON_SECTIONS.length; i++) {
    const section = createTutorialSection(i);
    scrollContainer.appendChild(section);
  }

  content.appendChild(scrollContainer);

  // Paging dots container
  const pagingDotsContainer = document.createElement('div');
  pagingDotsContainer.className = 'tutorial-paging-dots';
  pagingDots = [];

  for (let i = 0; i < LESSON_SECTIONS.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'tutorial-paging-dot';
    if (i === 0) dot.classList.add('active'); // First dot active initially

    // Click dot to scroll to that section
    dot.addEventListener('click', () => {
      // Track dot click (different from scroll-based view)
      trackTutorialSectionViewed(i, LESSON_SECTIONS[i].name, 'dot_click');

      const section = scrollContainer.children[i];
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    });

    pagingDots.push(dot);
    pagingDotsContainer.appendChild(dot);
  }

  content.appendChild(pagingDotsContainer);

  // Navigation button container
  const navButtons = document.createElement('div');
  navButtons.style.display = 'flex';
  navButtons.style.gap = '12px';
  navButtons.style.alignItems = 'center';
  navButtons.style.width = 'calc(100% - 40px)';
  navButtons.style.margin = '24px 20px 20px 20px';

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'bottom-sheet-btn bottom-sheet-btn-primary';
  nextBtn.style.flex = '1';
  nextBtn.textContent = 'Next';
  nextBtn.onclick = () => handleNextClick(nextBtn);
  navButtons.appendChild(nextBtn);

  content.appendChild(navButtons);

  // Add scroll listener to update paging dots and button text
  scrollContainer.addEventListener('scroll', () => {
    updatePagingDots();
    updateNextButton(nextBtn);
  });

  // Create and show the bottom sheet
  activeSheet = showBottomSheetAsync({
    title: ' ', // Empty title - content speaks for itself
    content: content,
    colorScheme: 'info',
    dismissLabel: null, // No default dismiss button - we use custom navigation
    onClose: () => {
      // Clean up observer when sheet is dismissed
      if (intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver = null;
      }
    }
  });

  // Setup video observer after sheet is shown
  // Use double RAF for guaranteed DOM ready (more reliable than setTimeout)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setupVideoObserver();
      initIcons();
    });
  });
}

/**
 * Initialize tutorial videos (lazy - only on first call)
 */
function initializeVideos() {
  if (tutorialVideos.length === 0) {
    // Create all 3 videos upfront for reliable preloading
    for (let i = 1; i <= 3; i++) {
      const video = buildVideoElement(i);
      tutorialVideos.push(video);
    }
  }
}

/**
 * Show the tutorial bottom sheet
 * Can be called from anywhere in the app (home screen, game screens, etc.)
 * Videos are lazy-loaded on first open and cached for subsequent opens
 * @param {string} [source='unknown'] - Where tutorial was opened from ('home', 'game')
 */
export function showTutorialSheet(source = 'unknown') {
  // Track tutorial opened
  trackTutorialOpened(source);

  // Ensure videos are created (only happens once)
  initializeVideos();

  // Clean up any existing sheet and observer
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }

  if (activeSheet) {
    activeSheet.destroy();
  }

  // Pause all videos before opening new sheet
  tutorialVideos.forEach((video) => {
    video.pause();
    video.currentTime = 0;
  });

  // Reset section tracking
  lastTrackedSection = -1;

  // Show the lesson sheet
  showLessonSheet();
}
