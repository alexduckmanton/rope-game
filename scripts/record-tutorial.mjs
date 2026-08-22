/**
 * Records the How to play tutorial videos by playing the real game.
 *
 *   npm run record:tutorial            # every scene, both themes
 *   npm run record:tutorial -- 3 4     # just scenes 3 and 4
 *
 * Needs the dev server running (`npm run dev`); pass BASE_URL to point
 * somewhere else. Scenes live in `tutorial-scenes.mjs`, and the boards they run
 * on are built by `lib/tutorial-boards.mjs` from the game's own generator.
 *
 * Read `docs/recording-tutorial-videos.md` before changing the capture or the
 * encode. Several things here look like free wins and are not: the scale factor
 * is a frame-rate setting, the concat demuxer silently resamples to 25fps, and
 * cropping anything wider than the canvas puts the app's own card back inside
 * the sheet's card. That document has the measurements, the failure signatures,
 * and how to prove a run came out right. The comments below say which line is
 * load-bearing; it explains why.
 */

import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES } from './tutorial-scenes.mjs';
import { buildBoard, plantedSave, GRID_SIZE } from './lib/tutorial-boards.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public/videos');
const WORK_DIR = path.join(ROOT, '.tutorial-capture');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

/**
 * Just big enough that the canvas reaches its full size. `calculateCellSize()`
 * clamps a cell to CONFIG.CELL_SIZE_MAX (100px), so a 4x4 tops out at 400px
 * once the viewport clears 440 wide and 500 tall. Every pixel above that is one
 * the browser JPEG-encodes 60 times a second and the crop then throws away.
 */
const VIEWPORT = { width: 440, height: 560 };
/**
 * A frame-rate setting, not a resolution one, and 2 is the ceiling.
 *
 * The browser JPEG-encodes every screencast frame on the renderer, and that
 * work competes with the game's own canvas render for the same frame budget.
 * Neither is expensive alone — which is why every cheaper way of measuring this
 * says there is headroom, and every one of them is wrong:
 *
 *   game page, no screencast, scale 2.5   60.3fps, 0 frames over 30ms
 *   blank page, screencast, scale 2.5     60.5fps
 *   game page, screencast, scale 2.5      53.3fps, 22 frames over 30ms
 *   game page, screencast, scale 2.25     59.3fps, 3 frames over 30ms
 *   **game page, screencast, scale 2**    **60.4fps, 0 frames over 30ms**
 *
 * Measured as the page's own rAF cadence while a stroke is being drawn, which
 * is the only condition that reproduces it: an idle board is fine at 3.5.
 *
 * The dropped frames are what "stuttering" looks like — they land as 150-350ms
 * freezes in the encoded clip, one per cell towards the end of a long stroke,
 * because a longer path costs more to render and pushes the pair over budget.
 *
 * So the clip is 800px from a 400px canvas, and any more sharpness has to come
 * from the bitrate. Forced at launch rather than set on the context —
 * screencast ignores the latter and keeps returning CSS-pixel frames. The env
 * override exists so the table above can be reproduced, not so the value can
 * be raised.
 */
const DEVICE_SCALE = Number(process.env.DEVICE_SCALE ?? 2);
const FPS = 60;

const THEMES = ['light', 'dark'];

/* ============================================================================
 * PACING
 *
 * These decide whether a clip can be followed rather than merely watched.
 *
 * CELL_MS is deliberately slow. Loopy's whole input is one continuous drag, and
 * a stroke that crosses the grid in half a second reads as a line appearing
 * rather than as someone drawing it — and the drawing is the point.
 *
 * LEAD_IN_MS holds every clip on its opening board before anything moves, so
 * the viewer knows what they are looking at before it changes. The runner
 * applies it at the `start` mark rather than each scene writing its own, so no
 * scene can be recorded without one. It is also what makes the poster — always
 * the first frame — a readable starting position.
 * ========================================================================= */

/**
 * Pointer samples per cell, and the only thing that sets a stroke's speed.
 *
 * `page.mouse.move` costs about 16.3ms on its own — it is bound to a frame —
 * so back-to-back moves land one per 60Hz tick and 16 of them take ~260ms.
 * **Do not sleep between them.** An earlier version paced the stroke with a
 * timeout on top of that cost and got 8 samples per cell at a 50ms gap: the
 * path advanced 20 times a second, which is exactly what "laggy" looked like.
 */
