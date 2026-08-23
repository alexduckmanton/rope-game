# Design decisions

Why the game behaves the way it does. This is reference reading, not instructions —
nothing here changes how you edit a file, but it explains choices that look arbitrary
from the code alone. Read it before changing scoring, the win condition, or hint colour.

-----

#### Victory Condition

Victory requirements are consistent across all difficulties:

- Path forms a valid closed loop (any shape, any size)
- All hint constraints are satisfied (turn counts match)
- Loop does NOT need to visit every cell to complete the puzzle

**The score is hint satisfaction, nothing else.** `CONFIG.SCORING.HAMILTONIAN_BONUS_PERCENT`
is `0`, so `calculateScore()` puts the full 100% on constraint satisfaction and the cell
coverage term contributes nothing. A score of 100 means "every hint reads zero" - it does
*not* mean the loop visited every cell. The win gate in `views/game.js` is
`isCurrentlyWinning && scorePercentage === 100`, which is therefore exactly the rule stated
above: any valid closed loop satisfying all hints wins, whatever its shape or size.

The coverage machinery is still in `calculateScore()` behind that zero, so raising the
constant would immediately start requiring a Hamiltonian cycle for a perfect score - and
would make the win unreachable for most loops. Do not raise it without also changing the
win gate.

**Daily puzzle completion icons:**

- **Trophy**: puzzle won
- **Skull**: solution was viewed
- Trophy wins when both apply

Every completion is a win, which is why `game_completed` carries no `completion_type`.

-----

#### Player Feedback Systems

**Number Behaviour (Dynamic Feedback):**

Players can choose between three number display modes via the "Number behaviour" setting:

**Count down (Default):**
- Numbers show **remaining corners needed**: `expectedTurnCount - actualTurnCount`
- **Dynamic feedback**: Numbers update in real-time as players draw their path
- **Progress tracking**: Numbers count down toward zero as correct corners are added
- **Negative values**: When players draw too many corners, number goes negative (e.g., need 3, drew 4 → shows "-1")
- **Color feedback**: Colors shift dynamically with magnitude (see Magnitude-Based Color System for details)

**Show total (Classic Mode):**
- Numbers show **total required corners**: `expectedTurnCount` (static)
- **Static display**: Numbers never change regardless of player progress
- **Traditional puzzle style**: Mirrors physical puzzle books where constraints stay constant
- **Color feedback**: Colors remain static based on expected turn count, only shift to green upon validation

**Show both:**
- Combines countdown and total display in a single view
- **Main number**: Shows countdown (remaining corners) in the center of the cell
- **Small total**: Shows total required corners in the top-right corner of the cell
- **Proportional sizing**: Small number is 40% of main number size, with 10% padding
- **Unified coloring**: Both numbers share the same color (including green when validated)
- **Best of both worlds**: Players see progress while retaining reference to original constraint

**Design Rationale:**

Countdown mode provides **progressive disclosure** - players immediately see if they're on the right track without needing to mentally calculate differences. This reduces cognitive load during gameplay, especially on larger grids where tracking multiple constraints becomes challenging.

Static mode appeals to **purist players** who prefer the traditional puzzle-solving experience where all information is given upfront and progress tracking happens mentally.

Show both mode serves players who want the dynamic feedback of countdown while still seeing the original constraint value for reference.

**Implementation Architecture:**

The countdown parameter is threaded through the rendering pipeline:
- **Settings layer**: Stored in localStorage as string ('on', 'off', 'both'), defaults to 'on'
- **Game state**: String variable passed to render function
- **Renderer**: Conditionally displays `remainingTurns` vs `expectedTurnCount` based on parameter; 'both' mode renders additional small number in top-right
- **Migration**: Boolean values from older versions are automatically converted ('true' → 'on', 'false' → 'off')

Validation logic remains identical - all modes use the same `isValid = remainingTurns === 0` check. Only the displayed value changes.

**User Control:**

Setting is accessible via select dropdown in settings bottom sheet. Changes apply immediately with live re-render. Setting persists across sessions and applies to all game modes (daily and unlimited).

**Score Tracking System:**

`calculateScore()` in `game/validation.js` returns a percentage that drives the win gate
and is reported on every game event. It has two components, but **only one of them is
currently live**:

**1. Hints component** - weighted `100 - HAMILTONIAN_BONUS_PERCENT`, so **100% today**
- Measures progress toward satisfying all hint constraints
- Formula: `(startingTotal - currentTotal) / startingTotal × weight`
- `startingTotal`: sum of absolute values of all expected turn counts
- `currentTotal`: sum of absolute values of all remaining turns needed
- Absolute values, so drawing too many corners is penalised like drawing too few

**2. Cell coverage component** - weighted `HAMILTONIAN_BONUS_PERCENT`, **0% today**
- Would reward visiting more cells: `(cellsVisited / totalCells) × weight`
- Reaches its full weight only on a Hamiltonian cycle
- Contributes nothing while the constant is zero

So in the shipping configuration `score === 100` is exactly "every hint reads zero", and
the win gate `scorePercentage === 100` implements the documented "any valid loop satisfying
all hints" rule. Raising `HAMILTONIAN_BONUS_PERCENT` would silently make a perfect score -
and therefore a win - require visiting every cell; change the win gate at the same time.

**Score Labels** (`getScoreLabel()`, used for sub-100 scores):
| Score Range | Label |
|-------------|-------|
| 100% | Perfect |
| 80-99% | Genius |
| 60-79% | Amazing |
| 40-59% | Great |
| 20-39% | Good |
| 0-19% | Okay |

Only "Perfect" is reachable by a player today: a loop that does not satisfy every hint does
not end the game, so no sheet ever shows the other labels. They exist for the score
reported on `game_abandoned`, where partial progress is the whole point.

**Display:** the score is not shown during play. The timer reads "Difficulty • Time".

**Validation Modals:**

| Condition | Modal Title | Modal Body | Icon | Color |
|-----------|-------------|------------|------|-------|
| All hints satisfied (score 100) | "Perfect loop!" | Completion time, swapping to the streak (daily only) | party-popper | Gold/amber |

A closed loop that does not satisfy its hints shows no modal at all - it fires
`validation_error` and leaves the player to keep working. There has never been a partial
win sheet, and the bottom sheet's `partial` colour scheme was removed once that was
established.

**Perfect Win Modal:**
- Celebrates complete puzzle solution
- Daily mode includes Share button for social features
- Timer stops permanently on perfect completion
- Body line opens on the completion time, then swaps itself for the streak (see Win Sheet Streak Reveal)

**Win Sheet Streak Reveal:**

In daily mode the perfect win sheet's body line does not sit still. It opens on "You finished in 2:34.", holds for a beat, then slides that line up and out while the streak line - the same flame and "5 day streak" wording as the home screen - slides up into its place. The reward for coming back tomorrow lands in the same moment as the win.

- **Mechanism**: both lines are stacked inside a window exactly one line tall (24px) with `overflow: hidden`, so the swap is a single transform on the track and everything outside the window is cropped. Nothing in the sheet moves.
- **Timing**: `CONFIG.WIN_STREAK.REVEAL_DELAY_MS` (1500) before the swap, `CONFIG.WIN_STREAK.TRANSITION_MS` (300) for the slide itself, on an easeInOutQuint curve so it reads as snappy rather than as an animation to wait out.
- **Tap to toggle**: tapping the line switches between the two, and cancels the pending automatic reveal so a tap is never overridden a moment later.
- **Replays on every open**: a fresh line is built for each sheet, including when a completed daily puzzle is reopened from a saved game, so the reveal always plays from the time.
- **Overall streak only**: the line never mentions the difficulty. Per-difficulty streaks stay an easter egg on the home screen.
- **Unlimited mode**: unlimited games do not touch the daily streak, so there the sheet keeps the plain time line with no swap. Same when the overall streak is somehow 0.

The wording comes from `formatStreakLabel()` in `persistence.js`, shared with the home screen line so the two can never drift apart.

**Share Text Format:**

```
💫 Medium Loopy 2:34
26 Dec 2025
```

- Difficulty label and time on one line, date beneath
- The label and the date are both localised — the date through `Intl.DateTimeFormat` in `formatShareDate()`, which used to hardcode `en-US` for everyone
- Uses Web Share API on mobile devices with clipboard fallback
- Share button appears on the perfect win sheet, daily mode only

**Pending change:** adding a puzzle number and the site URL (`💫 Loopy #233 · Medium / 2:34 / https://loopy.wtf`) is held until `share_attempted` volume is high enough to measure the effect. `getPuzzleNumber()` in `seededRandom.js` and `CONFIG.SITE.URL` already exist for it. When it lands the URL must be the **locale** URL (`CONFIG.SITE.URL + localeUrl(LOCALE)`), so a shared link opens and previews in the sender's language — that is most of the point of giving each language its own URL.

