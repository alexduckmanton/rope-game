# Loop - Puzzle Game

## Quick Reference

### Key Modules & Responsibilities

| Module | Purpose | Key Functions & Exports |
|--------|---------|-------------------------|
| `main.js` | App entry point | Initializes router, icons, font preloading, theme-color meta tag updater |
| `router.js` | Client-side routing | `initRouter()` - History API navigation |
| `tokens.css` | Color definitions | CSS custom properties for all colors, dark mode overrides via media query |
| `tokens.js` | Color token exports | `colors`, `semantic` - Reads CSS variables, dispatches `themeChanged` event |
| `config.js` | Configuration constants | `CONFIG` - Colors (from tokens.js), sizes, generation tuning, rendering params, interaction behavior, scoring configuration |
| `gameCore.js` | Game state & pointer events | `createGameCore({ gridSize, canvas, onRender })` - Returns instance with event handlers |
| `generator.js` | Puzzle generation | `generateSolutionPath(size, randomFn)` - Warnsdorff's heuristic, returns Hamiltonian cycle (used for hint generation; players can make smaller loops) |
| `renderer.js` | Canvas drawing | `renderGrid()`, `renderPlayerPath()`, `renderCellNumbers()`, `generateHintCells()`, `calculateBorderLayers()` |
| `persistence.js` | localStorage persistence | `saveGameState()`, `loadGameState()`, `createThrottledSave()`, `saveSettings()` |
| `seededRandom.js` | Deterministic PRNG | `createSeededRandom(seed)` - Mulberry32 for daily puzzles |
| `utils.js` | Validation & pathfinding | `buildSolutionTurnMap()`, `countTurnsInArea()`, `checkStructuralLoop()`, `parseCellKey()`, `createCellKey()`, `getCellsAlongLine()` - Bresenham with 4-connected enforcement |
| `bottomSheet.js` | Reusable bottom sheet UI | `createBottomSheet()`, `showBottomSheetAsync()` - Factory + async helper with onClose callback |
| `components/tutorialSheet.js` | Tutorial bottom sheet | `showTutorialSheet()` - Self-contained carousel with video management |
| `game/timer.js` | Game timer | `createGameTimer({ onUpdate, difficulty })`, `formatTime()` - Encapsulated timer with pause/resume |
| `game/share.js` | Share functionality | `handleShare()`, `buildShareText()` - Web Share API + clipboard fallback, score-aware share text |
| `game/validation.js` | Win validation & scoring | `checkStructuralWin()`, `checkFullWin()`, `validateHints()`, `calculateScore()`, `getScoreLabel()` - Game validation logic and score calculation |
| `game/canvasSetup.js` | Canvas sizing | `calculateCellSize(gridSize, extraSpace)`, `setupCanvas()` - Responsive sizing utilities |

### Core Concepts

- **Turn**: Path changes direction within a cell. Corner = 1 turn, straight = 0 turns.
- **Constraint (Hint)**: Number showing expected turn count in surrounding 3x3 area (includes diagonals + self).
- **Victory**: Closed loop satisfying all constraints.
- **Daily Puzzle**: Deterministic generation using date-based seed (YYYYMMDD + difficulty offset 0/1/2).
- **Unlimited Mode**: True random generation (not date-based), allows infinite practice with difficulty switching.

### Grid Sizes

| Difficulty | Grid Size | Total Cells | Max Hints | Hint Probability | Win Requirement | Warnsdorff Attempts |
|------------|-----------|-------------|-----------|------------------|-----------------|---------------------|
| Easy       | 4x4       | 16          | 2         | 30%              | Any valid loop  | 20                  |
| Medium     | 6x6       | 36          | Unlimited | 20%              | Any valid loop  | 50                  |
| Hard       | 8x8       | 64          | Unlimited | 30%              | Any valid loop  | 100                 |

### Storage Keys

- Daily puzzles: `loop-game:daily:2025-11-30-easy`
- Unlimited mode: `loop-game:unlimited:medium` (one slot per difficulty)
- Settings: `loop-game:settings` (global, shared across all modes)

