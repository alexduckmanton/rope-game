/**
 * Canvas Setup Utilities
 *
 * Shared logic for calculating responsive canvas dimensions
 * and setting up high-DPI canvas rendering.
 */

import { CONFIG } from '../config.js';

/**
 * Calculate optimal cell size for current viewport
 * @param {number} gridSize - Number of cells per row/column
 * @param {number} [extraVerticalSpace=0] - Additional space to reserve (e.g., for tutorial text)
 * @returns {number} Cell size in pixels
 */
export function calculateCellSize(gridSize, extraVerticalSpace = 0) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const availableHeight = viewportHeight - CONFIG.LAYOUT.TOP_BAR_HEIGHT - extraVerticalSpace;
  const availableWidth = viewportWidth - CONFIG.LAYOUT.HORIZONTAL_PADDING;
  const maxCellSize = Math.min(availableWidth / gridSize, availableHeight / gridSize);
  return Math.max(CONFIG.CELL_SIZE_MIN, Math.min(maxCellSize, CONFIG.CELL_SIZE_MAX));
}

/**
 * Configure canvas for high-DPI display
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} gridSize - Grid size
 * @param {number} cellSize - Cell size in pixels
 */
export function setupCanvas(canvas, ctx, gridSize, cellSize) {
  const totalSize = cellSize * gridSize;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = totalSize * dpr;
  canvas.height = totalSize * dpr;
  canvas.style.width = totalSize + 'px';
  canvas.style.height = totalSize + 'px';

  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
  ctx.scale(dpr, dpr);
}
