# Loop - Puzzle Game

## Game Premise

**Loop** is a minimalist path-drawing puzzle game where players create a single continuous loop through a grid, guided by numbered constraints.

### Core Rules

1. **Draw ONE continuous path** that visits every cell exactly once and returns to the starting point
1. **Path can only move UP, DOWN, LEFT, RIGHT** (no diagonals)
1. **Numbered cells are clues** that indicate how many turns (corners/bends) the path must make in the surrounding 9-cell area (all 8 adjacent cells including diagonals, plus the numbered cell itself)
1. **The number counts a 3x3 grid centered on itself** - this includes orthogonal neighbors, diagonal neighbors, and the numbered cell itself
1. A "turn" = when the path changes direction within a cell (straight = 0 turns, corner = 1 turn)

### Victory Condition

All constraints are satisfied AND the path forms a complete loop visiting every cell exactly once.

-----

## Tech Stack

### Recommended Stack (Modern, No Backend)

- **HTML5 Canvas** or **SVG** for grid rendering
- **Vanilla JavaScript** (or TypeScript) for game logic
- **CSS3** for animations and UI
- **Lucide Icons** for UI icons (tree-shakeable, minimal bundle size)
- **No framework required** for MVP (keep it lightweight)
- Optional: **Vite** for dev server and build tooling

### Alternative Stack (Component-Based)

- **React** for UI management
- **Canvas** for grid rendering

### Mobile Gestures

- **Pointer Events API** (handles both mouse and touch)
- Support for:
  - Drag to draw (continuous path creation)
  - Single tap to erase existing cells
  - Drag backward to undo recent drawing (backtracking)
  - Automatic connection breaking when drawing through existing paths
  - All interactions should feel native and responsive

-----

## Implementation Guide

### 1. Puzzle Generation Algorithm

**High-Level Approach:**

1. **Generate a valid solution path first**
- Start at random cell
- Use recursive backtracking to create a path visiting all cells once
- Ensure it forms a closed loop
2. **Calculate constraints from the solution**
- For each cell, count turns in the surrounding 9-cell area (8 neighbors + self)
- Only place numbers for cells that add interesting constraints
- Avoid over-constraining (too many numbers = too easy)
3. **Test solvability**
- Verify the puzzle has exactly one solution
- Remove redundant constraints if possible

### 2. Daily Puzzle System

**Deterministic Generation Approach:**

The daily puzzle system creates identical puzzles for all players on the same local date using a seeded pseudorandom number generator (PRNG) rather than backend storage.

**Key Design Decisions:**

1. **Seeded Random Number Generation**
   - Uses Mulberry32 algorithm for deterministic, high-quality pseudorandom numbers
   - Same seed always produces identical puzzle, hints, and solution path
   - Seed format: YYYYMMDD concatenated with difficulty offset (0=easy, 1=medium, 2=hard)
   - Example: November 30, 2025 Easy = seed 202511300

2. **Local Timezone Strategy**
   - Each player's puzzle changes at their local midnight, not UTC
   - Same as popular daily puzzle games (NYT Crossword, Wordle)
   - Players in different timezones see different puzzles on the same UTC day
   - Simplifies UX - no confusion about when "today's puzzle" updates

3. **No Backend Required**
   - Deterministic algorithm eliminates need for puzzle storage or caching
   - All generation happens client-side on demand
   - Reduces infrastructure costs and complexity
   - Works offline after initial page load

4. **Puzzle Identity System**
   - Each puzzle has unique ID: date string plus difficulty (e.g., "2025-11-30-easy")
   - Enables future social features: leaderboards, result sharing, statistics
   - Natural key for completion tracking in localStorage

**Randomization Points:**
- Warnsdorff algorithm starting position (seeded)
- Tie-breaking when multiple cells have same priority (seeded)
- Hint cell selection probability (seeded)

**Cross-Browser Consistency:**
The PRNG uses only bitwise operations guaranteed to be deterministic across all JavaScript engines, ensuring players get identical puzzles regardless of browser or device.

**Tradeoffs Accepted:**
- Puzzle quality varies by date (some dates produce easier/harder puzzles than others)
- Players can change system clock to preview future puzzles (acceptable for casual game)
- No server-side validation of completion times (trust-based until backend added)

### 3. Visual Feedback

**Constraint States:**

