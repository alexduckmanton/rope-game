/**
 * Builds the boards the tutorial scenes are played on, using the game's own
 * generator and hint placement rather than hand-authored puzzle data.
 *
 * Register the browserless hooks before importing this module — it reaches into
 * `src/`, which pulls in `config.js`, which cannot load outside a browser
 * unaided:
 *
 *   import { register } from 'node:module';
 *   register('./lib/browserless-hooks.mjs', import.meta.url);
 *   const { buildBoard } = await import('./lib/tutorial-boards.mjs');
 */

import { register } from 'node:module';

// Importing this module implies the hooks; registering twice is harmless and
// saves every caller from remembering.
register('./browserless-hooks.mjs', import.meta.url);

const { generateSolutionPath } = await import('../../src/generator.js');
const { createSeededRandom } = await import('../../src/seededRandom.js');
const { generateHintCellsWithMinDistance } = await import('../../src/renderer.js');
const { buildSolutionTurnMap, countTurnsInArea, parseCellKey, createCellKey } =
  await import('../../src/utils.js');
const { CONFIG } = await import('../../src/config.js');

export const GRID_SIZE = 4;

const EASY = CONFIG.DIFFICULTY.HINT_PLACEMENT.easy;

/**
 * Build the real Easy puzzle a seed produces
 *
 * Draws from the seeded source in the same order `views/game.js` does —
 * solution first, hints second — so this is the puzzle a player would be dealt
 * on the day that seed belongs to.
 *
 * @param {number} seed - Daily seed (YYYYMMDD0 for Easy)
 * @returns {{solution: Array, hints: Array<string>, expected: Map<string, number>}} Puzzle
 */
export function buildBoard(seed) {
  const random = createSeededRandom(seed);
  const solution = generateSolutionPath(GRID_SIZE, random);
  const turnMap = buildSolutionTurnMap(solution);
  const hints = [...generateHintCellsWithMinDistance(GRID_SIZE, EASY.count, EASY.minDistance, random)];

  const expected = new Map(
    hints.map((hint) => {
      const { row, col } = parseCellKey(hint);
      return [hint, countTurnsInArea(row, col, GRID_SIZE, turnMap)];
    })
  );

  return { solution, hints, expected };
}

/**
 * The localStorage payload that makes the game load a given board
 *
 * An unlimited-mode save carries its own `solutionPath` and `hintCells` — daily
 * saves rebuild theirs from the date seed — so planting one is how a scene
 * pins its puzzle without the app needing a capture-only route. The shape here
 * is `persistence.js`'s, and `isValidSavedState()` rejects anything else.
 *
 * @param {{solution: Array, hints: Array<string>}} board - From buildBoard()
 * @returns {{key: string, value: string}} localStorage key and serialised value
 */
export function plantedSave(board) {
  return {
    key: 'loop-game:unlimited:easy',
    value: JSON.stringify({
      version: 1,
      puzzleId: null,
      difficulty: 'easy',
      gridSize: GRID_SIZE,
      isUnlimitedMode: true,
      playerDrawnCells: [],
      playerConnections: {},
      elapsedSeconds: 0,
      hasWon: false,
      hasViewedSolution: false,
      savedAt: 0,
      solutionPath: board.solution,
      hintCells: board.hints,
    }),
  };
}

/* ============================================================================
 * GESTURE MODEL
 *
 * Replays a scene's strokes so a board can be designed without recording it.
 * It is deliberately the simple case: every cell in a stroke is connected to
 * the one before it. That is exact for the gestures the scenes are allowed to
 * use — no self-intersections, no backtracking, no drawing through a cell that
 * already has two connections — and those restrictions exist precisely so this
 * model cannot drift from `gameCore.js`. Anything more elaborate has to be
 * verified by recording it; the runner's `expect` assertions are the backstop.
 * ========================================================================= */

/** The game's own rule: a cell turns when its two connections are not collinear */
function playerTurnMap(drawnCells, connections) {
  const turnMap = new Map();
  for (const cellKey of drawnCells) {
    const linked = connections.get(cellKey);
    if (!linked || linked.size !== 2) {
      turnMap.set(cellKey, false);
      continue;
    }
    const [a, b] = [...linked].map(parseCellKey);
    turnMap.set(cellKey, !(a.row === b.row || a.col === b.col));
  }
  return turnMap;
}

/**
 * Replay a scene's steps, reporting what every hint reads after each cell
 *
 * @param {Object} scene - A scene from tutorial-scenes.mjs
 * @param {Object} board - From buildBoard()
 * @returns {{trace: Array<{cell: string, reads: Array<number>}>, cells: number}} Replay
 */
export function replayScene(scene, board) {
  const drawn = new Set();
  const connections = new Map();
  const trace = [];

  const ensure = (cellKey) => {
    drawn.add(cellKey);
    if (!connections.has(cellKey)) connections.set(cellKey, new Set());
  };
  const link = (a, b) => {
    connections.get(a).add(b);
    connections.get(b).add(a);
  };
  const reads = () => {
    const turnMap = playerTurnMap(drawn, connections);
    return board.hints.map((hint) => {
      const { row, col } = parseCellKey(hint);
      return board.expected.get(hint) - countTurnsInArea(row, col, GRID_SIZE, turnMap);
    });
  };

  for (const step of scene.steps) {
    if (step.type === 'draw') {
      let previous = null;
      for (const [row, col] of step.cells) {
        const cellKey = createCellKey(row, col);
        ensure(cellKey);
        if (previous && previous !== cellKey) link(previous, cellKey);
        previous = cellKey;
        trace.push({ cell: cellKey, reads: reads() });
      }
    } else if (step.type === 'tap') {
      const cellKey = createCellKey(step.row, step.col);
      for (const other of connections.get(cellKey) ?? []) {
        connections.get(other)?.delete(cellKey);
      }
      connections.delete(cellKey);
      drawn.delete(cellKey);
      trace.push({ cell: `-${cellKey}`, reads: reads() });
    }
  }

  return { trace, cells: drawn.size };
}
