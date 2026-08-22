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
import { buildBoard, plantedSave, replayScene, GRID_SIZE } from './lib/tutorial-boards.mjs';

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
 * Capture scale. 3 gives a 1200px clip from the 400px canvas.
 *
 * **This is a frame-rate setting as much as a resolution one**, and the reason
 * is worth keeping: the browser JPEG-encodes every screencast frame on the
 * renderer, and that work competes with the game's own canvas render for the
 * same frame budget. Neither is expensive alone, so every cheap way of
 * measuring it says there is headroom, and every one of them is wrong:
 *
 *   game page, no screencast, scale 2.5   60.3fps, 0 frames over 30ms
 *   blank page, screencast, scale 2.5     60.5fps
 *   game page, screencast, scale 2.5      53.3fps, 22 frames over 30ms
 *   game page, screencast, scale 2         60.4fps, 0 frames over 30ms
 *
 * Measured as the page's own rAF cadence while a stroke is being drawn, which
 * is the only condition that reproduces it: an idle board is fine at 3.5.
 *
 * Those numbers set the ceiling at 2 while the scene was being played in real
 * time, and 800px from a 400px canvas is soft on any phone above 2x. **Slow
 * motion is what raised the ceiling**, and it does so by exactly the factor it
 * slows by: one 60Hz tick of finished clip is SLOWDOWN ticks of real capture,
 * so the renderer may take three frames over a frame's work and still deliver
 * a new frame for every tick of the output. Measured on scene 1, in real time,
 * under SLOWDOWN 3:
 *
 *   scale   median gap   p95    mid-clip freezes   mp4
 *   2       16.6ms       19.1   4                  45KB
 *   2.5     22.0ms       25.5   1                  62KB
 *   **3**   **32.1ms**   37.0   **1**              97KB
 *
 * A 32ms real gap is 10.7ms of clip, still inside a 16.7ms tick, so scale 3
 * resamples clean — and does *better* than scale 2 did on the freeze count,
 * because there is more captured motion between output frames to choose from.
 * Above 3 the gap crosses the tick and freezes come back.
 *
 * Forced at launch rather than set on the context — screencast ignores the
 * latter and keeps returning CSS-pixel frames.
 */
const DEVICE_SCALE = Number(process.env.DEVICE_SCALE ?? 3);
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
 * Everything is recorded this many times slower than it plays back.
 *
 * Screencast stalls for 150-270ms at a time here whatever it is asked to do
 * (trap 4). Nothing removes the stall, but slowing the scene down shrinks what
 * it costs: three times slower means a 250ms stall spans only ~80ms of finished
 * clip, and three times as many pointer samples land per frame of that clip, so
 * there is far more captured motion to resample from.
 *
 * It is not enough to slow the pointer. Every animation the game runs is driven
 * by `Date.now()`, so the runner slows the page's clock by the same factor and
 * the whole scene — path entry, the number bounce, the win fade — stretches
 * together. The runner's own CSS animations are scaled to match. Speeding the
 * frames back up at encode restores all of it in step.
 *
 * Costs recording time and nothing else: a 9s card takes about 27s to shoot.
 */
const SLOWDOWN = Number(process.env.SLOWDOWN ?? 3);

/**
 * How long the pointer spends crossing one cell, in finished-clip time.
 *
 * The stroke is paced by the clock, not by a sample count, and that is the
 * whole point of the number. `page.mouse.move` is bound to a frame and costs
 * whatever a frame currently costs — about 16ms at capture scale 2, about 48ms
 * at scale 3 — so a stroke built from a fixed number of moves runs at whatever
 * speed the renderer happens to be managing. Raising DEVICE_SCALE from 2 to 3
 * that way stretched scene 1 from 5.6s to 8.3s: same gesture, half again as
 * slow, for a reason nothing in the scene mentions.
 *
 * `glide()` therefore interpolates along the paced track against elapsed real
 * time and emits as many moves as fit. Pacing is then a property of the scene
 * and sample density a property of the machine, which is the right way round.
 *
 * **Do not sleep between the moves.** An earlier version paced the stroke with
 * a timeout on top of the move's own cost and got 8 samples per cell at a 50ms
 * gap: the path advanced 20 times a second, which is exactly what "laggy"
 * looked like. Slow motion is what buys the density now — three times the real
 * time per tick of clip means three times the samples land in it.
 */
const CELL_MS = 260;

/** Pointer samples the paced track is resolved at. Only ever read from. */
const TRACK_SAMPLES = 1200;

/** How long the cursor takes to travel in from below its first cell */
const APPROACH_MS = 170;

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

