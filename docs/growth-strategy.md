# Loopy — Growth Strategy

**Goal:** 20 → 1,000 daily players.
**Realistic timeframe:** 12–18 months of consistent effort (~2–4 hrs/week).
**Budget assumption:** near-zero spend for the first 6 months. Paid acquisition is the last lever, not the first.

---

## 1. The one thing to understand before anything else

You do not have a traffic problem. You have a **retention and conversion problem that will waste any traffic you get.**

Right now, if 5,000 people hit the site tomorrow from a Hacker News front page, here is what happens:

- Most bounce, because the page says "Loopy — A path-drawing puzzle" and nothing else.
- Some play. Some win.
- The winners share a message that says `💫 Medium Loopy 75% in 2:34` — **with no link in it.** Nobody who receives it can find the game.
- Nobody has a reason to come back tomorrow. There's no streak, no stats, no reminder, no email, no notification, no day number.
- By day 3 you're back to ~20 DAU, and you've burned your one Show HN.

So the sequencing is: **fix the bucket, then pour water in.** Everything in Phase 1 below should ship before you do any serious promotion.

### The arithmetic of 1,000 DAU

For a daily game, steady-state DAU follows Little's Law:

```
DAU ≈ (new visitors/day) × (% who become habitual) × (average lifetime in days)
```

Some scenarios:

| New visitors/day | → habitual | Avg. lifetime | Steady-state DAU |
|---|---|---|---|
| 200 | 4% | 30 days | 240 |
| 200 | 8% | 60 days | **960** |
| 100 | 10% | 100 days | **1,000** |
| 500 | 3% | 20 days | 300 |

Read that table twice. **Doubling retention halves the traffic you need.** A big spike with bad retention is worth less than a modest, permanent trickle with good retention. This is why the plan front-loads product work and back-loads promotion.

Target for planning: ~150–250 new visitors/day sustained, 8% habitual conversion, 60+ day average lifetime.

---

## 2. Honest audit of what exists today

### What's already good
- The game itself is solid, loads fast, and is mobile-first.
- **It is now genuinely offline-capable and installable.** When this audit was written the site had a manifest and icons but no service worker, which meant neither — Chromium's install criteria require a registered service worker with a `fetch` handler. That shipped since: files cache as they are used, and a player who has played once can play on a plane. This is the prerequisite for §4.2's install prompt and push notifications, and it is no longer pending.
- PostHog is wired up with real custom events (game_started, game_completed, share_attempted, etc.) — better instrumentation than most indie games.
- `llms.txt`, `robots.txt` with AI crawlers allowed, OG image, manifest with shortcuts. Someone has thought about this.
- Deterministic daily generation with no backend — cheap to run, scales to any audience for free.
- **The game is language-independent.** It's numbers and lines. This is a big, underused asset (see §7).

### What's broken or missing (ranked by cost to growth)

| # | Problem | Why it matters |
|---|---|---|
| 1 | **Share text contains no URL** (`src/game/share.js`) | Every share is a dead end. This is the single biggest leak in the funnel. |
| 2 | **No streaks, no stats, no day number** | Daily games run on streaks. Without one, there is no reason to return, and lifetime stays short. |
| 3 | **No reason to return tomorrow** — no "next puzzle in 4:12:33", no reminder, no email capture, no push | You have no way to reach a single one of your ~20 players. |
| 4 | **Zero SEO surface** — title is "Loopy", description is "A path-drawing puzzle", no sitemap, no crawlable content pages | Organic search is the only free channel that compounds. You're invisible in it. |
| 5 | **Share text is meaningless to the recipient** | Wordle's grid was *interesting to look at* and spoiler-free. `75% in 2:34` communicates nothing and creates no curiosity. |
| 6 | **No archive** | Archives are both a retention feature (new players can binge) and dozens of indexable pages. |
| 7 | **Brand/domain risk**: `loopy.wtf` | `.wtf` reads as a joke/spam domain to the 35–65 daily-puzzle demographic, gets flagged by some corporate/school filters, and looks bad in an iMessage link preview. "Loopy" is also unsearchable and collides with an existing puzzle genre ("loop the loop"). |
| 8 | **Unknown puzzle quality** | Deterministic generation with no quality filter means some days will be trivial or ambiguous. In a daily game, one bad puzzle churns players. Serious puzzle solvers care a lot about **unique solutions** — with 2 hints on a 4×4 there are many valid loops, which the puzzle-enthusiast crowd may read as "not a real puzzle." |
| 9 | **You don't know your D1/D7 retention or your win rate** | You're flying blind on the exact numbers that determine whether growth is even possible. |
| 10 | **Three dailies per day splits the "did you do today's Loopy?" conversation** | Wordle worked because there was exactly one. Consider one canonical daily + optional extras. |

