/**
 * Game Core - Shared game interaction logic
 *
 * Provides reusable game state and interaction logic for both
 * the main game and tutorial views. Handles all pointer events,
 * drag interactions, and connection management.
 */

import { isAdjacent, determineConnectionToBreak, getCellsAlongLine, parseCellKey, createCellKey } from './utils.js';
import { CONFIG } from './config.js';

/**
 * Creates a game core instance with encapsulated state and methods
 * @param {Object} config - Configuration object
 * @param {number} config.gridSize - Size of the game grid (e.g., 4 for 4x4)
 * @param {HTMLCanvasElement} config.canvas - The canvas element to interact with
 * @param {Function} config.onRender - Callback to trigger rendering after state changes
 * @returns {Object} Game core API with methods and state access
 */
export function createGameCore({ gridSize, canvas, onRender }) {
  // ============================================================================
  // STATE
  // ============================================================================

  const state = {
    gridSize,
    cellSize: 0,
    playerDrawnCells: new Set(),
    playerConnections: new Map(),
    isDragging: false,
    dragPath: [],
    cellsAddedThisDrag: new Set(),
    hasDragMoved: false,
    lastPointerX: 0,
    lastPointerY: 0,
    canvasRect: null,  // Cached canvas bounding rect during drag (avoids layout thrashing)
    currentPointerCell: null  // Current cell under pointer {row, col} for border highlighting
  };

  // ============================================================================
  // PLAYER CELL & CONNECTION MANAGEMENT
  // ============================================================================

  function clearPlayerCell(row, col) {
    const cellKey = createCellKey(row, col);
    state.playerDrawnCells.delete(cellKey);
    const connections = state.playerConnections.get(cellKey);
    if (connections) {
      for (const connectedCell of connections) {
        state.playerConnections.get(connectedCell)?.delete(cellKey);
      }
      state.playerConnections.delete(cellKey);
    }
  }

  function getCellFromCoords(x, y) {
    const col = Math.floor(x / state.cellSize);
    const row = Math.floor(y / state.cellSize);

    if (row >= 0 && row < state.gridSize && col >= 0 && col < state.gridSize) {
      return { row, col, key: createCellKey(row, col) };
    }
    return null;
  }

  function getCellFromPointer(event) {
    // Use cached rect if available (during drag), otherwise get fresh rect
    const rect = state.canvasRect || canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return getCellFromCoords(x, y);
  }

  function removeConnection(cellKeyA, cellKeyB) {
    state.playerConnections.get(cellKeyA)?.delete(cellKeyB);
    state.playerConnections.get(cellKeyB)?.delete(cellKeyA);
  }

  function ensureConnectionMap(cellKey) {
    if (!state.playerConnections.has(cellKey)) {
      state.playerConnections.set(cellKey, new Set());
    }
  }

  function resetDragState() {
    state.isDragging = false;
    state.dragPath = [];
    state.cellsAddedThisDrag = new Set();
    state.hasDragMoved = false;
    state.canvasRect = null;  // Clear cached rect (helps GC)
  }

  function cleanupOrphanedCells() {
    let foundOrphan = true;
    while (foundOrphan) {
      foundOrphan = false;
      for (const cellKey of state.playerDrawnCells) {
        const connections = state.playerConnections.get(cellKey);
        if (!connections || connections.size === 0) {
          state.playerDrawnCells.delete(cellKey);
          state.playerConnections.delete(cellKey);
          foundOrphan = true;
          break;
        }
      }
    }
  }

  // ============================================================================
  // PATH CONNECTION LOGIC
  // ============================================================================

  function forceConnection(cellKeyA, cellKeyB, incomingConnectionA = null) {
    const { row: r1, col: c1 } = parseCellKey(cellKeyA);
    const { row: r2, col: c2 } = parseCellKey(cellKeyB);

    if (!isAdjacent(r1, c1, r2, c2)) return false;
    if (state.playerConnections.get(cellKeyA)?.has(cellKeyB)) return false;

    ensureConnectionMap(cellKeyA);
    ensureConnectionMap(cellKeyB);

    const connectionsA = state.playerConnections.get(cellKeyA);
    if (connectionsA.size >= 2) {
      const toBreak = determineConnectionToBreak(cellKeyA, cellKeyB, connectionsA, incomingConnectionA);
      removeConnection(cellKeyA, toBreak);
    }

    const connectionsB = state.playerConnections.get(cellKeyB);
    if (connectionsB.size >= 2) {
      // For cellB, the incoming connection is cellKeyA (the one we're creating)
      const toBreak = determineConnectionToBreak(cellKeyB, cellKeyA, connectionsB, cellKeyA);
      removeConnection(cellKeyB, toBreak);
    }

    state.playerConnections.get(cellKeyA).add(cellKeyB);
    state.playerConnections.get(cellKeyB).add(cellKeyA);

    return true;
  }

  // ============================================================================
  // DRAG INTERACTION HELPERS
  // ============================================================================

  function tryCloseLoop(currentDragPath) {
    if (currentDragPath.length < 2) return false;
    const lastCell = currentDragPath[currentDragPath.length - 1];
    const firstCell = currentDragPath[0];

    if (state.playerConnections.get(lastCell)?.has(firstCell) || forceConnection(lastCell, firstCell)) {
      state.dragPath.push(firstCell);
      cleanupOrphanedCells();
      onRender();
      return true;
    }
    return false;
  }

  function handleBacktrack(backtrackIndex) {
    for (let i = state.dragPath.length - 1; i > backtrackIndex; i--) {
      const cellToRemove = state.dragPath[i];
      const prevCell = state.dragPath[i - 1];
      removeConnection(prevCell, cellToRemove);
    }
    state.dragPath = state.dragPath.slice(0, backtrackIndex + 1);
    cleanupOrphanedCells();
    onRender();
  }

  function extendDragPath(pathCells, currentCellKey) {
    // pathCells is now an array of cells along the actual drawn path
    if (!pathCells || pathCells.length === 0) return;

    let prevInDrag = currentCellKey;

    // Track the incoming connection: the cell before prevInDrag in the drag path
    // This avoids O(n) indexOf search on every iteration
    let incomingConnection = state.dragPath.length > 1
      ? state.dragPath[state.dragPath.length - 2]
      : null;

    for (const pathCell of pathCells) {
      if (!state.playerDrawnCells.has(pathCell)) {
        state.playerDrawnCells.add(pathCell);
        ensureConnectionMap(pathCell);
        state.cellsAddedThisDrag.add(pathCell);
      }

      if (state.playerConnections.get(prevInDrag)?.has(pathCell)) {
        state.dragPath.push(pathCell);
        // Update tracking: prevInDrag becomes the incoming connection for the next cell
        incomingConnection = prevInDrag;
        prevInDrag = pathCell;
      } else {
        // Use tracked incoming connection (no indexOf needed!)
        if (forceConnection(prevInDrag, pathCell, incomingConnection)) {
          state.dragPath.push(pathCell);
          // Update tracking: prevInDrag becomes the incoming connection for the next cell
          incomingConnection = prevInDrag;
          prevInDrag = pathCell;
        } else {
          break;
        }
      }
    }
    cleanupOrphanedCells();
    onRender();
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function handlePointerDown(event) {
    event.preventDefault();

    // Cache canvas bounding rect for the duration of the drag
    // This avoids expensive getBoundingClientRect() calls on every pointer move
    state.canvasRect = canvas.getBoundingClientRect();

    // Extract coordinates using cached rect
    const x = event.clientX - state.canvasRect.left;
    const y = event.clientY - state.canvasRect.top;

    state.lastPointerX = x;
    state.lastPointerY = y;

    const cell = getCellFromCoords(x, y);
    if (!cell) return;

    // Track current pointer cell for border highlighting
    state.currentPointerCell = { row: cell.row, col: cell.col };

    canvas.setPointerCapture(event.pointerId);
    state.isDragging = true;
    state.hasDragMoved = false;
    state.dragPath = [cell.key];
    state.cellsAddedThisDrag = new Set();

    if (!state.playerDrawnCells.has(cell.key)) {
      state.playerDrawnCells.add(cell.key);
      ensureConnectionMap(cell.key);
      state.cellsAddedThisDrag.add(cell.key);
    }

    onRender();
  }

  function handlePointerMove(event) {
    if (!state.isDragging) return;
    event.preventDefault();

    // Use cached canvas rect (set in handlePointerDown) to avoid layout thrashing
    const x = event.clientX - state.canvasRect.left;
    const y = event.clientY - state.canvasRect.top;

    const cell = getCellFromCoords(x, y);
    if (!cell) return;

    // Track current pointer cell for border highlighting
    state.currentPointerCell = { row: cell.row, col: cell.col };

    const currentCell = state.dragPath[state.dragPath.length - 1];
    if (cell.key === currentCell) {
      // Update pointer position even if in same cell
      state.lastPointerX = x;
      state.lastPointerY = y;
      return;
    }

    state.hasDragMoved = true;

    const backtrackIndex = state.dragPath.indexOf(cell.key);
    if (backtrackIndex !== -1 && backtrackIndex < state.dragPath.length - 1) {
      // Don't update pointer position yet - we need the old value for getCellsAlongLine
      // if we fall through to normal path extension

      if (backtrackIndex === 0) {
        // Special case: going back to the first cell (loop closing)
        // Always try to close loop, regardless of distance
        if (tryCloseLoop(state.dragPath)) {
          state.lastPointerX = x;
          state.lastPointerY = y;
          return;
        }
        // If loop closing fails, always backtrack (regardless of distance)
        // This ensures intentional attempts to close the loop work predictably
        handleBacktrack(backtrackIndex);
        state.lastPointerX = x;
        state.lastPointerY = y;
        return;
      }

      // For other cells, check if within backtrack threshold
      // This prevents accidental erasure when drawing long paths that cross themselves
      const backtrackDistance = state.dragPath.length - 1 - backtrackIndex;

      if (backtrackDistance <= CONFIG.INTERACTION.BACKTRACK_THRESHOLD) {
        // Within threshold - backtrack normally (1 cell back with threshold=1)
        handleBacktrack(backtrackIndex);
        state.lastPointerX = x;
        state.lastPointerY = y;
        return;
      }

      // Beyond threshold - treat as normal intersection and fall through
      // This allows drawing through self-intersections just like intersecting old paths
      // Pointer position will be updated at end of function after path extension
    }

    // Calculate cells along the actual pointer path
    const cellsAlongPath = getCellsAlongLine(
      state.lastPointerX,
      state.lastPointerY,
      x,
      y,
      state.cellSize,
      state.gridSize
    );

    // Remove first cell if it's the current cell (avoid duplication)
    if (cellsAlongPath.length > 0 && cellsAlongPath[0] === currentCell) {
      cellsAlongPath.shift();
    }

    // Extend the drag path with the actual drawn cells
    if (cellsAlongPath.length > 0) {
      extendDragPath(cellsAlongPath, currentCell);
    }

    // Update last pointer position for next move
    state.lastPointerX = x;
    state.lastPointerY = y;
  }

  function handlePointerUp(event) {
    if (!state.isDragging) return;

    canvas.releasePointerCapture(event.pointerId);

    const cell = getCellFromPointer(event);

    if (!state.hasDragMoved && cell && state.dragPath.length === 1 && state.dragPath[0] === cell.key) {
      if (!state.cellsAddedThisDrag.has(cell.key)) {
        const { row, col } = parseCellKey(cell.key);
        clearPlayerCell(row, col);
      }
    }

    // Clear pointer cell tracking (borders fade back to 10%)
    state.currentPointerCell = null;

    resetDragState();
    cleanupOrphanedCells();
    onRender();
  }

  function handlePointerCancel(event) {
    canvas.releasePointerCapture(event.pointerId);
    // Clear pointer cell tracking (borders fade back to 10%)
    state.currentPointerCell = null;
    resetDragState();
    cleanupOrphanedCells();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // Direct state access
    state,

    // Event handlers
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,

    // Utility methods
    restartPuzzle: () => {
      state.playerDrawnCells.clear();
      state.playerConnections.clear();
    },

    setCellSize: (size) => {
      state.cellSize = size;
    },

    // For cleanup
    resetDragState
  };
}