/* ============================================================================
 * CURSOR CHARACTER
 *
 * A pointer that runs cell centre to cell centre at a constant speed, turning
 * ninety degrees on the spot, reads as a machine — and it is drawing a line the
 * game renders with rounded corners, so it does not even match its own output.
 * Three things fix that, and none of them may move the path off its cells:
 * the game snaps pointer positions to cells, so the cursor is free inside a
 * cell and not across its edges.
 *
 * All of it is deterministic. The jitter comes from a PRNG seeded on the scene,
 * never Math.random, because a pipeline whose output changes between identical
 * runs is not one you can trust a re-record to.
 * ========================================================================= */

/**
 * Corner radius, as a fraction of a cell.
 *
 * The game draws the path itself with `cellSize * 0.35` corners, so this is
 * close to matching what the cursor leaves behind. Rounding cuts towards the
 * inside of the turn: at 0.3 the arc's closest approach to the diagonal
 * neighbour is about 0.21 of a cell, comfortably inside the two cells the turn
 * belongs to. Raising it much further starts to risk clipping a third cell,
 * which the drawn-path assertion at the end of every scene would catch.
 */
const CORNER_RADIUS = 0.3;

/** Speed through a corner, relative to a straight. Hands slow into turns. */
const CORNER_SPEED = 0.55;

/** How far a waypoint may drift off the cell centre, as a fraction of a cell */
const WAYPOINT_DRIFT = 0.07;

/** Deterministic PRNG — the same one the game seeds its puzzles with */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- page setup ------------------------------------------------------------

/**
 * Runs before any page script.
 *
 * Loopy has no capture-only route, and does not need one: an unlimited-mode
 * save carries its own solution path and hint cells, so planting one pins the
 * puzzle exactly. Settings are planted too — every clip has to show the
 * defaults, and a stale `loop-game:settings` from a previous run would not.
 */
