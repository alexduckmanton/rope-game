# Loop - Puzzle Game

## Quick Reference

### Key Modules & Responsibilities

| Module | Purpose | Key Functions & Exports |
|--------|---------|-------------------------|
| `main.js` | App entry point | Initializes router, icons, font preloading |
| `router.js` | Client-side routing | `initRouter()` - History API navigation |
| `gameCore.js` | Game state & pointer events | `createGameCore({ gridSize, canvas, onRender })` - Returns instance with event handlers |
| `generator.js` | Puzzle generation | `generateSolutionPath(size, randomFn)` - Warnsdorff's heuristic, returns Hamiltonian cycle |
| `renderer.js` | Canvas drawing | `renderGrid()`, `renderPlayerPath()`, `renderCellNumbers()`, `generateHintCells()` |
| `persistence.js` | localStorage persistence | `saveGameState()`, `loadGameState()`, `createThrottledSave()`, `saveSettings()` |
| `seededRandom.js` | Deterministic PRNG | `createSeededRandom(seed)` - Mulberry32 for daily puzzles |
| `utils.js` | Validation & pathfinding | `buildSolutionTurnMap()`, `buildPlayerTurnMap()`, `countTurnsInArea()`, `checkStructuralLoop()`, `findShortestPath()` |
| `config.js` | Configuration constants | `CONFIG` - Colors, sizes, generation tuning, rendering params |

### Core Concepts

- **Turn**: Path changes direction within a cell. Corner = 1 turn, straight = 0 turns.
- **Constraint (Hint)**: Number showing expected turn count in surrounding 3x3 area (includes diagonals + self).
- **Victory**: Complete loop visiting all cells exactly once + all constraints satisfied.
- **Daily Puzzle**: Deterministic generation using date-based seed (YYYYMMDD + difficulty offset 0/1/2).
- **Unlimited Mode**: True random generation (not date-based), allows infinite practice with difficulty switching.

### Grid Sizes

| Difficulty | Grid Size | Total Cells | Warnsdorff Attempts |
|------------|-----------|-------------|---------------------|
| Easy       | 4x4       | 16          | 20                  |
| Medium     | 6x6       | 36          | 50                  |
| Hard       | 8x8       | 64          | 100                 |

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
   - Hint colored green when counts match, otherwise uses assigned color from palette

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
├── index.html              # Single-page app with three view containers
├── style.css               # Global styles + view-specific styles
├── netlify.toml           # Netlify deployment configuration
├── public/
│   └── _redirects         # SPA routing for Netlify (serves index.html for all routes)
├── src/
│   ├── main.js            # App entry point, initializes router and icons
│   ├── router.js          # Client-side routing with History API
│   ├── icons.js           # Lucide icon initialization (tree-shakeable imports)
│   ├── config.js          # Centralized constants (colors, sizing, generation tuning)
│   ├── utils.js           # Shared utility functions (path math, validation helpers)
│   ├── seededRandom.js    # Deterministic PRNG for daily puzzles (Mulberry32 algorithm)
│   ├── generator.js       # Puzzle generation (Warnsdorff's heuristic)
│   ├── gameCore.js        # Game state and interaction logic (pointer events, drag handling)
│   ├── renderer.js        # Canvas rendering (grid, paths, hints, borders)
│   ├── persistence.js     # localStorage save/load/cleanup with throttled writes
│   └── views/
│       ├── home.js        # Home view with difficulty selection and date display
│       ├── tutorial.js    # Tutorial view (placeholder for future content)
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

**Hint Cell Selection:** After generating solution path, `generateHintCells()` randomly selects ~30% of cells to show hints using seeded random for daily puzzles or true random for unlimited mode.

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
- Settings: Hints, Border, Solution

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
| Hint colors | 8-color palette | Peachy orange → pink → purple gradient for different hints |
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
- Slides up from bottom with bounce animation (300ms, cubic-bezier(0.34, 1.3, 0.64, 1))
- White background, rounded top corners (16px), soft shadow (80px blur, 10% opacity)
- Settings displayed as list items with grey dividers
- Context-aware: Difficulty segmented control appears only in Unlimited mode
- iOS-style segmented control for difficulty switching
- Changes apply immediately (no save/cancel buttons)
- Click outside or X button to dismiss
- Hidden in tutorial view

### Animations

**Path Drawing:**
- Smooth line rendering (60fps via `requestAnimationFrame`)
- Corner radius for smooth curves (`cellSize * 0.35`)
- Path thickness: 4px, rounded line caps

**Constraint Feedback:**
- Number color transitions smoothly (300ms ease)
- Pulsing background for hint validation areas (2s cycle, max 20% opacity)
- Colors: Assigned palette color → Green when satisfied

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
- **Automatic connection breaking**: When drawing through existing paths, intelligently removes opposite-direction connection
- **Intelligent path extension**: Uses BFS to find shortest path when dragging to non-adjacent cell

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

**Modify Hint Display:**
1. **Hint colors**: Update `CONFIG.COLORS.HINT_COLORS` array in `config.js`
2. **Hint probability**: Change `CONFIG.HINT.PROBABILITY` (0-1) or modify `generateHintCells()` in `renderer.js`
3. **Border rendering**: Modify `drawHintBorders()` in `renderer.js` (width, inset, layer offset)
4. **Pulse animation**: Adjust `CONFIG.HINT.PULSE_DURATION` and `CONFIG.HINT.PULSE_MAX_OPACITY`

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
| **Settings** | Hints, Border, Solution toggles | Same + difficulty segmented control at top |
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
- **Colorful (palette)**: Constraint not yet satisfied
- **Green**: Constraint satisfied (turn count matches)
- **Pulsing background**: Animated 3x3 area showing validation region

**Path Colors:**
- **Black**: Player's active drawing
- **Green**: Victory state (all constraints satisfied)
- **Blue**: Solution path (when "Solution" setting enabled)
