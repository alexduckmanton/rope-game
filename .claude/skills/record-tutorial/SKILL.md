---
name: record-tutorial
description: Record or change the tutorial clips. Use when editing tutorial cards, scenes, copy or the recording runner, or after any visual change to the grid, hint colours, line weight or the win green.
---

# Recording the tutorial clips

The four tutorial cards are silent clips of the **real game**, recorded by a scripted
runner that plays it. Never author or hand-edit a clip — re-record instead.

**Read `docs/recording-tutorial-videos.md` before touching the runner.** It is the full
reference: how the runner plants boards, replays gestures, and what each knob does.

## The four cards

| # | Analytics name | Teaches |
|---|---|---|
| 1 | `Drawing loops` | Drag to draw a loop, any shape or size |
| 2 | `Erasing` | Tap to erase parts of the loop |
| 3 | `Counting bends` | Bends inside the box a number watches count it down; bends outside do not |
| 4 | `Win condition` | A loop closes with a number still at 2 and nothing happens; fix it, both read zero, the loop goes green |

Cards 1, 2 and 4 run on **one puzzle** and 3 on another, so three quarters of the tutorial
is a single game developing rather than four unrelated boards.

## Commands

```bash
npm run boards:tutorial            # replay every scene in Node, no browser
npm run boards:tutorial -- search  # find Easy seeds a new scene could run on
npm run record:tutorial            # record all four scenes, both themes (needs npm run dev)
npm run record:tutorial -- 3       # ...just one scene
```

## Rules

1. **Re-record after any visual change to the grid** — line weight, hint colours, corner
   radius, grid lines, the win green. The clips date the moment the board does, and there
   is no way to tell from the sheet that they have.
2. **Never edit `src/` or `style.css` while a recording is running.** HMR reloads the page
   and the run dies part-way through with "Execution context was destroyed".
3. **Change what a card shows**: edit the scene in `scripts/tutorial-scenes.mjs`, check it
   with `npm run boards:tutorial` (which prints what every hint reads after each cell),
   then `npm run record:tutorial -- <n>`.
   - A `draw` step can carry `pace` (a multiplier on `CELL_MS`, for a stroke where
     something has to be read as it happens) and `pauseAfter`.
   - A scene can carry `settings` (one of the game's own — `settingsFor()` rejects
     anything else) and `maskCells`.
   - **A number's starting value is not free**: a hint whose 3x3 fits entirely inside the
     grid always reads odd on a 4x4, so on Easy the middle cells can only be 3, 5 or 7.
4. **Change a card's words**: the `tutorial.*` keys in every dictionary. Adding or removing
   a card means adding or removing a key in all twelve, and `npm run check:i18n` will fail
   until they agree.
5. **Add or remove a card**: `LESSON_SECTIONS` in `components/tutorialSheet.js` and `SCENES`
   in `scripts/tutorial-scenes.mjs` must stay in step — the `clip` field is the scene id and
   the filename. Keep `section` (the analytics name) stable for any card that already existed.

## Two things the runner cannot check

Both are stated as rules at the top of `tutorial-scenes.mjs`; both need an eye on the output.

- Whether the path covers a hint number — it is drawn after them, so it hides them.
- Whether a card turns something green before the cards have explained what green means.
  This is why **card 3 deliberately stops short of zero**: zero is green and green means
  solved, which is card 4's job.

## Why the cards are built the way they are

- **Cards 1 and 2 show a bare grid.** The runner *masks* the two hint cells, which is not
  the same as planting a board with no hints: a board with no hints is one where every
  constraint is trivially satisfied, so a closed loop turns green two cards before green
  means anything. Keeping the hints and hiding the numbers keeps the loop black.
- **Card 3 records with Borders set to Full**, planted into `loop-game:settings` for that
  scene alone, because the card's lesson is *which* squares a number watches.
  `drawHintBorders()` outlines each hint's 3x3 area in the hint's own colour, so the outline
  and the number always agree. Its counting stroke runs at `pace: 1.5` — three of the card's
  four number changes land inside it, and at the shared rate they arrive faster than a
  first-time viewer can tie each to its bend.
- **Card 4 carries the near-miss** rather than giving it a card of its own. A closed loop
  that fails its hints is Loopy's most common stuck state — it fires `validation_error` —
  but split across two cards the first ends on "nothing happened", which is a weak place to
  leave a viewer.
- `settingsFor()` in the runner is the only door for non-default settings and rejects any
  key that is not already a capture default. An earlier cut of card 3 drew a pulsing
  rectangle behind the canvas instead — that made it the one place a clip showed something
  a player could never see on their own board.