-----

## Game Rules & Mechanics

### Core Rules

1. **Draw ONE continuous path** that forms a closed loop returning to its starting point
2. **Path can only move UP, DOWN, LEFT, RIGHT** (no diagonals)
3. **Numbered cells are clues** that indicate how many turns (corners/bends) the path must make in the surrounding 3x3 area
4. **The number counts a 3x3 grid centered on itself** - includes orthogonal neighbors, diagonal neighbors, and the numbered cell itself
5. A "turn" = when the path changes direction within a cell (straight = 0 turns, corner = 1 turn)

### Victory Condition

Victory requirements are consistent across all difficulties:

- Path forms a valid closed loop (any shape, any size)
- All hint constraints are satisfied (turn counts match)
- Loop does NOT need to visit every cell to complete the puzzle

**Scoring Distinction:**

While players can complete a valid puzzle without visiting all cells, the scoring system rewards grid coverage:
- Valid completion: Triggers win modal and marks puzzle as solved
- Perfect score (100%): Requires both hint satisfaction (90%) AND visiting all cells (10% Hamiltonian bonus)
- Partial scores: Players completing valid loops without full coverage receive 90% or less

This design allows for creative loop shapes and multiple valid solutions while maintaining challenging constraint satisfaction puzzles, with additional rewards for completionists who achieve Hamiltonian cycles.

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

**Score Tracking System:**

Players receive real-time progress feedback through a percentage-based scoring metric with two independent components: hint constraint satisfaction and grid coverage.

**Score Calculation:**

The scoring system has two components that are calculated independently and added together:

**1. Hints Component (90% of total score):**
- Measures progress toward satisfying all hint constraints
- Formula: `(startingTotal - currentTotal) / startingTotal × 90%`
- `startingTotal`: Sum of absolute values of all expected turn counts
- `currentTotal`: Sum of absolute values of all remaining turns needed
- Uses absolute values so positive and negative deviations are weighted equally
- Maxes out at 90% when all hints are satisfied

**2. Cell Coverage Component (10% of total score):**
- Rewards players for visiting more cells with their loop
- Formula: `(cellsVisited / totalCells) × 10%`
- Proportional scoring: visiting half the grid gives 5%, three-quarters gives 7.5%, etc.
- Achieves full 10% only when drawing a Hamiltonian cycle (visiting all cells)
- Updates in real-time as player draws, even before loop is closed
- Encourages exploration and complete solutions

**Total Score:**
- `finalScore = hintsScore + coverageScore`
- Maximum 100% requires both all hints satisfied (90%) AND all cells visited (10%)
- The 10% bonus percentage is configurable via `CONFIG.SCORING.HAMILTONIAN_BONUS_PERCENT`

**Score Labels:**
| Score Range | Label |
|-------------|-------|
| 100% | Perfect |
| 80-99% | Genius |
| 60-79% | Amazing |
| 40-59% | Great |
| 20-39% | Good |
| 0-19% | Okay |

**Display:**
- Timer shows: "Difficulty • Time • Score%" (e.g., "Medium • 1:23 • 75%")
- Score updates in real-time as player draws path
- Both components update independently during drawing
- Hidden when no hints exist or solution has been viewed

**Validation Modals:**

When players complete a closed loop, contextual feedback modals appear based on validation state:

| Condition | Modal Title | Modal Body | Icon | Color |
|-----------|-------------|------------|------|-------|
| All hints satisfied AND all cells visited (100%) | "Perfect loop!" | Completion time | party-popper | Gold/amber |
| Valid loop but incomplete (<100%) | "\<Score Label\> loop!" | "You scored \<score\>% in \<time\>. Make all numbers zero for a perfect score." | circle-check-big | Green |

**Partial Win Modal:**
- Shows player's current score percentage and time
- Displays encouraging score label as title (e.g., "Amazing loop!")
- Includes Share button to share partial completion
- Timer pauses while modal is visible, resumes on dismiss
- Motivates continued improvement with clear goal

