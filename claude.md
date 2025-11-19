# Loop - Puzzle Game

## Game Premise

**Loop** is a minimalist path-drawing puzzle game where players create a single continuous loop through a grid, guided by numbered constraints.

### Core Rules

1. **Draw ONE continuous path** that visits every cell exactly once and returns to the starting point
1. **Path can only move UP, DOWN, LEFT, RIGHT** (no diagonals)
1. **Numbered cells are clues** that indicate how many turns (corners/bends) the path must make in the cells directly adjacent to that number
1. **The number refers to its NEIGHBORS**, not the numbered cell itself
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

- **React** or **Svelte** for UI management
- **Canvas or SVG** for grid rendering
- **Tailwind CSS** for styling

### Mobile Gestures

- **Pointer Events API** (handles both mouse and touch)
- Support for:
  - Tap-and-drag (continuous drawing)
  - Tap-cell-by-cell (discrete drawing)
  - Both should feel native and responsive

-----

## Implementation Guide

### 1. Grid Structure

```javascript
// Grid representation
const grid = {
  size: 5, // 5x5 for MVP
  cells: [
    // 2D array of cells
    [
      { constraint: null, hasPath: false, pathDirection: null },
      { constraint: 2, hasPath: false, pathDirection: null },
      // ...
    ]
  ],
  path: [] // Array of [x, y] coordinates in order
};

// Path directions for each cell
const DIRECTIONS = {
  NONE: null,
  VERTICAL: 'vertical',      // straight up-down
  HORIZONTAL: 'horizontal',   // straight left-right
  CORNER_TL: 'corner-tl',    // top to left
  CORNER_TR: 'corner-tr',    // top to right
  CORNER_BL: 'corner-bl',    // bottom to left
  CORNER_BR: 'corner-br'     // bottom to right
};
```

### 2. Puzzle Generation Algorithm

**High-Level Approach:**

1. **Generate a valid solution path first**
- Start at random cell
- Use recursive backtracking to create a path visiting all cells once
- Ensure it forms a closed loop
1. **Calculate constraints from the solution**
- For each cell, count turns in its neighbors
- Only place numbers for cells that add interesting constraints
- Avoid over-constraining (too many numbers = too easy)
1. **Test solvability**
- Verify the puzzle has exactly one solution
- Remove redundant constraints if possible

**Simplified Generation for MVP:**

```javascript
function generatePuzzle(size) {
  // 1. Generate random valid loop path
  const solutionPath = generateValidLoop(size);

  // 2. Calculate turn counts for each cell
  const turnCounts = calculateTurnCounts(solutionPath, size);

  // 3. Place constraints strategically
  const constraints = placeConstraints(turnCounts, size);

  return {
    size,
    constraints, // { [x_y]: number }
    solution: solutionPath // hide this, only for validation
  };
}

function generateValidLoop(size) {
  // Recursive backtracking to create Hamiltonian cycle
  // Start at [0, 0], visit all cells, return to start
  // Returns array of [x, y] coordinates in order
}

function calculateTurnCounts(path, size) {
  // For each cell [x, y], count how many of its neighbors
  // have turns (corner directions)
  // Returns 2D array of counts
}

function placeConstraints(turnCounts, size) {
  // Place numbers in ~30-40% of cells
  // Prefer edges/corners and high-information positions
  // Returns object like { "0_1": 2, "2_3": 0, ... }
}
```

**Note:** For MVP, you can start with a simpler approach:

- Generate a few hand-crafted "template" loops
- Rotate/flip them for variety
- Calculate constraints from templates

### 3. Path Drawing System

**Two Interaction Modes:**

**Mode 1: Continuous Drag**

```javascript
// Pointer down -> start path
// Pointer move -> extend path to hovered cell
// Pointer up -> finalize path segment

let isDrawing = false;
let currentPath = [];

canvas.addEventListener('pointerdown', (e) => {
  isDrawing = true;
  const cell = getCellFromPointer(e);
  currentPath = [cell];
});

canvas.addEventListener('pointermove', (e) => {
  if (!isDrawing) return;
  const cell = getCellFromPointer(e);
  if (isAdjacentToLast(cell, currentPath)) {
    currentPath.push(cell);
    renderPath();
  }
});

canvas.addEventListener('pointerup', () => {
  isDrawing = false;
  validatePath();
});
```

