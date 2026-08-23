---
paths:
  - "src/components/**"
  - "src/bottomSheet.js"
  - "style.css"
  - "index.html"
  - "src/views/home.js"
  - "src/router.js"
---

# UI components and layout

The bottom sheet is the app's only modal pattern; every overlay goes through it. Tutorial clips are recordings of the real game — use the `record-tutorial` skill rather than editing them.

### Bottom Sheet Component System

**Purpose:** Unified modal overlay system replacing browser alerts throughout the application. Provides consistent animations, dismissal methods, visual design with icons and color schemes for all transient notifications and persistent settings panels.

**Architecture:** Factory pattern with closure-based state management. Module exports two functions serving different use cases:

| Function | Use Case | Lifecycle | Returns |
|----------|----------|-----------|---------|
| `createBottomSheet()` | Persistent sheets that need manual control | Caller manages show/hide/destroy | Instance with methods |
| `showBottomSheetAsync()` | One-time notifications that auto-show | Fire-and-forget, auto-shown async | Instance for optional control |

**Visual Design:**

Bottom sheets feature a redesigned layout with overlapping icons, centered titles, and a prominent dismiss button. The icon container straddles the top edge of the sheet, creating a visual pop-out effect:

```
        ┌────────┐  ← 40px above sheet edge
────────│  Icon  │──── ← Sheet top edge (icon center)
        └────────┘  ← 40px inside sheet

      Sheet Title       ← Centered title (24px, bold)

   Content area here    ← Message or settings content

  ┌─────────────────┐
  │  Dismiss Label  │   ← Bottom dismiss button (blue, rounded)
  └─────────────────┘
```

Icon container is 80px tall, fully rounded, with center aligned to sheet's top edge. When no icon is present, additional top spacing is applied to the header.

**Color Schemes:**

Five predefined color schemes provide visual context. Only `neutral`, `success` and `info` currently have callers:

| Scheme | Icon Color | Background Color | Usage |
|--------|-----------|------------------|-------|
| `neutral` | `#6B7280` (grey) | `#F3F4F6` (pale grey) | Settings, default |
| `success` | `#F59E0B` (amber/gold) | `#FEF3C7` (pale golden yellow) | Perfect win notifications, celebrations |
| `error` | `#EF4444` (red) | `#FEE2E2` (pale red) | Error feedback - no callers |
| `info` | `#3B82F6` (blue) | `#DBEAFE` (pale blue) | Informational messages |
| `warning` | `#F59E0B` (amber) | `#FEF3C7` (pale amber) | Warnings - no callers |

**Design Rationale:**

The dual-function approach emerged from analyzing actual usage patterns across the codebase. Settings requires persistent control (show on button click, hide on dismiss, reuse same instance across sessions), while game notifications are transient fire-and-forget messages. Two functions eliminate boilerplate without sacrificing flexibility.

Factory pattern with closures (rather than classes) keeps the API surface minimal and avoids the cognitive overhead of instantiation syntax. Each instance maintains private state for overlay references, content tracking, and cleanup handlers without polluting global scope or requiring state management libraries.

**Content Type Flexibility:**

Accepts both HTML strings and HTMLElement instances as content. This distinction enables two critical behaviors:

**HTML Strings (Notifications):** Content is inserted as innerHTML and discarded on destroy. Used for win messages, tutorial feedback, and alerts. Lightweight and simple.

**HTMLElement Instances (Settings):** Original DOM element is moved into the sheet, then restored to original location on destroy. Critical for settings panel which must survive across multiple show/hide cycles without losing state or event listeners. The component tracks parent node and sibling position to restore element exactly where it was found.

**Key Behaviors:**

**Animation Synchronization:** Bottom sheets use CSS transitions for smooth slide-up/slide-down animations. JavaScript timing must synchronize with CSS timing to avoid visual glitches. The async helper encapsulates the requestAnimationFrame plus setTimeout pattern required to wait for DOM render completion before triggering CSS transitions. This pattern was repeated five times before extraction into the helper function.

**Dismissal Methods:** Two ways to close sheets, all triggering the same cleanup flow:
- Click dismiss button at bottom (customizable label)
- Click outside overlay (click-to-dismiss)

All dismissal paths wait for hide animation to complete before firing onClose callback, ensuring smooth transitions before navigation or state changes.

