# Recording the Tutorial Videos

The How to play clips are recorded by playing the real game, not authored by
hand. This document is the reference for how that works, what breaks it, and
how to prove a run came out right.

```bash
npm run dev                      # in one terminal
npm run record:tutorial          # every scene, both themes
npm run record:tutorial -- 3 4   # just scenes 3 and 4
npm run boards:tutorial          # replay every scene offline, no recording
npm run boards:tutorial -- search  # find Easy seeds a new scene could run on
```

| | |
|---|---|
| Runner | `scripts/record-tutorial.mjs` |
| Scene scripts | `scripts/tutorial-scenes.mjs` |
| Board building and replay | `scripts/lib/tutorial-boards.mjs` |
| Node stubs for the game's modules | `scripts/lib/browserless-hooks.mjs` |
| Output | `public/videos/<n>-<theme>.{mp4,webm,webp}` |
| Consumed by | `src/components/tutorialSheet.js` |

Re-record whenever the grid's look changes — the clips are screenshots of the
game, so a change to the line weight, the hint colours, the corner radius or the
grid lines dates every one of them. That is not hypothetical: the clips this
pipeline replaced were recorded by hand at three different resolutions, and the
oldest of them still showed a pulsing 3x3 highlight behind each hint that the
game stopped rendering long ago. `renderHintPulse()` is still exported from
`renderer.js` and has no callers.

---

## How it works

Each scene loads `/play?difficulty=unlimited` in a real Chromium with a puzzle
planted in `localStorage`, then draws on it with real pointer events. Frames come
from CDP's `Page.startScreencast`, are trimmed to marks the scene records during
playback, and are encoded to an mp4, a webm and a webp poster.

**There is no capture-only route, and Loopy does not need one.** An
unlimited-mode save carries its own `solutionPath` and `hintCells` — daily saves
rebuild theirs from the date seed — so writing one before the page loads pins the
puzzle exactly. `scripts/lib/tutorial-boards.mjs` builds that save from a daily
seed using the game's own generator and hint placement, so every board in the
tutorial is one a player could really be dealt. Settings are planted alongside
it, always at the shipped defaults, so a clip can never quietly demonstrate a
setting nobody has.

The on-screen cursor is a `<div>` the runner injects and moves; the real pointer
follows it. Without it the line appears to draw itself, which teaches an
animation rather than a gesture.

Boards were designed with `npm run boards:tutorial -- search`, which builds every
Easy daily puzzle across a year of seeds and reports which ones have a short loop
that satisfies them. `npm run boards:tutorial` then replays each scene's strokes
cell by cell and prints what every hint reads after each one, which is how the
countdown in card 3 and the near-miss in card 4 were tuned without recording
anything.

### Running the game's modules outside a browser

`config.js` imports `tokens.js`, which reads CSS custom properties off a live
document, and the i18n runtime, whose dictionary is bound by a Vite-only alias.
Neither has anything to do with puzzle generation, but both make `generator.js`
and `renderer.js` unimportable in plain Node.

`scripts/lib/browserless-hooks.mjs` is a resolution hook that swaps both for
stubs. `tutorial-boards.mjs` registers it on import, so anything that imports
that module gets the real generation code and does not have to think about it.

### What the replay model can and cannot check

`replayScene()` connects each cell in a stroke to the one before it. That is
exact for the gestures the scenes are allowed to use, and the scenes are
restricted to keep it exact: no self-intersections, no drag-backtracking, and
never drawing through a cell that already has two connections. The last of those
is why card 5 erases a square before redrawing rather than bumping straight
through the loop — `gameCore` decides which connection to break there, and a
tutorial should not depend on which one it picks.

Anything outside that set has to be verified by recording it. The runner's
backstop is each scene's `expect.won`, asserted against the live game after the
scene plays: it is the only game state the DOM exposes, and it is the whole
difference between cards 4 and 5.

---

## The traps

Every one of these produces output that *looks* correct by the obvious
measurement.

### 1. The concat demuxer resamples to 25fps

**Symptom:** the file reports 60fps, the capture is 60fps, playback judders.

ffmpeg's concat demuxer decodes image input at a default **25fps**. The shortest
span it can represent is 40ms, so a `duration 0.016667` directive per frame gets
rounded up to two or three output frames — a clean 60fps capture quietly becomes
25fps of real content inside a 60fps container.

**Fix, and it needs both halves:** list each frame once per 60Hz tick it occupies
(no `duration` directives), and pass `-r 60` *before* `-i`.

This one is inherited from Tilbo's pipeline, where it was measured with the bar
test below; the fix is carried over verbatim rather than re-derived. What was
measured here is the outcome: every clip in the shipping set reports a median
capture gap of 16.5–18.3ms, which is what a real 60fps capture looks like.

