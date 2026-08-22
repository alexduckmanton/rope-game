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
countdown in card 3 and the near-miss inside card 4 were tuned without recording
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
is why the last card erases a square before redrawing rather than bumping
straight through the loop — `gameCore` decides which connection to break there, and a
tutorial should not depend on which one it picks.

Anything outside that set has to be verified by recording it. The runner's
backstop is each scene's `expect.won`, asserted against the live game after the
scene plays: it is the only game state the DOM exposes, and it is what proves
the last card really reaches the win rather than stopping a square short.

### The two overlays

Two scenes carry something the runner draws rather than the game.

**`maskCells`, on cards 1 and 2.** Covers a cell so its hint number does not
show, leaving a bare grid for the cards that are only about the gesture.

This is not the same as planting a board with no hints, and the difference is
not cosmetic: a board with no hints is a board where every constraint is
trivially satisfied, so the instant the loop closes the game calls it a win and
paints it green — two cards before green has been given a meaning. Keeping the
hints and hiding the numbers keeps the loop black, which is what a real board
does. The masks are inset two pixels so the cell's own grid lines survive, and
only ever go on cells the scene's strokes never enter.

**`highlight`, on card 3.** The runner draws the 3x3 area the hint watches, as a
pulsing tint behind the canvas.

Nothing in the shipped game draws this either. `renderHintPulse()` in `renderer.js`
draws exactly it and has no callers — it was dropped from the render at some
point, and the hand-recorded clips this pipeline replaced, which still showed
it, were the last place it appeared. So this is a tutorial annotation, and the
one place a clip shows something a player will not see on their own board.

It is there because the card is unteachable without it: the lesson is *which*
squares a number watches, and with no marker the clip can only imply the
boundary by contrast and hope the viewer infers it.

It goes *behind* the canvas rather than over it. `clearCanvas()` uses
`clearRect`, so the canvas is genuinely transparent and its white comes from
CSS; the runner moves that background to the container and slots the tint
between the two. Grid lines, numbers and the path all stay on top, which is
where `renderHintPulse()` put them. The colour, the 20% peak and the 2s cycle
are copied from that function.

If the pulse is ever restored to the game, delete the annotation and the scene
gets shorter and clearer for free.

### Trim marks and the cursor

A scene's setup — everything before the `start` mark — is played at full speed
and thrown away, but it leaves the cursor mid-fade. Trim there and the clip
opens on the previous card's cursor dissolving in a corner, which is exactly
what it looks like: a splice.

The runner snaps the cursor out of sight with no transition at **every** mark,
then waits two frames before taking the timestamp. A scene cannot opt out.

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

### 2. A pointer move costs a frame, so pacing one with a timeout halves it

**Symptom:** the drawing is legible but it judders, worst where the loop closes.

`page.mouse.move` is not cheap and not asynchronous in the way it looks: it
costs about **16.3ms** on its own, because the input event is bound to a frame.
Pacing a stroke by sleeping between moves therefore adds to that cost rather
than absorbing it. Measured, drawing one cell four ways:

| | pointer events | median gap | wall |
|---|---|---|---|
| 8 moves + 32ms sleep | 8 | **50.0ms** | 396ms |
| 16 moves + 16ms sleep | 16 | 17.6ms | 295ms |
| `mouse.move(steps: 16)` | 16 | 16.7ms | 264ms |
| **16 bare moves** | **16** | **16.6ms** | **245ms** |

The first row is what shipped in the first pass of this pipeline: the path
advanced twenty times a second inside a 60fps clip. Nothing in the capture or
the encode was wrong — the page genuinely only moved twenty times.

**Fix:** issue the moves back to back and let their own cost do the pacing.
`STEPS_PER_CELL` then sets the speed as well as the smoothness: 16 samples at
~16.3ms is ~260ms per cell.

The same reasoning killed the old per-sample `page.evaluate` that positioned the
cursor. The cursor now follows `pointermove` inside the page, which costs
nothing and cannot lag behind the line it is supposed to be drawing.

### 3. The capture scale factor is a frame-rate setting

**Symptom:** animations record below 60fps for no obvious reason.

The browser JPEG-encodes every screencast frame on the renderer, and that work
competes with the game's own canvas render for the same frame budget. Neither is
expensive alone, which is why every cheaper way of measuring this says there is
headroom and every one of them is wrong:

| | page rAF during a stroke |
|---|---|
| game page, no screencast, scale 2.5 | 60.3fps, 0 frames over 30ms |
| blank page, screencast, scale 2.5 | 60.5fps |
| game page, screencast, scale 2.5 | 53.3fps, 22 frames over 30ms |
| game page, screencast, scale 2.25 | 59.3fps, 3 frames over 30ms |
| **game page, screencast, scale 2** | **60.4fps, 0 frames over 30ms** |

**Measure it as the page's own rAF cadence while a stroke is being drawn.** An
idle board holds 58.7fps even at scale 3.5, and a blank page holds 60 at 2.5;
only the two together reproduce it. It also gets worse as a stroke goes on,
because a longer path costs more to render — which is why the first pass of this
pipeline looked fine at the start of every clip and fell apart towards the end.

So the clip is 800px from a 400px canvas, and any more sharpness has to come from
the bitrate. There is no need for more anyway: `--force-device-scale-factor`
makes the game's own canvas back itself at the same ratio, so a 400 CSS-px canvas
is genuinely 800 sharp pixels against the 400px the sheet caps its render at.

`DEVICE_SCALE` can be overridden from the environment so the table above can be
reproduced. That is what it is for, not a dial to turn up.

A Playwright context `deviceScaleFactor` does not work in its place: that only
sharpens screenshots, and screencast keeps returning CSS-pixel frames.

Keep `VIEWPORT` no larger than it needs to be, for the same reason: every pixel
above what the crop keeps is one the browser encodes 60 times a second and then
throws away. The floor is set by `calculateCellSize()`, which clamps a cell to
`CONFIG.CELL_SIZE_MAX` (100px), so a 4x4 reaches its full 400px once the viewport
clears 440 wide and 500 tall.

### 4. Screencast stops delivering while the page is perfectly fine

**Symptom:** the clip freezes for a fifth of a second, several times, always in
the second half. Every measurement of the page says nothing is wrong.

It stops being a mystery once the two are measured side by side over the same
stroke:

```
page rAF:            187 frames over 3100ms = 60.3fps
page rAF stalls:     none
page long tasks:     none
screencast stalls:   150ms @1.6s, 167ms @1.9s, 266ms @2.0s
```

The page paints every frame. `Page.startScreencast` simply stops handing frames
over for 150–270ms at a time. It is reproducible to the millisecond across runs,
and **none of the obvious levers move it**: not the device scale (identical at 1
and at 2.5), not `everyNthFrame`, not acking synchronously before doing anything
else, not streaming frames to disk instead of buffering them, not a larger Node
young-generation heap, and not driving the pointer from inside the page instead
of over CDP.

**So do not try to reconstruct the missing time.** The encode holds a frame for
the gap its timestamps report, and for a stall that is exactly the freeze you can
see. The fix is to decide, per gap, which of two completely different things it
was:

| the page was still | screencast stalled |
|---|---|
| a lead-in, a beat between taps | 150–270ms of lost motion |
| screencast correctly sends nothing | the page was painting the whole time |
| hold the frame for the whole gap | hold it for as little as possible |

Timing cannot tell them apart. **The pixels can.** `frameMotion()` decodes the
clip to 32x32 greyscale in one ffmpeg pass and compares each frame with the one
before it. Where they are identical the page really was still and the gap is
honoured in full; where they differ, motion was lost and no reconstruction will
bring it back, so the frame is held for `MAX_STALL_TICKS` (2, or 33ms) and the
clip runs a hair fast across the stall rather than freezing.

Lost motion is still lost — the clip is very slightly quicker than the recording
across a stall. That is invisible. A quarter-second freeze is not.

### 5. The canvas is 300x150 for a while after it exists

**Symptom:** the crop is off, or an overlay lands in the wrong cell.

`#game-canvas` is in the DOM at its default 300x150 long before `setupCanvas()`
gives it a size. `locator().waitFor()` resolves in that window, so anything
measured straight afterwards — the crop rectangle, the cell size the hint-area
annotation is positioned from — is computed against the wrong geometry. The
runner waits for `canvas.style.width` to be set instead.

### 6. Cropping wider than the canvas puts a card inside a card

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

### 7. HMR reloads the page mid-take

**Symptom:** `page.evaluate: Execution context was destroyed, most likely because
of a navigation`, part-way through a run that was working.

The runner drives the Vite dev server. Saving any file in the module graph
triggers a reload, which destroys the page under the scene being played. Do not
edit `src/`, `style.css` or `index.html` while a recording is running. Editing
`scripts/` or `docs/` is safe — neither is imported by the app.

### 8. The win sheet covers the board

The last card wins, and the win sheet slides up over the canvas. The clip is the board,
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