**Dismiss Button Labels:** The dismiss button label is customizable and provides contextual actions:
- `"Close"` - Default, used for settings and general dismissal
- `"Next"` - Tutorial progression, navigates to next lesson on close
- `"Yay!"` - Win celebration, adds emotional response to victory
- `"Play another"` - Daily win with another difficulty unfinished; navigates there on close

**Callback System:** Optional onClose parameter enables navigation or state updates after sheet dismisses. Used in tutorial to advance to next lesson when user closes win notification. Callback fires after hide animation completes but before instance destruction.

**Resource Management:** Destroy method removes overlay from DOM and handles content cleanup. For HTMLElement content, restores element to original location with display:none to prevent FOUC. For string content, simply removes overlay. Settings sheet persists across game sessions (created once, show/hide many times), while notification sheets are destroyed immediately after use.

**Icon Integration:** Bottom sheets render optional Lucide icons in centered containers that straddle the top edge of the sheet. Icon container uses negative margin to position 40px above and 40px below the sheet edge, creating a visual pop-out effect. Component calls project's initIcons function after DOM insertion to convert icon placeholders into SVG elements. This maintains tree-shaking benefits while ensuring icons render correctly.

**Icon Usage:**
- `settings` - Settings sheet
- `party-popper` - Win notifications with golden celebration colors
- `circle-off` - Incorrect loop feedback with error colors

**Spacing Architecture:** Consistent 40px total gap between content and dismiss button across all sheet types. Achieved through content bottom padding plus button top margin. Settings items use 20px sides/top with 16px bottom. Messages use 0 top and 16px bottom. Header uses 8px top/bottom when icon present, 24px top when no icon. Button uses uniform 24px top margin for all sheets.

**Animation Constants:** Module defines ANIMATION_DURATION_MS constant (300ms) matching CSS transition timing. This constant is referenced by both show/hide methods and exported for use in tests or dependent code. All animation timing flows from this single source of truth.

**CSS Architecture:** Component applies generic bottom-sheet-* CSS classes rather than inline styles. Message content uses .bottom-sheet-message class for consistent padding, centering, and typography. This separation of concerns keeps JavaScript focused on behavior while CSS handles presentation.

**Current Usage:**

| Location | Sheet Type | Content | Icon | Color Scheme | Dismiss Label |
|----------|-----------|---------|------|--------------|---------------|
| Settings panel | Persistent | HTMLElement | `settings` | `neutral` | "Close" |
| Perfect win (game) | Transient | HTMLElement (daily) / HTML string | `party-popper` | `success` | "Yay!" |
| Perfect win (tutorial) | Transient | HTML string | `party-popper` | `success` | "Next" |

**Integration Points:**

Settings sheet integrates with persistence system (saves on toggle), router (dismisses on navigation), and game state (re-renders on difficulty change). Notification sheets integrate with game validation (shown on a perfect win only - a closed loop that fails its hints shows no sheet) and the tutorial system (navigation callbacks).

**Known Limitations:**

No built-in state tracking across multiple sheets (only one should be visible at a time, enforced by convention not code). No animation queueing (rapid show/hide calls may cause visual glitches). No accessibility enhancements yet (no focus trapping, no ARIA labels, no keyboard shortcuts). These are acceptable tradeoffs for current single-sheet usage patterns but would need addressing for more complex modal workflows.

**Future Considerations:**

Component could be extended to support multiple simultaneous sheets with z-index stacking, animation queueing for rapid successive shows, keyboard navigation (Escape to close), focus management (trap focus within sheet, restore on close), and ARIA attributes for screen readers. Current implementation prioritizes simplicity and covers all existing use cases without over-engineering for hypothetical requirements.

-----

### Home Screen Menu

**Purpose:** Holds the destinations that do not earn a place in the main button stack, keeping the home screen down to the three daily puzzles.

A 44px hamburger button is fixed in the top-left of the home screen. Tapping it slides a sheet in from the left over a dimmed scrim.

**Contents:** How to play (opens the tutorial sheet), Unlimited, **Language**, Support Loopy, Give feedback. The support and feedback links moved here from the old home footer, which is gone.