---

## 3. Phase 0 — Measure (Week 1)

Do these before changing anything, so you can tell whether later changes worked.

1. **Google Search Console + Bing Webmaster Tools** — verify the domain and submit the sitemap. It exists now: `dist/sitemap.xml` is generated by the build, covers every route in every language, and `robots.txt` points at it.
2. **Define the north-star metric: 7-day active players** (not pageviews, not visits). Everything gets judged against this.
3. **Pull your current baseline from PostHog:**
   - New vs. returning split
   - D1 / D7 / D30 return rate
   - % of first-time visitors who *start* a puzzle, and % who *complete* one
   - Tutorial open rate + completion rate
   - Win rate and median completion time per difficulty
   - Share rate (shares ÷ completions)
4. **Write those numbers down in this repo.** They're your before-picture.

Two numbers will tell you almost everything:
- **First-session completion rate.** If under ~50%, your onboarding or difficulty curve is the growth bottleneck, not marketing.
- **D7 return rate.** Under 15% and no amount of traffic will get you to 1,000.

---

## 4. Phase 1 — Fix the bucket (Weeks 2–8)

**Do not promote the game until most of this ships.** In rough priority order:

### 4.1 Make sharing actually work (highest ROI item in this entire document)
- **Put the URL in the share text.** Non-negotiable.
- **Add a puzzle number** — "Loopy #143" — so shares feel like a collectible, comparable event.
- **Add a spoiler-free visual.** The reason Wordle spread was that the grid of coloured squares was *interesting-looking and gave nothing away*. Options that don't spoil: an emoji progress bar of the score, a per-hint ✅/⬜ row, or a "corners used" trail. Test a couple.
- **Add streak to the share** once streaks exist ("🔥 12").
- Target share format — short, visual, linked:
  ```
  Loopy #143 · Medium
  🟩🟩🟩🟩⬜ 92% · 2:34 · 🔥12
  loopy.wtf
  ```
- **Measure it:** you already have `trackShareCompleted`. Watch share rate before/after, and watch referral traffic in PostHog.

