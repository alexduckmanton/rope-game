# Loop - Puzzle Game

## Quick Reference

### Key Modules & Responsibilities

| Module | Purpose | Key Functions & Exports |
|--------|---------|-------------------------|
| `main.js` | App entry point | Initializes router, icons, font preloading |
| `router.js` | Client-side routing | `initRouter()` - History API navigation |
| `gameCore.js` | Game state & pointer events | `createGameCore({ gridSize, canvas, onRender })` - Returns instance with event handlers |
| `generator.js` | Puzzle generation | `generateSolutionPath(size, randomFn)` - Warnsdorff's heuristic, returns Hamiltonian cycle |
| `renderer.js` | Canvas drawing | `renderGrid()`, `renderPlayerPath()`, `renderCellNumbers()`, `generateHintCells()`, `calculateBorderLayers()` |
| `persistence.js` | localStorage persistence | `saveGameState()`, `loadGameState()`, `createThrottledSave()`, `saveSettings()` |
| `seededRandom.js` | Deterministic PRNG | `createSeededRandom(seed)` - Mulberry32 for daily puzzles |
| `utils.js` | Validation & pathfinding | `buildSolutionTurnMap()`, `countTurnsInArea()`, `checkStructuralLoop()`, `parseCellKey()`, `createCellKey()` |
| `config.js` | Configuration constants | `CONFIG` - Colors, sizes, generation tuning, rendering params |
| `bottomSheet.js` | Reusable bottom sheet UI | `createBottomSheet()`, `showBottomSheetAsync()` - Factory + async helper |
| `game/timer.js` | Game timer | `createGameTimer({ onUpdate, difficulty })`, `formatTime()` - Encapsulated timer with pause/resume |
| `game/share.js` | Share functionality | `handleShare()`, `buildShareText()` - Web Share API + clipboard fallback |
| `game/validation.js` | Win validation | `checkStructuralWin()`, `checkFullWin()`, `validateHints()` - Shared by game and tutorial |
| `game/canvasSetup.js` | Canvas sizing | `calculateCellSize(gridSize, extraSpace)`, `setupCanvas()` - Responsive sizing utilities |
| `confetti.js` | Win celebration effects | `fireConfettiFromIcon()` - Particle animation for puzzle completion |

### Core Concepts

- **Turn**: Path changes direction within a cell. Corner = 1 turn, straight = 0 turns.
- **Constraint (Hint)**: Number showing expected turn count in surrounding 3x3 area (includes diagonals + self).
- **Victory**: Complete loop visiting all cells exactly once + all constraints satisfied.
- **Daily Puzzle**: Deterministic generation using date-based seed (YYYYMMDD + difficulty offset 0/1/2).
- **Unlimited Mode**: True random generation (not date-based), allows infinite practice with difficulty switching.

### Grid Sizes

| Difficulty | Grid Size | Total Cells | Max Hints | Warnsdorff Attempts |
|------------|-----------|-------------|-----------|---------------------|
| Easy       | 4x4       | 16          | 2         | 20                  |
| Medium     | 6x6       | 36          | Unlimited | 50                  |
| Hard       | 8x8       | 64          | Unlimited | 100                 |

### Storage Keys

- Daily puzzles: `loop-game:daily:2025-11-30-easy`
- Unlimited mode: `loop-game:unlimited:medium` (one slot per difficulty)
- Settings: `loop-game:settings` (global, shared across all modes)

-----

## Game Rules & Mechanics

### Core Rules

1. **Draw ONE continuous path** that visits every cell exactly once and returns to the starting point
2. **Path can only move UP, DOWN, LEFT, RIGHT** (no diagonals)
3. **Numbered cells are clues** that indicate how many turns (corners/bends) the path must make in the surrounding 3x3 area
4. **The number counts a 3x3 grid centered on itself** - includes orthogonal neighbors, diagonal neighbors, and the numbered cell itself
5. A "turn" = when the path changes direction within a cell (straight = 0 turns, corner = 1 turn)

### Victory Condition

All constraints are satisfied AND the path forms a complete loop visiting every cell exactly once.

### Constraint Validation Algorithm

**What is a "Turn"?**

A turn occurs when a path changes direction within a cell. The algorithm analyzes connections between cells:
- **Straight path** (→→→ or ↑↑↑): 0 turns - previous, current, and next cells are collinear
- **Corner path** (↑→→ or ←↓→): 1 turn - path changes direction at this cell

**Validation Area:**

Each numbered hint validates the 3x3 area centered on itself (8 neighbors + self = 9 cells max, fewer at edges).

**Implementation:**

1. `buildSolutionTurnMap(solutionPath)` - Analyzes solution path to mark which cells are turns
   - For each cell, checks if previous→current→next are collinear (straight) or not (turn)
   - Returns `Map<cellKey, isTurn>`

2. `buildPlayerTurnMap(playerDrawnCells, playerConnections)` - Analyzes player's drawn path
   - For each drawn cell with exactly 2 connections, checks if connections are collinear
   - Returns `Map<cellKey, isTurn>`

3. `countTurnsInArea(row, col, gridSize, turnMap)` - Counts turns in 3x3 region
   - Iterates through 9 adjacent cells (including center)
   - Sums up cells where `turnMap.get(cellKey) === true`

4. Validation compares `expectedTurnCount` (from solution) vs `actualTurnCount` (from player)
   - Hint colored green when counts match, otherwise uses magnitude-based color from gradient palette

### Player Feedback Systems

**Countdown Mode (Dynamic Feedback):**

Players can toggle between two number display modes via the Countdown setting:

**Countdown ON (Default Behavior):**
- Numbers show **remaining corners needed**: `expectedTurnCount - actualTurnCount`
- **Dynamic feedback**: Numbers update in real-time as players draw their path
- **Progress tracking**: Numbers count down toward zero as correct corners are added
- **Negative values**: When players draw too many corners, number goes negative (e.g., need 3, drew 4 → shows "-1")
- **Color feedback**: Colors shift dynamically with magnitude (see Magnitude-Based Color System for details)