The language row is built by `components/languageMenu.js` rather than written into `index.html`, so adding a language never means editing the markup. It reuses the settings sheet's select-row markup — label left, current value and chevron right, transparent native `<select>` over the row — so the "this opens a picker" affordance is one players have already met in game settings. It sits here rather than in the in-game settings sheet on purpose: a language control two taps into a game screen is one nobody finds.

This menu is the **only** place the support link appears. It used to also sit as a secondary button on the daily perfect win sheet, which put an ask in front of the player at the moment they had just won. The bottom sheet's `secondaryButton` option existed for it, and was removed once it had no callers.

**Mechanics:**

- All open/closed styling hangs off a single `menu-open` class on `#home-view`, so the toggle icon, the scrim and the sheet stay in step without the JavaScript touching each of them.
- The icon swap is two Lucide icons (`menu` and `x`) stacked in one grid cell. They cross-fade while the stack rotates 180°, so the change reads as a single movement rather than two.
- Open and close both run 350ms on `cubic-bezier(0.83, 0, 0.17, 1)` — a quint ease-in-out, steep off the mark and slow to settle.
- `visibility` is delayed by the full duration on the way out, so the sheet finishes sliding before it stops being hit-testable.
- Closes on the toggle, a scrim tap, or Escape.
- Menu items carry `tabindex="-1"` while the sheet is closed, so keyboard users never land on a link they cannot see.
- The view cleanup closes the menu, so navigating back to home never restores a half-open sheet.

**Layering:** scrim 900, sheet 910, toggle 920 — the toggle sits above the sheet so the icon swaps in place rather than being covered, and the whole menu sits below the bottom sheet overlay (1000) so the tutorial stacks over it.

**Reduced motion:** `prefers-reduced-motion` collapses `--menu-duration` to 0.01ms, so the menu changes state without animating.

-----

### Tutorial Bottom Sheet System

**Architecture:** Self-contained carousel component providing an interactive walkthrough accessible from any view without navigation. Four sections, each a silent clip of the real game and one line of copy.

**Key Design Decisions:**

**Bottom Sheet Instead of Dedicated View:**
- Maintains user context - the tutorial overlay doesn't navigate away from the current screen
- Accessible from anywhere via a simple function call - no routing complexity
- Consistent with the app's modal pattern for transient content
- Reduces bundle size by eliminating separate view scaffolding

**Horizontal Scrolling Carousel:**
- iOS-style onboarding pattern familiar to mobile users
- Natural swipe gesture for progression through lessons
- Scroll-snap ensures crisp section alignment
- Paging dots track position and jump straight to a section - the only way back to an earlier card. 8px with an 8px gap so the row reads as one group; the 44px tap target comes from vertical padding on each dot, which does not push them apart. The dots' *container* carries no vertical padding of its own - that 18px per dot already reads as space, and stacking more on top put 42px between the copy and the dots

**The four cards**, in the order a player meets the mechanics: the two gestures, then what the numbers mean, then the goal.

| # | Analytics name | Teaches |
|---|---|---|
| 1 | `Drawing loops` | Drag to draw a loop, any shape or size |
| 2 | `Erasing` | Tap to erase parts of the loop |
| 3 | `Counting bends` | Bends inside the box a number watches count it down; bends outside it do not, and the loop closes without reaching zero |
| 4 | `Win condition` | A loop closes with one number still at 2 and nothing happens; fix it, both read zero, the loop goes green |

Card 4 carries the near-miss rather than giving it a card of its own. A closed loop that fails its hints is Loopy's most common stuck state - it fires `validation_error` - and nothing else in the product explains it, but split across two cards the first ends on "nothing happened", which is a weak place to leave a viewer and a weak place to start one.

Cards 1, 2 and 4 run on **one puzzle** and 3 on another, so three quarters of the tutorial is a single game developing rather than four unrelated boards. Card 3 needs a hint away from the edges — the only way to show a bend that is plainly *outside* the area a number watches without it being off the grid.

**Cards 1 and 2 show a bare grid.** The runner masks the two hint cells, which is not the same as planting a board with no hints: a board with no hints is one where every constraint is trivially satisfied, so a closed loop turns green two cards before green means anything. Keeping the hints and hiding the numbers keeps the loop black.

