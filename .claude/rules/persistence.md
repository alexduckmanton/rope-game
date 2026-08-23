---
paths:
  - "src/persistence.js"
  - "src/experiment.js"
  - "src/components/winStreakLine.js"
  - "src/components/streakFlame.js"
---

# Storage, saves and streaks

All state lives in localStorage — there is no backend. Keys are per **origin**, so every language build shares them.

### Storage Keys

- Daily puzzles: `loop-game:daily:2025-11-30-easy`
- Unlimited mode: `loop-game:unlimited:medium` (one slot per difficulty)
- Settings: `loop-game:settings` (global, shared across all modes)
- Streaks: `loop-game:streak:easy` (per difficulty) and `loop-game:streak:overall`, each storing `{ current, best, lastDate }`
- Tricky hint arm: `loop-game:experiment:tricky-hints`, storing `{ variant, source }`
  (round 1's `loop-game:experiment:hint-generation` is orphaned - nothing reads it)

All of these are keyed per **origin**, not per path, so they are shared across every language build: switching language keeps streaks, settings and part-finished puzzles intact.

**The one cookie:** `nf_lang`, set only when a player picks a language from the switcher. It is read by Netlify's root redirect, not by any application code, and exists so an explicit choice permanently outranks the browser's `Accept-Language` header. See "Localisation".

-----

-----

### Game Progress Persistence

Auto-saves game state to localStorage (client-side, no backend).

**Key Architecture:**

1. **Throttled saves**: First save immediate, then 5-second cooldown prevents excessive writes during rapid drawing. Trailing save ensures final state captured after cooldown. Immediate saves bypass throttle on tab blur, navigation, or game completion. Players never lose more than 5 seconds of progress.

2. **Storage keys**: See Quick Reference for patterns
   - Daily: One slot per date+difficulty (e.g., `loop-game:daily:2025-11-30-easy`). Old saves auto-cleaned on app init.
   - Unlimited: One slot per difficulty (e.g., `loop-game:unlimited:medium`). Switching difficulties saves current state, loads target difficulty state (or generates new if none exists).
   - Settings: Global singleton (`loop-game:settings`) shared across all modes.

3. **State vs Settings**: Game state (player path, connections, timer, win status, and the hint generation arm the puzzle was built with) is per-puzzle. Unlimited mode includes puzzle data (solution path, hint cells) since it's not deterministic. Settings (hint mode, border mode, show solution, last unlimited difficulty) are global.

4. **Data format**: Sets→Arrays, Maps→Objects (JSON-serializable), version field for migration, timestamp for debugging. Throttle returns `{ save, destroy }` for cleanup.

**Save triggers**: Player moves, restart, new puzzle, completion.
**Save skips**: Window resize, settings toggles (have dedicated save), undo operations.

**Edge cases**: restore without triggering cooldown, daily ID validation, immediate save on tab blur.

**Session-only state**: Undo history is not persisted to localStorage. Cleared on puzzle load, new puzzle, or difficulty change.

**Tradeoffs**: No cross-device sync, trust-based times, 5-second max progress loss (rare).

-----

### Streak System

**Purpose:** Gives players a reason to return tomorrow. Daily puzzle games live on streaks — without one there is no cost to skipping a day.

**Tracking:** Two kinds of streak, both stored as `{ current, best, lastDate }`:

- **Overall** (`loop-game:streak:overall`) — the one players are asked to protect. Completing *any* of the three daily puzzles extends it, so a busy day costs them the Diabolical puzzle rather than the whole streak.
- **Per difficulty** (`loop-game:streak:<difficulty>`) — kept for players who care about a specific difficulty, and surfaced only through the streak line's tap-to-cycle.

`recordDailyStreak(difficulty)` extends both and returns `{ difficulty, overall }`. Read them with `getStreak(difficulty)` and `getOverallStreak()`.

**Rules:**
- A completion extends a streak when the previous completion was **yesterday**, and starts a new streak of 1 otherwise.
- `reconcileStreaks()` runs on app start (from `main.js`) and treats any difficulty already flagged as completed today as a completion for streak purposes. Without it, a player who finished today's puzzle on a build without streak tracking would see nothing until tomorrow, since a completed puzzle is locked and can never run the completion path again. It is idempotent and silent on analytics.
- Recording twice on the same day is a no-op, so it is safe to call from every completion path.
- A streak stays **alive** while the last completion was today or yesterday. Any longer gap and the getters report `current: 0` — the stored value is only overwritten on the next completion.
- **Wins count**; viewing the solution does not extend a streak (though it does not break an already-live one either).

**Home screen display:**

A single line above the difficulty buttons: a flame plus text, e.g. "5 day streak". The text matches the tagline above it exactly - 20px, weight 600 - with the flame at 28px beside it. The line carries 24px of padding on its right against 8px on its left: the flame sits only on the left, so centring the group on its true middle leaves the text reading right of centre, and the extra padding pulls it most of the way back. The flame itself is nudged up 2px, its artwork being bottom-heavy enough to read low against the count when the two boxes are aligned.

The line shares a fixed-height slot (`.home-slot`, 72px — one large button tall) with the tutorial button. Exactly one of them shows, and sometimes neither:

| Streak live | Tutorial done | Slot shows |
|---|---|---|
| yes | either | Streak line |
| no | no | Tutorial button |
| no | yes | Nothing |

Both children start hidden in CSS, so the slot is empty at first paint and filling it once localStorage has been read never moves the difficulty buttons. This matters because the router shows the home view before `views/home.js` has finished loading — previously the tutorial button painted during that gap and then vanished, shifting the buttons.

Tapping the line cycles through every difficulty that currently has a live streak of its own, then wraps back to the overall total:

```
5 day streak  →  5 day medium streak  →  3 day hard streak  →  5 day streak
```

Difficulties with no live streak are skipped, so a tap never lands on "0 day streak", and the line is inert when there is nothing to cycle to. Cycle order follows the on-screen button order (`easy`, `medium`, `hard`) via the `DIFFICULTIES` constant in `views/home.js`.

This is deliberately styled as plain text, not a control — it is a small reward for the curious rather than a feature that needs discovering. The count is set in `--color-text-primary`, rather than the quieter `--color-text-secondary` the taglines use. The win sheet's streak half matches it; the completion time it slides up over stays secondary.

The difficulty buttons themselves carry only the existing completion icon: trophy for a win, skull for a viewed solution.

**Win sheet display:**

The perfect win sheet shows the overall streak too, revealed a couple of seconds after the sheet opens - see Win Sheet Streak Reveal under Validation Modals. This is the moment the streak has just been extended, so it is the most useful place to show it.

**The flame:**

Both streak lines get their flame from `createStreakFlameMarkup()` in `components/streakFlame.js`, so the home screen and the win sheet can never end up showing different ones.

Normally it is Microsoft's animated Fluent fire emoji (`public/streak-flame.webp`) — an animated WebP that loops by itself with no JavaScript driving it. It is authored with transparent padding around the flame, so it is rendered two pixels larger than the icon it stands in for; matching the icon's box would leave the artwork looking smaller.

`createStreakFlameMarkup(size)` takes the rendered size, because the two lines it appears in are set at different sizes: **28px on the home screen**, whose line matches the tagline's 20px text, and **20px in the win sheet**, whose line is one 16px line of sheet copy inside a 24px window it must not outgrow.

Players who have asked their system for **reduced motion** get the Lucide `flame` icon instead, two pixels smaller than the emoji it replaces and tinted with `--color-streak`. That branch is chosen in JavaScript rather than CSS specifically so those players never download the 75KB animation. The preference is read once per call, which is enough: a fresh line is built every time the home view initialises or the win sheet opens.

The emoji carries its own colour, so unlike the icon it looks identical in light and dark mode. It is decorative — the count beside it carries the meaning — so it has an empty `alt`.

The asset is 96x96, all 48 frames of the original, 122KB. That resolution is set by the largest render (28px) on the densest common screen (3x): 28 x 3 = 84 device pixels, so 96 covers it with a little headroom and the emoji never has to be upscaled. Anything above a 32px render needs the asset regenerating larger. It is MIT licensed; the notice and the command live in `ATTRIBUTION.md`.

**Analytics:** Each update fires `streak_updated` carrying both the difficulty and overall streaks, and writes them as person properties (`streak_current_<difficulty>`, `streak_current_overall`, and their `best` equivalents), so retention can be segmented by streak length.

-----

**Change Persistence Behavior:**
1. **Save cooldown**: Modify `SAVE_COOLDOWN_MS` constant in `persistence.js` (default 5000ms)
2. **Storage keys**: Update `getStorageKey()` function in `persistence.js`
3. **Cleanup logic**: Modify `cleanupOldSaves()` to change retention policy
4. **Settings schema**: Update `DEFAULT_SETTINGS` object and add migration logic if needed

-----

**Modify the Win Sheet Streak Reveal:**
1. **Timings**: `CONFIG.WIN_STREAK.REVEAL_DELAY_MS` and `CONFIG.WIN_STREAK.TRANSITION_MS` in `config.js`. The duration is applied inline to the track, so it overrides the CSS default.
2. **Easing**: `.win-streak-line-track` transition in `style.css`
3. **Wording**: `formatStreakLabel()` in `persistence.js` - shared with the home screen line, so a change lands in both
4. **Line height**: `.win-streak-line-window` height and `.win-streak-line-item` height in `style.css` must stay equal, and match one line of `.bottom-sheet-message` text. The flame is rendered at 20px inside a 24px line, so anything shorter clips it.

-----

**Modify the Streak Flame:**
1. **Swap the emoji for a different one**: replace `public/streak-flame.webp`, following the regeneration command in `ATTRIBUTION.md` with a different `assets/<Name>/animated/` source. Update the licence notice if it comes from somewhere other than Fluent Emoji
2. **Rendered size**: the `size` argument at each call site - `STREAK_FLAME_SIZE` in `views/home.js`, and the `FLAME_SIZE` default in `components/streakFlame.js` for the win sheet. Taking the win sheet's above 24px means also raising `.win-streak-line-window` / `.win-streak-line-item` in `style.css`, or it crops. Taking either above 32px means regenerating the asset larger, or it goes soft on 3x screens
3. **Reduced-motion fallback**: the `prefersReducedMotion()` branch in `components/streakFlame.js`. It returns a `data-lucide` placeholder, so any replacement icon must be registered in `icons.js` and both call sites must still run `initIcons()` afterwards
4. **Both call sites at once**: `views/home.js` (rebuilds the line on every visit) and `components/winStreakLine.js` - neither writes its own flame markup, so a change here lands in both
