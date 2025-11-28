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

### 2. Visual Feedback

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

- Numbers: Bold, 24-32px depending on cell size
- Buttons: 16px, medium weight, sans-serif (system font)

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
│   ├── generator.js       # Puzzle generation (Warnsdorff's heuristic)
│   ├── renderer.js        # Canvas rendering (grid, paths, hints, borders)
│   └── views/
│       ├── home.js        # Home view with difficulty selection
│       ├── tutorial.js    # Tutorial view (placeholder for future content)
│       └── game.js        # Game view with extracted game logic
└── package.json
```

**Architecture:** Single-page application (SPA) with client-side routing. Each view is a separate module that exports initialization and cleanup functions.

-----

## Navigation & Routing

### Architecture Overview

The app uses a **Single-Page Application (SPA)** architecture with client-side routing via the History API. No page reloads occur during navigation, creating a fast, app-like experience.

### Three Main Views

**1. Home View (default route: `/`)**
- Landing page with game title "Loopy" and tagline
- Four navigation buttons: Tutorial, Easy (4x4), Medium (6x6), Hard (8x8)
- Clean, centered layout with large touch-friendly buttons

**2. Tutorial View (route: `/tutorial`)**
- Placeholder page for future interactive tutorial content
- Includes back button to return home
- Ready for enhancement with step-by-step puzzle tutorials

**3. Play View (route: `/play?difficulty=easy|medium|hard`)**
- The main game interface with canvas and controls
- Difficulty is set via URL parameter and determines grid size
- Includes back button to return home
- Controls: Back, New, Restart buttons + Settings gear icon
- Settings bottom sheet for Hints, Border, and Solution toggles

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

### Deployment Considerations

**Netlify Configuration:** The app includes both `_redirects` file and `netlify.toml` configuration to handle SPA routing on Netlify. All routes serve `index.html` with a 200 status (rewrite, not redirect), allowing the client-side router to handle URL matching.

**Direct URL Access:** Users can bookmark or share any route and it will load correctly, even when accessed directly (not through in-app navigation).

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

### Planned Enhancements
- Interactive tutorial with guided puzzle examples
- Undo/Redo functionality
- Timer and move counter
- Daily puzzles
- Achievement system
- Dark mode
- Sound effects (optional, subtle)
- Save/load puzzle state (localStorage)
- Share puzzle codes

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

1. **User opens app** → See 5×5 grid with constraint numbers
2. **User taps empty cell** → Path starts, cell is drawn
3. **User taps existing cell** → Cell is erased (along with any orphaned cells)
4. **User drags** → Blue path extends smoothly, automatically breaking old connections when crossing existing paths
5. **User drags backward** → Recent path is undone (backtracking)
6. **User completes loop** → Constraints turn green if satisfied, yellow if violated
7. **All green** → Victory animation, can tap "New Puzzle"
8. **Stuck** → Tap "Restart" to clear path and try again