For contrast, the hand-recorded clips this replaced: during the busiest two
seconds of the old `tutorial-1`, **71% of frames were pixel-identical to their
predecessor** — about 17fps of content in a 60fps container, on a clip whose
entire subject was a line moving.

### 2. The capture scale factor is a frame-rate setting

**Symptom:** animations record below 60fps for no obvious reason.

The browser JPEG-encodes every screencast frame on the renderer. Past a certain
frame size that work starves the animations being recorded. Counting the page's
own `requestAnimationFrame` callbacks during capture, on the game view:

| | page frame rate |
|---|---|
| any scale, no screencast | 61.2–61.4fps |
| scale 2 | 60.2fps |
| **scale 2.5** | **60.7fps** |
| scale 3 | 59.7fps |
| scale 3.5 | 58.7fps |

Loopy degrades gently here rather than falling off a cliff — its page is one
small canvas, not a grid of animated tiles — so `DEVICE_SCALE = 2.5` is chosen
for output size rather than to stay under an edge. **Raising it buys nothing:**
the canvas is 400 CSS px, so 2.5 already yields a 1000px clip against the ~350px
the sheet renders it at, which covers a 3x screen with room to spare. Note the
measurement above is of an idle board; an active drag costs more, and the median
gap the runner prints per clip is the figure to trust.

Keep `VIEWPORT` no larger than it needs to be, for the same reason: every pixel
above what the crop keeps is one the browser encodes 60 times a second and then
throws away. The floor is set by `calculateCellSize()`, which clamps a cell to
`CONFIG.CELL_SIZE_MAX` (100px), so a 4x4 reaches its full 400px once the viewport
clears 440 wide and 500 tall.

`--force-device-scale-factor` at launch is what makes screencast return
device-resolution frames. A Playwright context `deviceScaleFactor` does not work:
that only sharpens screenshots, and screencast keeps returning CSS-pixel frames.

### 3. Cropping wider than the canvas puts a card inside a card

**Symptom:** the clip looks fine on its own and looks nested in the sheet.

The canvas carries `border-radius: 8px` and a drop shadow, and sits on the page
background. Crop anything wider than the canvas element and all of that comes
with it — and then the sheet draws its own rounded, elevated container around the
result. The old clips did exactly this: grid card inside page background inside
video container, with the actual grid down to about 60% of the frame's area.

The fix is in two halves and needs both. The runner crops to
`#game-canvas`'s own bounding box, and it injects CSS that flattens the canvas's
rounding and shadow for the duration of the capture, so the corners of the crop
are grid rather than page background. The rounding the viewer sees belongs to
`.bottom-sheet-video-container`.

### 4. HMR reloads the page mid-take

**Symptom:** `page.evaluate: Execution context was destroyed, most likely because
of a navigation`, part-way through a run that was working.

The runner drives the Vite dev server. Saving any file in the module graph
triggers a reload, which destroys the page under the scene being played. Do not
edit `src/`, `style.css` or `index.html` while a recording is running. Editing
`scripts/` or `docs/` is safe — neither is imported by the app.

### 5. The win sheet covers the board

Card 5 wins, and the win sheet slides up over the canvas. The clip is the board,
not the app chrome around it, so the runner hides `.bottom-sheet-overlay` for the
duration of the capture. This is a crop decision, not a change to what is being
demonstrated: the win itself — green path, green zeros — is exactly what the
frame shows.

---

## Verifying a run

**Do not compare encoded frames by hash.** Lossy decode makes repeated frames
differ slightly, so duplicates read as distinct and a broken run scores clean.

**The bar test** is the reliable instrument for the pipeline itself. Record a
page holding an element that moves a fixed step on every frame, then measure the
step between output frames. Uniform steps mean the pipeline is sound; zeros mean
frames are being dropped or held, and the size of the non-zero steps tells you by
how much.

```js
// the page under test
let x = 0;
const bar = document.getElementById('bar');
(function tick() {
  x += 3;
  bar.style.transform = `translateX(${x}px)`;
  requestAnimationFrame(tick);
})();
```

Then decode one row of pixels per output frame, find the bar's leading edge, and
histogram the differences. A healthy run is a single step value (plus its
neighbour, from rounding) and no zeros.

**What the runner prints per clip** — `5.8s, 173 frames, 17.0ms median gap`:

- *median gap* — the median interval between captured frames. It should sit near
  16.7ms; under about 20ms means capture is keeping up. Every clip in the
  shipping set is between 16.5 and 18.3ms.
- *frames* — the count kept after trimming.
- *duration* — clip length, which is ticks ÷ 60 by construction.

Frames-per-second-of-clip is **not** a useful figure: screencast emits nothing
while the page is still, and those stretches legitimately become one held frame.
It also means a scene's trailing `wait` does not lengthen the clip — nothing
paints during it, so the clip ends on the last painted frame. That is the right
behaviour for a player that holds its last frame, but it does mean a scene cannot
buy a pause at the end by waiting; the pause has to come from something that
paints, or from the sheet holding the frame.