**Perfect Win Modal:**
- Celebrates complete puzzle solution
- Daily mode includes Share button for social features
- Timer stops permanently on perfect completion

**Share Text Format:**

Both partial and perfect completions use a consistent share format that includes the score:

```
💫 Medium Loopy
75% in 2:34
26 Dec 2025
```

- **Perfect wins** (100%): Share text shows "100% in \<time\>"
- **Partial wins** (<100%): Share text shows actual score percentage
- Includes difficulty level, score percentage, time, and date
- Uses Web Share API on mobile devices with clipboard fallback
- Share button available in both partial win and perfect win modals

**Validation Optimization:**

To prevent frustrating accidental modal triggers, validation only runs when the path actually changes. The system computes a state key from connected cells and their connections, ignoring orphaned cells (temporary cells from taps that are immediately cleaned up). This prevents error modals from reappearing when players tap without modifying their loop.

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
- **Fonts**: Inter (UI text) and Monoton (title only), self-hosted via @fontsource

### File Structure

```
rope-game/
├── index.html              # Single-page app with two view containers (home, play)
├── style.css               # Global styles + view-specific styles
├── netlify.toml           # Netlify deployment configuration
├── public/
│   ├── _redirects         # SPA routing for Netlify (serves index.html for all routes)
│   └── videos/            # Tutorial demonstration videos (mp4/webm, ~688KB total)
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
│   ├── components/        # Reusable UI components
│   │   └── tutorialSheet.js # Tutorial carousel bottom sheet with video management
│   ├── game/              # Shared game utilities
│   │   ├── timer.js       # Encapsulated timer with pause/resume support
│   │   ├── share.js       # Share functionality (Web Share API + clipboard fallback)
│   │   ├── validation.js  # Win checking and hint validation logic
│   │   └── canvasSetup.js # Responsive canvas sizing utilities
│   └── views/
│       ├── home.js        # Home view with difficulty selection and date display
│       └── game.js        # Game view with daily/unlimited mode logic
└── package.json
```

-----

## Key Systems

### Puzzle Generation

**Algorithm: Warnsdorff's Heuristic**

Generates Hamiltonian cycles (paths visiting all cells exactly once forming a loop). Note: While the generated solution is a Hamiltonian cycle, players are not required to visit all cells - they only need to satisfy the hint constraints with any valid closed loop.

**Strategy:**
1. Try Warnsdorff's heuristic multiple times (fast, ~0.5ms per attempt, ~25% success rate)
2. Fallback to pre-generated valid cycle if all attempts fail (extremely rare with 100 attempts)

**Warnsdorff's Rule:** Always move to the neighbor with the fewest unvisited neighbors. This greedy strategy avoids dead ends by saving well-connected cells for later.

**Hint Cell Selection:** After generating solution path, `generateHintCells()` probabilistically selects cells to show hints using difficulty-specific probabilities. Each cell has a chance of becoming a hint based on the configured probability for that difficulty level. Easy uses 30% probability but caps at 2 hints maximum to reduce complexity. Medium uses 20% probability with no cap, creating sparser but more challenging puzzles. Hard uses 30% probability with no cap, providing more hints across the larger grid. Probabilities are controlled by `getHintProbabilityForDifficulty()` and apply consistently across both daily puzzles (seeded random) and unlimited mode (true random).

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

**Two Main Views:**

| View | Route | Purpose |
|------|-------|---------|
| **Home** | `/` | Landing page with current date and navigation buttons (Tutorial, Easy, Medium, Hard) |
| **Play** | `/play?difficulty=X` | Main game interface with canvas, controls, timer, settings, help button |

**Tutorial Access:**

Tutorial is implemented as a bottom sheet component rather than a dedicated view:
- **From Home**: Tutorial button opens carousel bottom sheet overlay
- **From Game**: Help icon (circle-help, left of settings) opens same tutorial sheet
- **No Route**: Tutorial has no URL route - accessible via function call from any view

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
**Save skips**: Window resize, settings toggles (have dedicated save), undo operations.