**Countdown OFF (Classic Mode):**
- Numbers show **total required corners**: `expectedTurnCount` (static)
- **Static display**: Numbers never change regardless of player progress
- **Traditional puzzle style**: Mirrors physical puzzle books where constraints stay constant
- **Color feedback**: Colors remain static based on expected turn count, only shift to green upon validation

**Design Rationale:**

Countdown mode provides **progressive disclosure** - players immediately see if they're on the right track without needing to mentally calculate differences. This reduces cognitive load during gameplay, especially on larger grids where tracking multiple constraints becomes challenging.

Static mode appeals to **purist players** who prefer the traditional puzzle-solving experience where all information is given upfront and progress tracking happens mentally.

**Implementation Architecture:**

The countdown parameter is threaded through the rendering pipeline:
- **Settings layer**: Stored in localStorage, defaults to true (countdown ON)
- **Game state**: Boolean variable passed to render function
- **Renderer**: Conditionally displays `remainingTurns` vs `expectedTurnCount` based on parameter
- **Tutorial**: Hardcoded to countdown mode (always true) for consistent learning experience

Validation logic remains identical - both modes use the same `isValid = remainingTurns === 0` check. Only the displayed value changes.

**User Control:**

Setting is accessible via bottom sheet under Hints checkbox. Changes apply immediately with live re-render. Setting persists across sessions and applies to all game modes (daily and unlimited).

### Magnitude-Based Color System

**Core Concept:**

Hint numbers are colored based on their magnitude (distance from zero) rather than randomly assigned colors. This creates an intuitive visual hierarchy where the color itself communicates information about the constraint difficulty.

**Color Assignment Logic:**

Each hint number receives a color from a nine-shade gradient based on its absolute value:

- **Zero (0)**: Always green, matching validated state color
- **Magnitude 1** (±1): Bright yellow-orange, lightest shade in the palette
- **Magnitude 2-8**: Progressive darkening through vibrant warm-to-cool gradient
- **Magnitude 9** (±9): Very dark magenta, darkest shade in the palette

Negative numbers use the same color as their positive counterparts. For example, both 3 and -3 display in the same coral-red tone. This emphasizes that magnitude (not sign) determines difficulty.

**Gradient Progression:**

The nine-color palette flows through a warm-to-cool spectrum creating visual distinction:

1. Bright yellow-orange (magnitude 1, easiest)
2. Bright orange
3. Tomato red
4. Red-pink
5. Hot pink
6. Pink-magenta
7. Magenta
8. Dark magenta
9. Very dark magenta (magnitude 9, hardest)

This chromatic progression provides natural visual chunking - warm tones (orange/red) signal low-to-medium constraints, while cool tones (pink/magenta) signal high constraints.

**Dynamic Color Updates:**

Colors update in real-time as players draw their path, creating animated feedback:

- **Countdown mode enabled**: Colors shift as remaining turns decrease
  - Start: Hint shows 7 remaining turns → magenta (high urgency)
  - Progress: Draw correctly, now 3 remaining → red (medium urgency)
  - Near completion: Down to 1 remaining → bright orange (almost there)
  - Complete: 0 remaining → green (validated)

- **Countdown mode disabled**: Colors remain static based on total required turns
  - Hint always shows expected turn count with corresponding magnitude color
  - Only changes to green upon validation

This dynamic behavior transforms hints into progress indicators. Players can visually scan the grid and immediately identify which constraints need more work (darker colors) versus which are nearly complete (lighter colors).

**Design Rationale:**

**Cognitive Load Reduction:**

Traditional puzzle games assign random colors to constraints purely for differentiation. This forces players to maintain mental mappings between colors and constraint values. Magnitude-based coloring eliminates this overhead by making color semantically meaningful.

**At-a-Glance Priority Assessment:**

Players can instantly identify high-priority constraints (dark magenta 8s and 9s) versus low-priority ones (bright orange 1s and 2s) without reading numbers. This becomes increasingly valuable on larger grids where many constraints compete for attention.

**Progress Visualization:**

In countdown mode, the color shift from dark to light provides visceral satisfaction. Players literally watch constraints "cool down" as they approach completion. This positive reinforcement loop encourages continued engagement.

**Accessibility Benefits:**

While the system relies on color, the gradient spans multiple visual dimensions:
- **Hue shift**: Orange through red to magenta (color-blind friendly warm-cool progression)
- **Lightness contrast**: Bright to dark provides luminance-based distinction
- **Saturation variation**: Vibrant to deep creates intensity differentiation

This multi-dimensional approach ensures the system remains functional across various forms of color vision deficiency.

**Zero as Special Case:**

Zero receiving green treatment (instead of a gradient color) serves dual purposes:
1. Reinforces that zero-turn constraints are fundamentally different (straight paths, no corners)
2. Creates consistency with the validated state, reducing cognitive dissonance

When an unvalidated hint displays zero, showing it in green doesn't create confusion because the border color still indicates unvalidated status. The number itself being green communicates "this area should have zero turns."

**Tutorial Visual Design:**

In tutorial pages, hint numbers use the magnitude-based gradient for educational clarity, while pulsing backgrounds use a uniform blue color (matching the primary button color). This design separates the information hierarchy: numbers communicate difficulty through color variation, while the pulsing animation provides a consistent, non-distracting spatial indicator. Validated hints display green in both cases, creating immediate positive feedback when constraints are satisfied.

-----

## Architecture Overview

### Tech Stack

