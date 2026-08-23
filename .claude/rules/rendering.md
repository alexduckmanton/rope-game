---
paths:
  - "src/renderer.js"
  - "src/tokens.js"
  - "src/tokens.css"
  - "src/config.js"
---

# Canvas rendering and colour

Everything drawn on the canvas, and the CSS-as-source-of-truth colour system behind it. The reasoning for the magnitude-based hint gradient is in `docs/design-decisions.md`.

### Constraint Validation Algorithm

**What is a "Turn"?**

A turn occurs when a path changes direction within a cell. The algorithm analyzes connections between cells:
- **Straight path** (→→→ or ↑↑↑): 0 turns - previous, current, and next cells are collinear
- **Corner path** (↑→→ or ←↓→): 1 turn - path changes direction at this cell

**Validation Area:**

Each numbered hint validates the 3x3 area centered on itself (8 neighbors + self = 9 cells max, fewer at edges).

**Implementation:**

1. `buildSolutionTurnMap(solutionPath)` - Analyzes solution path to mark which cells are turns
   - For each cell, checks if previous→current→next are collinear (straight) or not (turn)
   - Returns `Map<cellKey, isTurn>`

2. `buildPlayerTurnMap(playerDrawnCells, playerConnections)` - Analyzes player's drawn path
   - For each drawn cell with exactly 2 connections, checks if connections are collinear
   - Returns `Map<cellKey, isTurn>`

3. `countTurnsInArea(row, col, gridSize, turnMap)` - Counts turns in 3x3 region
   - Iterates through 9 adjacent cells (including center)
   - Sums up cells where `turnMap.get(cellKey) === true`

4. Validation compares `expectedTurnCount` (from solution) vs `actualTurnCount` (from player)
   - Hint colored green when counts match, otherwise uses magnitude-based color from gradient palette

-----

### Color Token System

**Purpose:** Centralized color management system providing automatic dark mode support and consistent theming across UI and canvas rendering.

**Architecture:** Two-tier token system with CSS as single source of truth.

**Design Token Hierarchy:**

1. **Base Color Scales** (Primitive Tokens)
   - **Neutral scale**: 10 shades from lightest to darkest, inverted in dark mode
   - **Blue scale**: Primary action colors, navigation, solution paths
   - **Green scale**: Success states, validated hints, win conditions
   - **Red scale**: Error states, destructive actions
   - **Amber scale**: Success backgrounds, celebration colors
   - **Hint gradient**: 9 magnitude-based colors for hint number display

2. **Semantic Tokens** (Purpose-Based)
   - Reference base scales with meaningful names describing intent
   - Examples: primary, bgBase, textPrimary, canvasBg, playerPath, hintValidated
   - Automatically inherit dark mode values from base scales they reference

**CSS-as-Source-of-Truth Pattern:**

The system maintains a single definition point for all colors while supporting both CSS and JavaScript usage:

- **tokens.css**: Defines all color values as CSS custom properties, includes dark mode overrides via media query
- **tokens.js**: Reads CSS values using getComputedStyle, exports JavaScript-friendly color objects
- **style.css**: Uses CSS variables for all UI styling, automatically adapts to theme
- **config.js**: Imports colors from tokens.js for canvas rendering
- **Synchronization**: Media query listener detects theme changes, reloads JavaScript colors, dispatches custom event

**Dark Mode Implementation:**

The app automatically follows the user's system-wide dark mode preference without requiring manual configuration:

- **Detection**: CSS media query `prefers-color-scheme: dark` automatically applies dark color overrides
- **Theme switching**: JavaScript media query listener detects changes and triggers re-render
- **Canvas updates**: Game and tutorial views listen for `themeChanged` event and redraw with new colors
- **Browser chrome**: Theme-color meta tag updates dynamically to match current theme
- **Zero configuration**: No user-facing toggle needed, respects system preferences

**Dark Mode Color Philosophy:**

