/**
 * Tutorial Bottom Sheet Component
 *
 * Self-contained tutorial that can be opened from anywhere in the app.
 * Five sections, each a silent clip of the real game and one line of copy.
 *
 * The clips are recorded by `scripts/record-tutorial.mjs` — see
 * `docs/recording-tutorial-videos.md`. Two things about them shape this file:
 *
 * - There are **light and dark variants** of every clip, and the player's theme
 *   can change while the sheet is open, so sources are swapped live rather than
 *   chosen once.
 * - They **play once and hold their last frame**, rather than looping. A loop
 *   has no beginning, so a viewer arriving mid-cycle sees an effect with no
 *   cause; and the last frame of every clip is the state the lesson is about.
 *   The progress bar and replay button exist because a clip that stops needs to
 *   say that it stopped and offer to run again.
 */

import { showBottomSheetAsync } from '../bottomSheet.js';
import { initIcons } from '../icons.js';
import { markTutorialCompleted } from '../persistence.js';
import {
  trackTutorialOpened,
  trackTutorialSectionViewed,
  trackTutorialCompleted
} from '../analytics.js';
import { t } from '../i18n/index.js';

// Tutorial sections, in the order a player meets the mechanics: the two
// gestures, then what the numbers mean, then the goal and the near-miss that
// stands in front of it.
//
// `body` is a message key resolved at render time. `name` is the analytics
// label and deliberately stays English, so tutorial_section_viewed reports the
// same section name whatever language the player is using — and the three names
// carried over from the previous three-card tutorial are unchanged, so the
// event stays comparable across the change.
//
// `clip` is the scene id in `scripts/tutorial-scenes.mjs`, which is also the
// filename. Keep the two in step: a section with no clip renders an empty box.
const LESSON_SECTIONS = [
  { clip: 1, bodyKey: 'tutorial.draw', name: 'Drawing loops' },
  { clip: 2, bodyKey: 'tutorial.erase', name: 'Erasing' },
  { clip: 3, bodyKey: 'tutorial.numbers', name: 'Counting bends' },
  { clip: 4, bodyKey: 'tutorial.zero', name: 'Zeroing numbers' },
  { clip: 5, bodyKey: 'tutorial.win', name: 'Win condition' }
];

/** A section counts as showing once half of it is in view */
const VIDEO_VISIBILITY_THRESHOLD = 0.5;

/**
 * How many sections ahead of the visible one to fetch.
 *
 * The five clips together are about 700KB, and opening the sheet used to pull
 * all of them before the first one had played. One ahead is enough that a swipe
 * never waits, and means a player who reads card 1 and closes has downloaded
 * two clips rather than five.
 */
const PRELOAD_AHEAD = 1;

// Module state - videos are created once and reused for the session
let sectionVideos = [];
let activeSheet = null;
let scrollContainer = null;
let pagingDots = [];
let progressBars = [];
let intersectionObserver = null;
let themeListener = null;
let progressFrame = null;
let lastTrackedSection = -1;

/** The clip variant that matches the player's current system theme */
function currentTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function clipUrl(clip, theme, extension) {
  return `/videos/${clip}-${theme}.${extension}`;
}

/**
 * Create a video element for one section
 *
 * `preload` starts at `none`: the poster stands in until the section is the one
 * being looked at, or the one after it. The poster is the clip's own first
 * frame, so there is no jump between the still and the start of playback.
 */
function buildVideoElement(clip) {
  const theme = currentTheme();
  const video = document.createElement('video');
  video.className = 'tutorial-video';
  video.muted = true;
  video.loop = false;
  video.autoplay = false;
  video.playsInline = true;
  video.preload = 'none';
  video.poster = clipUrl(clip, theme, 'webp');
  video.dataset.clip = String(clip);

  // mp4 first, deliberately. On line art this flat x264 beats VP9 outright, so
  // the h.264 file is the smaller one and should be what almost every browser
  // takes; the webm is there for a Chromium built without proprietary codecs,
  // which cannot decode h.264 at all. See docs/recording-tutorial-videos.md.
  const mp4 = document.createElement('source');
  mp4.type = 'video/mp4';
  mp4.src = clipUrl(clip, theme, 'mp4');
  video.appendChild(mp4);

  const webm = document.createElement('source');
  webm.type = 'video/webm';
  webm.src = clipUrl(clip, theme, 'webm');
  video.appendChild(webm);

  return video;
}

/**
 * Repoint every video at the other theme's clips
 *
 * Called from the `themeChanged` event the token system dispatches, which is
 * also what makes the game canvas redraw. Position is preserved so a theme
 * flipping mid-clip does not restart the lesson under the viewer.
 */