- **Vanilla JavaScript (ES modules)** - No framework, lightweight and fast
- **HTML5 Canvas** - Grid and path rendering with smooth curves
- **CSS3** - Animations, layouts, bottom sheet transitions
- **Vite** - Dev server and build tooling (fast HMR, tree-shaking)
- **Lucide Icons** - Tree-shakeable SVG icons (~2-3KB bundle)
- **canvas-confetti** - GPU-accelerated particle effects for win celebrations (~26KB bundle, 10KB gzipped)
- **Fonts**: Inter (UI text) and Monoton (title only), self-hosted via @fontsource

### File Structure

```
rope-game/
├── index.html              # Single-page app with three view containers
├── style.css               # Global styles + view-specific styles
├── netlify.toml           # Netlify deployment configuration
├── public/
│   └── _redirects         # SPA routing for Netlify (serves index.html for all routes)
├── src/
│   ├── main.js            # App entry point, initializes router and icons
│   ├── router.js          # Client-side routing with History API
│   ├── icons.js           # Lucide icon initialization (tree-shakeable imports)
│   ├── bottomSheet.js     # Reusable bottom sheet component (factory + async helper)
│   ├── config.js          # Centralized constants (colors, sizing, generation tuning)
│   ├── utils.js           # Shared utility functions (path math, cell key parsing)
│   ├── seededRandom.js    # Deterministic PRNG for daily puzzles (Mulberry32 algorithm)
│   ├── generator.js       # Puzzle generation (Warnsdorff's heuristic)
│   ├── gameCore.js        # Game state and interaction logic (pointer events, drag handling)
│   ├── renderer.js        # Canvas rendering (grid, paths, hints, borders)
│   ├── persistence.js     # localStorage save/load/cleanup with throttled writes
│   ├── confetti.js        # Win celebration particle effects (wraps canvas-confetti library)
│   ├── game/              # Shared game modules (used by both game and tutorial views)
│   │   ├── timer.js       # Encapsulated timer with pause/resume support
│   │   ├── share.js       # Share functionality (Web Share API + clipboard fallback)
│   │   ├── validation.js  # Win checking and hint validation logic
│   │   └── canvasSetup.js # Responsive canvas sizing utilities
│   └── views/
│       ├── home.js        # Home view with difficulty selection and date display
│       ├── tutorial.js    # Tutorial view with progressive puzzles
│       └── game.js        # Game view with daily/unlimited mode logic
└── package.json
```

-----

## Key Systems

### Puzzle Generation

**Algorithm: Warnsdorff's Heuristic**

Generates Hamiltonian cycles (paths visiting all cells exactly once forming a loop).

**Strategy:**
1. Try Warnsdorff's heuristic multiple times (fast, ~0.5ms per attempt, ~25% success rate)
2. Fallback to pre-generated valid cycle if all attempts fail (extremely rare with 100 attempts)

**Warnsdorff's Rule:** Always move to the neighbor with the fewest unvisited neighbors. This greedy strategy avoids dead ends by saving well-connected cells for later.

**Hint Cell Selection:** After generating solution path, `generateHintCells()` randomly selects ~30% of cells to show hints using seeded random for daily puzzles or true random for unlimited mode. Easy difficulty is capped at 2 hints maximum to reduce complexity; medium and hard have no cap.

**Performance:** ~50ms average for 8x8, >99.99% success rate

### Daily Puzzle System

**Architecture:** Deterministic generation using date-based seeded PRNG (no backend required).

**Key Design:**

