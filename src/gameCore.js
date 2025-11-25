/**
 * Game Core - Shared game interaction logic
 *
 * Provides reusable game state and interaction logic for both
 * the main game and tutorial views. Handles all pointer events,
 * drag interactions, and connection management.
 */

import { isAdjacent, determineConnectionToBreak, findShortestPath } from './utils.js';

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
    hasDragMoved: false
  };

  // ============================================================================
  // PLAYER CELL & CONNECTION MANAGEMENT
  // ============================================================================

  function clearPlayerCell(row, col) {
    const cellKey = `${row},${col}`;
    state.playerDrawnCells.delete(cellKey);
    const connections = state.playerConnections.get(cellKey);
    if (connections) {
      for (const connectedCell of connections) {
        state.playerConnections.get(connectedCell)?.delete(cellKey);
      }
      state.playerConnections.delete(cellKey);
    }
  }

  function getCellFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const col = Math.floor(x / state.cellSize);
    const row = Math.floor(y / state.cellSize);

    if (row >= 0 && row < state.gridSize && col >= 0 && col < state.gridSize) {
      return { row, col, key: `${row},${col}` };
    }
    return null;
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

  function forceConnection(cellKeyA, cellKeyB) {
    const [r1, c1] = cellKeyA.split(',').map(Number);
    const [r2, c2] = cellKeyB.split(',').map(Number);

    if (!isAdjacent(r1, c1, r2, c2)) return false;
    if (state.playerConnections.get(cellKeyA)?.has(cellKeyB)) return false;

    ensureConnectionMap(cellKeyA);
    ensureConnectionMap(cellKeyB);

    const connectionsA = state.playerConnections.get(cellKeyA);
    if (connectionsA.size >= 2) {
      const toBreak = determineConnectionToBreak(cellKeyA, cellKeyB, connectionsA);
      removeConnection(cellKeyA, toBreak);
    }

    const connectionsB = state.playerConnections.get(cellKeyB);
    if (connectionsB.size >= 2) {
      const toBreak = determineConnectionToBreak(cellKeyB, cellKeyA, connectionsB);
      removeConnection(cellKeyB, toBreak);
    }

    state.playerConnections.get(cellKeyA).add(cellKeyB);
    state.playerConnections.get(cellKeyB).add(cellKeyA);

    return true;
  }

  function findPathToCell(fromKey, toKey) {
    return findShortestPath(fromKey, toKey, state.gridSize);
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

  function extendDragPath(newCellKey, currentCellKey) {
    const path = findPathToCell(currentCellKey, newCellKey);
    if (!path || path.length === 0) return;

    let prevInDrag = currentCellKey;
    for (const pathCell of path) {
      if (!state.playerDrawnCells.has(pathCell)) {
        state.playerDrawnCells.add(pathCell);
        ensureConnectionMap(pathCell);
        state.cellsAddedThisDrag.add(pathCell);
      }

      if (state.playerConnections.get(prevInDrag)?.has(pathCell)) {
        state.dragPath.push(pathCell);
        prevInDrag = pathCell;
      } else if (forceConnection(prevInDrag, pathCell)) {
        state.dragPath.push(pathCell);
        prevInDrag = pathCell;
      } else {
        break;
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

    const cell = getCellFromPointer(event);
    if (!cell) return;

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

    const cell = getCellFromPointer(event);
    if (!cell) return;

    const currentCell = state.dragPath[state.dragPath.length - 1];
    if (cell.key === currentCell) return;

    state.hasDragMoved = true;

    const backtrackIndex = state.dragPath.indexOf(cell.key);
    if (backtrackIndex !== -1 && backtrackIndex < state.dragPath.length - 1) {
      if (backtrackIndex === 0) {
        if (tryCloseLoop(state.dragPath)) {
          return;
        }
      }
      handleBacktrack(backtrackIndex);
      return;
    }

    extendDragPath(cell.key, currentCell);
  }

  function handlePointerUp(event) {
    if (!state.isDragging) return;

    canvas.releasePointerCapture(event.pointerId);

    const cell = getCellFromPointer(event);

    if (!state.hasDragMoved && cell && state.dragPath.length === 1 && state.dragPath[0] === cell.key) {
      if (!state.cellsAddedThisDrag.has(cell.key)) {
        const [row, col] = cell.key.split(',').map(Number);
        clearPlayerCell(row, col);
      }
    }

    resetDragState();
    cleanupOrphanedCells();
    onRender();
  }

  function handlePointerCancel(event) {
    canvas.releasePointerCapture(event.pointerId);
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
