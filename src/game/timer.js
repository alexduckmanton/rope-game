/**
 * Game Timer Module
 *
 * Creates a timer instance with pause/resume support and
 * page visibility handling. Encapsulates all timer state.
 */

/**
 * Format seconds as "M:SS" string
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted time string
 */
export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Create a game timer instance
 * @param {Object} options
 * @param {Function} options.onUpdate - Called with formatted time string on each tick
 * @param {string} options.difficulty - Difficulty label for display
 * @returns {Object} Timer API
 */
export function createGameTimer({ onUpdate, difficulty }) {
  let timerStartTime = 0;
  let timerInterval = null;
  let elapsedSeconds = 0;
  let isPaused = false;
  let pauseStartTime = 0;
  let currentDifficulty = difficulty;

  function updateDisplay() {
    const label = currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1);
    onUpdate(`${label} • ${formatTime(elapsedSeconds)}`);
  }

  function start(resumeFromSeconds = 0) {
    stop();

    if (resumeFromSeconds > 0) {
      elapsedSeconds = resumeFromSeconds;
      timerStartTime = Date.now() - (resumeFromSeconds * 1000);
    } else {
      elapsedSeconds = 0;
      timerStartTime = Date.now();
    }

    isPaused = false;
    pauseStartTime = 0;
    updateDisplay();

    timerInterval = setInterval(() => {
      if (!isPaused) {
        elapsedSeconds = Math.floor((Date.now() - timerStartTime) / 1000);
        updateDisplay();
      }
    }, 1000);
  }

  function stop() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    isPaused = false;
    pauseStartTime = 0;
  }

  function pause() {
    if (!timerInterval || isPaused) return;
    isPaused = true;
    pauseStartTime = Date.now();
  }

  function resume() {
    if (!isPaused) return;
    const pauseDuration = Date.now() - pauseStartTime;
    timerStartTime += pauseDuration;
    isPaused = false;
    pauseStartTime = 0;
  }

  function setDifficulty(newDifficulty) {
    currentDifficulty = newDifficulty;
    updateDisplay();
  }

  function getElapsedSeconds() {
    return elapsedSeconds;
  }

  function getFormattedTime() {
    return formatTime(elapsedSeconds);
  }

  function setElapsedSeconds(seconds) {
    elapsedSeconds = seconds;
  }

  return {
    start,
    stop,
    pause,
    resume,
    setDifficulty,
    getElapsedSeconds,
    setElapsedSeconds,
    getFormattedTime,
    updateDisplay
  };
}