const STEPS_PER_CELL = 16;

const STROKE_SETTLE_MS = 420;
const LEAD_IN_MS = 900;

/**
 * How long the cursor takes to fade out, and the beat the runner then waits
 * before it will record a trim mark. A clip that starts while the previous
 * scene's cursor is still fading opens on a ghost.
 */
const CURSOR_FADE_MS = 260;

/** Held after a tap resolves, so the gap it leaves has a beat to register */
const BETWEEN_TAPS_MS = 700;
const TAP_TIMING = { approach: 340, hold: 130, settle: 220 };

// --- page setup ------------------------------------------------------------

/**
 * Runs before any page script.
 *
 * Loopy has no capture-only route, and does not need one: an unlimited-mode
 * save carries its own solution path and hint cells, so planting one pins the
 * puzzle exactly. Settings are planted too — every clip has to show the
 * defaults, and a stale `loop-game:settings` from a previous run would not.
 */
function initScript({ save, settings }) {
  try {
    localStorage.clear();
    localStorage.setItem(save.key, save.value);
    localStorage.setItem('loop-game:settings', settings);
    // Every clip is one puzzle; nothing should carry over between them
    localStorage.setItem('loop-game:tutorial-completed', 'true');
  } catch {
    /* storage disabled; the run will fail its expect assertions and say so */
  }

  const install = () => {
    const style = document.createElement('style');
    style.textContent = `
      /* The canvas is the crop. Its own rounding and shadow belong to the app's
         layout, not to a clip that will sit inside the sheet's rounded box —
         leaving them in puts a card inside a card.

         The background moves to the container so the hint-area annotation can
         sit behind the canvas: clearCanvas() uses clearRect, so the canvas is
         genuinely transparent and the white is CSS. */
      #play-view .game-container .canvas-container {
        background-color: var(--color-bg-elevated);
      }
      #play-view .game-container .canvas-container canvas {
        border-radius: 0 !important;
        box-shadow: none !important;
        background-color: transparent !important;
        /* The canvas fades in over 300ms on load. Capture starts after that,
           but the transition also fires on a theme change, so pin it. */
        opacity: 1 !important;
        transition: none !important;
      }
      /* The win sheet slides up over the canvas on the last card. The clip is
         the board, not the app chrome around it, and the sheet would cover the
         green loop that card exists to show. */
      .bottom-sheet-overlay { display: none !important; }

      /* The 3x3 area a number watches. Nothing in the shipped game draws this —
         renderHintPulse() in renderer.js does exactly it and has no callers — so
         this is a tutorial annotation, matched to what that function would have
         drawn: the solution-path blue, 20% at the peak, on a 2s cycle. It sits
         under the canvas rather than over it, so grid lines, numbers and path
         all stay on top, which is where renderHintPulse() put them. */
      #capture-hint-area {
        position: absolute;
        z-index: 1;
        pointer-events: none;
        background-color: var(--color-solution-path);
        animation: capture-hint-pulse 2s ease-in-out infinite;
      }
      @keyframes capture-hint-pulse {
        0%, 100% { opacity: 0; }
        50% { opacity: .2; }
      }

      /* Hides a hint number without removing the hint. Sits above the canvas
         and takes the canvas's own colour, so the cell reads as empty. */
      .capture-mask {
        position: absolute;
        z-index: 3;
        pointer-events: none;
        background-color: var(--color-bg-elevated);
      }

      /* A fingertip, not a UI badge: a translucent disc under half a cell, its
         ring carrying most of the weight. A denser fill reads as a control
         sitting on the board and competes with the line it is drawing — which
         is the thing the viewer is meant to be watching. */
      #capture-cursor, #capture-ripple {
        position: fixed; top: 0; left: 0; width: 46px; height: 46px;
        margin: -23px 0 0 -23px; border-radius: 50%;
        opacity: 0; pointer-events: none;
        transform: translate3d(-200px, -200px, 0) scale(1);
      }
      #capture-cursor {
        z-index: 2147483647;
        border: 2.5px solid var(--capture-cursor-edge);
        background: var(--capture-cursor-fill);
        box-shadow: 0 2px 10px var(--capture-cursor-shadow);
        transition: opacity 260ms linear;
      }
      #capture-ripple {
        z-index: 2147483646;
        border: 2.5px solid var(--capture-cursor-edge);
      }
      @keyframes capture-ripple {
        from { opacity: .8; transform: translate3d(var(--x), var(--y), 0) scale(.6); }
        to   { opacity: 0;  transform: translate3d(var(--x), var(--y), 0) scale(2.3); }
      }
    `;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = 'capture-cursor';
    const ripple = document.createElement('div');
    ripple.id = 'capture-ripple';
    document.body.append(ripple, cursor);

    /**
     * The cursor tracks the real pointer, in the page.
     *
     * The runner used to place it with a `page.evaluate` per sample, which
     * doubled the CDP traffic on the hot path for no benefit — the pointer is
     * already moving, and following it here costs nothing and can never lag
     * behind the line being drawn.
     */
    let scale = 1;
    let x = -200;
    let y = -200;
    const paint = () => {
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    };
    window.addEventListener(
      'pointermove',
      (event) => {
        x = event.clientX;
        y = event.clientY;
        paint();
      },
      true
    );

    window.__capture = {
      show: (visible) => {
        cursor.style.opacity = visible ? '1' : '0';
      },
      /** Snap out of sight with no transition, for a clean trim point */
      hide: () => {
        cursor.style.transition = 'none';
        cursor.style.opacity = '0';
        void cursor.offsetWidth;
        cursor.style.transition = 'opacity 260ms linear';
      },
      press: (pressed) => {
        scale = pressed ? 0.8 : 1;
        cursor.style.transition = pressed
          ? 'transform 110ms ease-out, opacity 260ms linear'
          : 'transform 260ms cubic-bezier(.33,.9,.35,1), opacity 260ms linear';
        paint();
        if (!pressed) return;
        ripple.style.setProperty('--x', `${x}px`);
        ripple.style.setProperty('--y', `${y}px`);
        ripple.style.animation = 'none';
        void ripple.offsetWidth;
        ripple.style.animation = 'capture-ripple 520ms ease-out';
      },
      /**
       * Cover cells so their hint numbers do not show.
       *
       * Cards 1 and 2 are about the gesture, and a number nobody has explained
       * yet is a distraction on them. The board still *has* its hints — that is
       * what keeps a closed loop black rather than turning it green, since a
       * board with no hints is one where every constraint is trivially
       * satisfied — they are just not painted.
       *
       * Inset by a couple of pixels so the cell's own grid lines survive, and
       * only ever used on cells the scene's strokes never enter.
       */
      mask: ({ cells, gridSize }) => {
        const canvas = document.getElementById('game-canvas');
        const container = canvas.parentElement;
        const cell = canvas.getBoundingClientRect().width / gridSize;
        for (const [row, col] of cells) {
          const cover = document.createElement('div');
          cover.className = 'capture-mask';
          cover.style.left = `${col * cell + 2}px`;
          cover.style.top = `${row * cell + 2}px`;
          cover.style.width = `${cell - 4}px`;
          cover.style.height = `${cell - 4}px`;
          container.appendChild(cover);
        }
      },
      /** Draw the 3x3 area a hint watches, behind the canvas */
      highlight: ({ row, col, gridSize }) => {
        const canvas = document.getElementById('game-canvas');
        const container = canvas.parentElement;
        const cell = canvas.getBoundingClientRect().width / gridSize;
        const minRow = Math.max(0, row - 1);
        const minCol = Math.max(0, col - 1);
        const rows = Math.min(gridSize - 1, row + 1) - minRow + 1;
        const cols = Math.min(gridSize - 1, col + 1) - minCol + 1;

        const area = document.createElement('div');
        area.id = 'capture-hint-area';
        area.style.left = `${minCol * cell}px`;
        area.style.top = `${minRow * cell}px`;
        area.style.width = `${cols * cell}px`;
        area.style.height = `${rows * cell}px`;
        container.appendChild(area);
      },
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
}

/** Cursor ink that reads against whichever theme is being recorded */
async function applyCursorTheme(page, theme) {
  await page.evaluate((isDark) => {
    const root = document.documentElement;
    root.style.setProperty('--capture-cursor-fill', isDark ? 'rgba(255,255,255,.2)' : 'rgba(28,28,30,.14)');
    root.style.setProperty('--capture-cursor-edge', isDark ? 'rgba(255,255,255,.72)' : 'rgba(28,28,30,.5)');
    root.style.setProperty('--capture-cursor-shadow', isDark ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.2)');
  }, theme === 'dark');
}

// --- scene playback --------------------------------------------------------

/** Viewport coordinates of a cell's centre, from the canvas's own geometry */
async function cellCentres(page) {
  const box = await page.locator('#game-canvas').boundingBox();
  if (!box) throw new Error('canvas not found');
  const cell = box.width / GRID_SIZE;
  return (row, col) => ({
    x: box.x + (col + 0.5) * cell,
    y: box.y + (row + 0.5) * cell,
  });
}

/**
 * Move the real pointer along a line, one sample per frame.
 *
 * No sleep: `page.mouse.move` already costs about a frame, so back-to-back
 * calls land at 60Hz. Adding a timeout on top is what made an earlier version
 * advance the path 20 times a second. See STEPS_PER_CELL.
 */
async function glide(page, from, to, steps) {
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
  }
}

const capture = (page, method, arg) =>
  page.evaluate(([name, value]) => window.__capture[name](value), [method, arg]);

/** Bring the cursor in from below the target, so it reads as an approach */
async function approach(page, target) {
  await page.mouse.move(target.x, target.y + 56);
  await capture(page, 'show', true);
  await glide(page, { x: target.x, y: target.y + 56 }, target, 10);
}

/** Fade the cursor out and wait for the fade to finish painting */
async function withdraw(page) {
  await capture(page, 'show', false);
  await page.waitForTimeout(CURSOR_FADE_MS + 60);
}

/** One pointer gesture through a run of cells */
async function drawStroke(page, centre, cells) {
  const first = centre(...cells[0]);

  await approach(page, first);
  await page.mouse.down();
  await page.waitForTimeout(120);

  let from = first;
  for (const [row, col] of cells.slice(1)) {
    const to = centre(row, col);
    await glide(page, from, to, STEPS_PER_CELL);
    from = to;
  }

  await page.mouse.up();
  await page.waitForTimeout(STROKE_SETTLE_MS);
  await withdraw(page);
}

/** Press and release on one cell without moving, which erases it */
async function tapCell(page, centre, row, col) {
  const target = centre(row, col);

  await approach(page, target);
  await page.waitForTimeout(TAP_TIMING.approach);

  await capture(page, 'press', true);
  await page.waitForTimeout(TAP_TIMING.hold);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(TAP_TIMING.settle);

  await capture(page, 'press', false);
  await withdraw(page);
  await page.waitForTimeout(BETWEEN_TAPS_MS);
}

async function playScene(page, scene, marks) {
  const centre = await cellCentres(page);

  for (const step of scene.steps) {
    switch (step.type) {
      case 'draw':
        await drawStroke(page, centre, step.cells);
        if (step.pauseAfter) await page.waitForTimeout(step.pauseAfter);
        break;
      case 'tap':
        await tapCell(page, centre, step.row, step.col);
        break;
      case 'wait':
        await page.waitForTimeout(step.ms);
        break;
      case 'mark':
        // Snap the cursor out of sight before the timestamp, never fade it.
        // A scene whose setup ends in a gesture would otherwise be trimmed
        // mid-fade, and the clip would open on the previous card's cursor
        // dissolving in a corner.
        await capture(page, 'hide');
        await page.waitForTimeout(120);
        marks.set(step.name, Date.now());
        // Every clip opens on a still board for the same beat
        if (step.name === scene.trim.from) await page.waitForTimeout(LEAD_IN_MS);
        break;
      default:
        throw new Error(`unknown step type: ${step.type}`);
    }
  }
}

// --- capture ---------------------------------------------------------------

/**
 * The settings every clip is recorded under: the shipped defaults.
 *
 * Written explicitly rather than left to `loadSettings()` so a clip can never
 * quietly demonstrate a non-default setting, and so changing a default is a
 * visible diff here rather than a silent change to every video.
 */
const CAPTURE_SETTINGS = JSON.stringify({
  hintMode: 'partial',
  borderMode: 'off',
  countdown: 'on',
  lastUnlimitedDifficulty: 'easy',
});

async function record(browser, scene, theme) {
  const board = buildBoard(scene.seed);

  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: theme,
    reducedMotion: 'no-preference',
  });

  // Analytics from a recording run is noise in a real project's data. The
  // capture events would be dropped anyway — PostHog discards anything from a
  // browser reporting navigator.webdriver — but not sending them is cheaper
  // and does not depend on that staying true.
  await context.route('**://*.i.posthog.com/**', (route) => route.abort());
  await context.route('**://*.posthog.com/**', (route) => route.abort());

  const page = await context.newPage();
  await page.addInitScript(initScript, {
    save: plantedSave(board),
    settings: CAPTURE_SETTINGS,
  });

  // Aborting the analytics requests above makes the page log its own failure to
  // reach them, which is expected rather than a fault in the build being recorded
  const expectedNoise = /posthog/i;
  const consoleErrors = [];
  const note = (text) => {
    if (!expectedNoise.test(text) && !text.includes('ERR_FAILED')) consoleErrors.push(text);
  };
  page.on('console', (m) => m.type() === 'error' && note(m.text()));
  page.on('pageerror', (e) => note(String(e)));

  await page.goto(`${BASE_URL}/play?difficulty=unlimited`);
  // Not just `waitFor()`: the element exists at its 300x150 default long before
  // `setupCanvas()` sizes it, and anything measured in that window — the cell
  // size the highlight is positioned from, the crop — comes out wrong.
  await page.waitForFunction(() => {
    const canvas = document.getElementById('game-canvas');
    return canvas && canvas.style.width !== '';
  });
  await applyCursorTheme(page, theme);
  // Let the canvas finish its fade-in before capture starts
  await page.waitForTimeout(1200);

  if (scene.highlight) {
    await page.evaluate(
      (area) => window.__capture.highlight(area),
      { ...scene.highlight, gridSize: GRID_SIZE }
    );
  }
  if (scene.maskCells) {
    await page.evaluate(
      (spec) => window.__capture.mask(spec),
      { cells: scene.maskCells, gridSize: GRID_SIZE }
    );
  }

  const crop = await page.evaluate((scale) => {
    const { x, y, width, height } = document.getElementById('game-canvas').getBoundingClientRect();
    return {
      x: Math.round(x * scale),
      y: Math.round(y * scale),
      w: Math.round(width * scale),
      h: Math.round(height * scale),
    };
  }, DEVICE_SCALE);

  // Frames arrive only when the page paints; each is stamped so still moments
  // can be reconstructed as a held frame at encode time.
  const frames = [];
  const cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
    frames.push({ wall: Date.now(), pageTime: metadata.timestamp, data });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    // Below the final VP9/H.264 pass's own loss, and cheaper to produce — the
    // browser has to encode one of these every 16ms without missing a paint.
    quality: 85,
    everyNthFrame: 1,
    maxWidth: VIEWPORT.width * DEVICE_SCALE,
    maxHeight: VIEWPORT.height * DEVICE_SCALE,
  });

  const marks = new Map();
  await playScene(page, scene, marks);
  await page.waitForTimeout(250);

  await cdp.send('Page.stopScreencast').catch(() => {});

  // The only game state the page exposes. `won` is the assertion that matters:
  // it is the whole difference between cards 4 and 5, and a scene that stopped
  // working would otherwise record a plausible-looking wrong clip.
  const outcome = await page.evaluate(() => ({
    won: document.querySelector('.bottom-sheet-overlay.visible') !== null,
  }));

  await context.close();

  if (consoleErrors.length) {
    console.warn(`  ! console errors in scene ${scene.id} (${theme}):`, consoleErrors.slice(0, 3));
  }
  if (scene.expect && scene.expect.won !== outcome.won) {
    throw new Error(
      `scene ${scene.id} (${theme}): expected won=${scene.expect.won}, game says ${outcome.won}`
    );
  }
  if (frames.length < 10) {
    throw new Error(`scene ${scene.id} (${theme}): only ${frames.length} frames captured`);
  }

  return { frames, crop, marks };
}