**For the content rather than the pipeline**, decode to small grayscale frames
and count how many differ from their predecessor within the busiest one-second
window. This conflates frame rate with amount of motion, so it only compares
clips of similar content — useful for before-and-after on the same scene,
misleading across different ones. It is how the 71% figure above was produced.

Then look at the clips. The runner cannot check what a card teaches, and two
things in particular need an eye on them:

- **Nothing the lesson depends on should be under the path.** The path is drawn
  after the numbers, so a hint the loop crosses is unreadable. The scenes are
  written to avoid it; a new one has to be checked.
- **Green means won.** A number reaching zero renders green, and so does a
  completed loop. On a card before numbers have been introduced, either reads as
  a reward for something the viewer was not asked to do.

---

## Notes on the environment

These clips have been recorded in a container with no GPU. That is fine — the
numbers above were all measured there — but two things follow, both inherited
from Tilbo's pipeline and unchanged here:

- Chromium's **default** frame pacing is what gets closest to 60fps.
  `--disable-gpu-vsync` and `--disable-frame-rate-limit` both measured *worse*
  there, and in combination effectively froze rendering. Do not add them.
- `HeadlessExperimental.beginFrame` is gone from current Chromium, and
  `Emulation.setVirtualTimePolicy` does not drive rAF, so deterministic
  frame-stepping is not available as a fallback.

`ffmpeg-static` and `playwright` are devDependencies. Playwright's bundled ffmpeg
is VP8/webm only and cannot produce the mp4 or the webp poster.

Analytics requests are aborted at the context, so a recording run never lands in
PostHog. They would be dropped anyway — PostHog discards events from a browser
reporting `navigator.webdriver` — but not sending them does not depend on that
staying true. The page logs its own failure to reach the endpoint; the runner
filters that out of its console-error check.

---

## Encoding

One crop-and-resample pass to a lossless FFV1 intermediate, so both encodes and
the poster come from identical frames. Then H.264 and VP9 from it.

Loopy's clips are flat colour and a few thin lines on a near-uniform ground, so
both codecs go far looser than they could on photographic content before
anything shows. Swept against the win clip, which is the busiest:

| | size | verdict |
|---|---|---|
| VP9 crf 44 | 67KB | indistinguishable from 52 at 3x magnification |
| **VP9 crf 50** | **~52KB** | shipped |
| VP9 crf 52 | 48KB | still clean |
| H.264 crf 30 | 68KB | |
| **H.264 crf 36** | **~45KB** | shipped |
| H.264 crf 38 | 42KB | faint ringing beside a curve |

**The mp4 is listed first in the sheet, and that is the unusual part.** On this
content x264 wins outright: the webm came out 8–30% larger on every one of the
ten clips, at matched quality. Source order decides what a browser downloads, so
listing the mp4 first hands almost everyone the smaller file.

The webm is not dead weight, and dropping it was tried and reverted. **A Chromium
built without proprietary codecs cannot decode H.264 at all** — Playwright's
bundled Chromium is one, and so are some Linux distribution builds. On an
mp4-only set they get `DEMUXER_ERROR_NO_SUPPORTED_STREAMS` and a poster that
never moves. The webm is what those fall through to.

The whole set is 1.1MB — ten clips in two formats and ten posters, in two themes,
against 984KB for the three single-theme, single-format clips it replaced.

If a future change makes the clips busier — a fill, a gradient, an animated
background — re-run the codec comparison before assuming the ordering still
holds. It is a property of this content, not of the codecs.

The poster is the clip's first frame. It stands in for the clip before it plays
and again after it ends, so it has to match what pressing replay starts from —
which is why the runner holds every scene on a settled board for `LEAD_IN_MS`
before anything moves.

---

## Pacing

The constants at the top of `scripts/record-tutorial.mjs` decide whether a clip
can be followed rather than merely watched:

- `CELL_MS` — how long the pointer takes to cross one cell, and deliberately
  slow. Loopy's whole input is one continuous drag; a stroke that crosses the
  grid in half a second reads as a line appearing rather than as someone drawing
  it, and the drawing is the point.
- `STEPS_PER_CELL` — pointer samples per cell. Enough that the game's own
  Bresenham never has to interpolate a jump of more than a fraction of a cell,
  which is what keeps the recorded path identical to the scene's cell list.
- `LEAD_IN_MS` — every clip holds on its opening board before anything moves. The
  runner applies this at the `start` mark rather than each scene writing its own,
  so no scene can be recorded without one. It is also what makes the poster
  readable.
- `BETWEEN_TAPS_MS` — held after a tap resolves, so the gap it leaves has a beat
  to register before the next thing happens.
- `TAP_TIMING` — how the cursor travels and presses.