**Edge cases**: Partial win feedback persisted, restore without triggering cooldown, daily ID validation, immediate save on tab blur.

**Session-only state**: Undo history is not persisted to localStorage. Cleared on puzzle load, new puzzle, or difficulty change.

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

### Undo System

**Purpose:** Allows players to revert drawing actions without restarting the entire puzzle.

**Implementation:**
- **History limit**: 50 actions maximum (configurable via UNDO_HISTORY_LIMIT constant)
- **State capture timing**: Before each action begins (on pointerDown), not after completion
- **Action granularity**: Each complete drawing gesture or tap-to-erase counts as one action
- **Duplicate prevention**: Consecutive identical states are filtered out to avoid wasted history slots
- **Deep copying**: Game state is deep-copied to prevent reference issues

**What can be undone:**
- Drawing actions (drag to create path)
- Erase actions (tap to remove cell)
- Restart button (saves state before clearing, enabling undo of restart itself)

**When undo is disabled:**
- No history available (fresh puzzle or all history used)
- Puzzle is won
- Solution has been viewed

**When undo history is cleared:**
- New puzzle generated
- Difficulty changed (unlimited mode)
- Saved game loaded (undo is session-only)

**State captured per action:**
- Player drawn cells (Set)
- Player connections (Map of Sets)
- Win status flags (hasWon, hasShownPartialWinFeedback)
- Validation state key

**Performance:** O(1) state comparison for duplicate detection, minimal memory impact (~50 states × small data structures).

### Google Analytics

**Setup:** Google Analytics 4 (GA4) with measurement ID `G-9BFMVX4CLE`.

**Implementation:**
- **Script tag**: Loaded in `index.html` head immediately after opening `<head>` tag (as Google recommends)
- **SPA tracking**: `src/analytics.js` module exports `trackPageView(path, title)` for virtual page views
- **Router integration**: `router.js` calls `trackPageView()` on every route change

**Tracked Pages:**
- `/` (home)
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

### Color Token System

**Purpose:** Centralized color management system providing automatic dark mode support and consistent theming across UI and canvas rendering.

**Architecture:** Two-tier token system with CSS as single source of truth.

**Design Token Hierarchy:**

1. **Base Color Scales** (Primitive Tokens)
   - **Neutral scale**: 10 shades from lightest to darkest, inverted in dark mode
   - **Blue scale**: Primary action colors, navigation, solution paths
   - **Green scale**: Success states, validated hints, win conditions
   - **Red scale**: Error states, destructive actions
   - **Amber scale**: Success backgrounds, celebration colors
   - **Hint gradient**: 9 magnitude-based colors for hint number display

2. **Semantic Tokens** (Purpose-Based)
   - Reference base scales with meaningful names describing intent
   - Examples: primary, bgBase, textPrimary, canvasBg, playerPath, hintValidated
   - Automatically inherit dark mode values from base scales they reference

**CSS-as-Source-of-Truth Pattern:**

The system maintains a single definition point for all colors while supporting both CSS and JavaScript usage:

- **tokens.css**: Defines all color values as CSS custom properties, includes dark mode overrides via media query
- **tokens.js**: Reads CSS values using getComputedStyle, exports JavaScript-friendly color objects
- **style.css**: Uses CSS variables for all UI styling, automatically adapts to theme
- **config.js**: Imports colors from tokens.js for canvas rendering
- **Synchronization**: Media query listener detects theme changes, reloads JavaScript colors, dispatches custom event

**Dark Mode Implementation:**

The app automatically follows the user's system-wide dark mode preference without requiring manual configuration:

- **Detection**: CSS media query `prefers-color-scheme: dark` automatically applies dark color overrides
- **Theme switching**: JavaScript media query listener detects changes and triggers re-render
- **Canvas updates**: Game and tutorial views listen for `themeChanged` event and redraw with new colors
- **Browser chrome**: Theme-color meta tag updates dynamically to match current theme
- **Zero configuration**: No user-facing toggle needed, respects system preferences

**Dark Mode Color Philosophy:**