**What the runner prints per clip** — `7.5s, 396 frames, 16.6ms median gap,
18.9ms p95`:

- *median gap* — the median interval between captured frames. It should sit near
  16.7ms; under about 20ms means capture is keeping up.
- *p95 gap* — and this is the one that catches a stutter. A hitch lasting a
  handful of frames barely moves the median: at scale 3 the median rose to
  22.3ms while the p95 went to 42.4ms, and it is the p95 that matches what the
  clip looks like. Under about 20ms is healthy.
- *frames* — the count kept after trimming.
- *duration* — clip length, which is ticks ÷ 60 by construction.

Frames-per-second-of-clip is **not** a useful figure: screencast emits nothing
while the page is still, and those stretches legitimately become one held frame.
It also means a scene's trailing `wait` does not lengthen the clip — nothing
paints during it, so the clip ends on the last painted frame. That is the right
behaviour for a player that holds its last frame, but it does mean a scene cannot
buy a pause at the end by waiting; the pause has to come from something that
paints, or from the sheet holding the frame.

**The freeze test** is what catches trap 4, and neither the median nor the p95
will. Decode the finished clip, count consecutive frames identical to their
predecessor, and list the runs:

```
freezes >=3 frames: 0.00s x65  3.65s x25  4.37s x62
```

Every run should be explainable by the scene: the lead-in at the start, a beat
the scene asked for, the hold at the end. A run in the middle of a stroke is a
dropped-frame stall. Before trap 4 was fixed the same clip read
`2.98s x9  3.20s x9  4.02s x8  4.17s x16` — four freezes of 130–270ms, none of
which moved the median gap at all.

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

Hard black lines on a near-white ground are the worst case for codecs designed
for photographs: every edge is a step change, and ringing beside one is visible
in a way it never is in a photo. **The bitrate has to be more generous than the
content's apparent simplicity suggests.** An earlier pass shipped x264 crf 36 /
VP9 crf 50, which measured small and looked mushy in the sheet. The shipping
values are crf 26 and 36.

They are also, now, the only lever on sharpness left: the capture scale is
pinned at 2.5 by the frame rate (trap 3), so quality above that comes from the
encode or nowhere.

**The mp4 is listed first in the sheet, which is the reverse of the usual
order.** On this content x264 generally beats VP9, so listing the mp4 first
hands most browsers the smaller file. The exception is the card with the pulsing
annotation, where the large smooth gradient plays to VP9's strengths and the
webm comes out ahead — worth knowing if the clips ever gain more soft-edged
content, because the ordering would stop being the right default.

The webm is not dead weight, and dropping it was tried and reverted. **A
Chromium built without proprietary codecs cannot decode H.264 at all** —
Playwright's bundled Chromium is one, and so are some Linux distribution builds.
On an mp4-only set they get `DEMUXER_ERROR_NO_SUPPORTED_STREAMS` and a poster
that never moves.

The poster is the clip's first frame. It stands in for the clip before it plays
and again after it ends, so it has to match what pressing replay starts from —
which is why the runner holds every scene on a settled board for `LEAD_IN_MS`
before anything moves.

The whole set is 2.0MB — four clips in two formats and four posters, in two
themes. A player who opens the tutorial and swipes through it in one theme
fetches about 465KB of that, because only the visible clip and the next one are
ever loaded.

---

## Pacing

The constants at the top of `scripts/record-tutorial.mjs` decide whether a clip
can be followed rather than merely watched:

- `STEPS_PER_CELL` — pointer samples per cell, and the only thing that sets a
  stroke's speed, because each sample costs a frame (trap 2). 16 gives one
  sample per 60Hz tick and ~260ms per cell — deliberately slow. Loopy's whole
  input is one continuous drag; a stroke that crosses the grid in half a second
  reads as a line appearing rather than as someone drawing it, and the drawing
  is the point. It also keeps the recorded path identical to the scene's cell
  list, since the game's own Bresenham never has to bridge more than a fraction
  of a cell.
- `CURSOR_FADE_MS` — how long the cursor takes to disappear, and the beat the
  runner waits after asking it to before doing anything else.
- `LEAD_IN_MS` — every clip holds on its opening board before anything moves. The
  runner applies this at the `start` mark rather than each scene writing its own,
  so no scene can be recorded without one. It is also what makes the poster
  readable.
- `BETWEEN_TAPS_MS` — held after a tap resolves, so the gap it leaves has a beat
  to register before the next thing happens.
- `TAP_TIMING` — how the cursor travels and presses.
