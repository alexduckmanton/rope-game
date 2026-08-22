/**
 * Designs and checks the boards the tutorial clips are recorded on.
 *
 *   npm run boards:tutorial            # print every scene's board and replay
 *   npm run boards:tutorial -- search  # list Easy seeds worth building a scene on
 *
 * Recording a clip takes the better part of a minute per theme, so a scene is
 * worth checking here first: this prints the board a seed produces and what
 * every hint reads after each cell of every stroke. See
 * `docs/recording-tutorial-videos.md`.
 */

import { SCENES } from './tutorial-scenes.mjs';
import { buildBoard, replayScene, GRID_SIZE } from './lib/tutorial-boards.mjs';

const { parseCellKey, createCellKey, buildSolutionTurnMap, countTurnsInArea } =
  await import('../src/utils.js');

/** Render a board as text, hints in place */
function drawBoard(board, drawn = new Set()) {
  const hintValues = new Map(board.hints.map((h) => [h, board.expected.get(h)]));
  let out = '';
  for (let row = 0; row < GRID_SIZE; row += 1) {
    out += '  ';
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const cellKey = createCellKey(row, col);
      if (hintValues.has(cellKey)) out += ` ${hintValues.get(cellKey)}`;
      else if (drawn.has(cellKey)) out += ' #';
      else out += ' ·';
    }
    out += '\n';
  }
  return out;
}

function report() {
  for (const scene of SCENES) {
    const board = buildBoard(scene.seed);
    const { trace, cells } = replayScene(scene, board);

    console.log(`\n=== ${scene.id} ${scene.name}  seed ${scene.seed}`);
    console.log(`hints: ${board.hints.map((h) => `${h}=${board.expected.get(h)}`).join('  ')}`);
    console.log(drawBoard(board));
    console.log(`  ${board.hints.join('  ')}`);
    for (const point of trace) {
      console.log(`  ${point.cell.padEnd(6)} ${point.reads.join('  ')}`);
    }

    const expected = scene.expect ?? {};
    if (expected.cells !== undefined && expected.cells !== cells) {
      console.log(`  ! expects ${expected.cells} cells, replay leaves ${cells}`);
      process.exitCode = 1;
    }
    const allZero = trace.length > 0 && trace[trace.length - 1].reads.every((v) => v === 0);
    if (expected.won !== undefined && expected.won && !allZero) {
      console.log('  ! expects a win, but a hint is still non-zero');
      process.exitCode = 1;
    }
  }
}

/**
 * Every simple cycle on the grid, as an ordered ring
 *
 * There are 213 on a 4x4, so exhaustive search is free. Used to answer "is
 * there a short loop that satisfies this board", which is the question that
 * decides whether a seed can carry a scene.
 */
function allCycles() {
  const found = new Map();
  const inBounds = (r, c) => r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;
  const neighbours = (r, c) =>
    [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => inBounds(a, b));

  for (let sr = 0; sr < GRID_SIZE; sr += 1) {
    for (let sc = 0; sc < GRID_SIZE; sc += 1) {
      const path = [[sr, sc]];
      const seen = new Set([createCellKey(sr, sc)]);
      const walk = (r, c) => {
        for (const [nr, nc] of neighbours(r, c)) {
          // Only ever extend "forwards" of the start, so each cycle is found
          // once, from its lowest cell
          if (nr * GRID_SIZE + nc < sr * GRID_SIZE + sc) continue;
          if (nr === sr && nc === sc) {
            if (path.length >= 4) {
              const id = path.map(([a, b]) => createCellKey(a, b)).sort().join('|');
              if (!found.has(id)) found.set(id, path.map(([a, b]) => ({ row: a, col: b })));
            }
            continue;
          }
          const cellKey = createCellKey(nr, nc);
          if (seen.has(cellKey)) continue;
          seen.add(cellKey);
          path.push([nr, nc]);
          walk(nr, nc);
          path.pop();
          seen.delete(cellKey);
        }
      };
      walk(sr, sc);
    }
  }
  return [...found.values()];
}

/** List Easy seeds whose puzzle could carry a scene */
function search(days = 400) {
  const cycles = allCycles();
  console.log(`${cycles.length} simple cycles on a ${GRID_SIZE}x${GRID_SIZE} grid\n`);
  console.log('seed        hints                 shortest winning loop');

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(2026, 0, 1 + offset);
    const seed =
      (date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()) * 10;
    const board = buildBoard(seed);

    const winners = cycles
      .filter((ring) => {
        const turnMap = buildSolutionTurnMap(ring);
        return board.hints.every((hint) => {
          const { row, col } = parseCellKey(hint);
          return countTurnsInArea(row, col, GRID_SIZE, turnMap) === board.expected.get(hint);
        });
      })
      .sort((a, b) => a.length - b.length);

    if (!winners.length || winners[0].length > 12) continue;
    const hints = board.hints.map((h) => `${h}=${board.expected.get(h)}`).join(' ').padEnd(21);
    console.log(`${seed}  ${hints} ${winners[0].length} cells`);
  }
}

if (process.argv.includes('search')) search();
else report();