### 4.2 Build the return loop
- **Streaks** (current + best), with a visible "don't break it" cue on the home screen.
- **Stats screen**: games played, win rate, streak, best times, distribution of scores. Cheap to build (it's all in localStorage already), and it's the thing players screenshot.
- **"Next Loopy in 4:12:33" countdown** on the home screen after completion.
- **A way to reach players.** Pick one to start:
  - *Web push notifications* (free, and the service worker they need is now in place, best conversion) — ask only *after* a player has won 2–3 days in a row, never on first load.
  - *Email list* ("get a nudge when the daily drops") — slower, but portable and useful for announcements later.
- **PWA install prompt** shown after a win, not on arrival. Installed users retain dramatically better than tab-visitors. Now actually available: Chromium only fires `beforeinstallprompt` for a site with a service worker that has a `fetch` handler, which this did not have until offline support landed.

### 4.3 Make the first session succeed
- Measure how many first-time visitors complete a puzzle. If it's low:
  - Ship the **interactive tutorial** already on your roadmap (a playable 3×3 beats three videos).
  - Consider an ultra-gentle first-ever puzzle that everyone wins.
- First-session success is the strongest predictor of long-term retention in every casual game. Treat it as a marketing metric.

### 4.4 Basic on-page SEO hygiene (one afternoon)
- Rewrite `<title>` and meta description with actual search intent, e.g.
  *"Loopy — a free daily loop logic puzzle. New puzzle every day."*
- Put the tagline in the HTML rather than injecting it via JS.
- Add `public/sitemap.xml` and reference it from `robots.txt`.
- Per-page titles/descriptions/canonicals for `/play?difficulty=…` and future content pages.
- Keep `llms.txt` current — AI answer engines are now a genuine referral source for "recommend me a daily puzzle game".

---

## 5. Phase 2 — Build the compounding channel: content + SEO (Weeks 6–20, then forever)

SEO is the only free channel that grows while you sleep, and the "-dle" ecosystem is *heavily* search-driven. It takes 3–6 months to show results, so start early and be patient.

Your site is a Vite SPA with essentially zero crawlable text. You need a static content layer — prerender at build time (`vite-plugin-ssg`, or just generate plain HTML pages at build; the game stays a SPA).

**Pages to build, in priority order:**

1. **How to Play** — a real page, not a bottom sheet. With diagrams and worked examples. Targets "how to play loop puzzle", "loop puzzle rules".
2. **Strategy / Tips guide** — deduction patterns, common shapes, how to approach an 8×8. This is the kind of page puzzle people link to and bookmark.
3. **Archive** — every past puzzle at its own URL (`/archive/2026-08-01-medium`). Doubles as a retention feature and generates a new indexable page every day, forever. Highest-leverage single build on this list.
4. **"Today's Loopy — hints and answer"** page pattern. Every successful daily game captures the "today's answer" search intent. If you don't, someone else will build a Loopy answers site and take that traffic.
5. **Comparison / discovery content** — "daily puzzle games that aren't word games", "what to play after Connections". Real, useful, opinionated posts that link out generously to other games (this also seeds the cross-promo relationships in §6.4).
6. **An About page with a face and a story.** Solo-dev stories convert far better than anonymous sites, and they're what journalists and bloggers need in order to write about you.

**Keywords to target** (genre, not brand — nobody is searching "Loopy"):
`daily logic puzzle`, `daily loop puzzle`, `slitherlink online free`, `games like wordle but not words`, `daily puzzle game no download`, `free brain teaser daily`, `number logic puzzle online`.

**Cadence:** one solid page every 2 weeks. Twenty good pages beats a hundred thin ones.

---

## 6. Phase 3 — Distribution (Weeks 8+, once Phase 1 has shipped)

Ordered by expected return per hour of your time.

| Channel | Cost | Effort | Realistic result | When |
|---|---|---|---|---|
| Daily-game directories | Free | Low, one-off | Steady trickle for years | First |
| Puzzle communities (Thinky, Reddit, Discord) | Free | Medium, ongoing | Small but high-quality, high-retention users | Early |
| itch.io / web game portals | Free | Low (build already exists) | Modest, long tail | Early |
| Show HN / Product Hunt | Free | Medium, one shot each | 2k–20k visits in a day, decays fast | After Phase 1 |
| Content/SEO | Free | High, ongoing | The main long-term engine | Ongoing |
| Cross-promo with other indie daily games | Free | Medium | **Very high ROI — most underrated** | Month 3+ |
| Newsletters & puzzle press | Free | Medium | Occasional big spike | Month 3+ |
| Creators (YouTube/TikTok puzzle solvers) | Free–low | High | Highest variance; one hit changes everything | Month 4+ |
| App stores (wrapped PWA) | ~$125 | Medium | New discovery surface + credibility | Month 6+ |
| Paid ads | $$$ | Low | Poor, while the game earns nothing | Last |

### 6.1 Directories (do these in one sitting)
Submit to every daily-game aggregator. These are one-time actions that pay out for years:
- [Seekdle](https://seekdle.com/) — hand-curated directory of daily "-dle" games.
- [adoryvo's dailies list](https://adoryvo.github.io/lists/dailies.html) — widely used, creator-submitted.
- [Thinky Games database](https://thinkygames.com/) — the home of the thinking-puzzle audience. Exactly your people.
- itch.io (you already have `npm run build:itch` — use it), Newgrounds, GameJolt, indiexpo.
- AlternativeTo, and the various "games like Wordle" listicles — email the authors of [existing roundups](https://www.pcgamer.com/best-games-like-wordle/); updating a post is much easier for a writer than writing a new one.

### 6.2 Communities — participate, don't broadcast
Rule: be a member for weeks before you post a link. One post per community, ever, unless you're sharing genuine news.
- **Thinky Games Discord** — the highest-signal puzzle community online. Play others' games, comment, then share yours.
- **Reddit:** r/WebGames, r/puzzles, r/dailygames, r/IndieDev, r/incremental_games (adjacent), r/nonograms and logic-puzzle subs. Read each subreddit's self-promo rules first. A short post with a 20-second GIF and a link does far better than a wall of text.
- **Bluesky / Mastodon** puzzle and gamedev circles (you already link your Bluesky from the footer — good).

### 6.3 The one-shot big swings — save these until you're ready
- **Show HN.** Lead with the *engineering* story, not the game: "I built a daily puzzle game with no backend — every puzzle is generated deterministically from the date." HN rewards technical novelty. Post Tue–Thu, ~8–10am ET. You get one good shot; make sure streaks + linked sharing are live first.
- **Product Hunt.** Same rule — one shot, needs a good GIF, a founder comment, and a few friends ready to engage in the first hour.

### 6.4 Cross-promotion (start month 3 — this is the sleeper hit)
The indie daily-game scene is small and friendly, and its players are *exactly* your target: people who already have a daily-puzzle habit and are looking for the next one.
- Find 10–20 indie daily games of similar scale. Play them. Email the makers.
- Propose a reciprocal "More daily games" link in each other's footer or post-win screen.
- A single good partner can send more retained players than a Reddit front page, because the traffic is pre-qualified.

### 6.5 Press & creators (month 4+)
- **Thinky Games' biweekly newsletter** includes a free web game recommendation — a natural fit; build the relationship first.
- Journalists who have written "games like Wordle" roundups at PC Gamer, Polygon, Kotaku, The Verge. Pitch: 2 sentences, a GIF, a link, and the hook (solo dev, no backend, no accounts, no ads, language-independent).
- **Puzzle YouTubers/streamers.** Loop puzzles are a staple of the Cracking The Cryptic-style solving scene. A single feature there could be worth more than everything else on this list combined. Approach: no money, no demands — just "I made this, thought you might enjoy it, here's a link."

---

## 7. Things you probably haven't thought about

1. **The domain is a real liability.** `.wtf` costs you trust with a 40+ demographic, gets filtered on some corporate/school networks, and looks unserious in link previews — exactly where shares land. If you're ever going to rename or re-domain, **do it now**, while 20 people know the game and there's no SEO equity to lose. A `.com` or `.game` with a distinctive, searchable name is worth ~$20–40/yr and would be the best money you spend. ("Loopy" is also generic — you'll never rank for it, and it collides with the existing "loop the loop" puzzle genre.)
2. **The game is language-independent — that's a rare, free multiplier.** It's numbers and lines. Translating ~50 UI strings opens Brazil, Germany, Japan, France, Spain, Indonesia — markets where English-language Wordle clones can't compete and where competition for "daily logic puzzle" search terms is a fraction of the US. Very few of your competitors can do this cheaply. Do it around month 6.
3. **Puzzle uniqueness.** Verify whether your generated puzzles have unique solutions. Enthusiast puzzlers regard non-unique puzzles as broken, and they're the people who evangelise games. If puzzles aren't unique, either add a solver-based uniqueness check to generation or lean explicitly into "many valid loops" as a deliberate design choice — but decide, and say so on the How to Play page.
4. **Puzzle quality QA.** Generate the next 30 days now, solve-check them, and flag any that are degenerate. One trivially easy or unfair daily can cost you a chunk of your habitual players.
5. **Three dailies dilutes the ritual.** "Did you do today's Wordle?" worked because there was one. Consider making one difficulty *the* daily and framing the others as bonus rounds.
6. **You have no way to contact your players.** Every day without an email list or push opt-in is a day of permanently unreachable users. This is the cheapest thing on this list and the easiest to neglect.
7. **Cookie consent / privacy.** Largely resolved by the move off GA4. PostHog here is configured with `persistence: 'localStorage'` and sets no cookies, so there is no analytics cookie to consent to. The site sets exactly one cookie — `nf_lang`, written only when a player picks a language from the switcher and read only by Netlify's root redirect — which is a strictly-necessary preference cookie and needs no banner. Revisit if session replay, autocapture or an ad pixel is ever added.
8. **Accessibility is a growth channel too.** Your hint system leans heavily on colour. Colour-blind-safe modes and keyboard play widen the audience and earn genuine goodwill posts.
9. **Monetisation changes the whole strategy.** You don't need to monetise, but note that with zero revenue, paid acquisition is *permanently* off the table. Even modest revenue (Ko-fi, a no-ads supporter tier, a paid archive) creates a CAC budget and turns growth into an arithmetic problem instead of a hustle. Worth deciding deliberately, not by default.
10. **Consistency beats intensity.** 2 hours every week for a year beats a heroic fortnight. Growth for a daily game is a compounding curve, and the only way to lose is to stop.
11. **Talk to your 20 players.** At your scale you can literally reply to every single one. Ask why they came back. Those answers are worth more than any analytics dashboard, and early superfans become your best distribution.
12. **Don't:** buy traffic or bot installs, spam Discords/subreddits with drive-by links, chase TikTok virality with no retention hooks, or rebuild the game for a platform (Steam, native apps) before the web version retains people.

---

## 8. Timeline and milestones

| Phase | Timeframe | Focus | Target DAU |
|---|---|---|---|
| 0 | Week 1 | Measurement, Search Console, baseline | 20 |
| 1 | Weeks 2–8 | Share links, streaks, stats, return loop, SEO hygiene | 30–50 |
| 2 | Weeks 6–20 | Content layer, archive, strategy guides | 60–120 |
| 3 | Weeks 8–16 | Directories, communities, Show HN, Product Hunt | 100–200 |
| 4 | Months 4–8 | Cross-promo, press, creators, localisation | 250–500 |
| 5 | Months 8–15 | Compounding SEO + partnerships + app stores | 500–1,000 |

**Growth will be lumpy.** Expect long flat stretches punctuated by spikes. The spikes are only worth anything if the retention machinery from Phase 1 exists to capture them — which, again, is why it comes first.

**Checkpoint honesty:** if you're at month 6 with good traffic but D7 retention still under 15%, stop marketing and fix the game. The traffic isn't the problem.

---

## 9. Do these five things this week

1. ~~**Add the URL and a puzzle number to the share text.**~~ **Done.** Shares now read `💫 Loopy #233 · Medium / 2:34 / https://loopy.wtf`.
2. ~~**Rewrite `<title>` and the meta description**; add `sitemap.xml`.~~ **Done**, including per-route titles and a `Sitemap:` line in `robots.txt`.
3. **Verify the site in Google Search Console** and submit the sitemap. Still worth doing — Search Console reports what Google actually indexes and which queries you surface for, which no product analytics tool can tell you.
4. **Pull baseline numbers** (D1/D7 return, first-session completion rate, share rate) once PostHog has a week or two of data, and record them here as the before-picture.
5. ~~**Streaks.**~~ **Done** — per-difficulty streaks with home screen badges. A full stats screen (win rate, best times, score distribution) is the natural follow-up, and it's the thing players screenshot.

**Analytics note:** the game moved from Google Analytics to PostHog, so retention, funnels and streak-segmented cohorts can be queried directly rather than read off a dashboard.

## 10. The PostHog dashboard

Project **Loopy** (538478, US cloud). The [**Loopy Overview**](https://us.posthog.com/project/538478/dashboard/1940498) dashboard is pinned and set as the project's landing page:

| Tile | What it answers | Read it for |
|------|-----------------|-------------|
| Daily players | Unique players per day | The headline number. Everything else explains its movement |
| Average session duration | Time spent per session, daily | Rising duration on flat players = deeper engagement |
| Puzzles started vs completed, by difficulty | Raw start and completion counts | Absolute volume per difficulty |
| Completion rate by difficulty | Completions ÷ starts | A falling line means a difficulty is losing people |
| New vs returning players | Lifecycle bands | Growth is only real when the *returning* band grows |
| Play frequency | Days played per 30 | A spike at 1 day means people try it once and leave |
| Tutorial opens by source | Home vs mid-puzzle | Opens from inside a puzzle mean the rules weren't clear enough first |
| Tutorial opens by difficulty | Which puzzle drove them to the rules | `none` = opened from home |
| Difficulties played per session | 1 vs several | Tall bar at 1 = players treat difficulties as separate games |
| Share rate | Shares ÷ completions | The baseline for the pending share-text change |

**Three caveats when reading it:**

0. **Difficulty keys are not the labels.** Events carry `easy` / `medium` / `hard`, but players see **Easy / Tricky / Diabolical**. So `medium` in any chart means the puzzle labelled "Tricky", and `hard` means "Diabolical". The keys were deliberately left alone so history stays continuous across the rename.

1. **Timezone.** The project buckets by UTC, but puzzles roll over at each player's *local* midnight. Day-edge numbers will be slightly soft for players outside UTC; totals and trends are unaffected.
2. **`game_started` fires only for a fresh puzzle**, not when a saved game is restored from localStorage. That makes it a true count of starts, but it means a player who starts on one day and finishes after a reload shows up as a completion without a same-day start.

## 11. Weekly operating cadence (once you're rolling)

- **Monday, 15 min:** check DAU, D7 retention, share rate, top referrers.
- **One distribution action per week:** a directory submission, a community post, a cross-promo email, a press pitch.
- **One content page per two weeks.**
- **Reply to every piece of player feedback, always.**