**Card 3 is recorded with Borders set to Full**, the game's own setting, planted into `loop-game:settings` for that scene alone. The card's lesson is *which* squares a number watches, so the boundary has to be visible, and `drawHintBorders()` already outlines each hint's 3x3 area in the hint's own colour - so the outline and the number always agree. The card's loop bends six times: three outside the box, changing nothing — a whole stroke of it — and three inside, walking the number 5 to 4 to 3 to 2, one per bend, finishing as the loop closes on a bend that is itself outside. **The stroke that does the counting is drawn at half again the tutorial's pace** (`pace: 1.5` on that step, a multiplier on `CELL_MS`) — three of the card's four number changes land inside it, and at the shared rate they arrive faster than a first-time viewer can tie each to its bend. **It deliberately stops short of zero.** Zero is green and green means solved, which is card 4's job; a card 3 that finished on zero would show a closed loop being rejected and a satisfied hint in the same frame, which is two lessons fighting. An earlier cut drew a pulsing blue rectangle behind the canvas instead; that made card 3 the one place a clip showed something a player could never see on their own board. `settingsFor()` in the runner is the only door for this and rejects any key that is not already a capture default.

**Video-Based Content:**
- Four clips, recorded by playing the real game - see `docs/recording-tutorial-videos.md`. Never author or hand-edit one; re-record instead
- **Light and dark variants of every clip.** Sources are swapped live on the `themeChanged` event, preserving playback position, so a theme flipping mid-clip does not restart the lesson
- **Play once and hold the last frame**, rather than looping. A loop has no beginning, so a viewer arriving mid-cycle sees an effect with no cause - and the last frame of every clip is the state its lesson is about
- A **progress bar** along the bottom edge of the clip and a **replay button** at the right of the dots row. A clip that stops has to say so, or a viewer waits for a loop that is never coming
- The **poster is the clip's own first frame** (a webp), so the still and the start of playback are the same picture. This replaced a shimmering skeleton loader that cut hard to frame 1
- A **light border** on the container. The clips are a white board cropped to its own edges, so on a white sheet they would otherwise float with no boundary; the border uses the same token as the game's grid lines
- **The mp4 is listed before the webm**, which is the reverse of the usual order. On line art this flat x264 beats VP9 on every clip, so mp4-first hands most browsers the smaller file. The webm stays because a Chromium built without proprietary codecs cannot decode h.264 at all, and needs something to fall through to
- **Captured at 1200px** — 3x the game's own 400px canvas, which is what a 3x phone renders at the width the sheet caps the clip to. The capture scale is a frame-rate setting as much as a resolution one and used to be pinned at 2 by it; recording in slow motion is what lifted the ceiling. See the recording doc. Total 2.1MB for eight clips in two formats plus eight posters, but only the visible clip and the next are ever fetched, so swiping the whole tutorial in one theme costs about 470KB. Deployed once at the domain root, since locale builds reference `/videos/` absolutely rather than copying it twelve times

**Technical Implementation:**

**Module State Management:**
- Video elements created once on first `showTutorialSheet()` call and reused for the session
- Intersection Observer, theme listener and progress rAF all released via the bottom sheet's `onClose` callback, and again on reopen
- Double requestAnimationFrame ensures DOM ready before observer setup
- Named constants for configuration values (`VIDEO_VISIBILITY_THRESHOLD`, `PRELOAD_AHEAD`)

**Performance:**
- `preload="none"` on every clip, raised to `auto` only for the visible section and the one after it (`PRELOAD_AHEAD`). Opening the sheet used to fetch all the clips before the first had played; a player who reads card 1 and closes now downloads two
- Progress bars are driven on `requestAnimationFrame`, not `timeupdate` - the latter fires about four times a second and the bar visibly steps
- Video element reuse - no DOM thrashing on section changes
- Sections scrolled out of view **pause and rewind**, so swiping back never lands on a finished clip's last frame

**Layout:** the clip is square and its width therefore sets the sheet's height, so it is capped at `min(100% - 40px, 88vh - 300px, 400px)`. Without the `88vh` term the sheet is the entire screen on a short phone (it measured 640px of a 640px viewport), leaving no backdrop to tap. The 400px is the game's own canvas size, and the clips are captured at 1200px so a 3x screen renders that cap without upscaling.

