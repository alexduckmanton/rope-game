/**
 * Tutorial Bottom Sheet Component
 *
 * Self-contained tutorial that can be opened from anywhere in the app.
 * Shows a multi-section walkthrough with video demonstrations.
 */

import { showBottomSheetAsync } from '../bottomSheet.js';
import { initIcons } from '../icons.js';

// Tutorial lesson content
const LESSON_SECTIONS = [
  {
    body: 'To win, drag to draw a single continuous loop'
  },
  {
    body: 'Numbers count the bends of your loop in the squares they touch'
  },
  {
    body: 'To win, draw a loop that makes all numbers zero'
  }
];

// Module state - videos created once and cached for entire session
let tutorialVideos = [];
let currentLessonSection = 0;
let activeSheet = null;

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
 * Get the pre-created video for a lesson section and add it to container
 * @param {number} sectionIndex - The lesson section index (0-2)
 * @param {HTMLElement} container - The container element
 * @returns {HTMLVideoElement} The pre-created video element
 */
function attachTutorialVideo(sectionIndex, container) {
  // Add skeleton loader
  const skeleton = document.createElement('div');
  skeleton.className = 'bottom-sheet-video-skeleton';
  container.appendChild(skeleton);

  // Get the pre-created video
  const video = tutorialVideos[sectionIndex];

  // Reset video to beginning for clean playback
  video.currentTime = 0;

  // Remove skeleton when video is ready to play
  const removeSkeletonHandler = () => {
    if (skeleton.parentNode) {
      skeleton.remove();
    }
  };

  // If video is already ready (cached/loaded), remove skeleton immediately
  if (video.readyState >= 3) {
    removeSkeletonHandler();
  } else {
    video.addEventListener('canplay', removeSkeletonHandler, { once: true });
  }

  return video;
}

/**
 * Update the lesson sheet content for the current section
 * @param {HTMLElement} messageEl - Message container element
 * @param {HTMLElement} videoContainer - Video container element
 * @param {HTMLElement} nextBtn - Next button element
 */
function updateLessonContent(messageEl, videoContainer, nextBtn) {
  const section = LESSON_SECTIONS[currentLessonSection];
  const isLastSection = currentLessonSection === LESSON_SECTIONS.length - 1;

  // Update message content
  messageEl.innerHTML = `<p>${section.body}</p>`;

  // Update video (clear and add pre-created one)
  videoContainer.innerHTML = '';
  const video = attachTutorialVideo(currentLessonSection, videoContainer);
  videoContainer.appendChild(video);

  // Update next button text
  nextBtn.textContent = isLastSection ? 'Got it' : 'Next';
}

/**
 * Show the multi-section tutorial lesson sheet
 */
function showLessonSheet() {
  const section = LESSON_SECTIONS[currentLessonSection];
  const isLastSection = currentLessonSection === LESSON_SECTIONS.length - 1;

  // Build the content with navigation buttons
  const content = document.createElement('div');
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.gap = '0';

  // Message content
  const message = document.createElement('div');
  message.className = 'bottom-sheet-message';
  message.style.paddingBottom = '16px';
  message.innerHTML = `<p>${section.body}</p>`;
  content.appendChild(message);

  // Video container with initial video
  const videoContainer = document.createElement('div');
  videoContainer.className = 'bottom-sheet-video-container';
  const initialVideo = attachTutorialVideo(currentLessonSection, videoContainer);
  videoContainer.appendChild(initialVideo);
  content.appendChild(videoContainer);

  // Navigation buttons container
  const navButtons = document.createElement('div');
  navButtons.style.display = 'flex';
  navButtons.style.gap = '12px';
  navButtons.style.alignItems = 'center';
  navButtons.style.width = 'calc(100% - 40px)';
  navButtons.style.margin = '24px 20px 20px 20px';

  // Next button (full width)
  const nextBtn = document.createElement('button');
  nextBtn.className = 'bottom-sheet-btn bottom-sheet-btn-primary';
  nextBtn.style.flex = '1';
  nextBtn.textContent = isLastSection ? 'Got it' : 'Next';
  nextBtn.onclick = () => {
    if (currentLessonSection === LESSON_SECTIONS.length - 1) {
      // Dismiss the sheet on last section
      activeSheet.destroy();
    } else {
      // Go to next section
      currentLessonSection++;
      updateLessonContent(message, videoContainer, nextBtn);
    }
  };
  navButtons.appendChild(nextBtn);

  content.appendChild(navButtons);

  // Create and show the bottom sheet
  activeSheet = showBottomSheetAsync({
    title: ' ', // Empty title - content speaks for itself
    content: content,
    icon: 'graduation-cap',
    colorScheme: 'info',
    dismissLabel: null // No default dismiss button - we use custom navigation
  });

  // Initialize icons for the navigation buttons
  setTimeout(() => {
    initIcons();
  }, 0);
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
 */
export function showTutorialSheet() {
  // Ensure videos are created (only happens once)
  initializeVideos();

  // Close any existing tutorial sheet
  if (activeSheet) {
    activeSheet.destroy();
  }

  // Reset to first section
  currentLessonSection = 0;

  // Show the lesson sheet
  showLessonSheet();
}