// --- encoding --------------------------------------------------------------

/**
 * How long a frame may be held when the picture is moving.
 *
 * Two ticks is 33ms — a dropped frame, not a freeze. Anything longer only
 * happens because screencast stalled, and holding for it is what reads as
 * stuttering.
 */
const MAX_STALL_TICKS = 2;

async function ffmpeg(args) {
  try {
    await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      maxBuffer: 1 << 26,
    });
  } catch (error) {
    throw new Error(`ffmpeg failed:\n${error.stderr || error.message}`);
  }
}

/**
 * Which frames differ from the one before them
 *
 * Decodes the whole clip to 32x32 greyscale in one ffmpeg pass — far cheaper
 * than a JPEG decoder in Node, and 1KB per frame is plenty to tell "the board
 * moved" from "nothing at all happened".
 *
 * @param {string} dir - Working directory holding the frame jpegs
 * @param {Array<string>} names - Frame filenames in order
 * @returns {Promise<Array<boolean>>} True where the frame after this one differs
 */
async function frameMotion(dir, names) {
  const SIZE = 32;
  const listPath = path.join(dir, 'motion.txt');
  await writeFile(listPath, names.map((name) => `file '${name}'`).join('\n'));
  const rawPath = path.join(dir, 'motion.gray');
  await ffmpeg([
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-vf', `scale=${SIZE}:${SIZE},format=gray`, '-fps_mode', 'passthrough',
    '-f', 'rawvideo', rawPath,
  ]);

  const raw = await readFile(rawPath);
  const stride = SIZE * SIZE;
  const moved = new Array(names.length).fill(false);
  for (let i = 1; i < names.length; i += 1) {
    let delta = 0;
    for (let p = 0; p < stride; p += 1) {
      delta += Math.abs(raw[i * stride + p] - raw[(i - 1) * stride + p]);
    }
    // Averaged over the frame; JPEG noise alone sits well under one level
    moved[i - 1] = delta / stride > 0.6;
  }
  return moved;
}

