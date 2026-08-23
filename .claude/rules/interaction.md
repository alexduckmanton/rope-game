---
paths:
  - "src/gameCore.js"
  - "src/utils.js"
---

# Pointer interaction and the drawing hot path

`handlePointerMove`, `getCellsAlongLine` and `extendDragPath` run 60+ times a second during a drag. Read the performance notes before changing any of them.

### Mobile Gestures

**Supported Interactions:**
- **Drag to draw**: Continuous path creation
- **Single tap**: Erase existing cell (if not added this drag)
- **Drag backward**: Undo recent drawing (backtracking)
- **Automatic connection breaking**: When drawing through existing paths, preserves the connection from your drag path and breaks the unused connection
- **Intelligent path extension**: Uses Bresenham's line algorithm to calculate cells along actual mouse path

**Implementation:** Pointer Events API (handles both mouse and touch). All interactions feel native and responsive.

**Smart Backtracking:**

Dragging back over the path you are currently drawing erases it, but only one cell at a
time. `CONFIG.INTERACTION.BACKTRACK_THRESHOLD` is **1**, so:

- **1 cell back** (the cell you just came from): erased.
- **2 or more cells back**: **not** erased, and **not** ignored either. The touch falls
  through to normal path extension and draws on through the crossing, exactly as it would
  over a path drawn in an earlier gesture.
- **Back to the drag's first cell**: always attempts to close the loop, and backtracks if
  that fails. Distance is never consulted - `handlePointerMove()` in `gameCore.js`
  special-cases index 0 so a deliberate loop close always works, however long the path.

**Design Rationale:** long crossing paths used to trigger accidental full erasure when the
pointer briefly clipped an old cell far back in the path - the drag would silently delete
everything after it. A threshold of 1 removes that failure mode entirely: erasure is never
something that happens by accident, only ever one deliberate cell at a time. The cost is
that larger corrections cannot be made by dragging backwards at all; they go through the
Undo button, which reverts a whole gesture at once.

That cost is visible in the telemetry - `undo_used` fires roughly 26 times per player, more
often than `$pageview`. That is the intended division of labour rather than a symptom, but
it does mean the Undo button is load-bearing and worth protecting in any UI change.

Raising the threshold restores long-distance drag backtracking and reinstates the accidental
erasure it was set to 1 to prevent. Note the two are not symmetrical: a mistaken erasure
destroys work, whereas a mistaken draw-through is corrected by continuing to draw.

**Diagonal Drawing Continuity:**

Drawing diagonally across the grid maintains smooth, uninterrupted flow:

- **Challenge**: Bresenham's algorithm produces 8-connected paths (diagonal jumps) but the game requires 4-connected paths (orthogonal only)
- **Solution**: Direction-tracking post-processing automatically inserts intermediate cells for diagonal movements
- **Behavior**: Creates natural alternating patterns (horizontal→vertical→horizontal) that follow the drawing gesture
- **Result**: Players can draw at any angle without interruption or having to manually trace step-by-step paths

**Undo Button vs Drag Backtracking:**

The game provides two distinct mechanisms for reversing actions:

- **Drag backtracking**: During an active drawing gesture, dragging back onto the cell you just came from removes it - one cell at a time (see Smart Backtracking). This is immediate, fine-grained correction.
- **Undo button**: After completing a drawing action, the undo button reverts the entire action. This provides step-by-step history navigation across multiple completed actions (up to 50).

These complement each other: backtracking for in-gesture corrections, undo for multi-action history.

**Mobile Optimizations:**
- Prevent page scroll while drawing
- Large touch targets (minimum 48×48px)
- Prevent zoom/pinch gestures on canvas
- Prevent double-tap zoom

-----

-----

**Modify Backtracking Sensitivity:**

1. **Change threshold**: `CONFIG.INTERACTION.BACKTRACK_THRESHOLD` in `config.js`. **Shipped
   value is 1** and that is a deliberate choice, not a leftover - see the rationale under
   Smart Backtracking before changing it.
2. **Higher values** (2-10): dragging further back erases more in one gesture. This
   reinstates the accidental-erasure failure mode the threshold exists to prevent, since a
   pointer briefly clipping an earlier cell on a crossing loop wipes everything after it.
3. **Value of 1**: only the immediately previous cell erases. Anything further back draws on
   through as a self-intersection.
4. **Not a tunable dial between two equal risks.** A mistaken erasure destroys work; a
   mistaken draw-through is fixed by carrying on drawing. Raise it only with evidence.
5. **Loop closing is exempt** at any value - returning to the drag's first cell always
   attempts to close the loop.
6. **Affects**: all drawing interactions in both daily and unlimited modes, globally.

-----

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

-----

**Performance:**
- Use `requestAnimationFrame` for smooth rendering (already implemented in `views/game.js`)
- Debounce resize events (implemented with `ResizeObserver`)
- Cache constraint calculations (turn maps are built once per render)
- Use pointer events (already using Pointer Events API, better than touch + mouse)

-----

**Performance Tuning:**
1. **Canvas sizing**: Adjust `CONFIG.CELL_SIZE_MIN/MAX` in `config.js`
2. **Rendering optimization**: Modify render frequency or use canvas layering
3. **Save frequency**: Tune `SAVE_COOLDOWN_MS` or implement debouncing instead of throttling

-----

#### Undo System

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
- Win status flag (`hasWon`)
- Validation state key

**Performance:** O(1) state comparison for duplicate detection, minimal memory impact (~50 states × small data structures).
