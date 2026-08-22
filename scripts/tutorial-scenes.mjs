/**
 * Scene scripts for the How to play tutorial videos.
 *
 * Each scene is played against a real Easy daily puzzle, planted in
 * localStorage as an unlimited-mode save so the board is deterministic without
 * the app needing a capture-only route. See `docs/recording-tutorial-videos.md`.
 *
 * Boards were chosen with `npm run boards:tutorial -- search`, which builds them
 * with the game's own generator and hint placement, so every number below is one
 * a player could really be dealt. The strokes were checked with
 * `npm run boards:tutorial`, which replays them cell by cell and prints what
 * each hint reads.
 *
 * Coordinates are `[row, col]`, both 0-indexed from the top-left, matching the
 * game's own cell keys.
 *
 * Steps:
 *   draw  — one pointer gesture through a run of cells. Starting on the cell the
 *           path already ends at extends it, exactly as a player's second stroke
 *           would.
 *   tap   — press and release on one cell without moving, which erases it
 *   wait  — hold on the current state
 *   mark  — record a trim point
 *
 * Scenes do not write their own opening pause: the runner holds every clip on
 * its first board for LEAD_IN_MS at the `start` mark, so no scene can be
 * recorded without one. That beat is also what makes the poster — always the
 * first frame — a readable starting position rather than something mid-stroke.
 *
 * Two scenes reach outside their own steps, and the two are not the same kind
 * of thing:
 *
 *   settings   — overrides on the planted `loop-game:settings`. A real setting
 *                a player can switch on, so the clip is still the shipped game.
 *                Card 3 turns Borders to Full for exactly one reason: see it.
 *   maskCells  — a runner overlay that covers a cell so its number does not
 *                show. Cards 1 and 2 use it to clear the board of numbers
 *                nobody has explained yet. Nothing in the game does this.
 *
 * `maskCells` is not the same as planting a board with no hints, and the
 * difference matters: a board with no hints is one where every constraint is
 * trivially satisfied, so the moment the loop closes the game calls it a win
 * and paints it green. Keeping the hints and hiding the numbers keeps the loop
 * black, which is what a real board does.
 *
 * Two rules every stroke keeps, both for legibility rather than legality:
 *
 * 1. **Never draw over a hint cell.** The path is drawn after the numbers, so a
 *    number under it is unreadable — and on cards 3 and 4 what the number is
 *    doing is the entire lesson.
 * 2. **Green belongs to card 4 alone.** Zero renders green and green reads as
 *    solved, so no earlier card may take a hint to zero: on cards 1 and 2 it
 *    would reward something the viewer was not asked to do, and on card 3 it
 *    would answer the question card 4 is there to ask.
 *
 * `expect` is asserted against the live game after the scene plays. `won` is the
 * only state the DOM exposes, and it is what proves the last card really reaches
 * the win rather than stopping one square short of it.
 */

/**
 * A real Easy daily puzzle with a single hint at (2,1) reading 3.
 *
 * Its 3x3 area is rows 1-3 x cols 0-2, which holds both kinds of cell: bends
 * the number watches and bends it does not. Card 3 needs both, and the hint
 * cell itself has to stay off the loop, or the path would cover the number the
 * whole card is about.
 *
 * The 3 is not a free choice. Card 3's loop (CARD_THREE_LOOP) has four bends,
 * one near each corner of the grid, and no 3x3 window can reach more than two
 * of them — so the number can only ever be walked down by two. Ending on 1,
 * which is the point, therefore means starting on 3. Any board whose hint here
 * reads something else changes where the card finishes.
 */
const SEED_ONE_HINT = 202602210;

/**
 * A real Easy daily puzzle with hints in opposite corners, (3,0) and (0,3),
 * both reading 3.
 *
 * Cards 1, 2 and 4 all run on it, so three quarters of the tutorial is one
 * puzzle developing rather than four unrelated boards. Opposite corners also
 * mean a loop can reach into both hints' areas while never crossing either cell.
 */
const SEED_TWO_HINTS = 202603020;

/**
 * The loop cards 1 and 2 share, drawn as one stroke.
 *
 * A staircase rather than a rectangle, because "any shape, any size" is the
 * claim the card makes. It crosses neither hint cell — which is what lets those
 * two cells be masked on cards 1 and 2 without ever hiding the path — and
 * leaves both hints reading 2, so the loop stays black.
 */
const FREEHAND_LOOP = [
  [0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2],
  [2, 2], [1, 2], [0, 2], [0, 1], [0, 0],
];

/**
 * Card 3's loop: bottom-right, all the way left, up two, all the way right,
 * down to close.
 *
 * A plain rectangle over rows 1-3, and every part of it is doing work for the
 * hint at (2,1):
 *
 *   - it bends at (3,0) and (1,0), both inside the hint's area, which is what
 *     walks the number 3 -> 2 -> 1;
 *   - it bends at (1,3) and (3,3), both outside it, which is the contrast the
 *     card exists for — the loop keeps bending and the number stops moving;
 *   - it never enters (2,1), so the number is legible throughout;
 *   - and it *closes*, on a number still reading 1, so nothing turns green.
 *
 * That last part previews card 4 rather than stealing it: card 3 shows a closed
 * loop is not automatically a solved one, card 4 shows what to do about it.
 */
