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
 * Two rules every stroke keeps, both for legibility rather than legality:
 *
 * 1. **Never draw over a hint cell.** The path is drawn after the numbers, so a
 *    number under it is unreadable — and on cards 4 and 5 the number turning
 *    green is the entire lesson.
 * 2. **Never zero a hint on a card that has not introduced them.** Zero renders
 *    green, which on cards 1 and 2 reads as a reward for something the viewer
 *    was not asked to do.
 *
 * `expect` is asserted against the live game after the scene plays. `won` is the
 * only state the DOM exposes, and it is the one that matters: it is the whole
 * difference between cards 4 and 5.
 */

/**
 * A real Easy daily puzzle with a single hint at (1,1) reading 3.
 *
 * Its 3x3 area is rows 0-2 x cols 0-2, so the grid holds both kinds of cell:
 * bends the number watches and bends it does not. Card 3 needs both, and a
 * central hint is the only way to have a bend that is plainly *outside* the area
 * without being off the grid.
 */
const SEED_ONE_HINT = 202602050;

/**
 * A real Easy daily puzzle with hints in opposite corners, (3,0) and (0,3),
 * both reading 3.
 *
 * Cards 1, 2, 4 and 5 all run on it, so four fifths of the tutorial is one
 * puzzle developing rather than four unrelated boards. Opposite corners also
 * mean a loop can reach into both hints' areas while never crossing either cell.
 */
const SEED_TWO_HINTS = 202603020;

/**
 * The loop cards 1 and 2 share, drawn as one stroke.
 *
 * A staircase rather than a rectangle, because "any shape, any size" is the
 * claim the card makes. It crosses neither hint cell and leaves both reading 2,
 * so nothing turns green two cards before numbers are explained.
 */
const FREEHAND_LOOP = [
  [0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2],
  [2, 2], [1, 2], [0, 2], [0, 1], [0, 0],
];

/**
 * The 10-cell loop that closes but leaves the top-right hint reading 2.
 *
 * A ring with a hole at (1,1), which reads as a deliberate shape rather than a
 * blob, and it zeroes the bottom-left hint on the way round — one green number
 * beside one that is not is exactly what card 4 is for.
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
    // Two strokes, and the first one is the lesson. It bends at (3,0), two rows
    // from the hint, and the number does not move — so the card can claim that
    // distant bends do not count and then show it, before the second stroke
    // bends three times beside the number and walks it down 3, 2, 1, 0.
    //
    // Nothing in the game marks the area a number watches: the pulsing 3x3
    // highlight `renderer.js` still exports was dropped from the render at some
    // point and has no caller. Contrast is the only teaching tool available,
    // which is why this scene spends its first half on a bend that changes
    // nothing.
    steps: [
      { type: 'mark', name: 'start' },
      { type: 'draw', cells: [[3, 3], [3, 2], [3, 1], [3, 0], [2, 0]], pauseAfter: 700 },
      { type: 'draw', cells: [[2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]] },
      { type: 'wait', ms: 1200 },
      { type: 'mark', name: 'end' },
    ],
    trim: { from: 'start', to: 'end' },
    // An open path, so nothing wins however many numbers reach zero
    expect: { cells: 10, won: false },
  },

  {
    id: 4,
    name: 'zero',
    section: 'Zeroing numbers',
    captionKey: 'tutorial.zero',
    seed: SEED_TWO_HINTS,
    // The loop closes, the bottom-left hint goes green on zero, the top-right
    // one still reads 2 — and nothing happens. That is the state Loopy players
    // most often get stuck in, and this is the only card that names it.
    steps: [
      { type: 'mark', name: 'start' },
      { type: 'draw', cells: NEAR_MISS_LOOP },
      { type: 'wait', ms: 1600 },
      { type: 'mark', name: 'end' },
    ],
    trim: { from: 'start', to: 'end' },
    expect: { cells: 10, won: false },
  },

  {
    id: 5,
    name: 'win',
    section: 'Win condition',
    captionKey: 'tutorial.win',
    seed: SEED_TWO_HINTS,
    // Picks up card 4's stuck loop and fixes it: rub out one square to open the
    // loop, then redraw wide enough to put two bends in the corner hint's area.
    //
    // Erasing first is what keeps the edit deterministic. Dragging straight
    // through a cell that already has two connections leaves `gameCore` to
    // choose which one to break, and which it chooses is not something a
    // tutorial should depend on. It also puts card 2's lesson to work, which is
    // the argument for teaching erasing that early.
    steps: [
      { type: 'draw', cells: NEAR_MISS_LOOP },
      { type: 'mark', name: 'start' },
      { type: 'tap', row: 2, col: 2 },
      { type: 'draw', cells: [[1, 2], [1, 3], [2, 3], [2, 2], [3, 2]] },
      { type: 'wait', ms: 2200 },
      { type: 'mark', name: 'end' },
    ],
    trim: { from: 'start', to: 'end' },
    expect: { cells: 12, won: true },
  },
];
