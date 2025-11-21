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

-----

## File Structure

```
rope-game/
├── index.html
├── style.css
├── src/
│   ├── config.js         # Centralized constants (colors, sizing, generation tuning)
│   ├── utils.js          # Shared utility functions (path math, validation helpers)
│   ├── main.js           # Game logic, state, interactions (organized in sections)
│   ├── generator.js      # Puzzle generation (Warnsdorff's heuristic)
│   └── renderer.js       # Canvas rendering (grid, paths, hints, borders)
└── package.json
```

**main.js Organization:** Code is organized into logical sections (imports, state, connections, validation, drag handlers, events, UI, lifecycle, init) for easy navigation.

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

- Multiple difficulty levels (grid sizes)
- Hint system
- Undo/Redo
- Timer and move counter
- Daily puzzles
- Achievement system
- Dark mode
- Sound effects (optional, subtle)
- Save/load puzzle state
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
# Option 1: Simple setup (no build tools)
# Just open index.html in browser
# Use live-server for hot reload:
npx live-server

# Option 2: With Vite
npm create vite@latest loop-puzzle -- --template vanilla
cd loop-puzzle
npm install
npm run dev
```

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