**No close icon.** The sheet carries no X, so it closes on a backdrop tap or on the nav button, which reads "Got it" on the last card. The `88vh` height cap is what makes that safe - it is the guarantee that a backdrop exists to tap on a short phone, and removing it would leave the nav the only way out. `showCloseIcon` is still available on the bottom sheet component and the win sheet uses it.

**The copy has no fixed height.** It used to reserve three lines so a longer line in one language could not shuffle the dots as the carousel scrolls, but the sections are flex items in a row and already stretch to the tallest of them - the dots could never have moved. The reservation only added dead space, 40px of it under a one-line card. Removing it and the dots container's own padding took 40px off the whole sheet and cut the gap between copy and dots from 82px to 26px. It is also more correct per language: four captions (de, fr, pt-BR) wrap to three lines at 320px and now get three, while English pays for the two it uses. The `88vh - 300px` budget was deliberately *not* reduced to match - the 40px goes to backdrop instead, which matters more now the close icon is gone.

**Integration Points:**
- Accessible via `showTutorialSheet()` from `home.js`, `homeMenu.js` and `game.js`
- No dependencies on game state or routing
- Shares the bottom sheet component for consistent UX
- Clips live in `public/videos/<scene>-<theme>.{mp4,webm,webp}`

**Resource Cleanup:** observer disconnected, theme listener removed and the progress rAF cancelled on sheet close. Video elements remain cached in memory for instant reopening; on app reload they are rebuilt on first tutorial access.

-----

-----

### Design System

**Color System:**

The app uses a comprehensive design token system with automatic dark mode support. All colors are defined in CSS custom properties and automatically adapt based on the user's system preference.

**Key Features:**
- **Automatic dark mode**: Follows device settings via CSS media queries, no manual toggle
- **Two-tier token system**: Base color scales (neutral, blue, green, red, amber) + semantic tokens (primary, bgBase, textPrimary, etc.)
- **CSS as source of truth**: JavaScript reads colors from CSS for canvas rendering, ensuring consistency
- **Theme-aware re-rendering**: Canvas automatically updates when system theme changes
- **Magnitude-based hint gradient**: Nine distinct colors (bright yellow-orange → dark magenta) convey constraint difficulty through color intensity

**Light Mode Characteristics:**
- Light gray backgrounds with dark text for comfortable reading
- Vibrant accent colors (blue, green, amber) for clear visual hierarchy
- White elevated surfaces (buttons, sheets, canvas) with subtle shadows