- **True Dark approach**: Near-black backgrounds (#1A1A1A) instead of pure black for reduced eye strain and better OLED performance
- **Inverted neutral scale**: Light mode's lightest becomes dark mode's darkest, maintaining semantic meaning
- **Brightened accents**: Primary colors become more vibrant and saturated for visibility on dark backgrounds
- **Elevation through lightness**: Elevated surfaces (buttons, sheets, canvas) are lighter than base background, creating depth
- **Preserved gradients**: Hint magnitude colors maintain their warm-to-cool progression with brightness adjustments

**Key Files:**

| File | Purpose | Dark Mode Role |
|------|---------|----------------|
| `src/tokens.css` | Color definitions | Contains base scales and dark mode overrides |
| `src/tokens.js` | JavaScript exports | Reads CSS values, listens for theme changes |
| `style.css` | UI styling | Uses CSS variables, automatically adapts |
| `src/config.js` | Game configuration | Imports semantic tokens for canvas colors |
| `src/main.js` | App initialization | Updates theme-color meta tag on theme change |
| `src/views/game.js` | Game view | Re-renders canvas on theme change |
| `src/components/tutorialSheet.js` | Tutorial component | Re-renders canvas on theme change |

**Performance Characteristics:**

- **Initial load**: CSS variables loaded instantly with stylesheet, JavaScript reads once during module initialization
- **Theme change**: ~1ms to read new CSS values, single requestAnimationFrame for canvas re-render
- **No duplication**: CSS is single source of truth, eliminates maintenance burden of parallel color systems
- **Automatic cascade**: CSS variable changes flow through all components without manual updates

**Benefits:**

- **Maintainability**: Single location to modify colors affects entire app (CSS and JS)
- **Consistency**: Canvas rendering always matches UI styling via shared color source
- **Accessibility**: Automatic dark mode reduces eye strain in low-light environments
- **User experience**: Respects system preferences without forcing users to configure app-level settings
- **Future-proof**: Easy to add theme variations, high-contrast modes, or custom color schemes

-----

**Modify Hint Display:**
1. **Hint number colors**: Modify hint gradient colors in `tokens.css` (both light and dark mode blocks). The 9-color gradient is defined as `--color-hint-1` through `--color-hint-9` and automatically flows to `CONFIG.COLORS.HINT_COLORS`
2. **Border rendering**: Modify `drawHintBorders()` in `renderer.js` (width, inset, layer offset). This is the only thing drawn behind a hint - there is no pulsing background, despite what older notes claimed

-----

**Modify Colors:**
1. **Edit color values**: Update CSS custom properties in `src/tokens.css`
   - Modify base color scales (neutral, blue, green, red, amber) in the `:root` block
   - For dark mode: Update corresponding colors in the `@media (prefers-color-scheme: dark)` block
   - Changes automatically flow to both UI (CSS) and canvas (JavaScript)
2. **Add new semantic tokens**: Define new purpose-based color references
   - Add to `:root` block in tokens.css using `var()` to reference base scales
   - Import in tokens.js by adding to `loadSemanticFromCSS()` function
   - Use in config.js by referencing semantic token
3. **Add new color scales**: For new color families beyond existing scales
   - Define scale shades in tokens.css `:root` block
   - Add dark mode overrides in media query block
   - Add to `loadColorsFromCSS()` function in tokens.js
   - Reference in config.js or create semantic tokens
4. **Testing color changes**:
   - Check both light and dark modes by toggling system appearance settings
   - Verify canvas rendering matches UI styling
   - Ensure contrast ratios meet accessibility standards
   - Test hint gradient maintains visual hierarchy in both themes

-----

**Modify Number Behaviour Setting:**
1. **Change default**: Update `countdown: 'on'` in `DEFAULT_SETTINGS` object in `persistence.js` (values: 'on', 'off', 'both')
2. **Display calculation**: Modify `displayValue` logic in `renderer.js:renderCellNumbers()` - uses `showCountdown = countdown === 'on' || countdown === 'both'`
3. **Add new display modes**: Add new option value to select in `index.html`, update labels in `game.js:updateCountdownSelectState()`
4. **Small number rendering**: For 'both' mode, modify small number sizing/position in `renderer.js:renderCellNumbers()`
5. **Migration**: Add migration logic in `persistence.js:loadSettings()` for backward compatibility (boolean → string conversion already exists)
6. **UI**: Modify select options in `index.html` settings list, update value labels in `game.js`

-----

**Modify Numbers Setting:**
1. **Change default**: Update `hintMode: 'partial'` in `DEFAULT_SETTINGS` object in `persistence.js`
2. **Select handler**: Modify `handleHintsChange()` in `game.js`
3. **Select state**: Update `updateHintsSelectState()` in `game.js` for value display
4. **Add new hint modes**: Extend conditional logic in `renderer.js:renderCellNumbers()` to support additional display modes
5. **Migration**: Add migration logic in `persistence.js:loadSettings()` for backward compatibility
6. **UI**: Modify select options in `index.html` settings list, update value labels in `game.js`

-----

**Add New Constraint Types:**
1. Modify turn counting logic in `utils.js:countTurnsInArea()` or create new validation function
2. Update validation rendering in `renderer.js:renderCellNumbers()` to display new constraint type
3. Consider impact on puzzle generation difficulty and solvability

-----

**Add New Visual Features:**
1. **Path styling**: Update `CONFIG.RENDERING.*` constants in `config.js`
2. **Colors**: See "Modify Colors" section below for proper color token workflow
3. **Animations**: Adjust `renderPlayerPath()` or `renderPath()` in `renderer.js`
