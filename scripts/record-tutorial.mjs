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
import { mkdir, rm, writeFile } from 'node:fs/promises';
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
 * A frame-rate setting, not a resolution one. Forced at launch rather than set
 * on the context — screencast ignores the latter and keeps returning CSS-pixel
 * frames. 2.5 gives a 1000px clip from a 400px canvas, which is 3x the ~330px
 * the sheet renders it at. See the doc before raising it.
 */
const DEVICE_SCALE = 2.5;
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

const CELL_MS = 260;
const STROKE_SETTLE_MS = 420;
const LEAD_IN_MS = 900;

/** Held after a tap resolves, so the gap it leaves has a beat to register */
const BETWEEN_TAPS_MS = 700;
const TAP_TIMING = { approach: 420, hold: 120, settle: 220 };

/** Pointer samples per cell. Enough that the game's Bresenham never has to
 *  interpolate a jump of more than a fraction of a cell. */
const STEPS_PER_CELL = 8;

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
         leaving them in puts a card inside a card. */
      #play-view .game-container .canvas-container canvas {
        border-radius: 0 !important;
        box-shadow: none !important;
        /* The canvas fades in over 300ms on load. Capture starts after that,
           but the transition also fires on a theme change, so pin it. */
        opacity: 1 !important;
        transition: none !important;
      }
      /* The win sheet slides up over the canvas on card 5. The clip is the
         board, not the app chrome around it, and the sheet would cover the
         green loop that card exists to show. */
      .bottom-sheet-overlay { display: none !important; }

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
 * `transition` is only ever set for a tap's approach. During a stroke the
 * cursor is placed on every pointer sample, and a transition would leave it
 * lagging behind the line it is supposed to be drawing.
 */
async function placeCursor(page, x, y, { show = true, transition = null, scale = 1 } = {}) {
  await page.evaluate(
    ({ x, y, show, transition, scale }) => {
      const cursor = document.getElementById('capture-cursor');
      cursor.style.transition = transition ?? 'none';
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      cursor.style.opacity = show ? '1' : '0';
    },
    { x, y, show, transition, scale }
  );
}

async function ripple(page, x, y) {
  await page.evaluate(
    ({ x, y }) => {
      const el = document.getElementById('capture-ripple');
      el.style.setProperty('--x', `${x}px`);
      el.style.setProperty('--y', `${y}px`);
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'capture-ripple 520ms ease-out';
    },
    { x, y }
  );
}

/** One pointer gesture through a run of cells, cursor tracking the pointer */
async function drawStroke(page, centre, cells) {
  const first = centre(...cells[0]);

  // Fade in below the first cell and travel to it, so the stroke starts from
  // an approach rather than from a disc materialising mid-grid
  await placeCursor(page, first.x, first.y + 56, { show: false });
  await page.waitForTimeout(40);
  await placeCursor(page, first.x, first.y, {
    transition: 'transform 320ms cubic-bezier(.33,.9,.35,1), opacity 200ms linear',
  });
  await page.waitForTimeout(360);

  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  await page.waitForTimeout(120);

  let from = first;
  for (const [row, col] of cells.slice(1)) {
    const to = centre(row, col);
    for (let step = 1; step <= STEPS_PER_CELL; step += 1) {
      const t = step / STEPS_PER_CELL;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      await page.mouse.move(x, y);
      await placeCursor(page, x, y);
      await page.waitForTimeout(CELL_MS / STEPS_PER_CELL);
    }
    from = to;
  }

  await page.mouse.up();
  await page.waitForTimeout(STROKE_SETTLE_MS);
  await placeCursor(page, from.x, from.y, {
    show: false,
    transition: 'opacity 260ms linear',
  });
}

/** Press and release on one cell without moving, which erases it */
async function tapCell(page, centre, row, col) {
  const { x, y } = centre(row, col);

  await placeCursor(page, x, y + 56, { show: false });
  await page.waitForTimeout(40);
  await placeCursor(page, x, y, {
    transition: 'transform 380ms cubic-bezier(.33,.9,.35,1), opacity 200ms linear',
  });
  await page.waitForTimeout(TAP_TIMING.approach);

  await placeCursor(page, x, y, { transition: 'transform 110ms ease-out', scale: 0.8 });
  await ripple(page, x, y);
  await page.waitForTimeout(TAP_TIMING.hold);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(TAP_TIMING.settle);

  await placeCursor(page, x, y, {
    show: false,
    transition: 'transform 380ms cubic-bezier(.33,.9,.35,1), opacity 260ms linear',
  });
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
  await page.locator('#game-canvas').waitFor();
  await applyCursorTheme(page, theme);
  // Let the canvas finish its fade-in and the first hint pulse settle
  await page.waitForTimeout(1200);

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

  // Each frame is listed once per 60Hz tick it occupies, rather than once with
  // a `duration` directive — the demuxer rounds those up to its 25fps default
  // and silently resamples a 60fps capture to 25. Gaps are snapped to whole
  // ticks first, since the page only paints on vsync and the spread in the
  // timestamps is capture jitter, not content. See the doc.
  const TICK = 1 / FPS;
  const lines = [];
  for (const [index, frame] of clip.entries()) {
    const name = `f${String(index).padStart(5, '0')}.jpg`;
    await writeFile(path.join(dir, name), Buffer.from(frame.data, 'base64'));
    const next = clip[index + 1];
    // The final frame has no successor to measure against; give it one tick.
    const measured = next ? next.pageTime - frame.pageTime : TICK;
    const ticks = Math.max(1, Math.round(measured / TICK));
    for (let tick = 0; tick < ticks; tick += 1) lines.push(`file '${name}'`);
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

  // Loopy's clips are flat colour and a few thin lines on a near-uniform ground,
  // so both codecs go far looser than they could on photographic content before
  // anything shows. Swept against the win clip, which is the busiest: VP9 44 and
  // 52 were indistinguishable at 3x magnification, and h.264 only started ringing
  // beside a curve at 38. These sit a step inside those.
  //
  // On this content x264 wins outright — the webm is 8-30% larger on every clip —
  // which is why the sheet lists the mp4 first and this one second. The webm is
  // not dead weight: a Chromium built without proprietary codecs cannot decode
  // h.264 at all, and is exactly what falls through to it.
  await ffmpeg([
    '-i', master, '-c:v', 'libx264', '-crf', '36', '-preset', 'slow',
    '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-an', `${base}.mp4`,
  ]);

  await ffmpeg([
    '-i', master, '-c:v', 'libvpx-vp9', '-crf', '50', '-b:v', '0',
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

  return { duration, frames: clip.length, medianGap };
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
      const capture = await record(browser, scene, theme);
      const { duration, frames, medianGap } = await encode(capture, scene, theme);
      console.log(`${duration.toFixed(1)}s, ${frames} frames, ${medianGap.toFixed(1)}ms median gap`);
    }
  }
} finally {
  await browser.close();
}

console.log(`\nWrote ${scenes.length * THEMES.length} clips to ${path.relative(ROOT, OUT_DIR)}`);