const CARD_THREE_LOOP = [
  [3, 3], [3, 2], [3, 1], [3, 0], [2, 0], [1, 0],
  [1, 1], [1, 2], [1, 3], [2, 3], [3, 3],
];

/**
 * The 10-cell loop that closes but leaves the top-right hint reading 2.
 *
 * A ring with a hole at (1,1), which reads as a deliberate shape rather than a
 * blob, and it zeroes the bottom-left hint on the way round. One green number
 * beside one that is not is the near-miss card 4 opens on.
 */
const NEAR_MISS_LOOP = [
  [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [3, 1], [2, 1], [2, 0], [1, 0], [0, 0],
];

export const SCENES = [
  {
    id: 1,
    name: 'draw',
    // Analytics label. Deliberately English, and deliberately unchanged from the
    // three-card tutorial wherever the name already existed, so
    // tutorial_section_viewed stays comparable across the change.
    section: 'Drawing loops',
    captionKey: 'tutorial.draw',
    seed: SEED_TWO_HINTS,
    // The gesture cards show a bare grid. Both hint cells are outside
    // FREEHAND_LOOP, so nothing the stroke draws is ever behind a mask.
    maskCells: [[3, 0], [0, 3]],
    steps: [
      { type: 'mark', name: 'start' },
      { type: 'draw', cells: FREEHAND_LOOP },
      { type: 'wait', ms: 900 },
      { type: 'mark', name: 'end' },
    ],
    trim: { from: 'start', to: 'end' },
    expect: { cells: 10, won: false },
  },

  {
    id: 2,
    name: 'erase',
    section: 'Erasing',
    captionKey: 'tutorial.erase',
    seed: SEED_TWO_HINTS,
    maskCells: [[3, 0], [0, 3]],
    // Continues card 1's loop rather than starting a new one, so swiping forward
    // reads as one game rather than two disconnected demos. Two taps rather than
    // one: a single erase could be read as an undo, a run of them reads as a
    // tool. Both cells sit on the loop's bottom edge, so the gap is unmissable.
    steps: [
      { type: 'draw', cells: FREEHAND_LOOP },
      { type: 'mark', name: 'start' },
      { type: 'tap', row: 3, col: 1 },
      { type: 'tap', row: 3, col: 2 },
      { type: 'wait', ms: 800 },
      { type: 'mark', name: 'end' },
    ],
    trim: { from: 'start', to: 'end' },
    expect: { cells: 8, won: false },
  },

  {
    id: 3,
    name: 'numbers',
    section: 'Counting bends',
    captionKey: 'tutorial.numbers',
    seed: SEED_ONE_HINT,
    // The only scene that changes a setting, and the card is unteachable
    // without it: "the squares around a number" has to be visible before a
    // bend can be shown landing inside or outside it.
    //
    // Borders: Full is the game's own answer to that — `drawHintBorders()`
    // outlines each hint's 3x3 area in the hint's own colour, so the boundary
    // turns green with the number it belongs to. An earlier cut drew a pulsing
    // blue rectangle behind the canvas instead, copied from `renderHintPulse()`
    // in `renderer.js`, which has no callers: that put a thing on the card no
    // player would ever see on their own board. A real setting is strictly
    // better, and it is one tap away in the settings sheet if they want it.
    settings: { borderMode: 'full' },
    // Two strokes, split where the number stops moving. The first bends once
    // inside the box (3 -> 2); the second bends inside it once more (2 -> 1)
    // and then twice outside it, closing the loop without shifting the number
    // again. The pause between them is what makes the first drop readable.
    steps: [
      { type: 'mark', name: 'start' },
      { type: 'draw', cells: CARD_THREE_LOOP.slice(0, 5), pauseAfter: 700 },
      { type: 'draw', cells: CARD_THREE_LOOP.slice(4) },
      { type: 'wait', ms: 1200 },
      { type: 'mark', name: 'end' },
    ],
    trim: { from: 'start', to: 'end' },
    // The loop closes, but on a hint reading 1 — so no win, and no green
    expect: { cells: 10, won: false },
  },

  {
    id: 4,
    name: 'win',
    section: 'Win condition',
    captionKey: 'tutorial.win',
    seed: SEED_TWO_HINTS,
    // The whole win, in one card: a loop closes, the bottom-left hint goes green
    // on zero, the top-right one still reads 2 — and nothing happens. Then one
    // square is rubbed out, the loop is redrawn wider, and the second number
    // reaches zero too.
    //
    // The near-miss is not a separate card because it is not a separate idea.
    // Split across two, the first ends on "nothing happened", which is a weak
    // place to leave a viewer and a weak place to start one.
    //
    // Erasing before redrawing is what keeps the edit deterministic. Dragging
    // straight through a cell that already has two connections leaves `gameCore`
    // to choose which one to break, and which it chooses is not something a
    // tutorial should depend on. It also puts card 2's lesson to work, which is
    // the argument for teaching erasing that early.
    steps: [
      { type: 'mark', name: 'start' },
      { type: 'draw', cells: NEAR_MISS_LOOP, pauseAfter: 900 },
      { type: 'tap', row: 2, col: 2 },
      { type: 'draw', cells: [[1, 2], [1, 3], [2, 3], [2, 2], [3, 2]] },
      { type: 'wait', ms: 1800 },
      { type: 'mark', name: 'end' },
    ],
    trim: { from: 'start', to: 'end' },
    expect: { cells: 12, won: true },
  },
];