**Mode 2: Tap-to-Advance**

```javascript
// Tap cell -> extend path to that cell (if valid)

canvas.addEventListener('pointerdown', (e) => {
  const cell = getCellFromPointer(e);

  if (currentPath.length === 0) {
    // Start path
    currentPath = [cell];
  } else if (isAdjacentToLast(cell, currentPath)) {
    // Extend path
    currentPath.push(cell);
  }

  renderPath();
  validatePath();
});
```

**Helper Functions:**

```javascript
function isAdjacentToLast(cell, path) {
  if (path.length === 0) return true;
  const last = path[path.length - 1];
  const dx = Math.abs(cell.x - last.x);
  const dy = Math.abs(cell.y - last.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

function getCellFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return {
    x: Math.floor(x / cellSize),
    y: Math.floor(y / cellSize)
  };
}
```

### 4. Validation System

**Real-time Feedback:**

```javascript
function validatePath() {
  // Check if path is complete
  if (currentPath.length !== size * size) {
    return { complete: false };
  }

  // Check if path forms a loop
  const first = currentPath[0];
  const last = currentPath[currentPath.length - 1];
  if (!isAdjacent(first, last)) {
    return { complete: false, error: 'Not a closed loop' };
  }

  // Check all constraints
  const violations = checkConstraints(currentPath, constraints);

  if (violations.length === 0) {
    return { complete: true, solved: true };
  }

  return { complete: true, solved: false, violations };
}

function checkConstraints(path, constraints) {
  const violations = [];

  for (const [cellKey, expectedTurns] of Object.entries(constraints)) {
    const [x, y] = cellKey.split('_').map(Number);
    const neighbors = getNeighbors(x, y);
    const actualTurns = countTurnsInCells(neighbors, path);

    if (actualTurns !== expectedTurns) {
      violations.push({ x, y, expected: expectedTurns, actual: actualTurns });
    }
  }

  return violations;
}

function countTurnsInCells(cells, path) {
  let turnCount = 0;

  for (const cell of cells) {
    const direction = getPathDirection(cell, path);
    if (isCorner(direction)) {
      turnCount++;
    }
  }

  return turnCount;
}

function isCorner(direction) {
  return direction && direction.startsWith('corner-');
}
```

### 5. Visual Feedback

**Constraint States:**

- **Gray**: Not yet evaluable (path incomplete)
- **Yellow**: Constraint violated (wrong turn count)
- **Green**: Constraint satisfied
- **Red**: Impossible to satisfy with current path

```javascript
function getConstraintColor(cell, path, constraints) {
  const expected = constraints[`${cell.x}_${cell.y}`];
  if (expected === undefined) return null;

  if (path.length < size * size) {
    return 'gray'; // incomplete
  }

  const actual = countTurnsInNeighbors(cell, path);
  return actual === expected ? 'green' : 'yellow';
}
```

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

**Implementation Example:**

```css
.constraint-number {
  transition: color 300ms ease, transform 300ms ease;
}

.constraint-satisfied {
  color: #27AE60;
  animation: satisfyPulse 500ms ease;
}

@keyframes satisfyPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

.path-line {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: drawPath 600ms ease forwards;
}

@keyframes drawPath {
  to { stroke-dashoffset: 0; }
}
```

-----

## Canvas Rendering Guide

### Grid Rendering