**Dark Mode Characteristics:**
- True dark backgrounds (near-black #1A1A1A) for OLED-friendly display
- Light text on dark backgrounds with proper contrast ratios
- Brightened accent colors for visibility on dark backgrounds
- Elevated surfaces lighter than base for proper depth perception
- Adjusted hint gradient maintaining visual hierarchy in low-light conditions

For implementation details, see Color Token System in Key Systems section.

**Typography:**
- **Body Copy**: Inter (400, 500, 600, 700) - Clean sans-serif for UI text, buttons, labels
- **Display Font**: Monoton - Retro display font for "Loopy" title only
- **Implementation**: Self-hosted via @fontsource, preloaded via JavaScript, font-display: block (no flicker)
- **Performance**: ~120KB total, ~30KB gzipped, loads in 100-200ms
- **Timer**: Uses tabular numerals (monospaced digits) to prevent layout shift during counting

**Layout (Mobile-First):**

```
+---------------------------+
|   [←] [Title]   [🎲 ? ⚙]  | ← Top bar (64px) - New, Help, Settings
+---------------------------+
|     Timer: Easy • 1:23    | ← Timer display (format: "Difficulty • MM:SS")
|                           | ← 16px spacing
|       [GRID 5x5]          | ← Canvas (fixed size across all difficulties)
|                           | ← 8px spacing
|      [Clear]    [Undo]    | ← Control buttons (Clear/Undo fill, elevated bg)
+---------------------------+
```

**Canvas Sizing:** All difficulty levels (4x4, 6x6, 8x8) render at the same total canvas size. The reference size is calculated based on a 4x4 grid, then applied to larger grids with proportionally smaller cells. This ensures visual alignment with the restart and undo buttons below.

**Button Styling:** Minimal flat design, rounded corners (8px), subtle shadow on tap, no heavy borders.

**Home Screen Layout:** The home view is split into two equal halves — `.home-title-section` and `.home-actions`, each `flex: 1`. The wordmark and tagline centre in the top half (nudged down 48px), the streak/tutorial slot and difficulty buttons centre in the bottom half. Centring the lot as one group instead, which is what it used to do, floats the buttons too far up the screen.

The wordmark sizes itself fluidly: `clamp(60px, 20.5vw, 72px)`. Monoton renders roughly 3.9× the font size wide, so any fixed size that fits a 390px phone would overflow a 320px one. The `vw` term only does work below roughly 350px — from there up the wordmark holds at the 72px cap rather than growing with the viewport.

The wordmark also sets `font-kerning: none`. Monoton ships one kern pair that lands in "Loopy" and it *widens* o-o by 0.073em, more than double every other gap in the word, which reads as a hole at display size - presumably meant to stop two concentric rings merging at text sizes. No other pair in the word is kerned, so switching the feature off changes nothing else.

The tagline holds at 20px on every width, matching Tilbo's. It fits on one line down to 320px, so the home screen carries no size breakpoints at all. `line-height: 1` trims Monoton's generous line box so the 16px gap to the tagline is the real gap rather than 16px plus leading. Only the tagline steps at the 600px/400px breakpoints.

**Home Screen Buttons (`.btn-large`):** Deliberately bigger and softer than the in-game controls — 72px tall, 24px radius, 20px/700 text, 8px apart, capped at 400px wide. No drop shadow: press feedback is carried by opacity (0.85 on hover, 0.7 on press) and a 2px lift alone. The completion icon (trophy / check / skull) is absolutely positioned 24px from the left edge. The same styling covers the tutorial button in the slot above, so the whole stack reads as one set.

**Icons:**
- **Library**: Lucide icons (tree-shakeable, ~2-3KB for current icons)
- **Sizing**: 18px inline (button labels), 20px standalone, 24px header buttons
- **Color**: Inherit via `currentColor`
- **Usage**: Arrow-left (back), Circle-help (help), Settings (gear), Dices (new puzzle), Refresh-ccw (Clear), Undo2 (undo), Party-popper (win), Share2 (share), Trophy/Skull (home completion icons), ChevronDown (settings select indicator), Menu/X (home hamburger menu, cross-fading between the two)

**Settings Bottom Sheet:**

Built using the bottom sheet component system (see Bottom Sheet Component System in Key Systems). The settings panel is a persistent sheet that reuses the same HTMLElement instance across multiple show/hide cycles.

- **Visual Design**: Slides up with bounce animation (300ms, cubic-bezier(0.34, 1.3, 0.64, 1)), elevated background (adapts to theme), rounded top corners (16px), soft shadow (80px blur, 10% opacity)
- **Layout**: Settings displayed as list items with grey dividers
- **Available Settings:**
  - **Difficulty** (Unlimited mode only): iOS-style segmented control for switching grid sizes
  - **Numbers**: Select dropdown with options "Required only" (partial hints) / "Show all" (all cells). Default: Required only. Migration: Old 'none' values automatically converted to 'partial' on load.
  - **Number behaviour**: Select dropdown with options "Count down" / "Show total" / "Show both". Default: Count down. Migration: Boolean values from older versions automatically converted.
  - **Borders**: Select dropdown with options "Off" / "Center only" / "Full" for hint area borders. Default: Off.
  - **Solution**: Button to overlay solution path in blue (disqualifies player)
- **Settings Row Layout**: Each setting row has left-aligned label, right-aligned value with chevron-down icon. Tapping anywhere on row opens native select picker.
- **Behavior**: Context-aware (difficulty segmented control appears only in Unlimited mode), changes apply immediately with live re-render (no save/cancel buttons), click outside or dismiss button to close

**Game Control Buttons:**

Two control buttons appear below the canvas in a horizontal layout: Clear and Undo.

- **Positioning**: Centered below canvas with 8px top spacing
- **Layout**: Flex container with 8px gap between buttons
- **Button sizing**:
  - Clear button: Fills available space (flex: 1)
  - Undo button: Fills available space (flex: 1)
- **Horizontal padding**: 20px per button
- **Max width**: 400px to prevent oversizing on large screens
- **Styling**: Elevated background matching canvas (theme-aware), no drop shadow, no transform on interaction
- **States**:
  - Default: Elevated background with standard text color
  - Hover: No visual change (prevents stuck states on touch devices)
  - Active: No visual change (prevents stuck states on touch devices)
  - Disabled: 30% opacity, not-allowed cursor
  - Focus: No outline (removes persistent grey background after tap)

**Button-Specific Behavior:**

- **Clear button** (formerly Restart):
  - Enabled when at least one cell is drawn and game not completed
  - Disabled when no cells drawn, game won, or solution viewed
  - Clears all drawn cells, resets game state
  - Icon: Refresh-ccw

- **Undo button**:
  - Enabled only when undo history exists and puzzle not completed
  - Disabled when history empty, game won, or solution viewed
  - Reverts last drawing action (up to 50 actions)
  - Icon: Undo2

-----

### Animations

**Path Drawing:**
- Smooth line rendering (60fps via `requestAnimationFrame`)
- Corner radius for smooth curves (`cellSize * 0.35`)
- Path thickness: 4px, rounded line caps

**Constraint Feedback:**
- Number color transitions smoothly (300ms ease) as magnitude changes in countdown mode
- Number text uses magnitude-based gradient (bright yellow-orange through dark magenta) for visual hierarchy

**Victory Animation:**
- Path color shifts from black (`#000000`) to green (`#ACF39D`)
- Constraint numbers fade to green
- "Puzzle Solved" message with completion time

**Settings Bottom Sheet:**
- Slide up: Ease-out with bounce (cubic-bezier(0.34, 1.3, 0.64, 1))
- Slide down: Steep ease-in, no bounce (cubic-bezier(0.6, 0, 0.9, 1))
- Shadow fades in/out with sheet (300ms)

-----

#### Navigation & Routing

**Architecture:** Single-Page Application (SPA) with client-side routing via History API. No page reloads.

**Two Main Views:**

| View | Route | Purpose |
|------|-------|---------|
| **Home** | `/` | Landing page with the difficulty buttons (Easy, Tricky, Diabolical), the streak/tutorial slot above them, and the hamburger menu holding everything else |
| **Play** | `/play?difficulty=X` | Main game interface with canvas, controls, timer, settings, help button |

**Locale prefix:** localised builds are served from a path prefix, so the real URLs are `/de/` and `/de/play?difficulty=easy`. Routes are written *without* the prefix everywhere in the code — `router.js` strips it in `stripBase()` on the way in and adds it in `withBase()` on the way out, both driven by `import.meta.env.BASE_URL`. Callers pass `/play?difficulty=easy` and never think about the language. The itch build's relative base (`./`) is not a routable prefix, so it falls back to the root.

**Tutorial Access:**

Tutorial is implemented as a bottom sheet component rather than a dedicated view:
- **From Home**: Tutorial button opens carousel bottom sheet overlay. It shares a fixed-height slot with the streak line (see Streak System) and is hidden once the tutorial is completed, or once a streak exists — a player with a streak has plainly worked out how to play. The hamburger menu carries a permanent "How to play" item, so the tutorial stays reachable after the slot button is gone
- **From Game**: Help icon (circle-help, left of settings) opens same tutorial sheet
- **No Route**: Tutorial has no URL route - accessible via function call from any view

**Smart History Management:**

When navigating FROM home to a subpage, the router adds metadata to history state tracking the origin. This enables intelligent back button behavior:
- **From home**: Back button pops history to return to original home entry (no duplicates)
- **Direct URL**: Back button replaces current entry with home

**Result:** History stack maintains single clean home entry. Browser back from home exits app entirely.

**Game Modes:**

**Daily Puzzle Modes (`easy`/`medium`/`hard`)**
- Fixed grid sizes per difficulty
- Everyone sees identical puzzle for same local date
- Deterministic generation from date-based seed
- New button hidden (can't regenerate daily puzzles)
- Restart button replays same puzzle
- Settings: Numbers, Number behaviour, Borders, Solution

**Unlimited Mode**
- True random generation (not date-based)
- Defaults to Easy (4x4) on entry
- New button visible (generates fresh random puzzles)
- Settings include segmented control to switch difficulty within session
- Changing difficulty regenerates puzzle and resets timer
- Maintains separate save slot per difficulty

**Deployment:** Netlify configuration includes `_redirects` and `netlify.toml` to serve `index.html` for all routes (SPA routing).
