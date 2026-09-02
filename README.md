# Loopy

A daily path-drawing puzzle. Draw one closed loop; the numbers tell you how many bends
belong in the 3x3 area around them. [loopy.wtf](https://loopy.wtf)

Vanilla JavaScript, no framework, no backend. Shipping in 12 languages.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173, English
LOCALE=de npm run dev  # ...in another language
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server, one language at a time |
| `npm run check:i18n` | Diff every dictionary against `en.js` (also runs in build) |
| `npm run build` | All 12 locales + `_redirects` + sitemaps, into `dist/` |
| `npm run build:single` | One locale only, for a quick check (`LOCALE=xx` to choose) |
| `npm run preview` | Serve the production build locally |
| `npm run boards:tutorial` | Replay every tutorial scene offline, no browser |
| `npm run record:tutorial` | Record the tutorial clips (needs `npm run dev` running) |

Deployed on Netlify from `main`: build `npm run build`, publish `dist`.

## How the game works

**Rules**

1. Draw **one continuous path** that forms a closed loop returning to its start.
2. The path moves **up, down, left and right** only — no diagonals.
3. **Numbered cells are clues.** Each says how many turns the path must make in the 3x3
   area centred on it (its 8 neighbours plus itself).
4. A turn is the path changing direction within a cell. Straight = 0, corner = 1.

**Winning.** Any valid closed loop that satisfies every hint wins, whatever its shape or
size. It does **not** need to visit every cell. Same rule at every difficulty.

**Difficulties.** Players see Easy / Tricky / Diabolical; the internal keys are
`easy` / `medium` / `hard` and appear unchanged in URLs, storage, daily seeds and analytics.

| Key | Label | Grid |
|---|---|---|
| `easy` | Easy | 4x4 |
| `medium` | Tricky | 6x6 |
| `hard` | Diabolical | 8x8 |

Every language has its own labels — German plays Einfach / Knifflig / Teuflisch — while the
keys are identical everywhere, which is what keeps analytics and daily seeds continuous
across languages.

## Modes

|  | Daily | Unlimited |
|---|---|---|
| Puzzle source | Deterministic from a date seed | True random |
| Consistency | Everyone gets the same puzzle on the same local date | Different every time |
| Entry | Home → pick a difficulty | Home → menu → Unlimited (defaults to Easy) |
| Difficulty | Fixed for the session | Switchable in-session via settings |
| New button | Hidden | Visible |
| Save slots | One per date + difficulty | One per difficulty |
| Rotation | New puzzle at local midnight | n/a |

Daily puzzles are seeded `YYYYMMDD` + a difficulty offset (0/1/2), through a Mulberry32
PRNG, so the same seed always produces an identical puzzle, hints and solution. No backend
is involved, which is what makes the offline story below as simple as it is.

**Streaks.** Completing *any* of the three daily puzzles extends the overall streak, so a
busy day costs the Diabolical puzzle rather than the whole streak. Per-difficulty streaks
are also kept, surfaced only through tapping the home screen's streak line.

## Offline

There is no offline *mode* to turn on, and nothing to download first. A service worker
stores each file the first time it is used, so playing one puzzle online is what makes that
puzzle playable on a plane. Nothing is fetched ahead of time except the page shell and a
2KB fallback screen.

Reach a part of the game that was never downloaded while offline — the tutorial's video, a
difficulty you have never opened — and you get a frownie face and one line. Everything else
behaves exactly as it does online, because it always did: the puzzles are generated on the
device and the results never left it.

One worker per language, each caching its own bundle. New builds install quietly and take
over once every tab is closed, so a deploy never interrupts a puzzle in progress. The
details, and the two mistakes that break it silently, are in `.claude/rules/offline.md`.

## Interaction

| Action | Result |
|---|---|
| Tap an empty cell | Path starts, cell is drawn |
| Tap an existing cell | Cell is erased, along with orphaned cells |
| Drag | Path extends smoothly, auto-breaking connections when crossing |
| Drag back one cell | That cell is erased |
| Drag back to the drag's first cell | Attempts to close the loop |
| Clear | Clears all drawn cells |
| Undo | Reverts the last drawing action, up to 50 |
| Tab blur / focus | Timer pauses and resumes automatically |

Dragging back **two or more** cells does not erase — it draws on through the crossing. See
`.claude/rules/interaction.md` for why.

## Settings

Global, shared across all modes, stored in `loop-game:settings`.

- **Numbers** — Required only (default) / Show all
- **Number behaviour** — Count down (default) / Show total / Show both
- **Borders** — Off (default) / Center only / Full
- **Solution** — overlays the solution path in blue, and disqualifies the attempt
- **Difficulty** — segmented control, unlimited mode only

## Layout

```
index.html          Single page, two view containers (home, play)
offline.html        Cold-start offline fallback; self-contained, translated at build time
style.css           Global styles, including the locale font stacks
src/
  main.js           Entry point: router, icons, fonts, theme-color
  router.js         History API routing; strips/adds the locale prefix
  sw.js             Service worker template; one is generated per locale at build time
  serviceWorker.js  Registration
  views/            home.js, game.js
  game/             timer, share, validation, canvasSetup
  generation/       hintPlacement.js
  components/       tutorialSheet, homeMenu, languageMenu, winStreakLine, streakFlame,
                    offlineNotice
  i18n/             locales.js (the registry), index.js (runtime), messages/*.js
  tokens.css        Every colour, with dark mode overrides
scripts/            Build, i18n check, and the tutorial recording runner
docs/               Design decisions, experiments, growth strategy, recording guide
```

Dark mode follows the system preference automatically; there is no toggle.

## Documentation

- `CLAUDE.md` — instructions for agents working in this repo
- `.claude/rules/` — conventions per area, loaded when that area is touched
- `docs/design-decisions.md` — why scoring, the win condition and hint colour work as they do
- `docs/experiments.md` — the hint placement experiment, live and settled
- `docs/recording-tutorial-videos.md` — how the tutorial clips are made
- `docs/growth-strategy.md` — the localisation and SEO thesis
- `ATTRIBUTION.md` — licences for third-party assets committed here
