/**
 * Hint generation experiment - variant assignment
 *
 * Assignment comes from a PostHog feature flag, but a flag alone is not enough
 * here, for two reasons specific to this game:
 *
 * **Puzzles are generated, not fetched.** The variant decides which hint
 * placement runs, so it has to be known at the moment a puzzle is built. If the
 * flag has not arrived yet the puzzle still has to appear. Blocking on the
 * network would leave the grid empty for players on slow connections and
 * permanently broken for players running an ad blocker, so this module answers
 * immediately and always: from cache when it has one, from a local coin flip
 * when it does not.
 *
 * **Daily saves hold no puzzle data.** A daily game's hints are regenerated
 * from the date seed on every load, so if a player's variant changed between
 * two visits their half-finished puzzle would silently rearrange itself around
 * their drawn path. Every save therefore pins the variant it was created under
 * (see `variantForSavedGame`), and a pinned variant always wins.
 *
 * ## Why the analysis reads an event property, not the flag
 *
 * Because of the fallbacks above, the variant a player actually *played* can
 * differ from the one PostHog would report for them - most obviously on a first
 * visit that generates a puzzle before the flag response lands. Every game
 * event therefore carries `generator_variant` and `variant_source` describing
 * what really happened, and the experiment is analysed on those rather than on
 * PostHog's `$feature/...` property. `variant_source` exists precisely so that
 * locally-assigned sessions can be inspected, or excluded, rather than quietly
 * polluting whichever arm they landed in.
 */

import { CONFIG } from './config.js';
import { getFeatureFlag, onFeatureFlags, setPersonProperties } from './analytics.js';

const { FLAG_KEY, CONTROL, VARIANT, STORAGE_KEY } = CONFIG.EXPERIMENT.HINT_GENERATION;

/**
 * Where an assignment came from
 *
 * Recorded alongside the variant on every game event.
 * - `flag`  - PostHog answered, this is a real assignment
 * - `cache` - PostHog answered on an earlier visit and we stored it
 * - `local` - PostHog never answered; assigned by local coin flip and cached
 * - `saved` - Pinned into a saved game when that puzzle was first generated
 */
export const VARIANT_SOURCE = {
  FLAG: 'flag',
  CACHE: 'cache',
  LOCAL: 'local',
  SAVED: 'saved',
};

/**
 * Cached assignment for this browser
 * @type {{variant: string, source: string}|null}
 */
let cached = null;

/**
 * Whether a valid variant name
 * @param {*} value - Candidate
 * @returns {boolean} True for a known arm
 */
function isVariant(value) {
  return value === CONTROL || value === VARIANT;
}

/**
 * Read the stored assignment
 * @returns {{variant: string, source: string}|null} Stored assignment, if valid
 */
function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isVariant(parsed?.variant)) return null;

    return { variant: parsed.variant, source: parsed.source || VARIANT_SOURCE.CACHE };
  } catch {
    // Corrupt entry, private browsing, storage disabled - all mean "no cache"
    return null;
  }
}

/**
 * Persist an assignment so later visits are stable
 *
 * @param {string} variant - Arm name
 * @param {string} source - How it was decided
 */
function writeStored(variant, source) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ variant, source }));
  } catch {
    // Storage unavailable - the in-memory cache still holds for this session
  }
}

/**
 * Report the assignment as a person property
 *
 * Needed so retention cohorts can be split by arm: a weekly retention curve is
 * built from people, not events, so the arm has to live on the person.
 *
 * @param {string} variant - Arm name
 * @param {string} source - How it was decided
 */
function reportAssignment(variant, source) {
  setPersonProperties({
    generator_variant: variant,
    generator_variant_source: source,
  });
}

/**
 * Current assignment for this browser
 *
 * Resolution order: PostHog's answer, then this browser's cached answer, then a
 * local coin flip. Always returns something.
 *
 * @returns {{variant: string, source: string}} The assignment and its origin
 */
export function getHintGenerationAssignment() {
  const flagValue = getFeatureFlag(FLAG_KEY);
  if (isVariant(flagValue)) {
    // PostHog is authoritative whenever it has actually answered. Overwrite any
    // earlier local guess so the two agree from here on.
    if (!cached || cached.variant !== flagValue || cached.source !== VARIANT_SOURCE.FLAG) {
      cached = { variant: flagValue, source: VARIANT_SOURCE.FLAG };
      writeStored(flagValue, VARIANT_SOURCE.FLAG);
      reportAssignment(flagValue, VARIANT_SOURCE.FLAG);
    }
    return cached;
  }

  if (cached) return cached;

  const stored = readStored();
  if (stored) {
    cached = stored;
    return cached;
  }

  // PostHog has not answered and there is nothing stored. Assign locally rather
  // than defaulting to control: this game's traffic is dominated by first-time
  // visitors, so quietly sending every unresolved first visit to one arm would
  // bias the experiment far more than an even local split does.
  const variant = Math.random() < 0.5 ? CONTROL : VARIANT;
  cached = { variant, source: VARIANT_SOURCE.LOCAL };
  writeStored(variant, VARIANT_SOURCE.LOCAL);
  reportAssignment(variant, VARIANT_SOURCE.LOCAL);
  return cached;
}

/**
 * Variant to generate a puzzle with
 *
 * A saved game's pinned variant always wins, so a puzzle in progress is never
 * regenerated with different hints underneath the player. Saves written before
 * the experiment shipped have no pinned variant and fall through to the current
 * assignment; their `variant_source` marks them so they can be excluded.
 *
 * @param {string} [savedVariant] - Variant pinned in a loaded save, if any
 * @returns {{variant: string, source: string}} Variant to generate with
 */
export function variantForSavedGame(savedVariant) {
  if (isVariant(savedVariant)) {
    return { variant: savedVariant, source: VARIANT_SOURCE.SAVED };
  }
  return getHintGenerationAssignment();
}

/**
 * Whether a variant name is the dense arm
 * @param {string} variant - Arm name
 * @returns {boolean} True for the dense arm
 */
export function isDenseVariant(variant) {
  return variant === VARIANT;
}

/**
 * Prime the assignment as early as possible
 *
 * Called from main.js on app start. Resolving here means the flag response
 * usually lands while the player is still on the home screen choosing a
 * difficulty, so the first puzzle they open is generated from a real PostHog
 * assignment rather than a local guess.
 */
export function initHintGenerationExperiment() {
  // Seed from cache (or coin flip) straight away so nothing ever has to wait
  getHintGenerationAssignment();

  // Then upgrade to PostHog's answer the moment it arrives
  onFeatureFlags(() => {
    getHintGenerationAssignment();
  });
}
