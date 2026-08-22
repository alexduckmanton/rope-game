/**
 * Tricky hint placement experiment - variant assignment
 *
 * **Scope: the 6x6 Tricky grid only.** Round 1 of this experiment tested
 * covering hint placement on all three difficulties at once and confounded it
 * with hint count, because two of the three arms raised the count at the same
 * time. Easy and Diabolical are now settled and fixed for every player (see
 * `HINT_PLACEMENT` in config.js); an assignment here changes nothing outside
 * Tricky.
 *
 * **This is client-side randomisation, not a PostHog feature flag.** That is a
 * deliberate choice, and the reason is worth reading before "fixing" it.
 *
 * The game ships `posthog-js/dist/module.slim.no-external.js`, and the slim
 * build contains no feature-flag network code at all - `posthog.getFeatureFlag()`
 * exists as an API and silently returns `undefined` forever. Moving to
 * `module.no-external.js` would restore flags at a cost of roughly +38KB
 * gzipped, nearly doubling the JS payload of a game whose traffic is mostly
 * one-visit referrals from puzzle directories. That trade was not worth it, so
 * assignment happens here instead.
 *
 * The consequence is that the PostHog *Experiment* object cannot compute
 * results: it keys on flag exposure, and there is none. The experiment is
 * analysed on the `generator_variant` event property instead - see
 * "Tricky hint placement experiment" in CLAUDE.md.
 *
 * Two properties this still has to satisfy, both specific to this game:
 *
 * **Puzzles are generated, not fetched.** The variant decides which hint
 * placement runs, so it must be known at the moment a puzzle is built, with no
 * network round trip to wait on. A cached coin flip answers instantly and
 * always, including for players running an ad blocker.
 *
 * **Daily saves hold no puzzle data.** A daily game's hints are regenerated
 * from the date seed on every load, so if a player's variant changed between
 * two visits their half-finished puzzle would silently rearrange itself around
 * their drawn path. Every save therefore pins the variant it was created under
 * (see `variantForSavedGame`), and a pinned variant always wins.
 *
 * The assignment is cached in localStorage, so it is stable per browser for the
 * life of the experiment. It is not stable across devices or after a storage
 * clear - acceptable here, where players are anonymous and mostly visit once.
 *
 * Round 1's key (`loop-game:experiment:hint-generation`) is deliberately NOT
 * reused: inheriting those assignments would carry round-1 exposure into
 * round-2 behaviour. It is left in localStorage to expire with nothing reading
 * it.
 */

import { CONFIG } from './config.js';
import { setPersonProperties } from './analytics.js';

const { CONTROL, VARIANT, STORAGE_KEY } = CONFIG.EXPERIMENT.TRICKY_HINTS;

/**
 * Where an assignment came from
 *
 * Recorded alongside the variant on every game event.
 * - `local` - assigned by coin flip in this browser, and cached
 * - `saved` - pinned into a saved game when that puzzle was first generated
 */
export const VARIANT_SOURCE = {
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
 *
 * Round 1's values ('control' / 'dense') fail this deliberately, so a save
 * written before round 2 falls through to a fresh assignment rather than
 * silently selecting a placement that no longer exists.
 *
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

    return { variant: parsed.variant, source: parsed.source || VARIANT_SOURCE.LOCAL };
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
 * In-memory cache, then localStorage, then a fresh coin flip. Always returns
 * something, without ever touching the network.
 *
 * @returns {{variant: string, source: string}} The assignment and its origin
 */
export function getTrickyHintsAssignment() {
  if (cached) return cached;

  const stored = readStored();
  if (stored) {
    cached = stored;
    return cached;
  }

  // First visit in this browser. An even split is the whole point: this game's
  // traffic is dominated by first-time visitors, so anything that quietly sent
  // unresolved visits to one arm would bias the experiment badly.
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
 * regenerated with different hints underneath the player. Saves carrying a
 * round-1 variant, or none at all, fall through to the current assignment;
 * their `variant_source` marks them so they can be excluded.
 *
 * @param {string} [savedVariant] - Variant pinned in a loaded save, if any
 * @returns {{variant: string, source: string}} Variant to generate with
 */
export function variantForSavedGame(savedVariant) {
  if (isVariant(savedVariant)) {
    return { variant: savedVariant, source: VARIANT_SOURCE.SAVED };
  }
  return getTrickyHintsAssignment();
}

/**
 * Whether a variant name is the covering arm
 *
 * Only consulted for Tricky - every other difficulty has a fixed placement.
 *
 * @param {string} variant - Arm name
 * @returns {boolean} True for the covering arm
 */
export function isTrickyCoveringVariant(variant) {
  return variant === VARIANT;
}

/**
 * Prime the assignment as early as possible
 *
 * Called from main.js on app start, so the arm is decided and reported as a
 * person property while the player is still on the home screen - before any
 * puzzle asks for it.
 */
export function initTrickyHintsExperiment() {
  getTrickyHintsAssignment();
}