- **Gray**: Not yet evaluable (path incomplete)
- **Yellow**: Constraint violated (wrong turn count)
- **Green**: Constraint satisfied
- **Red**: Impossible to satisfy with current path

-----

## UI/UX Specifications

### Minimalist Design

**Color Palette:**

- Background: `#F5F5F5` (light gray)
- Grid lines: `#E0E0E0` (subtle gray)
- Path: `#4A90E2` (calm blue)
- Numbers: `#2C3E50` (dark blue-gray)
- Constraint satisfied: `#27AE60` (green)
- Constraint violated: `#F39C12` (amber, not harsh red)
- UI elements: `#34495E` (dark gray)

**Typography:**

The app uses custom web fonts for a polished, consistent appearance across all platforms while maintaining performance.

**Font Choices:**

- **Body Copy (Inter):** Clean, highly legible sans-serif used for all UI text (buttons, labels, settings, navigation). Designed specifically for digital interfaces with excellent readability at small sizes.
- **Display Font (Monoton):** Distinctive retro-futuristic display font used exclusively for the main "Loopy" title on the home screen, creating visual personality without overwhelming the minimal aesthetic.

**Implementation Strategy:**

- **Package Source:** Fonts are self-hosted via @fontsource npm packages rather than Google Fonts CDN. This ensures privacy compliance, offline functionality, and eliminates external dependencies that could fail or introduce tracking.
- **Loading Behavior:** All fonts use font-display: block to completely eliminate font rendering flicker (FOUT). Text remains invisible for a brief moment until fonts load rather than showing fallback fonts that swap visibly. This creates a cleaner visual experience.
- **Performance Optimization:** Critical font files are preloaded via JavaScript using Vite's URL import system, ensuring fonts start downloading immediately on page load before CSS parsing completes. Fonts load in approximately 100-200ms on typical connections.
- **Bundle Size:** Total font payload is approximately 120KB for all weights (400, 500, 600, 700 of Inter plus Monoton), gzipped to around 30KB. Only latin and latin-ext subsets are included via unicode-range optimization.
- **Fallback Chain:** System fonts (system-ui, -apple-system, Segoe UI) are provided as fallbacks in case font loading fails, though with font-display: block this means text appears in system fonts only if fonts completely fail to load within the 3-second timeout.
- **OpenType Features:** The game timer uses tabular numerals (monospaced digits) via Inter's OpenType features to prevent layout shift as the timer counts up. This ensures all digits occupy equal width, keeping the timer visually stable.

**Tradeoffs Accepted:**

- Brief invisible text period during initial load (100-200ms) in exchange for zero flicker
- Slightly larger bundle size compared to system fonts in exchange for consistent cross-platform appearance
- JavaScript-based preloading for maximum performance in exchange for slightly more complex implementation

**Font Weights Used:**

- Numbers: Bold (700), 24-32px depending on cell size
- Buttons: SemiBold (600), 16-18px
- Navigation: Medium (500), 22px
- Body text: Regular (400), 16-20px

**Layout (Mobile-First):**

```
+---------------------------+
|       [New] [Restart]     | <- Top bar, fixed
+---------------------------+
|                           |
|       [GRID 5x5]          | <- Canvas, centered
|                           |
|                           |
+---------------------------+
```

**Button Styling:**

- Minimal, flat design
- Rounded corners (8px)
- Subtle shadow on tap
- No heavy borders

**Icons:**

The app uses Lucide icons with a tree-shakeable import pattern to minimize bundle size. Icons are centralized in a single initialization module and rendered via data attributes in HTML.

- **Library Choice:** Lucide provides consistent, minimal SVG icons that match the app's clean aesthetic
- **Bundle Optimization:** Only icons actively used are included in the production bundle (approximately 2-3KB for current icons)
- **Design Consistency:** Icons inherit color from parent elements via currentColor, ensuring they match the UI color palette automatically
- **Standard Sizing:** Icons use explicit width/height attributes (18px for inline icons, 20px for standalone buttons, 24px for larger close buttons)
- **Current Usage:** Arrow-left (back navigation), Settings (gear icon), X (close/dismiss)
- **Extensibility:** New icons are added by importing them in the centralized module, making icon management predictable and maintainable

**Alignment Pattern:** Icons paired with text (like the back button) use flexbox with align-items: center and a small gap for consistent vertical alignment.

**Bottom Sheet Pattern:**

