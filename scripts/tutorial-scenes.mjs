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
 *           would. Takes `pauseAfter` (a beat once the stroke settles) and
 *           `pace` (a multiplier on the runner's CELL_MS, for a stroke that
 *           carries more to read than the rest — see card 3).
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
 * A real Easy daily puzzle with a single hint at (1,1) reading 5.
 *
 * The 5 is not a choice, and the reason is worth knowing before designing any
 * card around a number. **A hint whose 3x3 area fits entirely inside the grid
 * always reads an odd number on a 4x4.** Across 1500 daily seeds, (1,1) and
 * (1,2) — the only two such cells on an Easy board, once the clipped edge cells
 * are set aside — read 3, 5 or 7 and never 2, 4 or 6. It falls out of the
 * solution being a Hamiltonian cycle; edge cells, whose area is clipped by the
 * grid, take either parity freely.
 *
 * So a card whose number starts on 4 cannot put that number here, and 5 is the
 * lowest value that survives card 3's three counted bends without
 * reaching zero. 3 would land on green, which belongs to card 4.
 */
const SEED_ONE_HINT = 202602090;

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
    // blue rectangle behind the canvas instead: that put a thing on the card no
    // player would ever see on their own board. A real setting is strictly
    // better, and it is one tap away in the settings sheet if they want it.
    settings: { borderMode: 'full' },
    // The loop is a rectangle over rows 1-3 x cols 1-3 with a notch out to col 0
    // across rows 2-3. Six bends, and the split down the middle is the whole
    // card: (1,1), (2,1) and (2,0) sit inside the area the hint watches, and
    // (1,3), (3,3) and (3,0) sit outside it.
    //
    // The notch is what makes that possible. A plain rectangle puts one bend
    // near each corner of the grid and no 3x3 area can reach more than two of
    // them; it takes a shape that doubles back for three to crowd into one.
    //
    // Two strokes, and the order is doing the teaching. The first draws the
    // bottom and right: two bends, both outside, and the number does not move
    // once. The second draws the notch: three bends, all inside, and the number
    // steps 5 -> 4 -> 3 -> 2, one per bend, finishing as the loop closes. The
    // bend that closes it is outside, so the last thing the card shows is a
    // bend that does not count.
    //
    // The second stroke runs at `pace: 1.5`. It is the only stroke in the
    // tutorial that carries a rate of its own, and it earns it: three of the
    // card's four number changes happen inside it, one per bend, and at the
    // shared pace they arrive faster than a first-time viewer can connect each
    // one to the bend that caused it. The first stroke has nothing to read, so
    // slowing it too would only cost patience.
    //
    // The hint cell is on the loop, which rule 1 above otherwise forbids. It
    // stays legible because the bend at (1,1) enters from the right edge and
    // leaves through the bottom, hugging that corner of the cell while the
    // digit sits above and left of it — checked on the frames, not assumed.
    steps: [
      { type: 'mark', name: 'start' },
      {
        type: 'draw',
        cells: [[3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [1, 2], [1, 1]],
        pauseAfter: 700,
      },
      { type: 'draw', cells: [[1, 1], [2, 1], [2, 0], [3, 0]], pace: 1.5 },
      { type: 'wait', ms: 1200 },
      { type: 'mark', name: 'end' },
    ],
    trim: { from: 'start', to: 'end' },
    // The loop closes, but on a hint reading 2 — so no win, and no green
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