- **True Dark approach**: Near-black backgrounds (#1A1A1A) instead of pure black for reduced eye strain and better OLED performance
- **Inverted neutral scale**: Light mode's lightest becomes dark mode's darkest, maintaining semantic meaning
- **Brightened accents**: Primary colors become more vibrant and saturated for visibility on dark backgrounds
- **Elevation through lightness**: Elevated surfaces (buttons, sheets, canvas) are lighter than base background, creating depth
- **Preserved gradients**: Hint magnitude colors maintain their warm-to-cool progression with brightness adjustments

**Key Files:**

| File | Purpose | Dark Mode Role |
|------|---------|----------------|
| `src/tokens.css` | Color definitions | Contains base scales and dark mode overrides |
| `src/tokens.js` | JavaScript exports | Reads CSS values, listens for theme changes |
| `style.css` | UI styling | Uses CSS variables, automatically adapts |
| `src/config.js` | Game configuration | Imports semantic tokens for canvas colors |
| `src/main.js` | App initialization | Updates theme-color meta tag on theme change |
| `src/views/game.js` | Game view | Re-renders canvas on theme change |
| `src/components/tutorialSheet.js` | Tutorial component | Re-renders canvas on theme change |

**Performance Characteristics:**

- **Initial load**: CSS variables loaded instantly with stylesheet, JavaScript reads once during module initialization
- **Theme change**: ~1ms to read new CSS values, single requestAnimationFrame for canvas re-render
- **No duplication**: CSS is single source of truth, eliminates maintenance burden of parallel color systems
- **Automatic cascade**: CSS variable changes flow through all components without manual updates

**Benefits:**

- **Maintainability**: Single location to modify colors affects entire app (CSS and JS)
- **Consistency**: Canvas rendering always matches UI styling via shared color source
- **Accessibility**: Automatic dark mode reduces eye strain in low-light environments
- **User experience**: Respects system preferences without forcing users to configure app-level settings
- **Future-proof**: Easy to add theme variations, high-contrast modes, or custom color schemes

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

Six predefined color schemes provide visual context:

| Scheme | Icon Color | Background Color | Usage |
|--------|-----------|------------------|-------|
| `neutral` | `#6B7280` (grey) | `#F3F4F6` (pale grey) | Settings, default |
| `success` | `#F59E0B` (amber/gold) | `#FEF3C7` (pale golden yellow) | Perfect win notifications, celebrations |
| `partial` | `#10B981` (green) | `#D1FAE5` (pale green) | Partial win notifications with score feedback |
| `error` | `#EF4444` (red) | `#FEE2E2` (pale red) | Error feedback (legacy) |
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
| Perfect win (game) | Transient | HTML string | `party-popper` | `success` | "Yay!" |
| Perfect win (tutorial) | Transient | HTML string | `party-popper` | `success` | "Next" |
| Partial win (game) | Transient | HTML string | `circle-check-big` | `partial` | "Keep trying" |

**Integration Points:**

Settings sheet integrates with persistence system (saves on toggle), router (dismisses on navigation), and game state (re-renders on difficulty change). Notification sheets integrate with game validation (show on win/partial win) and tutorial system (navigation callbacks).

**Known Limitations:**

No built-in state tracking across multiple sheets (only one should be visible at a time, enforced by convention not code). No animation queueing (rapid show/hide calls may cause visual glitches). No accessibility enhancements yet (no focus trapping, no ARIA labels, no keyboard shortcuts). These are acceptable tradeoffs for current single-sheet usage patterns but would need addressing for more complex modal workflows.

**Future Considerations:**

Component could be extended to support multiple simultaneous sheets with z-index stacking, animation queueing for rapid successive shows, keyboard navigation (Escape to close), focus management (trap focus within sheet, restore on close), and ARIA attributes for screen readers. Current implementation prioritizes simplicity and covers all existing use cases without over-engineering for hypothetical requirements.

### Tutorial Bottom Sheet System

**Architecture:** Self-contained carousel component providing interactive walkthrough accessible from any view without navigation.

**Key Design Decisions:**

**Bottom Sheet Instead of Dedicated View:**
- Maintains user context - tutorial overlay doesn't navigate away from current screen
- Accessible from anywhere via simple function call - no routing complexity
- Consistent with app's modal pattern for transient content
- Reduces bundle size by eliminating separate view scaffolding

**Horizontal Scrolling Carousel:**
- iOS-style onboarding pattern familiar to mobile users
- Natural swipe gesture for progression through lessons
- Scroll-snap ensures crisp section alignment
- Paging dots provide visual progress indicator and direct navigation

**Video-Based Content:**
- Three demonstration videos showing core mechanics
- Videos cached on first open and reused across session
- Total size ~688KB (webm format) - acceptable for educational content
- Intersection Observer manages video playback - only visible video plays

**Technical Implementation:**

**Module State Management:**
- Videos created once on first `showTutorialSheet()` call and cached for session
- Intersection Observer cleaned up via bottom sheet's `onClose` callback
- Double requestAnimationFrame ensures DOM ready before observer setup
- Named constants for configuration values (VIDEO_VISIBILITY_THRESHOLD)

**Performance Optimizations:**
- Lazy video initialization - no overhead until tutorial accessed
- Video element reuse - no DOM thrashing on section changes
- Scroll event listener updates paging dots in real-time (lightweight operations)
- Skeleton loader provides perceived performance during video load

**Content Structure:**

Each of three sections contains:
- Demonstration video (square aspect ratio, muted, looping, autoplay)
- Body copy explaining mechanic (centered below video)
- Shared paging dots (fixed position, iOS-style pill expansion on active)
- Navigation button ("Next" → "Next" → "Got it")

**Tutorial Content:**
1. Drawing closed loops with drag gesture and tap-to-erase
2. How numbers count down based on path bends in surrounding area
3. Win condition - single continuous loop with all numbers at zero

**Integration Points:**
- Accessible via `showTutorialSheet()` from home.js and game.js
- No dependencies on game state or routing
- Shares bottom sheet component for consistent UX
- Videos stored in public/videos/ folder

**Resource Cleanup:**
Observer disconnected on sheet close via onClose callback. Videos remain cached in memory for instant reopening. On app reload, videos re-initialize on first tutorial access.

-----

## UI/UX Specifications

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
|                           | ← 16px spacing
|  [Restart]  [Undo]        | ← Control buttons (equal width, elevated bg)
+---------------------------+
```

**Canvas Sizing:** All difficulty levels (4x4, 6x6, 8x8) render at the same total canvas size. The reference size is calculated based on a 4x4 grid, then applied to larger grids with proportionally smaller cells. This ensures visual alignment with the restart and undo buttons below.

**Button Styling:** Minimal flat design, rounded corners (8px), subtle shadow on tap, no heavy borders.

**Icons:**
- **Library**: Lucide icons (tree-shakeable, ~2-3KB for current icons)
- **Sizing**: 18px inline (button labels), 20px standalone, 24px header buttons
- **Color**: Inherit via `currentColor`
- **Usage**: Arrow-left (back), Circle-help (help), Settings (gear), Dices (new puzzle), Refresh-ccw (restart), Undo2 (undo), Party-popper (win), Circle-off (error), Share2 (share), Trophy/Skull (completion icons)

**Settings Bottom Sheet:**

Built using the bottom sheet component system (see Bottom Sheet Component System in Key Systems). The settings panel is a persistent sheet that reuses the same HTMLElement instance across multiple show/hide cycles.

- **Visual Design**: Slides up with bounce animation (300ms, cubic-bezier(0.34, 1.3, 0.64, 1)), elevated background (adapts to theme), rounded top corners (16px), soft shadow (80px blur, 10% opacity)
- **Layout**: Settings displayed as list items with grey dividers
- **Available Settings:**
  - **Difficulty** (Unlimited mode only): iOS-style segmented control for switching grid sizes
  - **Hints**: Binary toggle between Partial (30% of cells, unchecked) and All (100% of cells, checked). Default: Partial. Migration: Old 'none' values automatically converted to 'partial' on load.
  - **Countdown**: Boolean toggle for remaining vs total corners display (default ON)
  - **Borders**: Three-state toggle (Off → Center → Full) for hint area borders
  - **Solution**: Boolean toggle to overlay solution path in blue
- **Behavior**: Context-aware (difficulty segmented control appears only in Unlimited mode), changes apply immediately with live re-render (no save/cancel buttons), click outside or dismiss button to close

**Game Control Buttons:**

Restart and Undo buttons appear below the canvas in a horizontal layout.

- **Positioning**: Centered below canvas with 16px top spacing
- **Layout**: Flex container with equal-width buttons (flex: 1), 16px gap between
- **Max width**: 400px to prevent oversizing on large screens
- **Styling**: Elevated background matching canvas (theme-aware), no drop shadow, no transform on interaction
- **States**:
  - Default: Elevated background with standard text color
  - Hover: No visual change (prevents stuck states on touch devices)
  - Active: No visual change (prevents stuck states on touch devices)
  - Disabled: 30% opacity, not-allowed cursor
  - Focus: No outline (removes persistent grey background after tap)
- **Restart button**: Always enabled unless puzzle is won or solution viewed
- **Undo button**: Enabled only when undo history exists and puzzle not completed

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

**Smart Backtracking:**

The backtracking system uses distance-based logic to prevent accidental path erasure while maintaining precise control:

- **1-4 squares back**: Normal backtracking (erases those squares)
- **5+ squares back**: Touch is ignored to prevent accidental full erasure
- **Loop closing**: Returning to first cell always works regardless of distance
- **Threshold**: Configurable via `CONFIG.INTERACTION.BACKTRACK_THRESHOLD` (default: 4)

**Design Rationale:** Long crossing paths frequently triggered accidental full erasure when the pointer briefly touched old cells far back in the path. The threshold provides a forgiving drawing experience for complex loops while maintaining precise backtracking for small corrections. Higher values are more forgiving but make deliberate long-distance backtracking impossible. Lower values require more precision but allow backtracking across longer distances.

**Diagonal Drawing Continuity:**

Drawing diagonally across the grid maintains smooth, uninterrupted flow:

- **Challenge**: Bresenham's algorithm produces 8-connected paths (diagonal jumps) but the game requires 4-connected paths (orthogonal only)
- **Solution**: Direction-tracking post-processing automatically inserts intermediate cells for diagonal movements
- **Behavior**: Creates natural alternating patterns (horizontal→vertical→horizontal) that follow the drawing gesture
- **Result**: Players can draw at any angle without interruption or having to manually trace step-by-step paths

**Undo Button vs Drag Backtracking:**

The game provides two distinct mechanisms for reversing actions:

- **Drag backtracking**: During an active drawing gesture, dragging backward over recently drawn cells removes them (1-4 cells back). This is immediate, gesture-based correction.
- **Undo button**: After completing a drawing action, the undo button reverts the entire action. This provides step-by-step history navigation across multiple completed actions (up to 50).

These complement each other: backtracking for in-gesture corrections, undo for multi-action history.

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
- Undo functionality with 50-action history (session-only, not persisted)
- Timer with auto-pause on tab blur
- Responsive mobile-first UI with smooth animations
- Consistent canvas sizing across all difficulty levels
- Settings bottom sheet with context-aware controls
- Intelligent drag interactions and path smoothing
- Automatic dark mode following system preferences
- Design token system with CSS-as-source-of-truth architecture

**🚧 Planned Enhancements**
- Interactive tutorial with guided puzzle examples
- Redo functionality (undo already implemented)
- Move counter
- Daily puzzle completion tracking and statistics dashboard
- Streak counter (consecutive days completed)
- Leaderboards and social sharing for daily puzzles (requires backend)
- Achievement system
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
1. **Hint number colors**: Modify hint gradient colors in `tokens.css` (both light and dark mode blocks). The 9-color gradient is defined as `--color-hint-1` through `--color-hint-9` and automatically flows to `CONFIG.COLORS.HINT_COLORS`
2. **Hint pulsing background color**: Modify color assignment in `renderHintPulse()` function in `renderer.js` (currently uses blue for unvalidated, green for validated)
3. **Hint probability per difficulty**: Modify `getHintProbabilityForDifficulty()` function in `game.js` to change probability values for each difficulty level. Changes apply to both daily and unlimited modes automatically since both use the same difficulty-based function. Note: Easy caps at 2 hints regardless of probability, while medium and hard have unlimited hints.
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
2. **Colors**: See "Modify Colors" section below for proper color token workflow
3. **Animations**: Adjust `renderPlayerPath()`, `renderPath()`, or `renderHintPulse()` in `renderer.js`

**Modify Colors:**
1. **Edit color values**: Update CSS custom properties in `src/tokens.css`
   - Modify base color scales (neutral, blue, green, red, amber) in the `:root` block
   - For dark mode: Update corresponding colors in the `@media (prefers-color-scheme: dark)` block
   - Changes automatically flow to both UI (CSS) and canvas (JavaScript)
2. **Add new semantic tokens**: Define new purpose-based color references
   - Add to `:root` block in tokens.css using `var()` to reference base scales
   - Import in tokens.js by adding to `loadSemanticFromCSS()` function
   - Use in config.js by referencing semantic token
3. **Add new color scales**: For new color families beyond existing scales
   - Define scale shades in tokens.css `:root` block
   - Add dark mode overrides in media query block
   - Add to `loadColorsFromCSS()` function in tokens.js
   - Reference in config.js or create semantic tokens
4. **Testing color changes**:
   - Check both light and dark modes by toggling system appearance settings
   - Verify canvas rendering matches UI styling
   - Ensure contrast ratios meet accessibility standards
   - Test hint gradient maintains visual hierarchy in both themes

**Performance Tuning:**
1. **Canvas sizing**: Adjust `CONFIG.CELL_SIZE_MIN/MAX` in `config.js`
2. **Rendering optimization**: Modify render frequency or use canvas layering
3. **Save frequency**: Tune `SAVE_COOLDOWN_MS` or implement debouncing instead of throttling

**Modify Backtracking Sensitivity:**
1. **Change threshold**: Update `CONFIG.INTERACTION.BACKTRACK_THRESHOLD` in `config.js` (default: 4 squares)
2. **Higher values** (5-10): More forgiving, reduces accidental erasure on complex crossing paths, but makes deliberate long-distance backtracking impossible
3. **Lower values** (1-3): More precise control, allows backtracking across shorter distances only, but easier to accidentally erase when drawing crosses itself
4. **Special case**: Value of 1 makes backtracking work only for immediately adjacent cells (most precise, least forgiving)
5. **Affects**: All drawing interactions in both daily and unlimited modes, applies globally

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
- **4-connected path enforcement**: Post-processing layer ensures adjacency by inserting intermediate cells for diagonal jumps
- **Result**: Drawing remains smooth even on lower-end devices with complex path intersections

**4-Connected Path Continuity:**

The game requires 4-connected paths (Manhattan distance = 1 between cells) but Bresenham's algorithm naturally produces 8-connected paths (allows diagonals). A post-processing layer bridges this gap:

- **Detection**: Scans for diagonal jumps (both row and column change between consecutive cells)
- **Insertion strategy**: Adds intermediate cells based on previous movement direction
- **Direction tracking**: Alternates horizontal and vertical insertions to create natural flowing paths
- **Performance**: O(n) linear scan with minimal overhead, executes in the same frame as Bresenham
- **Alternative approaches considered**: Modified Bresenham (complex, may skip cells), pathfinding (overkill, slower), both cells insertion (doubles path length unnecessarily)

This approach was chosen for its simplicity, performance, and natural drawing feel. The direction-tracking creates intuitive paths that follow the gesture rather than arbitrary fixed patterns.

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
| **Win Requirement** | Any valid loop satisfying all hints | Same for all difficulties |
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