function initScript({ save, settings, slowdown }) {
  /**
   * Slow the page's clock.
   *
   * Every animation the game runs reads `Date.now()` — the path entry, the
   * number bounce, the win fade — so scaling it here stretches all of them by
   * exactly the factor the pointer is stretched by, and speeding the frames up
   * at encode puts them all back in step. Installed before any page script, so
   * the game never sees the real clock.
   *
   * `performance.now()` is deliberately left alone: nothing in the game reads
   * it, and Playwright's own machinery does.
   */
  const epoch = Date.now();
  const realNow = Date.now.bind(Date);
  Date.now = () => Math.round(epoch + (realNow() - epoch) / slowdown);

  try {
    localStorage.clear();
    localStorage.setItem(save.key, save.value);
    localStorage.setItem('loop-game:settings', settings);
    // Every clip is one puzzle; nothing should carry over between them
    localStorage.setItem('loop-game:tutorial-completed', 'true');
  } catch {
    /* storage disabled; the run will fail its expect assertions and say so */
  }

  // The runner's own animations are CSS, driven by the compositor rather than
  // by Date.now(), so they have to be stretched by hand to stay in step.
  const ms = (base) => `${base * slowdown}ms`;

  const install = () => {
    const style = document.createElement('style');
    style.textContent = `
      /* The canvas is the crop. Its own rounding and shadow belong to the app's
         layout, not to a clip that will sit inside the sheet's rounded box —
         leaving them in puts a card inside a card.

         The background sits on the container rather than the canvas, so the
         clip's ground does not depend on how the canvas clears itself:
         clearCanvas() uses clearRect, which leaves it genuinely transparent. */
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
        transition: opacity ${ms(260)} linear;
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
        cursor.style.transition = `opacity ${ms(260)} linear`;
      },
      press: (pressed) => {
        scale = pressed ? 0.8 : 1;
        cursor.style.transition = pressed
          ? `transform ${ms(110)} ease-out, opacity ${ms(260)} linear`
          : `transform ${ms(260)} cubic-bezier(.33,.9,.35,1), opacity ${ms(260)} linear`;
        paint();
        if (!pressed) return;
        ripple.style.setProperty('--x', `${x}px`);
        ripple.style.setProperty('--y', `${y}px`);
        ripple.style.animation = 'none';
        void ripple.offsetWidth;
        ripple.style.animation = `capture-ripple ${ms(520)} ease-out`;
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
  const centre = (row, col) => ({
    x: box.x + (col + 0.5) * cell,
    y: box.y + (row + 0.5) * cell,
  });
  centre.cellSize = cell;
  return centre;
}

/**
 * A cell centre, nudged off centre by a fixed amount for this scene.
 *
 * Nobody drags through the exact middle of every square, and a path that does
 * is the other half of why the cursor reads as mechanical. Seeded on the scene
 * so a re-record reproduces, and bounded well inside the cell so the drift can
 * never change which cells the stroke draws.
 */
function driftedCentres(centre, seed) {
  const random = mulberry32(seed);
  const reach = centre.cellSize * WAYPOINT_DRIFT;
  const cache = new Map();
  return (row, col) => {
    const key = `${row},${col}`;
    if (!cache.has(key)) {
      cache.set(key, { x: (random() * 2 - 1) * reach, y: (random() * 2 - 1) * reach });
    }
    const nudge = cache.get(key);
    const base = centre(row, col);
    return { x: base.x + nudge.x, y: base.y + nudge.y };
  };
}

/**
 * Wait, in finished-clip milliseconds.
 *
 * Every beat a scene asks for is written at the speed it should read back at,
 * so the runner is the only place that knows about SLOWDOWN.
 */
const hold = (page, ms) => page.waitForTimeout(ms * SLOWDOWN);

/**
 * Turn a run of waypoints into a rounded path, sampled densely.
 *
 * Each interior corner becomes a quadratic Bézier whose control point is the
 * corner itself, which is the cheapest curve that leaves the straights
 * untouched and meets them tangentially. Samples come back tagged with whether
 * they sit on a corner, which is what the speed profile keys off.
 *
 * @param {Array<{x: number, y: number}>} points - Waypoints, already drifted
 * @param {number} radius - Corner radius in pixels
 * @returns {Array<{x: number, y: number, corner: boolean}>} Dense samples
 */
function roundedPath(points, radius) {
  const DENSITY = 60; // samples per segment or arc; only feeds the resample
  const out = [];
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

  // Where each corner's arc starts and ends, clamped so two corners on a short
  // segment can never overlap
  const cut = points.map((point, i) => {
    if (i === 0 || i === points.length - 1) return 0;
    const before = dist(points[i - 1], point);
    const after = dist(point, points[i + 1]);
    return Math.min(radius, before / 2, after / 2);
  });

  let cursor = points[0];
  for (let i = 1; i < points.length; i += 1) {
    const corner = points[i];
    const isLast = i === points.length - 1;
    const arcIn = cut[i];

    // Straight run up to where this corner's arc begins
    const straightEnd = isLast || arcIn === 0
      ? corner
      : lerp(corner, cursor, arcIn / dist(cursor, corner));
    for (let step = 0; step < DENSITY; step += 1) {
      out.push({ ...lerp(cursor, straightEnd, step / DENSITY), corner: false });
    }
    if (isLast || arcIn === 0) {
      cursor = corner;
      continue;
    }

    // Quadratic arc through the corner
    const next = points[i + 1];
    const arcEnd = lerp(corner, next, arcIn / dist(corner, next));
    for (let step = 0; step < DENSITY; step += 1) {
      const t = step / DENSITY;
      const a = lerp(straightEnd, corner, t);
      const b = lerp(corner, arcEnd, t);
      out.push({ ...lerp(a, b, t), corner: true });
    }
    cursor = arcEnd;
  }
  out.push({ ...points[points.length - 1], corner: false });
  return out;
}

/**
 * Pick `count` points along a dense path, spaced by time rather than distance.
 *
 * Speed drops through corners and ramps in and out at the ends, so samples
 * bunch up where the pointer is slow — which is what makes the motion read as a
 * hand rather than a plotter. Both curves are smoothed over a window so the
 * change of pace is gradual rather than a gear change at the arc boundary.
 *
 * @param {Array<{x: number, y: number, corner: boolean}>} dense - From roundedPath
 * @param {number} count - Track resolution; glide() reads positions out of it
 * @returns {Array<{x: number, y: number}>} Samples, first and last inclusive
 */
function paceSamples(dense, count) {
  const SMOOTH = 12;

  // Corner-ness, averaged over a window, so speed eases into and out of a turn
  const speed = dense.map((_, i) => {
    let corners = 0;
    let seen = 0;
    for (let j = Math.max(0, i - SMOOTH); j <= Math.min(dense.length - 1, i + SMOOTH); j += 1) {
      corners += dense[j].corner ? 1 : 0;
      seen += 1;
    }
    const curvature = corners / seen;
    const ends = Math.min(i, dense.length - 1 - i) / (dense.length * 0.12);
    // Start and finish gently; a stroke that begins at full pelt reads as a jump
    const ramp = 0.35 + 0.65 * Math.min(1, ends);
    return (1 - curvature * (1 - CORNER_SPEED)) * ramp;
  });

  // Time to traverse each step, then invert to find equal-time positions
  const clock = [0];
  for (let i = 1; i < dense.length; i += 1) {
    const length = Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y);
    clock.push(clock[i - 1] + length / ((speed[i] + speed[i - 1]) / 2));
  }

  const total = clock[clock.length - 1];
  const samples = [];
  let cursor = 0;
  for (let n = 1; n <= count; n += 1) {
    const target = (total * n) / count;
    while (cursor + 1 < clock.length && clock[cursor + 1] < target) cursor += 1;
    samples.push({ x: dense[cursor].x, y: dense[cursor].y });
  }
  samples[samples.length - 1] = { x: dense[dense.length - 1].x, y: dense[dense.length - 1].y };
  return samples;
}

/**
 * Move the real pointer along a paced track, over a fixed span of clip time.
 *
 * Position comes from the clock rather than from the loop counter, so the
 * gesture takes exactly as long as the scene asked for however fast or slow
 * `page.mouse.move` is returning. See CELL_MS.
 *
 * No sleep: the move already costs a frame, and every one of them is a sample
 * the resample can draw on. The loop simply issues them as fast as it can and
 * lets the clock decide where each one lands.
 *
 * @param {import('playwright').Page} page
 * @param {Array<{x: number, y: number}>} track - From paceSamples
 * @param {number} clipMs - Duration in finished-clip milliseconds
 */
async function glide(page, track, clipMs) {
  const realMs = clipMs * SLOWDOWN;
  const started = performance.now();
  for (;;) {
    const progress = (performance.now() - started) / realMs;
    if (progress >= 1) break;
    const point = track[Math.min(track.length - 1, Math.floor(progress * track.length))];
    await page.mouse.move(point.x, point.y);
  }
  const end = track[track.length - 1];
  await page.mouse.move(end.x, end.y);
}

const capture = (page, method, arg) =>
  page.evaluate(([name, value]) => window.__capture[name](value), [method, arg]);

/** Bring the cursor in from below the target, so it reads as an approach */
async function approach(page, target) {
  await page.mouse.move(target.x, target.y + 56);
  await capture(page, 'show', true);
  const dense = roundedPath([{ x: target.x, y: target.y + 56 }, target], 0);
  await glide(page, paceSamples(dense, TRACK_SAMPLES), APPROACH_MS);
}

/** Fade the cursor out and wait for the fade to finish painting */
async function withdraw(page) {
  await capture(page, 'show', false);
  await hold(page, CURSOR_FADE_MS + 60);
}

/** One pointer gesture through a run of cells */
async function drawStroke(page, centre, cells, drift) {
  const points = cells.map(([row, col]) => drift(row, col));
  const first = points[0];

  await approach(page, first);
  await page.mouse.down();
  await hold(page, 120);

  const dense = roundedPath(points, centre.cellSize * CORNER_RADIUS);
  await glide(page, paceSamples(dense, TRACK_SAMPLES), (cells.length - 1) * CELL_MS);

  await page.mouse.up();
  await hold(page, STROKE_SETTLE_MS);
  await withdraw(page);
}

/** Press and release on one cell without moving, which erases it */
async function tapCell(page, centre, row, col) {
  const target = centre(row, col);

  await approach(page, target);
  await hold(page, TAP_TIMING.approach);

  await capture(page, 'press', true);
  await hold(page, TAP_TIMING.hold);
  await page.mouse.down();
  await page.mouse.up();
  await hold(page, TAP_TIMING.settle);

  await capture(page, 'press', false);
  await withdraw(page);
  await hold(page, BETWEEN_TAPS_MS);
}

async function playScene(page, scene, marks) {
  const centre = await cellCentres(page);
  const drift = driftedCentres(centre, scene.seed);

  for (const step of scene.steps) {
    switch (step.type) {
      case 'draw':
        await drawStroke(page, centre, step.cells, drift);
        if (step.pauseAfter) await hold(page, step.pauseAfter);
        break;
      case 'tap':
        await tapCell(page, centre, step.row, step.col);
        break;
      case 'wait':
        await hold(page, step.ms);
        break;
      case 'mark':
        // Snap the cursor out of sight before the timestamp, never fade it.
        // A scene whose setup ends in a gesture would otherwise be trimmed
        // mid-fade, and the clip would open on the previous card's cursor
        // dissolving in a corner.
        await capture(page, 'hide');
        await hold(page, 120);
        marks.set(step.name, Date.now());
        // Every clip opens on a still board for the same beat
        if (step.name === scene.trim.from) await hold(page, LEAD_IN_MS);
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
 *
 * A scene may override one — card 3 turns Borders to Full — and that is a
 * deliberately narrow door: the override still goes through the game's own
 * settings, so the clip shows a state a player can reach, which a runner-drawn
 * annotation never is.
 */
const CAPTURE_DEFAULTS = {
  hintMode: 'partial',
  borderMode: 'off',
  countdown: 'on',
  lastUnlimitedDifficulty: 'easy',
};

function settingsFor(scene) {
  const settings = { ...CAPTURE_DEFAULTS, ...(scene.settings ?? {}) };
  for (const key of Object.keys(settings)) {
    if (!(key in CAPTURE_DEFAULTS)) throw new Error(`scene ${scene.id}: unknown setting ${key}`);
  }
  return JSON.stringify(settings);
}

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
    settings: settingsFor(scene),
    slowdown: SLOWDOWN,
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
  // size the masks are positioned from, the crop — comes out wrong.
  await page.waitForFunction(() => {
    const canvas = document.getElementById('game-canvas');
    return canvas && canvas.style.width !== '';
  });
  await applyCursorTheme(page, theme);
  // Let the canvas finish its fade-in before capture starts
  await page.waitForTimeout(1200);

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

  // What the game thinks was drawn.
  //
  // `pagehide` is the app's own immediate-save path, so firing it flushes the
  // throttled save and the board can be read back out of localStorage. This is
  // the assertion that guards the cursor: it now curves through corners and
  // drifts off centre, and the whole reason those are safe is that they never
  // move the stroke onto a different cell. Nothing else would catch it if they
  // did — a clip with one extra cell in it looks perfectly plausible.
  const outcome = await page.evaluate((key) => {
    window.dispatchEvent(new Event('pagehide'));
    let drawn = null;
    try {
      drawn = JSON.parse(localStorage.getItem(key) ?? 'null')?.playerDrawnCells ?? null;
    } catch {
      /* reported as a missing board below */
    }
    return {
      won: document.querySelector('.bottom-sheet-overlay.visible') !== null,
      drawn: drawn && [...drawn].sort(),
    };
  }, plantedSave(board).key);

  await context.close();

  if (consoleErrors.length) {
    console.warn(`  ! console errors in scene ${scene.id} (${theme}):`, consoleErrors.slice(0, 3));
  }
  if (scene.expect && scene.expect.won !== outcome.won) {
    throw new Error(
      `scene ${scene.id} (${theme}): expected won=${scene.expect.won}, game says ${outcome.won}`
    );
  }
  const wanted = replayScene(scene, board).drawnCells.sort();
  if (!outcome.drawn || outcome.drawn.join('|') !== wanted.join('|')) {
    throw new Error(
      `scene ${scene.id} (${theme}): the stroke drew a different board.\n` +
      `  expected ${wanted.join(' ')}\n` +
      `  drew     ${outcome.drawn ? outcome.drawn.join(' ') : '(no saved board)'}`
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

  const names = [];
  for (const [index, frame] of clip.entries()) {
    const name = `f${String(index).padStart(5, '0')}.jpg`;
    await writeFile(path.join(dir, name), Buffer.from(frame.data, 'base64'));
    names.push(name);
  }

  // Resample the capture onto a 60Hz grid, with time divided by SLOWDOWN.
  //
  // Each frame is listed once per output tick it is the most recent frame for.
  // That does three things at once: it speeds the slow-motion recording back up
  // to the intended pace, it drops the surplus frames slow motion produces, and
  // it turns what is left of a screencast stall (trap 4) into a hold a third of
  // its real length.
  //
  // Frames are listed rather than given `duration` directives because the
  // concat demuxer rounds those up to its 25fps default and silently resamples
  // a 60fps capture to 25 — see the doc. `-r 60` before `-i` is the other half.
  const TICK = 1 / FPS;
  const started = clip[0].pageTime;
  const clipTime = (frame) => (frame.pageTime - started) / SLOWDOWN;
  const lastTick = Math.round(clipTime(clip[clip.length - 1]) / TICK);

  const lines = [];
  let index = 0;
  for (let tick = 0; tick <= lastTick; tick += 1) {
    const at = tick * TICK;
    while (index + 1 < clip.length && clipTime(clip[index + 1]) <= at) index += 1;
    lines.push(`file '${names[index]}'`);
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

  const duration = lines.length / FPS;

  // Health check, in captured time rather than clip time: the median gap
  // between delivered frames should sit near 16.7ms. Frames-per-second-of-clip
  // is not a useful figure here — a still page emits no frames at all, and
  // those legitimately become one held frame.
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
