---
paths:
  - "src/analytics.js"
  - "src/router.js"
---

# Analytics (PostHog)

Every call is wrapped in try/catch and no-ops when PostHog is blocked, so analytics can never interrupt gameplay.

### Analytics (PostHog)

**Setup:** PostHog Cloud (US region), project "Default project". The project API key is a public client-side key and is hardcoded in `src/analytics.js`, with `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` available as build-time overrides for forks or staging deploys.

**Why PostHog:** Retention and funnel analysis on anonymous players is the metric that matters for a daily game, and PostHog's data can be queried directly through its MCP server rather than read off a dashboard.

**Implementation:**
- **Bundle**: Imports `posthog-js/dist/module.slim.no-external.js` — excludes autocapture, session replay, surveys and web vitals (all unused), roughly halving the added bundle size. No scripts are fetched from a CDN at runtime.
- **No feature flags.** The slim build also excludes the feature-flag *network code*, not just extra payload: `posthog.getFeatureFlag()` exists and returns `undefined` forever, silently. Verified by diffing the dist builds — `module.js` contains the `flags/?v=` endpoint, `module.slim.no-external.js` does not. **Nothing in this app can read a flag or run a PostHog Experiment.** Restoring flags means moving to `module.no-external.js`, at roughly **+38KB gzipped** — close to doubling this game's JS payload, which was judged not worth it for traffic that is mostly one-visit referrals. The hint generation experiment randomises client-side instead; see below.
- **Initialization**: Happens on module load in `src/analytics.js`, before the router renders its first route, so the initial page view is never missed.
- **SPA tracking**: `trackPageView(path, title)` sends `$pageview`; `router.js` calls it on every route change after setting `document.title`.
- **Event helpers**: Named `trackX()` functions wrap `posthog.capture()` for every game event (see the event list below).

**Key configuration choices:**
| Option | Value | Reason |
|--------|-------|--------|
| `persistence` | `localStorage` | Analytics sets no cookies, keeping the privacy/consent story simple. The game as a whole now sets exactly one — `nf_lang`, written only when a player picks a language from the switcher, read only by Netlify's root redirect, and never used for analytics |
| `person_profiles` | `always` | The game has no accounts; without this, anonymous players get no person profiles and retention analysis does not work |
| `capture_pageview` | `false` | The router tracks SPA navigation manually |
| `autocapture` | `false` | Explicit events only; autocapture on a canvas game is mostly noise |
| `capture_pageleave` | `true` | Needed for session duration |

**Tracked events:**

| Event | Key properties | Notes |
|-------|----------------|-------|
| `$pageview` | `$current_url`, `title`, `previous_page` | Powers DAU, new vs returning, and play frequency |
| `game_started` | `difficulty`, `mode`, puzzle shape, arm | Fires only for a *fresh* puzzle, not when a saved game is restored, so it counts genuine starts |
| `game_completed` | `difficulty`, `mode`, `completion_time_seconds`, `score`, puzzle shape, arm | `score` is the real value, not a hardcoded 100. `completion_type` was dropped with the End button - it was always `win` |
| `game_abandoned` | `difficulty`, `mode`, `elapsed_seconds`, `score`, `cells_drawn`, `hints_satisfied`, puzzle shape, arm | Fires on navigation away or tab close with a touched, unfinished puzzle. Best effort - a force-quit delivers nothing, so treat it as a lower bound |
| `game_restarted` | `difficulty`, `mode` | Clear button |
| `puzzle_generated` | `difficulty` | Unlimited mode only |
| `validation_error` | `difficulty`, `mode` | Closed loop that fails its hints |
| `undo_used` / `solution_viewed` / `settings_opened` | `difficulty`, `mode` | |
| `tutorial_opened` | `source` (`home`/`game`), `difficulty` | `difficulty` is `none` when opened from home |
| `tutorial_section_viewed` | `section_index`, `section_name`, `method` | Four sections since the clips were re-cut. `section_name` is stable English and the three older names are unchanged, so it is the property to segment on; `section_index` shifted and is only comparable within a period |
| `tutorial_completed` | — | |
| `share_attempted` | `difficulty`, `completion_time` | Fires on share button click; the denominator is `game_completed` |
| `share_completed` / `share_failed` | `difficulty`, `method` / `error_type` | |
| `difficulty_selected` | `difficulty`, `source` | Home screen navigation |
| `streak_updated` | `difficulty`, `streak_current`, `streak_best`, `streak_overall_current`, `streak_overall_best` | Also written as person properties |
| `language_selected` | `from_locale`, `to_locale` | Fires only on an explicit switch. This is the signal that the root redirect guessed wrong — a rising rate into one language means its `match` list in `locales.js` is missing browser codes |

**Puzzle shape**, on every game lifecycle event: `hint_count`, `expected_turns_total`,
`hint_coverage_percent`, `hint_redundancy`, `anchor_hints`, `solution_turns`. From
`describePuzzle()`. This is what lets an unlucky day's puzzle be told apart from a mistuned
difficulty - the difficulty label alone can never make that distinction. Useful well beyond
the experiment, so it stays when the experiment goes.

**Experiment arm**, on the same events: `generator_variant` and `variant_source`. Also
written as person properties (`generator_variant`, `generator_variant_source`) so weekly
retention cohorts can be split by arm - a retention curve is built from people, not events.
These are the **only** record of the assignment: the slim posthog build cannot read flags,
so there is no `$feature/...` property on anything.

Values are versioned per experiment round - `control`/`dense` for round 1, then
`tricky-control`/`tricky-covering` for round 2 - so a date filter is never the only thing
separating two experiments. Round 2's arm only affects Tricky, so filter to
`difficulty = 'medium'` before reading it as a treatment.

**Locale**, on *every* event: `locale`, the language the session was served. Also written as a person property, so retention cohorts can be split by language — a retention curve is built from people, not events. This is the only way to tell whether a translation is earning its keep, since each language is a separate build on a separate URL. Note the distinction from `language_selected`: `locale` is what a player *got*, `to_locale` is what they *asked for*.

PostHog attaches `$session_id` to every event, which is what makes "how many difficulties per session" answerable.

**Key Files:**
| File | Purpose |
|------|---------|
| `src/analytics.js` | PostHog initialization and all event helpers |
| `src/router.js` | Calls trackPageView on route changes |

**Notes:**
- Every call is wrapped in try/catch and no-ops when PostHog fails to initialize or is blocked, so analytics can never interrupt gameplay.
- PostHog silently drops events from browsers reporting `navigator.webdriver === true`. This is intended bot filtering, but it means automated browser tests will never produce events unless the flag is spoofed.