```javascript
function renderGrid(ctx, size, cellSize) {
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1;

  // Draw grid lines
  for (let i = 0; i <= size; i++) {
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(i * cellSize, 0);
    ctx.lineTo(i * cellSize, size * cellSize);
    ctx.stroke();

    // Horizontal lines
    ctx.beginPath();
    ctx.moveTo(0, i * cellSize);
    ctx.lineTo(size * cellSize, i * cellSize);
    ctx.stroke();
  }
}

function renderConstraints(ctx, constraints, cellSize) {
  ctx.fillStyle = '#2C3E50';
  ctx.font = 'bold 24px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const [cellKey, value] of Object.entries(constraints)) {
    const [x, y] = cellKey.split('_').map(Number);
    const centerX = x * cellSize + cellSize / 2;
    const centerY = y * cellSize + cellSize / 2;

    ctx.fillText(value.toString(), centerX, centerY);
  }
}

function renderPath(ctx, path, cellSize) {
  if (path.length < 2) return;

  ctx.strokeStyle = '#4A90E2';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();

  // Draw path through cell centers
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    const centerX = cell.x * cellSize + cellSize / 2;
    const centerY = cell.y * cellSize + cellSize / 2;

    if (i === 0) {
      ctx.moveTo(centerX, centerY);
    } else {
      ctx.lineTo(centerX, centerY);
    }
  }

  // Close the loop if complete
  if (path.length === size * size) {
    const first = path[0];
    ctx.lineTo(first.x * cellSize + cellSize / 2,
               first.y * cellSize + cellSize / 2);
  }

  ctx.stroke();

  // Draw start point indicator
  const start = path[0];
  ctx.fillStyle = '#4A90E2';
  ctx.beginPath();
  ctx.arc(start.x * cellSize + cellSize / 2,
          start.y * cellSize + cellSize / 2,
          12, 0, Math.PI * 2);
  ctx.fill();
}
```

### Responsive Sizing

```javascript
function calculateCellSize() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Reserve space for buttons (80px top, 20px padding)
  const availableHeight = viewportHeight - 100;
  const availableWidth = viewportWidth - 40; // 20px padding each side

  const maxCellSize = Math.min(
    availableWidth / size,
    availableHeight / size
  );

  // Ensure minimum cell size for usability
  return Math.max(50, Math.min(maxCellSize, 100));
}

function resizeCanvas() {
  const cellSize = calculateCellSize();
  const totalSize = cellSize * size;

  canvas.width = totalSize;
  canvas.height = totalSize;
  canvas.style.width = totalSize + 'px';
  canvas.style.height = totalSize + 'px';

  render();
}

window.addEventListener('resize', resizeCanvas);
```

-----

## File Structure

```
loop-puzzle/
├── index.html
├── style.css
├── src/
│   ├── main.js           # Entry point, initialization
│   ├── grid.js           # Grid data structure
│   ├── generator.js      # Puzzle generation
│   ├── pathDrawing.js    # Path drawing interactions
│   ├── validation.js     # Constraint checking
│   └── renderer.js       # Canvas rendering
└── README.md
```

-----

## MVP Feature Checklist

### Core Gameplay

- [ ] Render 5×5 grid with constraints
- [ ] Draw path with tap-and-drag
- [ ] Draw path with tap-cell-by-cell
- [ ] Real-time path visualization
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
- [ ] Prevent accidental path crossing
- [ ] Handle path backtracking (drag back over cells)

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

## Example Puzzle Data

```javascript
// Hand-crafted starter puzzle for testing
const SAMPLE_PUZZLE = {
  size: 5,
  constraints: {
    '1_0': 1,  // Cell at (1, 0) expects 1 turn in neighbors
    '0_1': 2,
    '3_1': 1,
    '2_2': 0,
    '1_3': 1,
    '3_3': 2
  },
  // Solution path (hidden from player)
  solution: [
    [0,0], [1,0], [2,0], [3,0], [4,0],
    [4,1], [4,2], [4,3], [4,4],
    [3,4], [2,4], [1,4], [0,4],
    [0,3], [0,2], [0,1]
  ]
};
```

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
1. **User taps cell** → Path starts, blue dot appears
1. **User drags or taps adjacent cells** → Blue path extends smoothly
1. **User completes loop** → Constraints turn green if satisfied, yellow if violated
1. **All green** → Victory animation, can tap "New Puzzle"
1. **Stuck** → Tap "Restart" to clear path and try again

-----

## Good Luck!

This should be a clean, satisfying mobile puzzle experience. Focus on smooth interactions and responsive feedback. The core loop is simple but the constraint-solving creates depth.

Start with the grid rendering and path drawing, then add puzzle generation, then validation. Build iteratively and test on mobile early and often!
