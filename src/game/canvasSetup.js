/**
 * Canvas Setup Utilities
 *
 * Shared logic for calculating responsive canvas dimensions
 * and setting up high-DPI canvas rendering.
 */

import { CONFIG } from '../config.js';

/**
 * Calculate optimal cell size for current viewport
 *
 * Strategy: Fix the total canvas size to be consistent across all grid sizes.
 * This ensures 4x4, 6x6, and 8x8 puzzles all appear the same visual size,
 * with the buttons aligned below them.
 *
 * We calculate what a 4x4 grid would be (the reference size), then use
 * that total size for all grids by dividing by the actual grid size.
 *
 * @param {number} gridSize - Number of cells per row/column
 * @param {number} [extraVerticalSpace=0] - Additional space to reserve (e.g., for tutorial text)
 * @returns {number} Cell size in pixels
 */
export function calculateCellSize(gridSize, extraVerticalSpace = 0) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const availableHeight = viewportHeight - CONFIG.LAYOUT.TOP_BAR_HEIGHT - extraVerticalSpace;
  const availableWidth = viewportWidth - CONFIG.LAYOUT.HORIZONTAL_PADDING;

  // Calculate cell size based on a 4x4 reference grid
  const REFERENCE_GRID_SIZE = 4;
  const referenceCellSize = Math.min(availableWidth / REFERENCE_GRID_SIZE, availableHeight / REFERENCE_GRID_SIZE);
  const clampedReferenceCellSize = Math.max(CONFIG.CELL_SIZE_MIN, Math.min(referenceCellSize, CONFIG.CELL_SIZE_MAX));

  // Fix total canvas size based on the 4x4 reference
  const fixedTotalSize = clampedReferenceCellSize * REFERENCE_GRID_SIZE;

  // Calculate cell size for actual grid to achieve the fixed total size
  return fixedTotalSize / gridSize;
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