/**
 * Writes the frames between the scene's marks as a concat playlist, then
 * crops, normalises, and encodes the three assets the sheet loads.
 */
async function encode({ frames, crop, marks }, scene, theme) {
  const from = marks.get(scene.trim.from);
  const to = marks.get(scene.trim.to);
  if (!from || !to || to <= from) {
    throw new Error(`scene ${scene.id}: bad trim marks (${scene.trim.from} -> ${scene.trim.to})`);
  }

  // Start on the last frame painted at or before the mark, so the clip opens on
  // a settled board rather than part-way through the next repaint.
  let first = frames.findIndex((f) => f.wall >= from);
  first = Math.max(0, first === -1 ? frames.length - 1 : first - 1);
  let last = frames.findIndex((f) => f.wall >= to);
  if (last === -1) last = frames.length - 1;
  const clip = frames.slice(first, last + 1);
  if (clip.length < 2) throw new Error(`scene ${scene.id}: trim selected ${clip.length} frames`);

  const dir = path.join(WORK_DIR, `${scene.id}-${theme}`);
  await mkdir(dir, { recursive: true });

  // Write every kept frame, then work out how long each should be held.
  const names = [];
  for (const [index, frame] of clip.entries()) {
    const name = `f${String(index).padStart(5, '0')}.jpg`;
    await writeFile(path.join(dir, name), Buffer.from(frame.data, 'base64'));
    names.push(name);
  }

  // Which consecutive frames actually differ. See the note below on why a gap
  // in the capture cannot be trusted on its own.
  const moved = await frameMotion(dir, names);

  // Each frame is listed once per 60Hz tick it occupies, rather than once with
  // a `duration` directive — the demuxer rounds those up to its 25fps default
  // and silently resamples a 60fps capture to 25. Gaps are snapped to whole
  // ticks first, since the page only paints on vsync and the spread in the
  // timestamps is capture jitter, not content. See the doc.
  //
  // A long gap means one of two completely different things, and getting them
  // confused is what a stutter is:
  //
  //   the page was still     — a lead-in, a beat between taps. Screencast sends
  //                            nothing while nothing changes, so the gap is real
  //                            and the frame should be held for all of it.
  //   screencast stalled     — it stops delivering for 150-270ms at a time even
  //                            while the page paints a clean 60fps. Holding a
  //                            frame for that is a freeze in the middle of a
  //                            movement.
  //
  // Timing alone cannot tell them apart; the pixels can. If the frames either
  // side of a gap are identical the page was still, so the gap is honoured. If
  // they differ, motion was lost and no reconstruction can bring it back — so
  // the frame is held for as little as possible and the clip runs very slightly
  // fast across the stall instead of freezing.
  const TICK = 1 / FPS;
  const lines = [];
  for (const [index, frame] of clip.entries()) {
    const next = clip[index + 1];
    // The final frame has no successor to measure against; give it one tick.
    const measured = next ? next.pageTime - frame.pageTime : TICK;
    const ticks = Math.max(1, Math.round(measured / TICK));
    const held = moved[index] ? Math.min(ticks, MAX_STALL_TICKS) : ticks;
    for (let tick = 0; tick < held; tick += 1) lines.push(`file '${names[index]}'`);
  }
  const listPath = path.join(dir, 'frames.txt');
  await writeFile(listPath, lines.join('\n'));

  const filter = [
    // Even dimensions, because yuv420p subsamples chroma by two
    `crop=${crop.w - (crop.w % 2)}:${crop.h - (crop.h % 2)}:${crop.x}:${crop.y}`,
    'setsar=1',
    `fps=${FPS}`,
  ].join(',');

  const base = path.join(OUT_DIR, `${scene.id}-${theme}`);
  const master = path.join(dir, 'master.mkv');

  // One crop+resample pass to a lossless intermediate, so both encodes and the
  // poster come from identical frames.
  await ffmpeg([
    // `-r` before `-i` is what tells the concat demuxer these images are 60fps;
    // without it they decode at its 25fps default no matter what follows.
    '-r', String(FPS), '-f', 'concat', '-safe', '0', '-i', listPath,
    '-vf', filter, '-fps_mode', 'cfr', '-r', String(FPS), '-c:v', 'ffv1', '-an', master,
  ]);

  // Hard black lines on a near-white ground are the worst case for a codec
  // built for photographs: every edge is a step change, and ringing beside one
  // is visible in a way it never is in a photo. These CRFs are much tighter
  // than the content's low bitrate would suggest, and deliberately so — an
  // earlier pass shipped 36/50, which measured small and looked mushy.
  //
  // On this content x264 wins outright — the webm is larger on every clip —
  // which is why the sheet lists the mp4 first and this one second. The webm is
  // not dead weight: a Chromium built without proprietary codecs cannot decode
  // h.264 at all, and is exactly what falls through to it.
  await ffmpeg([
    '-i', master, '-c:v', 'libx264', '-crf', '26', '-preset', 'slow',
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-an', `${base}.mp4`,
  ]);

  await ffmpeg([
    '-i', master, '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0',
    '-row-mt', '1', '-pix_fmt', 'yuv420p', '-an', `${base}.webm`,
  ]);

  // Poster is the first frame: it stands in for the clip before it plays and
  // again after it ends, so it has to match what pressing replay starts from.
  // Every scene opens on a settled board for exactly this reason.
  await ffmpeg(['-i', master, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', `${base}.webp`]);

  const duration = (lines.length || clip.length) / FPS;

  // Health check: the median gap between captured frames should sit near
  // 16.7ms. Frames-per-second-of-clip is not a useful figure here — a still
  // page emits no frames at all, and those become one held frame.
  const gaps = clip
    .slice(1)
    .map((f, i) => (f.pageTime - clip[i].pageTime) * 1000)
    .filter((gap) => gap < 200)
    .sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)] ?? 0;
  // The median hides a stutter that lasts a handful of frames, which is exactly
  // the kind that shows on a loop closing. The 95th percentile does not.
  const p95Gap = gaps[Math.floor(gaps.length * 0.95)] ?? 0;

  return { duration, frames: clip.length, medianGap, p95Gap };
}

// --- main ------------------------------------------------------------------

const wanted = process.argv.slice(2).map(Number).filter(Boolean);
const scenes = wanted.length ? SCENES.filter((s) => wanted.includes(s.id)) : SCENES;

await rm(WORK_DIR, { recursive: true, force: true });
await mkdir(WORK_DIR, { recursive: true });
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [`--force-device-scale-factor=${DEVICE_SCALE}`],
});

try {
  for (const scene of scenes) {
    for (const theme of THEMES) {
      process.stdout.write(`scene ${scene.id} (${scene.name}) ${theme} … `);
      const shot = await record(browser, scene, theme);
      const { duration, frames, medianGap, p95Gap } = await encode(shot, scene, theme);
      console.log(
        `${duration.toFixed(1)}s, ${frames} frames, ` +
        `${medianGap.toFixed(1)}ms median gap, ${p95Gap.toFixed(1)}ms p95`
      );
    }
  }
} finally {
  await browser.close();
}

console.log(`\nWrote ${scenes.length * THEMES.length} clips to ${path.relative(ROOT, OUT_DIR)}`);