**Validation Optimization:**

To prevent frustrating accidental modal triggers, validation only runs when the path actually changes. The system computes a state key from connected cells and their connections, ignoring orphaned cells (temporary cells from taps that are immediately cleaned up). This prevents error modals from reappearing when players tap without modifying their loop.

-----

#### Magnitude-Based Color System

**Core Concept:**

Hint numbers are colored based on their magnitude (distance from zero) rather than randomly assigned colors. This creates an intuitive visual hierarchy where the color itself communicates information about the constraint difficulty.

**Color Assignment Logic:**

Each hint number receives a color from a nine-shade gradient based on its absolute value:

- **Zero (0)**: Always green, matching validated state color
- **Magnitude 1** (±1): Bright yellow-orange, lightest shade in the palette
- **Magnitude 2-8**: Progressive darkening through vibrant warm-to-cool gradient
- **Magnitude 9** (±9): Very dark magenta, darkest shade in the palette

Negative numbers use the same color as their positive counterparts. For example, both 3 and -3 display in the same coral-red tone. This emphasizes that magnitude (not sign) determines difficulty.

**Gradient Progression:**

The nine-color palette flows through a warm-to-cool spectrum creating visual distinction:

1. Bright yellow-orange (magnitude 1, easiest)
2. Bright orange
3. Tomato red
4. Red-pink
5. Hot pink
6. Pink-magenta
7. Magenta
8. Dark magenta
9. Very dark magenta (magnitude 9, hardest)

This chromatic progression provides natural visual chunking - warm tones (orange/red) signal low-to-medium constraints, while cool tones (pink/magenta) signal high constraints.

**Dynamic Color Updates:**

Colors update in real-time as players draw their path, creating animated feedback:

- **Countdown mode enabled**: Colors shift as remaining turns decrease
  - Start: Hint shows 7 remaining turns → magenta (high urgency)
  - Progress: Draw correctly, now 3 remaining → red (medium urgency)
  - Near completion: Down to 1 remaining → bright orange (almost there)
  - Complete: 0 remaining → green (validated)

- **Countdown mode disabled**: Colors remain static based on total required turns
  - Hint always shows expected turn count with corresponding magnitude color
  - Only changes to green upon validation

This dynamic behavior transforms hints into progress indicators. Players can visually scan the grid and immediately identify which constraints need more work (darker colors) versus which are nearly complete (lighter colors).

**Design Rationale:**

**Cognitive Load Reduction:**

Traditional puzzle games assign random colors to constraints purely for differentiation. This forces players to maintain mental mappings between colors and constraint values. Magnitude-based coloring eliminates this overhead by making color semantically meaningful.

**At-a-Glance Priority Assessment:**

Players can instantly identify high-priority constraints (dark magenta 8s and 9s) versus low-priority ones (bright orange 1s and 2s) without reading numbers. This becomes increasingly valuable on larger grids where many constraints compete for attention.

**Progress Visualization:**

In countdown mode, the color shift from dark to light provides visceral satisfaction. Players literally watch constraints "cool down" as they approach completion. This positive reinforcement loop encourages continued engagement.

**Accessibility Benefits:**

While the system relies on color, the gradient spans multiple visual dimensions:
- **Hue shift**: Orange through red to magenta (color-blind friendly warm-cool progression)
- **Lightness contrast**: Bright to dark provides luminance-based distinction
- **Saturation variation**: Vibrant to deep creates intensity differentiation

This multi-dimensional approach ensures the system remains functional across various forms of color vision deficiency.

**Zero as Special Case:**

Zero receiving green treatment (instead of a gradient color) serves dual purposes:
1. Reinforces that zero-turn constraints are fundamentally different (straight paths, no corners)
2. Creates consistency with the validated state, reducing cognitive dissonance

When an unvalidated hint displays zero, showing it in green doesn't create confusion because the border color still indicates unvalidated status. The number itself being green communicates "this area should have zero turns."

**Tutorial Visual Design:**

The tutorial clips are recordings of the real game, so the hint numbers in them carry the magnitude-based gradient unchanged. Card 3 additionally records with Borders set to Full, which outlines each hint's 3x3 area in that same magnitude colour - so the boundary and the number it belongs to change colour together. Card 3 stops short of 0, so neither ever goes green there; green is card 4's.

-----