function applyTheme() {
  const theme = currentTheme();

  for (const video of sectionVideos) {
    const clip = video.dataset.clip;
    const [mp4, webm] = video.querySelectorAll('source');
    if (mp4.src.endsWith(`${clip}-${theme}.mp4`)) continue;

    const wasPlaying = !video.paused && !video.ended;
    const position = video.currentTime;

    video.poster = clipUrl(clip, theme, 'webp');
    mp4.src = clipUrl(clip, theme, 'mp4');
    webm.src = clipUrl(clip, theme, 'webm');
    video.load();

    // `load()` resets to zero, and the new source has to be seekable before the
    // old position can be restored
    video.addEventListener(
      'loadedmetadata',
      () => {
        video.currentTime = position;
        if (wasPlaying) video.play().catch(() => {});
      },
      { once: true }
    );
  }
}

/** Fetch the clips around a section, leaving the rest on their posters */
function preloadAround(index) {
  sectionVideos.forEach((video, position) => {
    if (position < index || position > index + PRELOAD_AHEAD) return;
    if (video.preload === 'auto') return;
    video.preload = 'auto';
    video.load();
  });
}

/**
 * Drive every visible progress bar from its video's position
 *
 * On requestAnimationFrame rather than `timeupdate`, which fires about four
 * times a second and makes the bar visibly step.
 */
function tickProgress() {
  progressFrame = requestAnimationFrame(tickProgress);
  sectionVideos.forEach((video, index) => {
    const bar = progressBars[index];
    if (!bar) return;
    const fraction = video.duration ? video.currentTime / video.duration : 0;
    bar.style.transform = `scaleX(${Math.min(1, fraction)})`;
  });
}

function createTutorialSection(sectionIndex) {
  const section = document.createElement('div');
  section.className = 'tutorial-section';
  section.dataset.sectionIndex = String(sectionIndex);

  const videoContainer = document.createElement('div');
  videoContainer.className = 'bottom-sheet-video-container';

  const video = sectionVideos[sectionIndex];
  video.currentTime = 0;
  videoContainer.appendChild(video);

  const progressTrack = document.createElement('div');
  progressTrack.className = 'tutorial-progress-track';
  const progressBar = document.createElement('div');
  progressBar.className = 'tutorial-progress-bar';
  progressTrack.appendChild(progressBar);
  videoContainer.appendChild(progressTrack);
  progressBars[sectionIndex] = progressBar;

  section.appendChild(videoContainer);

  const message = document.createElement('div');
  message.className = 'tutorial-section-message';
  message.appendChild(document.createElement('p')).textContent = t(
    LESSON_SECTIONS[sectionIndex].bodyKey
  );
  section.appendChild(message);

  return section;
}

/** Current section index from scroll position */
function getCurrentSectionIndex() {
  if (!scrollContainer) return 0;
  return Math.round(scrollContainer.scrollLeft / scrollContainer.offsetWidth);
}

function updatePagingDots() {
  const currentIndex = getCurrentSectionIndex();
  pagingDots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentIndex);
  });

  // Track section view when scrolling (only once per section)
  if (
    currentIndex !== lastTrackedSection &&
    currentIndex >= 0 &&
    currentIndex < LESSON_SECTIONS.length
  ) {
    lastTrackedSection = currentIndex;
    trackTutorialSectionViewed(currentIndex, LESSON_SECTIONS[currentIndex].name, 'scroll');
  }
}

function updateNextButton(nextBtn) {
  const isLastSection = getCurrentSectionIndex() === LESSON_SECTIONS.length - 1;
  nextBtn.textContent = isLastSection ? t('tutorial.gotIt') : t('tutorial.next');
}

function finishTutorial() {
  trackTutorialCompleted();
  markTutorialCompleted();
  window.dispatchEvent(new CustomEvent('tutorialCompleted'));
  activeSheet.destroy();
}

function handleNextClick() {
  const currentIndex = getCurrentSectionIndex();

  if (currentIndex === LESSON_SECTIONS.length - 1) {
    finishTutorial();
    return;
  }

  scrollContainer.children[currentIndex + 1].scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'start'
  });
}

/**
 * Play the section being looked at, rewind the ones that are not
 *
 * Rewinding on the way out is what stops a swipe back landing on a finished
 * clip's last frame, which reads as a video that will not play.
 */
function setupVideoObserver() {
  if (intersectionObserver) intersectionObserver.disconnect();

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target.querySelector('video');
        const index = Number(entry.target.dataset.sectionIndex);

        if (entry.isIntersecting && entry.intersectionRatio >= VIDEO_VISIBILITY_THRESHOLD) {
          preloadAround(index);
          video.currentTime = 0;
          video.play().catch(() => {
            // Autoplay can be blocked; the poster and replay button cover it
          });
        } else {
          video.pause();
          video.currentTime = 0;
        }
      });
    },
    { root: scrollContainer, threshold: [VIDEO_VISIBILITY_THRESHOLD] }
  );

  scrollContainer
    .querySelectorAll('.tutorial-section')
    .forEach((section) => intersectionObserver.observe(section));
}