| Aspect | Implementation |
|--------|----------------|
| **Seed Format** | YYYYMMDD + difficulty offset (0=easy, 1=medium, 2=hard) |
| **Example** | Nov 30, 2025 Medium = seed `202511301` |
| **Algorithm** | Mulberry32 PRNG (bitwise operations, cross-browser deterministic) |
| **Timezone** | Local timezone (puzzle changes at player's local midnight) |
| **Consistency** | Same seed always produces identical puzzle, hints, and solution path |
| **Puzzle ID** | Format: `"2025-11-30-medium"` (natural key for stats tracking) |

**Randomization Points:** Warnsdorff starting position, tie-breaking, hint cell selection (all seeded).

**Tradeoffs Accepted:**
- Puzzle quality varies by date (some dates produce easier/harder puzzles)
- Players can preview future puzzles by changing system clock (acceptable for casual game)
- No server-side validation of times (trust-based until backend added)

**Benefits:**
- Works offline after initial page load
- No backend infrastructure needed
- Enables future social features (leaderboards, sharing)

### Navigation & Routing

**Architecture:** Single-Page Application (SPA) with client-side routing via History API. No page reloads.

**Three Main Views:**

| View | Route | Purpose |
|------|-------|---------|
| **Home** | `/` | Landing page, displays current date, five navigation buttons (Tutorial, Easy, Medium, Hard, Unlimited) |
| **Tutorial** | `/tutorial` | Placeholder for future interactive tutorials, includes back button |
| **Play** | `/play?difficulty=X` | Main game interface with canvas, controls, timer, settings |

**Smart History Management:**

When navigating FROM home to a subpage, the router adds metadata to history state tracking the origin. This enables intelligent back button behavior:
- **From home**: Back button pops history to return to original home entry (no duplicates)
- **Direct URL**: Back button replaces current entry with home

**Result:** History stack maintains single clean home entry. Browser back from home exits app entirely.

**Game Modes:**

**Daily Puzzle Modes (Easy/Medium/Hard)**
- Fixed grid sizes per difficulty
- Everyone sees identical puzzle for same local date
- Deterministic generation from date-based seed
- New button hidden (can't regenerate daily puzzles)
- Restart button replays same puzzle
- Settings: Hints, Countdown, Borders, Solution

**Unlimited Mode**
- True random generation (not date-based)
- Defaults to Easy (4x4) on entry
- New button visible (generates fresh random puzzles)
- Settings include segmented control to switch difficulty within session
- Changing difficulty regenerates puzzle and resets timer
- Maintains separate save slot per difficulty

**Deployment:** Netlify configuration includes `_redirects` and `netlify.toml` to serve `index.html` for all routes (SPA routing).

### Game Progress Persistence

Auto-saves game state to localStorage (client-side, no backend).

**Key Architecture:**

1. **Throttled saves**: First save immediate, then 5-second cooldown prevents excessive writes during rapid drawing. Trailing save ensures final state captured after cooldown. Immediate saves bypass throttle on tab blur, navigation, or game completion. Players never lose more than 5 seconds of progress.

2. **Storage keys**: See Quick Reference for patterns
   - Daily: One slot per date+difficulty (e.g., `loop-game:daily:2025-11-30-easy`). Old saves auto-cleaned on app init.
   - Unlimited: One slot per difficulty (e.g., `loop-game:unlimited:medium`). Switching difficulties saves current state, loads target difficulty state (or generates new if none exists).
   - Settings: Global singleton (`loop-game:settings`) shared across all modes.

3. **State vs Settings**: Game state (player path, connections, timer, win status, partial win feedback) is per-puzzle. Unlimited mode includes puzzle data (solution path, hint cells) since it's not deterministic. Settings (hint mode, border mode, show solution, last unlimited difficulty) are global.

4. **Data format**: Sets→Arrays, Maps→Objects (JSON-serializable), version field for migration, timestamp for debugging. Throttle returns `{ save, destroy }` for cleanup.

**Save triggers**: Player moves, restart, new puzzle, completion.
**Save skips**: Window resize, settings toggles (have dedicated save).

**Edge cases**: Partial win feedback persisted, restore without triggering cooldown, daily ID validation, immediate save on tab blur.

**Tradeoffs**: No cross-device sync, trust-based times, 5-second max progress loss (rare).

### Timer Behavior

**Auto-Pause on Tab Blur:** Timer automatically pauses when browser tab becomes hidden, resumes when visible.

**Implementation:**
- Uses **Page Visibility API** to detect tab visibility changes
- Timestamp-based pause calculation maintains accuracy across pause/resume cycles
- Timer display updates skip during pause (setInterval checks pause state)
- No visual "PAUSED" indicator - timer simply freezes

**Scenarios Detected:**
- Switch to different tab ✓
- Minimize browser ✓
- Mobile app switch ✓

**Scenarios NOT Detected:**
- Alt+Tab to different app (tab still visible to browser)
- Multiple windows where tab visible but window lacks focus

**Benefits:** Fair competition (daily times exclude time away), better UX (no time anxiety), accurate metrics.

### Google Analytics

**Setup:** Google Analytics 4 (GA4) with measurement ID `G-9BFMVX4CLE`.

**Implementation:**
- **Script tag**: Loaded in `index.html` head immediately after opening `<head>` tag (as Google recommends)
- **SPA tracking**: `src/analytics.js` module exports `trackPageView(path, title)` for virtual page views
- **Router integration**: `router.js` calls `trackPageView()` on every route change

**Tracked Pages:**
- `/` (home)
- `/tutorial`
- `/play?difficulty=easy|medium|hard`

**Key Files:**
| File | Purpose |
|------|---------|
| `index.html` (lines 4-11) | GA script tag and gtag initialization |
| `src/analytics.js` | SPA page view tracking module |
| `src/router.js` | Calls trackPageView on route changes |

**Notes:**
- The `trackPageView()` function safely checks if `gtag` exists before calling it (graceful degradation if blocked)
- Initial page load is tracked by the script in `index.html`; subsequent SPA navigations are tracked by the router

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

Five predefined color schemes provide visual context:

| Scheme | Icon Color | Background Color | Usage |
|--------|-----------|------------------|-------|
| `neutral` | `#6B7280` (grey) | `#F3F4F6` (pale grey) | Settings, default |
| `success` | `#F59E0B` (amber/gold) | `#FEF3C7` (pale golden yellow) | Win notifications, celebrations |
| `error` | `#EF4444` (red) | `#FEE2E2` (pale red) | Incorrect loop feedback |
| `info` | `#3B82F6` (blue) | `#DBEAFE` (pale blue) | Informational messages |
| `warning` | `#F59E0B` (amber) | `#FEF3C7` (pale amber) | Warnings |

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
- `"Keep trying"` - Encouraging feedback for incorrect loops

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
| Win notification (game) | Transient | HTML string | `party-popper` | `success` | "Yay!" |
| Win notification (tutorial) | Transient | HTML string | `party-popper` | `success` | "Next" |
| Partial win feedback | Transient | HTML string | `circle-off` | `error` | "Keep trying" |

**Integration Points:**

Settings sheet integrates with persistence system (saves on toggle), router (dismisses on navigation), and game state (re-renders on difficulty change). Notification sheets integrate with game validation (show on win/partial win) and tutorial system (navigation callbacks).

**Known Limitations:**

No built-in state tracking across multiple sheets (only one should be visible at a time, enforced by convention not code). No animation queueing (rapid show/hide calls may cause visual glitches). No accessibility enhancements yet (no focus trapping, no ARIA labels, no keyboard shortcuts). These are acceptable tradeoffs for current single-sheet usage patterns but would need addressing for more complex modal workflows.

**Future Considerations:**

Component could be extended to support multiple simultaneous sheets with z-index stacking, animation queueing for rapid successive shows, keyboard navigation (Escape to close), focus management (trap focus within sheet, restore on close), and ARIA attributes for screen readers. Current implementation prioritizes simplicity and covers all existing use cases without over-engineering for hypothetical requirements.

### Confetti Celebration System

**Purpose:** Provides celebratory particle effects when players complete puzzles, creating an immediate emotional reward at the moment of victory. Confetti shoots upward from the golden party-popper icon in the winning bottom sheet, reinforcing the success state with dynamic visual feedback.

**Architecture:** Single-function module wrapping the canvas-confetti library with game-specific configuration. The module exports one function that handles timing synchronization, position calculation, and particle burst configuration.

**Library Choice:** Uses canvas-confetti as the underlying particle system rather than implementing custom particle physics. This decision prioritizes reliability and performance over bundle size. Canvas-confetti is well-optimized for mobile devices with GPU-accelerated rendering, cross-browser consistency, and professional-quality particle physics including gravity, velocity decay, and natural rotation.

**Visual Configuration:**

| Property | Value | Rationale |
|----------|-------|-----------|
| **Particle Count** | 150 | Heavy density creates dramatic celebration without overwhelming the screen |
| **Direction** | 90° (straight up) | Upward trajectory feels triumphant and matches party-popper metaphor |
| **Spread** | 145° | Wide arc ensures particles fill most of the screen width for maximum visual impact |
| **Start Velocity** | 30 | Medium velocity balances dramatic effect with mobile performance, particles arc gracefully |
| **Gravity** | 1.0 | Standard gravity creates natural falling motion after upward burst |
| **Particle Size** | 1.2x scalar | Slightly larger than default for visibility on mobile screens |
| **Duration** | 300 ticks (~3 seconds) | Long enough to appreciate the effect, short enough to not overstay welcome |

**Color Palette:**

Confetti uses three shades of gold and amber matching the success color scheme from the bottom sheet party-popper icon. This creates visual coherence between the icon and the particles shooting from it.

| Color | Hex Code | Usage | Visual Role |
|-------|----------|-------|-------------|
| Rich amber/gold | `#F59E0B` | Primary | Dominant warm tone, matches icon color directly |
| Pale golden yellow | `#FEF3C7` | Secondary | Light accent, matches icon background |
| Medium gold | `#FBBF24` | Tertiary | Mid-tone bridge between primary and secondary |

The three-color palette avoids visual clutter while providing enough variation for natural-looking particle diversity. All colors stay within the warm gold family to maintain thematic consistency with the success state.

**Timing Architecture:**

Confetti triggering involves careful synchronization with the bottom sheet animation to ensure particles appear to originate from the visible icon rather than off-screen.

**Animation Sequence:**
1. Player completes puzzle (win validation passes)
2. Bottom sheet slides up from bottom edge (300ms cubic-bezier animation)
3. Party-popper icon becomes visible as sheet slides into view
4. Confetti fires after 350ms delay (300ms animation + 50ms buffer)
5. Particles shoot upward from icon center, arc, and fall naturally over three seconds

The 350ms delay ensures the bottom sheet is fully visible and settled before confetti fires. Without this delay, particles would appear to shoot from below the screen edge, breaking the illusion of originating from the icon.

**Position Calculation:**

Origin point is calculated dynamically from the bottom sheet icon container DOM element rather than using fixed coordinates. This approach adapts to different screen sizes, orientations, and potential future layout changes.

**Calculation Steps:**
1. Query DOM for bottom sheet icon container using class selector
2. Get bounding rectangle of container element
3. Calculate center point (left + width/2, top + height/2)
4. Normalize coordinates to canvas space (x and y as 0-1 range)
5. Pass normalized coordinates to confetti library as origin point

**Fallback Behavior:** If icon container is not found in DOM (rare edge case), confetti defaults to center-bottom position (x: 0.5, y: 0.7). This ensures celebration still occurs even if DOM structure changes unexpectedly.

**Integration Points:**

Confetti fires at two distinct locations in the codebase, both in win detection paths:

**Game Win (Daily & Unlimited):** Integrated into game view win detection path immediately after win celebration bottom sheet is shown. Triggered only on fresh puzzle completions, not when restoring saved win state from localStorage. This distinction prevents confetti from firing every time a player returns to an already-completed puzzle.

**Tutorial Completion:** Integrated into tutorial view win detection path for all four tutorial lessons. Each lesson completion triggers confetti when the win celebration bottom sheet appears. Tutorial wins always trigger confetti since there is no state restoration for tutorial progress.

**Prevention of Duplicate Triggers:**

The system relies on selective code placement rather than explicit state flags to prevent confetti from firing on page refresh. Win detection code runs inside a guard condition checking that the win state is transitioning from false to true. When a player refreshes the page with a saved win state, the win flag is already true (loaded from localStorage), so the win detection code path never executes. Since the confetti trigger only exists in the fresh win detection path, it never fires on restoration.

This architecture avoids the need for dedicated "hasShownConfetti" tracking variables while ensuring confetti fires exactly once per puzzle completion.

**Performance Considerations:**

**Bundle Size Impact:** Canvas-confetti adds approximately 26KB to the production bundle (10KB gzipped). This is acceptable given the emotional value of the celebration and the reliability benefits of using a battle-tested library.

**Mobile Performance:** The heavy particle configuration (150 particles) is deliberately chosen because canvas-confetti uses GPU-accelerated canvas rendering and requestAnimationFrame for smooth 60fps animation. Testing on mid-range mobile devices shows no perceptible frame drops or lag during confetti animation.

**Rendering Layer:** Confetti renders on its own canvas element positioned above the game canvas but below the bottom sheet (z-index hierarchy managed by canvas-confetti). This layering prevents confetti from interfering with game interactions or covering important UI elements.

**Memory Cleanup:** Canvas-confetti automatically cleans up particle canvas and animation frames after the effect completes. No manual cleanup required from the game code.

**Design Rationale:**

**Emotional Reward Timing:** Confetti fires immediately when the bottom sheet appears rather than waiting for user interaction or adding delays. This instant feedback creates stronger association between completing the puzzle and receiving the reward, reinforcing the positive achievement loop.

**Visual Coherence:** Shooting confetti from the party-popper icon rather than screen center or random positions creates a clear visual story - the icon "pops" and releases celebration particles. This narrative quality makes the effect feel intentional rather than arbitrary.

**Intensity Selection:** Heavy particle count (150) was chosen over lighter alternatives because puzzle completion is a significant achievement worthy of enthusiastic celebration. The dramatic effect compensates for the lack of sound effects and provides satisfying closure to the gameplay session.

**Color Consistency:** Using the gold color palette throughout (icon background, icon color, confetti particles) creates a unified success aesthetic. Players subconsciously associate the gold color with winning, building brand consistency across the game experience.

**Accessibility Considerations:**

Confetti is purely decorative and does not convey essential information. Players with motion sensitivity or visual processing challenges can still understand they have won through the bottom sheet message, green path color, and validated hint colors. The confetti enhances but does not replace these primary success indicators.

Future enhancement could include a settings toggle to disable confetti for players who find motion effects distracting or overwhelming.

**Current Usage:**

| Trigger | Location | Frequency | User Control |
|---------|----------|-----------|--------------|
| Daily puzzle completion | Fresh win in game view | Once per daily puzzle | Cannot skip or replay |
| Unlimited puzzle completion | Fresh win in game view | Once per puzzle | Can generate new puzzles for repeated effect |
| Tutorial lesson completion | All 4 tutorial wins | Once per lesson | Cannot skip, lessons not repeatable |
| Page refresh with saved win | Never triggers | N/A | Intentionally prevented |

**Known Limitations:**

No user control to skip or disable confetti animation. No keyboard or screen reader announcements for the confetti effect. Confetti particles can briefly cover hint numbers or UI elements during the three-second animation (acceptable since game interaction is paused during celebration). Position calculation depends on DOM structure remaining consistent with current bottom sheet implementation.

**Future Enhancements:**

Settings toggle to disable confetti for motion-sensitive players. Alternative celebration styles (gentle sparkle vs heavy burst) based on puzzle difficulty or user preference. Confetti color themes matching different achievement types or special daily puzzles. Sound effects synchronized with confetti burst for enhanced celebration feel. Haptic feedback on mobile devices timed with particle burst.

-----

## UI/UX Specifications

### Design System

**Color Palette:**

| Element | Color | Usage |
|---------|-------|-------|
| Background | `#F5F5F5` | Light gray canvas background |
| Grid lines | `#E0E0E0` | Subtle gray grid |
| Player path | `#000000` | Black drawing color |
| Player path (win) | `#ACF39D` | Soft green when puzzle solved |
| Solution path | `#4A90E2` | Calm blue (when "Solution" enabled) |
| Hint validated | `#ACF39D` | Green when constraint satisfied |
| Hint pulsing background | `#4A90E2` | Blue for unvalidated tutorials hints (matches primary buttons) |
| Hint number colors | 9-color palette | Bright yellow-orange → dark magenta, magnitude-based gradient (see Magnitude-Based Color System) |
| UI text | `#34495E` | Dark gray for buttons/labels |

**Typography:**
- **Body Copy**: Inter (400, 500, 600, 700) - Clean sans-serif for UI text, buttons, labels
- **Display Font**: Monoton - Retro display font for "Loopy" title only
- **Implementation**: Self-hosted via @fontsource, preloaded via JavaScript, font-display: block (no flicker)
- **Performance**: ~120KB total, ~30KB gzipped, loads in 100-200ms
- **Timer**: Uses tabular numerals (monospaced digits) to prevent layout shift during counting

**Layout (Mobile-First):**

```
+---------------------------+
|   [←] [Title]  [⚙ ↻ 🎲]   | ← Top bar (80px)
+---------------------------+
|     Timer: Easy • 1:23    | ← Timer display (format: "Difficulty • MM:SS")
|                           |
|       [GRID 5x5]          | ← Canvas, centered, responsive
|                           |
|                           |
+---------------------------+
```

**Button Styling:** Minimal flat design, rounded corners (8px), subtle shadow on tap, no heavy borders.

**Icons:**
- **Library**: Lucide icons (tree-shakeable, ~2-3KB for current icons)
- **Sizing**: 18px inline, 20px standalone, 24px close buttons
- **Color**: Inherit via `currentColor`
- **Usage**: Arrow-left (back), Settings (gear), X (close), Refresh-ccw (restart), Dices (new puzzle)

**Settings Bottom Sheet:**

Built using the bottom sheet component system (see Bottom Sheet Component System in Key Systems). The settings panel is a persistent sheet that reuses the same HTMLElement instance across multiple show/hide cycles.

- **Visual Design**: Slides up with bounce animation (300ms, cubic-bezier(0.34, 1.3, 0.64, 1)), white background, rounded top corners (16px), soft shadow (80px blur, 10% opacity)
- **Layout**: Settings displayed as list items with grey dividers
- **Available Settings:**
  - **Difficulty** (Unlimited mode only): iOS-style segmented control for switching grid sizes
  - **Hints**: Binary toggle between Partial (30% of cells, unchecked) and All (100% of cells, checked). Default: Partial. Migration: Old 'none' values automatically converted to 'partial' on load.
  - **Countdown**: Boolean toggle for remaining vs total corners display (default ON)
  - **Borders**: Three-state toggle (Off → Center → Full) for hint area borders
  - **Solution**: Boolean toggle to overlay solution path in blue
- **Behavior**: Context-aware (difficulty segmented control appears only in Unlimited mode), changes apply immediately with live re-render (no save/cancel buttons), click outside or X button to dismiss
- **Visibility**: Hidden in tutorial view

### Animations

**Path Drawing:**
- Smooth line rendering (60fps via `requestAnimationFrame`)
- Corner radius for smooth curves (`cellSize * 0.35`)
- Path thickness: 4px, rounded line caps

**Constraint Feedback:**
- Number color transitions smoothly (300ms ease) as magnitude changes in countdown mode
- Number text uses magnitude-based gradient (bright yellow-orange through dark magenta) for visual hierarchy
- Pulsing background for hint validation areas (2s cycle, max 20% opacity)
- Pulsing background color: Blue (matching primary buttons) for unvalidated hints, green when satisfied

**Victory Animation:**
- Path color shifts from black (`#000000`) to green (`#ACF39D`)
- Constraint numbers fade to green
- "Puzzle Solved" message with completion time
- Gold confetti particles (150 count) shoot upward from party-popper icon with wide spread, arcing naturally over three seconds

**Settings Bottom Sheet:**
- Slide up: Ease-out with bounce (cubic-bezier(0.34, 1.3, 0.64, 1))
- Slide down: Steep ease-in, no bounce (cubic-bezier(0.6, 0, 0.9, 1))
- Shadow fades in/out with sheet (300ms)

### Mobile Gestures

**Supported Interactions:**
- **Drag to draw**: Continuous path creation
- **Single tap**: Erase existing cell (if not added this drag)
- **Drag backward**: Undo recent drawing (backtracking)
- **Automatic connection breaking**: When drawing through existing paths, preserves the connection from your drag path and breaks the unused connection
- **Intelligent path extension**: Uses Bresenham's line algorithm to calculate cells along actual mouse path

**Implementation:** Pointer Events API (handles both mouse and touch). All interactions feel native and responsive.

**Mobile Optimizations:**
- Prevent page scroll while drawing
- Large touch targets (minimum 48×48px)
- Prevent zoom/pinch gestures on canvas
- Prevent double-tap zoom

-----

## Development Guide

### Development Status

**✅ Core Features Complete**
- Full gameplay loop (draw, validate, win detection)
- Three difficulty levels (Easy 4x4, Medium 6x6, Hard 8x8)
- Daily puzzle system with deterministic generation
- Unlimited practice mode with in-session difficulty switching
- Settings persistence (hints, borders, solution display)
- Game progress persistence with throttled saves
- Timer with auto-pause on tab blur
- Responsive mobile-first UI with smooth animations
- Settings bottom sheet with context-aware controls
- Intelligent drag interactions and path smoothing

**🚧 Planned Enhancements**
- Interactive tutorial with guided puzzle examples
- Undo/Redo functionality
- Move counter
- Daily puzzle completion tracking and statistics dashboard
- Streak counter (consecutive days completed)
- Leaderboards and social sharing for daily puzzles (requires backend)
- Achievement system
- Dark mode
- Sound effects (optional, subtle)
- Share puzzle results with times
- Archive mode to replay previous daily puzzles
- Cross-device sync (requires backend and authentication)

### Common Modification Patterns

**Change Grid Sizes:**
1. Update difficulty configuration in `config.js` (if adding new standard sizes)
2. Add fallback cycle to `FALLBACK_CYCLES` object in `generator.js` (if size not already supported)
3. Update difficulty buttons in `index.html` and routing logic in `views/home.js`

**Add New Constraint Types:**
1. Modify turn counting logic in `utils.js:countTurnsInArea()` or create new validation function
2. Update validation rendering in `renderer.js:renderCellNumbers()` to display new constraint type
3. Consider impact on puzzle generation difficulty and solvability

**Modify Maximum Hints by Difficulty:**
1. **Change max hints**: Update `getMaxHintsForDifficulty()` in `game.js` (currently returns 2 for easy, null for medium/hard)
2. **Affects all modes**: Change applies to new daily puzzles, restored daily puzzles, and new unlimited puzzles
3. **Saved unlimited puzzles**: Will retain their original hint count when restored (no automatic migration)

**Modify Hint Display:**
1. **Hint number colors**: Update `CONFIG.COLORS.HINT_COLORS` array in `config.js` (affects number text and borders)
2. **Hint pulsing background color**: Modify color assignment in `renderHintPulse()` function in `renderer.js` (currently uses blue for unvalidated, green for validated)
3. **Hint probability**: Change `CONFIG.HINT.PROBABILITY` (0-1) or modify `generateHintCells()` in `renderer.js`
4. **Border rendering**: Modify `drawHintBorders()` in `renderer.js` (width, inset, layer offset)
5. **Pulse animation timing**: Adjust `CONFIG.HINT.PULSE_DURATION` and `CONFIG.HINT.PULSE_MAX_OPACITY`

**Modify Player Feedback (Countdown Feature):**
1. **Change default**: Update `countdown: true` in `DEFAULT_SETTINGS` object in `persistence.js`
2. **Display calculation**: Modify `displayValue` logic in `renderer.js:renderCellNumbers()` (currently line 403)
3. **Add new display modes**: Extend conditional to support additional feedback styles beyond remaining/total
4. **Tutorial behavior**: Update hardcoded value in `tutorial.js:renderCellNumbers()` call (currently line 207)
5. **UI positioning**: Modify checkbox placement in `index.html` settings list
6. **Setting label**: Change "Countdown" text in checkbox span element

**Modify Hints Setting:**
1. **Change default**: Update `hintMode: 'partial'` in `DEFAULT_SETTINGS` object in `persistence.js`
2. **Toggle behavior**: Modify `cycleHintMode()` in `game.js` (currently binary toggle between 'partial' and 'all')
3. **Checkbox state**: Update `updateCheckboxState()` in `game.js` for visual representation
4. **Add new hint modes**: Extend conditional logic in `renderer.js:renderCellNumbers()` to support additional display modes
5. **Migration**: Add migration logic in `persistence.js:loadSettings()` for backward compatibility
6. **UI positioning**: Modify checkbox placement in `index.html` settings list
7. **Setting label**: Change "Hints" text in checkbox span element

**Change Persistence Behavior:**
1. **Save cooldown**: Modify `SAVE_COOLDOWN_MS` constant in `persistence.js` (default 5000ms)
2. **Storage keys**: Update `getStorageKey()` function in `persistence.js`
3. **Cleanup logic**: Modify `cleanupOldSaves()` to change retention policy
4. **Settings schema**: Update `DEFAULT_SETTINGS` object and add migration logic if needed

**Modify Puzzle Generation:**
1. **Attempt counts**: Adjust `CONFIG.GENERATION.ATTEMPTS_*` values in `config.js`
2. **Algorithm**: Replace Warnsdorff's heuristic in `generator.js:tryWarnsdorff()`
3. **Fallback cycles**: Add pre-generated cycles to `FALLBACK_CYCLES` in `generator.js`

**Add New Visual Features:**
1. **Path styling**: Update `CONFIG.RENDERING.*` constants in `config.js`
2. **Colors**: Modify `CONFIG.COLORS.*` in `config.js`
3. **Animations**: Adjust `renderPlayerPath()`, `renderPath()`, or `renderHintPulse()` in `renderer.js`

**Performance Tuning:**
1. **Canvas sizing**: Adjust `CONFIG.CELL_SIZE_MIN/MAX` in `config.js`
2. **Rendering optimization**: Modify render frequency or use canvas layering
3. **Save frequency**: Tune `SAVE_COOLDOWN_MS` or implement debouncing instead of throttling

### Key Development Tips

**Performance:**
- Use `requestAnimationFrame` for smooth rendering (already implemented in `views/game.js`)
- Debounce resize events (implemented with `ResizeObserver`)
- Cache constraint calculations (turn maps are built once per render)
- Use pointer events (already using Pointer Events API, better than touch + mouse)

**Performance Architecture:**

The path drawing system is heavily optimized for the critical hot path (60+ calls per second during drags):

- **Bresenham's algorithm**: Line-to-grid conversion uses integer-only arithmetic, visiting each cell exactly once (10x faster than sampling)
- **Cached canvas rect**: Bounding rect cached per drag to eliminate layout thrashing (was causing 120 forced reflows/sec)
- **O(1) connection tracking**: Incoming connections tracked via variables instead of array searches
- **Result**: Drawing remains smooth even on lower-end devices with complex path intersections

When modifying `gameCore.js` or `utils.js`, be mindful that `handlePointerMove`, `getCellsAlongLine`, and `extendDragPath` are in the critical rendering path.

**Mobile UX:**
- Prevent page scroll while drawing (implemented in `main.js`)
- Large touch targets (48×48px minimum for buttons)
- Prevent zoom/pinch gestures (implemented with gesture event handlers)
- Consider haptic feedback on constraint satisfaction (Vibration API, not yet implemented)

**Accessibility:**
- High contrast mode option (not yet implemented)
- Keyboard navigation for drawing (arrow keys, not yet implemented)
- Screen reader announcements for constraint states (not yet implemented)
- Focus indicators for buttons (implemented via CSS)

**Testing:**
- Test on various screen sizes (iPhone SE to iPad)
- Test with both touch and mouse
- Test rapid drawing for performance
- Test edge cases (starting at corners, crossing paths, backtracking)

### Quick Start Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build

# Deployment (Netlify)
# Push to git, Netlify auto-deploys from branch
# Build command: npm run build
# Publish directory: dist
```

**Local Development Notes:**

Direct URL testing: When testing locally with `npm run dev`, direct URL navigation works only through in-app navigation. To test direct URLs properly:
1. Deploy to Netlify (recommended), or
2. Use `npm run build && npm run preview` to test production build locally

The Vite dev server doesn't process the `_redirects` file, but the production build on Netlify does.

-----

## Expected Behavior Summary

### Game Mode Comparison

| Aspect | Daily Mode (Easy/Medium/Hard) | Unlimited Mode |
|--------|-------------------------------|----------------|
| **Puzzle Source** | Deterministic from date seed | True random generation |
| **Consistency** | Everyone sees same puzzle on same local date | Each session gets different puzzles |
| **Entry Point** | Home → Select difficulty → Fixed for session | Home → Unlimited → Defaults to Easy |
| **New Button** | Hidden (can't regenerate daily puzzle) | Visible (generate fresh puzzle anytime) |
| **Difficulty** | Fixed by initial selection | Switchable in-session via settings segmented control |
| **Grid Size** | Easy 4x4, Medium 6x6, Hard 8x8 | Same sizes, switchable within session |
| **Timer Display** | Shows selected difficulty (e.g., "Medium • 0:00") | Shows current difficulty (e.g., "Easy • 0:00") |
| **Settings** | Hints, Countdown, Borders, Solution toggles | Same + difficulty segmented control at top |
| **Save Slots** | One per date+difficulty | One per difficulty (persistent across sessions) |
| **Restart** | Replays same daily puzzle | Replays current random puzzle |
| **Rotation** | New puzzle at local midnight | N/A (always generates random) |

### Universal Interactions

| User Action | Behavior |
|-------------|----------|
| **Tap empty cell** | Path starts, cell is drawn |
| **Tap existing cell** | Cell is erased (along with orphaned cells) |
| **Drag** | Blue path extends smoothly, auto-breaks connections when crossing |
| **Drag backward** | Recent path is undone (backtracking) |
| **Restart button** | Clears path, keeps timer running (unless already won) |
| **Back button** | Returns to home page |
| **Settings button** | Opens bottom sheet with toggles |
| **Tab blur** | Timer pauses automatically |
| **Tab focus** | Timer resumes automatically |

**Constraint States:**
- **Colorful (magnitude-based)**: Constraint not yet satisfied, color indicates difficulty (bright orange for low, dark magenta for high)
- **Green**: Constraint satisfied (turn count matches) or displays zero
- **Pulsing background**: Animated 3x3 area showing validation region, color matches hint number

**Number Display Behavior:**
- **Countdown ON (default)**: Shows remaining corners (e.g., need 3, drew 1 → shows "2")
- **Countdown OFF**: Shows total required corners (e.g., need 3 → always shows "3")
- **Negative values**: When too many corners drawn (e.g., need 3, drew 5 → shows "-2")
- **Color**: Magnitude-based gradient from bright yellow-orange to dark magenta (see Magnitude-Based Color System)

**Path Colors:**
- **Black**: Player's active drawing
- **Green**: Victory state (all constraints satisfied)
- **Blue**: Solution path (when "Solution" setting enabled)