- Slides up from bottom with playful bounce animation (300ms)
- White background with rounded top corners (16px)
- Soft shadow for depth (80px blur, 10% opacity, no dark overlay)
- Settings displayed as list items with grey dividers (#E0E0E0)
- Context-aware content: difficulty segmented control appears only in Unlimited mode
- iOS-style segmented control for difficulty switching (gray background, white active state with shadow)
- Changes apply immediately (no save/cancel buttons)
- Click outside to dismiss
- Hidden in tutorial view (game view only)
- Bottom padding buffer prevents gap during bounce overshoot

### Animations

**Path Drawing:**

- Smooth line rendering (60fps)
- Slight "trail" effect as you draw
- Animate path thickness on completion

**Constraint Feedback:**

- Number color transitions smoothly (300ms ease)
- Subtle pulse animation when constraint satisfied
- Gentle shake if constraint violated (avoid harsh feedback)

**Victory Animation:**

- Path color shifts through gradient
- Constraint numbers fade to green
- Subtle confetti or particle effect (optional)
- "Puzzle Solved" message fades in

**Settings Bottom Sheet:**

- Slide up: Ease-out with subtle bounce (cubic-bezier(0.34, 1.3, 0.64, 1))
- Slide down: Steep ease-in, no bounce (cubic-bezier(0.6, 0, 0.9, 1))
- Shadow fades in/out with sheet movement (300ms)
- Padding buffer (40px) prevents gap during bounce overshoot

-----

## File Structure

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
│   ├── renderer.js        # Canvas rendering (grid, paths, hints, borders)
│   ├── persistence.js     # localStorage save/load/cleanup with throttled writes
│   └── views/
│       ├── home.js        # Home view with difficulty selection and date display
│       ├── tutorial.js    # Tutorial view (placeholder for future content)
│       └── game.js        # Game view with daily/unlimited mode logic
└── package.json
```

**Architecture:** Single-page application (SPA) with client-side routing. Each view is a separate module that exports initialization and cleanup functions. The persistence module handles automatic save/restore across all game modes.

-----

## Navigation & Routing

### Architecture Overview

The app uses a **Single-Page Application (SPA)** architecture with client-side routing via the History API. No page reloads occur during navigation, creating a fast, app-like experience.

### Three Main Views

**1. Home View (default route: `/`)**
- Landing page with game title "Loopy"
- Displays current date (formatted as "30 November 2025") as the tagline
- Five navigation buttons: Tutorial, Easy (4x4), Medium (6x6), Hard (8x8), Unlimited
- Clean, centered layout with large touch-friendly buttons
- Date updates automatically based on local timezone

**2. Tutorial View (route: `/tutorial`)**
- Placeholder page for future interactive tutorial content
- Includes back button to return home
- Navigation title is center-aligned and empty initially (set by JavaScript)
- Ready for enhancement with step-by-step puzzle tutorials

**3. Play View (route: `/play?difficulty=easy|medium|hard|unlimited`)**
- The main game interface with canvas and controls
- Difficulty is set via URL parameter and determines grid size
- Navigation bar title intentionally left blank (difficulty shown in timer display instead)
- Timer display format: "Difficulty • MM:SS" (e.g., "Hard • 1:23")
- Includes back button to return home
- Controls: Back, Restart buttons + Settings gear icon (New button appears only in Unlimited mode)
- Daily puzzle modes (Easy, Medium, Hard) hide the New button since everyone plays the same daily puzzle
- Settings bottom sheet with context-aware controls based on game mode

### Smart History Management

The router implements intelligent history tracking to maintain a clean navigation stack:

**State Tracking:** When navigating FROM home to a subpage, the router adds metadata to the history state indicating the origin. This allows the back button to behave differently depending on how the user arrived.

**Back Button Logic:**
- If user navigated from home: Clicking back pops history to return to the original home entry (no duplicate entries)
- If user arrived via direct URL: Clicking back replaces the current entry with home

**Result:** The history stack always maintains a single clean home entry after using in-app navigation. Browser back from home exits the app entirely.

**Benefits:**
- No confusing duplicate home entries in history
- In-app "back" feels like "close/exit this screen"
- Works correctly with both in-app navigation and direct URL visits
- Browser back/forward buttons work as expected

### Game Modes

The app offers two distinct play experiences:

**Daily Puzzle Modes (Easy, Medium, Hard)**
- Fixed grid sizes: Easy (4x4), Medium (6x6), Hard (8x8)
- Everyone playing on the same local date receives identical puzzles
- Puzzles are generated using date-based deterministic randomization
- All players see the same hint cells and solution path for a given date and difficulty
- New button is hidden since daily puzzles cannot be regenerated
- Restart button allows replaying the same daily puzzle
- Puzzle changes automatically at local midnight
- Settings bottom sheet shows only standard toggles: Hints, Border, Solution

**Unlimited Mode**
- Practice mode allowing unlimited puzzle replays at any difficulty
- Uses true random generation (not date-based) for infinite variety
- Defaults to Easy difficulty (4x4 grid) on entry
- New button is visible and generates fresh random puzzles
- Settings bottom sheet includes an additional iOS-style segmented control at the top
- Segmented control allows switching between Easy, Medium, and Hard within the same session
- Changing difficulty immediately regenerates the puzzle and resets the timer
- Timer display shows the currently selected difficulty level, not "Unlimited"
- All other settings (Hints, Border, Solution) persist when switching difficulties

**Design Rationale:**
- Daily puzzles create shared experience and enable future social features (leaderboards, sharing results)
- Local timezone ensures puzzles change at midnight for each player regardless of location
- Deterministic generation eliminates need for backend storage or caching
- Puzzle IDs (format: "2025-11-30-easy") provide natural keys for future stats tracking
- Segmented control is hidden in daily modes to keep the UI clean and prevent confusion
- Unlimited mode provides practice environment without daily constraints
- Difficulty switching triggers full puzzle regeneration with timer reset for fair practice sessions

### Deployment Considerations

**Netlify Configuration:** The app includes both `_redirects` file and `netlify.toml` configuration to handle SPA routing on Netlify. All routes serve `index.html` with a 200 status (rewrite, not redirect), allowing the client-side router to handle URL matching.

**Direct URL Access:** Users can bookmark or share any route and it will load correctly, even when accessed directly (not through in-app navigation).

-----

## Timer Behavior

### Automatic Pause on Tab Blur

The game timer automatically pauses when the browser tab becomes hidden and resumes when the tab becomes visible again, ensuring fair and accurate timing for puzzle completion.

**Implementation Approach:**

The timer uses the Page Visibility API to detect when the document becomes hidden, which occurs in the following scenarios:
- User switches to a different browser tab
- User minimizes the browser window
- User closes the browser (pause happens just before close)
- Mobile users switch to a different app

**Design Decisions:**

**1. Page Visibility API (Chosen)**
   - Industry standard specifically designed for detecting tab visibility
   - Excellent browser support across all modern browsers (stable since 2015)
   - Semantically correct for "is the tab visible to the user?"
   - Low false positive rate - only fires when tab genuinely becomes hidden
   - Recommended approach by MDN and modern web development best practices

**2. Timestamp-Based Pause Mechanism**
   - Timer tracks the exact timestamp when pause occurs
   - On resume, the original start time is shifted forward by the pause duration
   - This approach maintains accuracy regardless of how long the tab was hidden
   - Timer display updates are skipped during pause (setInterval continues but checks pause state)
   - No visual indication of pause state - timer simply freezes at current time

**3. Scenarios NOT Detected**
   - Alt+Tab to different application (window blur, but tab remains visible)
   - Multiple browser windows where tab is visible but window lacks focus
   - Focus on DevTools in separate window
   - These are acceptable limitations for a browser-based puzzle game

**Edge Case Handling:**

- **Pausing when already paused:** Guards prevent double-pausing and state corruption
- **Timer stopped (game won):** Pause logic safely ignores attempts to pause stopped timer
- **New puzzle while paused:** Starting new timer automatically resets pause state
- **Rapid tab switching:** Timestamp-based calculation remains accurate across multiple pause/resume cycles
- **Cleanup:** Visibility event listener is properly registered and removed with view lifecycle

**Benefits:**

- **Fair competition:** Daily puzzle times exclude time spent away from the game
- **Better user experience:** Players can step away without penalty or time anxiety
- **Accurate metrics:** Completion times reflect actual puzzle-solving duration
- **Simple implementation:** Approximately 40 lines of code with no dependencies
- **No user configuration needed:** Works automatically without settings or toggles

**Tradeoffs Accepted:**

- Desktop Alt+Tab scenarios not detected (acceptable for casual browser game)
- No visual "PAUSED" indicator displayed (timer simply stops advancing)
- Trust-based system until backend validation added (consistent with daily puzzle approach)

-----

## Game Progress Persistence

### Architecture Overview

The game implements automatic save/restore functionality using browser localStorage, allowing players to exit mid-puzzle and resume exactly where they left off. Persistence is completely client-side with no backend requirements, maintaining consistency with the app's offline-first design philosophy.

### Core Design Decisions

**1. Throttled Save Strategy**

The persistence system uses a throttle pattern (not debounce) to balance data integrity with performance:

- **First save executes immediately** when player makes a move
- **5-second cooldown** prevents excessive writes during rapid drawing
- **Trailing save** ensures final state is always captured after cooldown expires
- **Immediate saves bypass throttle** when critical (tab backgrounding, navigation away, game completion)

**Rationale:** This approach provides optimal data safety without impacting performance. Players never lose more than 5 seconds of progress, while avoiding hundreds of localStorage writes during continuous drawing. Immediate saves on exit events catch the edge case where a player draws and immediately navigates away within the cooldown window.

**2. Separation of Game State and Settings**

The system maintains two independent localStorage namespaces:

- **Game state keys:** `loop-game:daily:2025-11-30-easy` or `loop-game:unlimited:medium`
- **Settings key:** `loop-game:settings` (singular, global)

**Game State (per-puzzle):** Player path, timer, win status, partial win feedback flag. For unlimited mode only, also includes the randomly generated puzzle data (solution path and hint cells) since it cannot be deterministically regenerated.

**Settings (global):** Hint mode, border mode, show solution flag, last selected unlimited difficulty. These persist across all game modes and sessions.

**Rationale:** Separating concerns allows settings to transfer seamlessly between daily and unlimited modes while keeping puzzle progress isolated. A player can switch from daily easy to unlimited hard and have their UI preferences automatically applied.

**3. Storage Key Architecture**

Each game mode maintains independent save slots:

- **Daily puzzles:** One slot per difficulty per day (e.g., `loop-game:daily:2025-11-30-medium`)
- **Unlimited mode:** One slot per difficulty (e.g., `loop-game:unlimited:hard`)

**Daily Behavior:** When the date changes, old daily saves are automatically cleaned up since they represent completed or abandoned puzzles from previous days. The deterministic puzzle generation means daily puzzles can be regenerated from their date-based seed, so only player progress needs saving.

**Unlimited Behavior:** Each difficulty maintains its own persistent save slot. Switching from easy to medium saves the easy state, loads the medium state (or generates new puzzle if none exists), allowing players to maintain progress across multiple difficulty levels simultaneously.

**Rationale:** Isolating save slots by difficulty prevents accidental data loss and enables natural workflow patterns. Players can start an unlimited easy puzzle, switch to medium for variety, then return to their easy progress days later. The automatic cleanup of old daily saves prevents unbounded localStorage growth.

**4. Data Serialization Strategy**

The system uses custom serialization rather than direct object storage:

- **Sets → Arrays:** Player drawn cells and hint cells are Sets in memory but serialize to arrays
- **Maps → Objects:** Player connections are Maps in memory but serialize to nested objects
- **Version field:** Every save includes a version number for future schema migration
- **Timestamp:** Each save records when it was created for debugging and potential analytics

**Rationale:** Sets and Maps cannot be directly JSON-serialized. The transformation layer ensures clean localStorage storage while maintaining optimal in-memory data structures. The version field provides forward compatibility when the save format inevitably needs to evolve.

**5. Settings Caching Pattern**

Settings are read once during game initialization and cached in module-level variables to avoid repeated localStorage reads:

- **Initial load:** Settings are read from localStorage and cached when game view initializes
- **Writes:** All settings are written together atomically on any change
- **Cached value:** Last selected unlimited difficulty is cached to avoid re-reading when saving other settings in daily mode

**Rationale:** Eliminates unnecessary I/O overhead. Settings change infrequently but game state saves happen constantly. Caching the unlimited difficulty prevents daily mode from reading localStorage on every hint/border toggle just to preserve a setting it doesn't actively use.

**6. Memory Leak Prevention**

The throttle function returns an object with both save and destroy methods:

- **Save method:** Triggers the throttled save logic
- **Destroy method:** Clears any pending timeout timers
- **Cleanup hook:** View cleanup lifecycle always calls destroy before unmounting

**Rationale:** JavaScript timers created in closures can leak memory if not explicitly cleared. When a game view is destroyed and recreated (though rare in current architecture), the destroy method prevents orphaned timers from attempting to save stale game state or consuming memory indefinitely.

### Selective Save Triggering

The rendering system distinguishes between game state changes and pure display changes:

- **Trigger saves:** Player draws, restarts puzzle, generates new puzzle, completes game
- **Skip saves:** Window resize, hint mode toggle, border mode toggle, solution checkbox toggle

Display-only changes (resize, settings toggles) call the render function with a flag that bypasses game state saving. Settings are persisted through their own dedicated save function, keeping concerns separated.

**Benefit:** Reduces localStorage writes by approximately 80%. Previously every window resize and setting toggle would save the entire game state. Now saves only occur when actual puzzle progress changes.

### Edge Case Handling

**Partial Win Message Persistence:** The flag tracking whether "nice loop but wrong hints" feedback has been shown is now persisted. Players who achieve a structurally valid loop, exit, and return won't see the same encouraging message repeatedly.

**Restore Without Cooldown:** When loading saved state, the render call explicitly bypasses save triggering. Without this, restoration would immediately trigger a save (since cooldown timer starts at zero), wasting a localStorage write and starting the cooldown before the player's first actual move.

**Daily Puzzle ID Validation:** When loading daily puzzle saves, the system verifies the puzzle ID matches the current day. This prevents restored state from appearing if the player's system clock changed significantly or timezone shifted during travel.

**Cleanup on New Puzzle:** Generating a new puzzle in unlimited mode explicitly clears the save for that difficulty before creating the fresh puzzle, preventing stale state from being restored if generation somehow fails partway through.

**Tab Backgrounding:** The Page Visibility API triggers an immediate save when the tab becomes hidden, ensuring timer accuracy is preserved and recent draws are not lost if the browser crashes or device runs out of memory while backgrounded.

### Benefits

- **Zero backend complexity:** No server, database, authentication, or sync conflicts to manage
- **Instant resume:** Players can close the browser mid-puzzle and return hours later to exact state
- **Offline-first:** Persistence works without network connectivity after initial load
- **Per-device isolation:** Acceptable for casual puzzle game; simpler than cross-device sync
- **Fair daily competition:** Player progress is saved but not shared; times remain trust-based until backend added
- **Efficient writes:** Throttling prevents performance impact from rapid drawing
- **Clean storage:** Automatic cleanup prevents localStorage from growing unbounded
- **Forward compatible:** Version field and settings merging enable future schema evolution

### Tradeoffs Accepted

- **No cross-device sync:** Progress is device-specific (acceptable for casual browser game)
- **Trust-based completion times:** No server validation prevents leaderboard cheating (deferred to future backend)
- **Clock manipulation vulnerability:** Players can access future daily puzzles by changing system clock (acceptable for casual game)
- **5-second progress loss window:** Rapid draw + crash during cooldown loses recent moves (extremely rare, acceptable for simplicity)
- **Local timezone saves:** Daily puzzle saves use local date, so traveling across timezones could cause minor confusion (consistent with local timezone puzzle generation)

-----

## MVP Feature Checklist

### Core Gameplay

- [ ] Render 5×5 grid with constraints
- [ ] Draw path with drag (continuous drawing)
- [ ] Erase cells with single tap
- [ ] Real-time path visualization
- [ ] Automatic connection breaking when drawing through existing paths
- [ ] Automatic orphaned cell cleanup
- [ ] Constraint validation
- [ ] Victory detection
- [ ] Victory animation

### UI

- [ ] "New Puzzle" button (generates random puzzle)
- [ ] "Restart" button (clears current path)
- [ ] Responsive mobile layout
- [ ] Touch-friendly hit targets (48px minimum)

### Polish

- [ ] Smooth animations (path drawing, constraint feedback)
- [ ] Color transitions for constraint states
- [ ] Intelligent connection breaking (opposite direction priority)
- [ ] Handle path backtracking (drag backward to undo)

-----

## Future Enhancements (Post-MVP)

### Completed Features
- ✅ Multiple difficulty levels (Easy 4x4, Medium 6x6, Hard 8x8)
- ✅ Hint system (partial/all toggle with validation coloring)
- ✅ Navigation system with home page
- ✅ Settings bottom sheet with immediate-apply controls
- ✅ Timer with difficulty display (format: "Difficulty • MM:SS")
- ✅ Automatic timer pausing when tab becomes hidden
- ✅ Unlimited practice mode with in-session difficulty switching
- ✅ iOS-style segmented control for difficulty selection
- ✅ Daily puzzles with date-based deterministic generation
- ✅ Local timezone support for puzzle rotation
- ✅ Puzzle ID system for future social features
- ✅ Automatic game progress persistence (localStorage-based)
- ✅ Settings persistence across all game modes
- ✅ Throttled save system with memory leak prevention
- ✅ Per-difficulty save slots for unlimited mode

### Planned Enhancements
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

-----

## Key Development Tips

### Performance

- Use `requestAnimationFrame` for smooth rendering
- Debounce resize events
- Cache constraint calculations
- Use pointer events (better than touch + mouse)

### Mobile UX

- Prevent page scroll while drawing
- Large touch targets (minimum 48×48px)
- Haptic feedback on constraint satisfaction (vibration API)
- Prevent zoom/pinch gestures on canvas

### Accessibility

- High contrast mode option
- Keyboard navigation (arrow keys to draw)
- Screen reader announcements for constraint states
- Focus indicators for buttons

### Testing

- Test on various screen sizes (iPhone SE to iPad)
- Test with both touch and mouse
- Test rapid drawing (performance)
- Test edge cases (starting at corners, crossing paths)

-----

## Quick Start Commands

```bash
# Development
npm install          # Install dependencies
npm run dev         # Start Vite dev server (http://localhost:5173)
npm run build       # Build for production (outputs to dist/)
npm run preview     # Preview production build

# Deployment (Netlify)
# Push to git, Netlify auto-deploys from branch
# Build command: npm run build
# Publish directory: dist
```

### Local Development Notes

**Direct URL Testing:** When testing locally with `npm run dev`, direct URL navigation works only through in-app navigation. To test direct URLs properly, either:
1. Deploy to Netlify (recommended)
2. Use `npm run build && npm run preview` to test production build locally

The Vite dev server doesn't process the `_redirects` file, but the production build on Netlify does.

-----

## Expected Behavior Summary

### Daily Puzzle Mode Flow (Easy/Medium/Hard)
1. **Home screen shows current date** → Tagline displays formatted date (e.g., "30 November 2025")
2. **User selects difficulty from home** → Enters game with fixed grid size and today's daily puzzle
3. **Navigation shows blank title** → Difficulty displayed in timer (e.g., "Medium • 0:00")
4. **Puzzle is deterministic** → Everyone playing Medium on the same local date sees identical puzzle
5. **User draws path** → Blue path extends smoothly with drag, timer counts up
6. **User completes loop** → Constraints turn green if satisfied, yellow if violated
7. **Victory** → Timer stops, completion message shows time (e.g., "You made a loop in 1:23!")
8. **No New button** → Button is hidden since daily puzzles cannot be regenerated
9. **Restart available** → User can restart and replay the same daily puzzle
10. **Tomorrow** → New puzzle automatically available at local midnight

### Unlimited Mode Flow
1. **User selects Unlimited from home** → Enters game defaulting to Easy (4x4)
2. **Timer shows current difficulty** → Displays "Easy • 0:00" (not "Unlimited")
3. **New button visible** → Generates fresh random puzzle each time
4. **User opens settings** → Sees segmented control (Easy/Medium/Hard) at top of sheet
5. **User switches to Hard** → Grid rebuilds as 8x8, puzzle regenerates, timer resets, difficulty label updates to "Hard • 0:00"
6. **Settings persist** → Hints, Border, and Solution toggles remain unchanged when switching difficulty
7. **Unlimited replays** → User can practice any difficulty repeatedly with true random generation

### Universal Interactions
- **Tap empty cell** → Path starts, cell is drawn
- **Tap existing cell** → Cell is erased (along with any orphaned cells)
- **Drag** → Blue path extends smoothly, automatically breaking old connections when crossing existing paths
- **Drag backward** → Recent path is undone (backtracking)
- **Restart button** → Clears path but keeps timer running (unless game was already won)
- **Back button** → Returns to home page