function releaseResources() {
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
  if (progressFrame) {
    cancelAnimationFrame(progressFrame);
    progressFrame = null;
  }
  if (themeListener) {
    window.removeEventListener('themeChanged', themeListener);
    themeListener = null;
  }
  sectionVideos.forEach((video) => video.pause());
}

function showLessonSheet() {
  const content = document.createElement('div');
  content.className = 'tutorial-content';

  scrollContainer = document.createElement('div');
  scrollContainer.className = 'tutorial-scroll-container';
  progressBars = [];

  for (let i = 0; i < LESSON_SECTIONS.length; i += 1) {
    scrollContainer.appendChild(createTutorialSection(i));
  }
  content.appendChild(scrollContainer);

  const pagingDotsContainer = document.createElement('div');
  pagingDotsContainer.className = 'tutorial-paging-dots';
  pagingDots = [];

  for (let i = 0; i < LESSON_SECTIONS.length; i += 1) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'tutorial-paging-dot';
    dot.setAttribute('aria-label', `${i + 1}`);
    if (i === 0) dot.classList.add('active');

    dot.addEventListener('click', () => {
      trackTutorialSectionViewed(i, LESSON_SECTIONS[i].name, 'dot_click');
      scrollContainer.children[i].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start'
      });
    });

    pagingDots.push(dot);
    pagingDotsContainer.appendChild(dot);
  }
  // Replay, at the right of the dots row rather than over the clip. It is the
  // only control that says a clip has an end, so it is present from the start
  // rather than appearing once one finishes — but nothing should sit on top of
  // the board, and the sheet's own close button already owns the top-right
  // corner.
  const replay = document.createElement('button');
  replay.className = 'tutorial-replay-btn';
  replay.type = 'button';
  replay.setAttribute('aria-label', t('tutorial.replay'));
  replay.innerHTML = '<i data-lucide="rotate-ccw" width="18" height="18"></i>';
  replay.addEventListener('click', () => {
    const video = sectionVideos[getCurrentSectionIndex()];
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
  });
  pagingDotsContainer.appendChild(replay);

  content.appendChild(pagingDotsContainer);

  const navButtons = document.createElement('div');
  navButtons.className = 'tutorial-nav';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'bottom-sheet-btn bottom-sheet-btn-primary';
  nextBtn.type = 'button';
  nextBtn.textContent = t('tutorial.next');
  nextBtn.onclick = handleNextClick;
  navButtons.appendChild(nextBtn);
  content.appendChild(navButtons);

  scrollContainer.addEventListener('scroll', () => {
    updatePagingDots();
    updateNextButton(nextBtn);
  });

  activeSheet = showBottomSheetAsync({
    title: ' ', // Empty title - the clips speak for themselves
    content,
    colorScheme: 'info',
    dismissLabel: null, // No default dismiss button - we use custom navigation
    // On a short phone the sheet is the whole screen, leaving barely any
    // backdrop to tap. Without this the only way out is Next, five times.
    showCloseIcon: true,
    onClose: releaseResources
  });

  // Double RAF for guaranteed DOM ready (more reliable than setTimeout)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setupVideoObserver();
      preloadAround(0);
      tickProgress();
      initIcons();
    });
  });

  themeListener = () => applyTheme();
  window.addEventListener('themeChanged', themeListener);
}

/** Create the video elements once, on first open */
function initializeVideos() {
  if (sectionVideos.length) return;
  sectionVideos = LESSON_SECTIONS.map((section) => buildVideoElement(section.clip));
}

/**
 * Show the tutorial bottom sheet
 *
 * Can be called from anywhere in the app (home screen, game screens, etc.)
 * Video elements are created on first open and reused for the session.
 *
 * @param {string} [source='unknown'] - Where tutorial was opened from ('home', 'game')
 * @param {string} [difficulty] - Difficulty being played, when opened from a game
 */
export function showTutorialSheet(source = 'unknown', difficulty) {
  trackTutorialOpened(source, difficulty);

  initializeVideos();
  releaseResources();

  if (activeSheet) activeSheet.destroy();

  // The theme may have changed since the last open, and a reopened sheet always
  // starts from the first card
  applyTheme();
  sectionVideos.forEach((video) => {
    video.currentTime = 0;
  });
  lastTrackedSection = -1;

  showLessonSheet();
}
