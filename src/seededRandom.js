/**
 * Seeded random number generator for daily puzzles
 *
 * Uses Mulberry32 algorithm for deterministic, high-quality pseudorandom numbers.
 * This ensures everyone playing on the same date gets the same puzzle.
 */

/**
 * Create a seeded random number generator using Mulberry32 algorithm
 *
 * Mulberry32 is a simple, fast PRNG with excellent statistical properties.
 * It's deterministic across all browsers and platforms.
 *
 * @param {number} seed - Integer seed value
 * @returns {function(): number} Random function returning values in [0, 1)
 */
export function createSeededRandom(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Generate daily seed from local date and difficulty
 *
 * Creates a numeric seed based on the current local date and difficulty level.
 * Format: YYYYMMDD * 10 + difficulty_offset
 *
 * Examples:
 *   2025-11-30 Easy   → 202511300
 *   2025-11-30 Medium → 202511301
 *   2025-11-30 Hard   → 202511302
 *   2025-12-01 Easy   → 202512010
 *
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @returns {number} Numeric seed for this difficulty on this date
 */
export function getDailySeed(difficulty) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // getMonth() is 0-indexed
  const day = now.getDate();

  // Different offset for each difficulty ensures different puzzles
  const difficultyOffset = {
    'easy': 0,
    'medium': 1,
    'hard': 2
  }[difficulty] || 0;

  // Combine date components into numeric seed
  const dateSeed = year * 10000 + month * 100 + day;
  return dateSeed * 10 + difficultyOffset;
}

/**
 * Get a readable puzzle ID for sharing and statistics
 *
 * Returns a human-readable identifier for today's puzzle.
 * Useful for future social features (sharing, leaderboards, etc.)
 *
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @returns {string} Puzzle ID like "2025-11-30-easy"
 */
export function getPuzzleId(difficulty) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}-${difficulty}`;
}

/**
 * Format current date for display on home screen
 *
 * Returns date in format: "30 November 2025"
 *
 * @returns {string} Formatted date string
 */
export function getFormattedDate() {
  const now = new Date();
  return now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}
