# CLAUDE.md review — findings and recommendations

Reviewed against the current Claude Code documentation (August 2026) and the actual
state of `src/`. Written 2026-08-22.

-----

## The short version

`CLAUDE.md` is 1,848 lines / 134KB / ~19,600 words. Anthropic's documented target is
**under 200 lines**. The file is ~9x that, and it loads in full at the start of every
session.

But size is the symptom, not the disease. The real problem is that the file is doing
**four different jobs at once**, only one of which belongs in always-on context:

| Job it's doing | Belongs in |
|---|---|
| Agent instructions ("do X, never Y") | `CLAUDE.md` ✅ |
| Product specification (rules, modes, UI behaviour) | `README.md` / `docs/` |
| Design rationale essays (why the flame is nudged 2px) | `docs/` |
| Procedures (record the tutorial, add a language) | `.claude/skills/` |

Nothing here is *bad writing* — much of it is genuinely excellent, and the rationale
sections are the most valuable thing in the repository. The recommendation is almost
never "delete this"; it's "move this somewhere it loads only when it's relevant."

-----

## Finding 1: the context cost is real and it's paid every session

| | |
|---|---|
| `CLAUDE.md` | 134KB, ~34k tokens (estimated at ~4 bytes/token) |
| All of `src/` + `scripts/` | 457KB |
| Share of a 200k context window | **~17%, before Claude reads a single file** |

The documentation is 29% the size of the entire codebase it describes.

Anthropic's guidance is unambiguous about the consequence:

> Bloated CLAUDE.md files cause Claude to ignore your actual instructions!
> — [Best practices](https://code.claude.com/docs/en/best-practices)

> Files over 200 lines consume more context and may reduce adherence.
> — [Memory](https://code.claude.com/docs/en/memory)

This matters most for the rules that are genuinely load-bearing. Right now
"**do not touch `HINT_PLACEMENT.medium` while the re-test is running**" — a real,
costly-to-violate instruction — is sitting on line 1,545, competing for attention with
a paragraph about Monoton's kerning.

-----

## Finding 2: most of the file fails the conciseness test

The test from Anthropic's docs: *"Would removing this cause Claude to make mistakes?"*

Their include/exclude table maps onto this file uncomfortably well:

| ❌ Their "exclude" | Where it appears here |
|---|---|
| Anything Claude can figure out by reading code | `File Structure` (65 lines), `Key Modules & Responsibilities` (32 lines) |
| File-by-file descriptions of the codebase | Both of the above |
| Long explanations or tutorials | `Magnitude-Based Color System` (86 lines), `Bottom Sheet Component System` (112 lines) |
| Information that changes frequently | `Development Status`, the experiment results tables |
| Detailed API documentation | `Analytics` event table (74 lines), `Player Feedback Systems` (135 lines) |

The `Expected Behavior Summary` section (51 lines) is a straight restatement of
`Game Rules & Mechanics` and `Mobile Gestures` — it's a third copy of rules already
stated twice.

`/doctor` now automates exactly this triage: it "cuts content Claude can derive from
the codebase, such as directory layouts, dependency lists, and architecture overviews,
and keeps pitfalls, rationale, and conventions that differ from tool defaults." Worth
running as a first pass.

-----

## Finding 3: it has drifted out of sync with the code

This is the more serious finding, because contradictory instructions are worse than
absent ones — the docs note that when two rules conflict, "Claude may pick one
arbitrarily."

Four confirmed drifts, found by grepping the claims against `src/`:

**1. The pulsing hint background is documented as a live feature. It has no callers.**

`renderHintPulse()` is defined at `src/renderer.js:475` and called from nowhere.
Yet `CLAUDE.md` describes it as shipping behaviour in four separate places:

- *Animations*: "Pulsing background for hint validation areas (2s cycle, max 20% opacity)"
- *Constraint States*: "**Pulsing background**: Animated 3x3 area showing validation region"
- *Modify Hint Display* step 2: instructs you to edit the colour assignment inside it
- *Tutorial* section: correctly notes it "**has no callers**"

The file both asserts and denies the same fact.

**2. The partial win sheet is documented in a usage table but does not exist.**

`Bottom Sheet Component System → Current Usage` lists:

> | Partial win (game) | Transient | HTML string | `circle-check-big` | `partial` | "Keep trying" |

There is no caller for `colorScheme: 'partial'` in `views/game.js`, and no
"Keep trying" string in `i18n/messages/en.js`. Sixty lines earlier the same document
says the `partial` scheme "is left in place but currently has no caller."

**3. The build comment says 8 locales. There are 12.**

Line 1769: `npm run build  # All 8 locales`. Line 842: "shipping in **12 languages**".
`src/i18n/locales.js` registers 12.

**4. The file documents dead code rather than removing it.**

`secondaryButton` in `bottomSheet.js` — correctly documented as having no callers.
`ENABLE_EARLY_GAME_ENDING` — a removed feature that still gets a full paragraph
explaining its removal. This is archaeology; it costs tokens every session to tell
Claude about code that isn't there.

**Root cause:** there is no `README.md`. With no human-facing document, `CLAUDE.md`
became the place every decision got written down — a design log, changelog and spec
in one. Design logs are append-only by nature, which is why this one only grows
(52 commits touch it) and why nothing ever gets deleted from it.

-----

## Finding 4: one common piece of advice is wrong, and worth avoiding

Most blog posts recommend splitting a large CLAUDE.md into files pulled back in with
`@path` imports. **That does not reduce context.** From the docs:

> Splitting into `@path` imports helps organization but doesn't reduce context, since
> imported files load at launch.

Imports are an organisational tool only. The two mechanisms that actually defer
loading are:

| Mechanism | Loads when | Good for |
|---|---|---|
| `.claude/rules/*.md` with `paths:` frontmatter | Claude reads a file matching the glob | Conventions and gotchas tied to one area of the code |
| `.claude/skills/*/SKILL.md` | Claude judges it relevant, or you type `/name` | Multi-step procedures |
| Plain `docs/*.md`, referenced by name | Claude chooses to read it | Long-form rationale and reference |

Two mechanics worth knowing while editing:

- **Block-level HTML comments are stripped before injection.** `<!-- ... -->` notes for
  human maintainers cost zero tokens.
- **Root `CLAUDE.md` survives `/compact`** and is re-injected from disk. Path-scoped
  rules reload when a matching file is next read.

-----

## Recommended structure

```
README.md                          # NEW — what Loopy is, stack, quick start (human-facing)
CLAUDE.md                          # ~120 lines: commands, hard rules, gotchas, pointers
.claude/rules/
  generation.md      paths: src/generator.js, src/generation/**, src/seededRandom.js
  rendering.md       paths: src/renderer.js, src/tokens.*, src/config.js
  interaction.md     paths: src/gameCore.js, src/utils.js
  persistence.md     paths: src/persistence.js, src/experiment.js
  i18n.md            paths: src/i18n/**, scripts/build-locales.mjs, index.html
  ui-components.md   paths: src/components/**, src/bottomSheet.js, style.css
  analytics.md       paths: src/analytics.js
.claude/skills/
  record-tutorial/SKILL.md         # wraps docs/recording-tutorial-videos.md
  add-language/SKILL.md            # the 4-step (5 for a new script) procedure
  tune-hints/SKILL.md              # verify-offline-across-365-seeds procedure
docs/
  design-decisions.md              # NEW — the rationale essays, kept intact
  experiments.md                   # NEW — round 1 results, round 2 spec, teardown
  growth-strategy.md               # unchanged
  recording-tutorial-videos.md     # unchanged
```

### Where each current section goes

| Current section | Lines | → Destination |
|---|---|---|
| Key Modules & Responsibilities | 32 | **Delete** — derivable; goes stale |
| Core Concepts | 8 | `CLAUDE.md` — genuine domain vocabulary |
| Grid Sizes / labels-vs-keys | 22 | `CLAUDE.md` (keep the `easy`/`medium`/`hard` ≠ labels rule; it's a real trap) |
| Storage Keys | 15 | `rules/persistence.md` |
| Core Rules, Victory Condition | 34 | `README.md` + one line in `CLAUDE.md` |
| Constraint Validation Algorithm | 29 | `rules/rendering.md` |
| Player Feedback Systems | 135 | `docs/design-decisions.md`; scoring gotcha → `rules/rendering.md` |
| Magnitude-Based Color System | 86 | `docs/design-decisions.md` |
| Tech Stack / File Structure | 76 | `README.md`; **delete the tree** |
| Puzzle Generation | 42 | `rules/generation.md` |
| Tricky hint placement experiment | **124** | `docs/experiments.md` + a **5-line** freeze rule in `rules/generation.md` |
| Daily Puzzle System | 27 | `rules/generation.md` |
| Navigation & Routing | 48 | `CLAUDE.md` (locale-prefix rule only); rest → `README.md` |
| Game Progress Persistence | 26 | `rules/persistence.md` |
| Timer Behavior, Undo System | 55 | `README.md` |
| Streak System | 64 | `rules/persistence.md` + `docs/design-decisions.md` |
| Localisation | 80 | `rules/i18n.md` (mechanics) + `docs/design-decisions.md` (SEO thesis) |
| Adding a language | 9 | `skills/add-language/` |
| Analytics (PostHog) | 74 | `rules/analytics.md` |
| Color Token System | 76 | `rules/rendering.md` |
| Bottom Sheet Component System | 112 | `rules/ui-components.md`, heavily cut |
| Home Screen Menu | 26 | `rules/ui-components.md` |
| Tutorial Bottom Sheet System | 77 | `rules/ui-components.md` + `skills/record-tutorial/` |
| Design System / Animations / Mobile Gestures | 206 | `rules/ui-components.md` + `rules/interaction.md` |
| Development Status | 39 | **Delete** — a changelog, stale by design |
| Common Modification Patterns | **172** | Split across the matching `rules/*.md` |
| Key Development Tips | 50 | `rules/interaction.md` (the perf hot-path warning is worth keeping) |
| Quick Start Commands | 38 | `CLAUDE.md` — this is the highest-value content in the file |
| Expected Behavior Summary | 51 | **Delete** — third statement of rules already given twice |

### What a ~120-line CLAUDE.md contains

1. **Commands** — `npm run dev`, `LOCALE=de npm run dev`, `check:i18n`, `build`,
   `build:single`, `record:tutorial`, `boards:tutorial`. Plus the two dev-server
   caveats (one language at a time; `_redirects` not processed).
2. **Hard rules** — the things that cost real money to get wrong:
   - Never edit `dist/_redirects` or `dist/sitemap.xml`; they're generated.
   - Never hand-author a tutorial clip; re-record.
   - Never edit `src/` or `style.css` while a recording is running (HMR kills the run).
   - Never call `t('difficulty.…')` directly — use `getDifficultyLabel()`.
   - Difficulty keys stay `easy`/`medium`/`hard` in URLs, storage, seeds, analytics.
   - Routes are written without the locale prefix; `router.js` adds it.
   - `HINT_PLACEMENT.medium` and `TRICKY_COVERING` are frozen until the re-test ends.
3. **Non-obvious gotchas** — the PostHog slim build silently returns `undefined` from
   `getFeatureFlag()`; PostHog drops events when `navigator.webdriver` is true;
   `config.js` imports the i18n runtime so offline harnesses need stubs.
4. **Pointers** — one line each to `docs/` and the skills, so Claude knows what exists.

Target: every line answers yes to *"would removing this cause a mistake?"*

-----

## Recommended sequence

1. **Fix the drift first, in code.** Either wire up `renderHintPulse()` or delete it
   and `secondaryButton` and the `partial` scheme. Dead code is what generates
   contradictory documentation. Fix `# All 8 locales` → 12.
2. **Write `README.md`.** Until the human-facing doc exists, everything keeps landing
   in `CLAUDE.md` by default. This is the change that stops the regrowth.
3. **Lift out `docs/design-decisions.md` and `docs/experiments.md`** verbatim — cut and
   paste, no rewriting. This alone removes ~500 lines from always-on context.
4. **Add the `.claude/rules/` files** with `paths:` frontmatter.
5. **Cut `CLAUDE.md` to the ~120-line core** and run `/doctor` to catch what's left.
6. **Add the three skills.** `record-tutorial` is the clearest win: 613 lines of
   procedure that currently has to be found via a prose pointer.

Steps 1–2 are worth doing even if nothing else happens.

-----

## Two things worth protecting

**The rationale is the valuable part, and it should not be summarised away.** The
explanation of *why* `BACKTRACK_THRESHOLD` is 1 — including that the two failure modes
are asymmetric, and that `undo_used` firing 26 times per player is the intended
division of labour rather than a symptom — is exactly the kind of thing that stops an
agent "helpfully" tuning a constant back to a plausible-looking value. Same for "hint
count is not a free parameter" and the `hreflang` reasoning. Move it, keep it whole.

**The experiment section needs an owner, not just a home.** 124 lines describing a
running A/B test with a teardown checklist is correct today and pure noise the day
Tricky is called. Putting it in `docs/experiments.md` with a 5-line freeze rule in
`rules/generation.md` means teardown is deleting one file and five lines, rather than
finding and unpicking references scattered through a 1,800-line document.

-----

## Sources

- [Claude Code — How Claude remembers your project (memory / CLAUDE.md)](https://code.claude.com/docs/en/memory)
- [Claude Code — Best practices](https://code.claude.com/docs/en/best-practices)
- [Claude Code — Skills](https://code.claude.com/docs/en/skills)
- [Claude Code — Monorepos and large codebases](https://code.claude.com/docs/en/large-codebases)
- [HumanLayer — Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
