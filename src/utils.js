/**
 * Shared utility functions for the Loop puzzle game
 */

/**
 * Check if two cells are adjacent (Manhattan distance = 1)
 * @param {number} r1 - Row of first cell
 * @param {number} c1 - Column of first cell
 * @param {number} r2 - Row of second cell
 * @param {number} c2 - Column of second cell
 * @returns {boolean} True if cells are adjacent
 */
export function isAdjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

/**
 * Draw smooth curves through an array of points with optional loop closure
 * Handles the complex math for calculating proper starting points and arc tangents
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context (must have beginPath already called)
 * @param {Array<{x: number, y: number}>} points - Array of pixel coordinate points
 * @param {number} radius - Corner radius for smooth curves
 * @param {boolean} isLoop - Whether this is a closed loop
 */
export function drawSmoothCurve(ctx, points, radius, isLoop) {
  if (points.length < 2) return;

  if (isLoop && points.length >= 2) {
    // Closed loop - calculate proper starting point to avoid overhang
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const secondPoint = points[1];

    // Calculate the angle at the first corner
    const dx1 = firstPoint.x - lastPoint.x;
    const dy1 = firstPoint.y - lastPoint.y;
    const dx2 = secondPoint.x - firstPoint.x;
    const dy2 = secondPoint.y - firstPoint.y;

    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    // Normalize vectors
    const ux1 = dx1 / len1;
    const uy1 = dy1 / len1;
    const ux2 = dx2 / len2;
    const uy2 = dy2 / len2;

    // Calculate angle between vectors
    const dot = ux1 * ux2 + uy1 * uy2;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

    // Calculate tangent distance from corner to arc start
    const tangentDist = Math.min(radius / Math.tan(angle / 2), len1 / 2, len2 / 2);

    // Starting point is offset from first point toward last point
    const startX = firstPoint.x - ux1 * tangentDist;
    const startY = firstPoint.y - uy1 * tangentDist;

    // Start at calculated position
    ctx.moveTo(startX, startY);

    // Arc around all points including the first point
    for (let i = 0; i < points.length; i++) {
      const cornerPoint = points[i];
      const nextPoint = points[(i + 1) % points.length];
      ctx.arcTo(cornerPoint.x, cornerPoint.y, nextPoint.x, nextPoint.y, radius);
    }
    ctx.closePath();
  } else {
    // Open path - start at first point and smooth interior corners only
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 2; i++) {
      const cornerPoint = points[i + 1];
      const nextPoint = points[i + 2];
      ctx.arcTo(cornerPoint.x, cornerPoint.y, nextPoint.x, nextPoint.y, radius);
    }
    // Draw to final point
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  }
}

/**
 * Build a map indicating which cells in a solution path are turns (corners)
 * A turn is where the path changes direction (not a straight line)
 *
 * @param {Array<{row: number, col: number}>} solutionPath - Array of cells in path order
 * @returns {Map<string, boolean>} Map of "row,col" -> isTurn (true if turn, false if straight)
 */
export function buildSolutionTurnMap(solutionPath) {
  const turnMap = new Map();
  const pathLength = solutionPath.length;

  for (let i = 0; i < pathLength; i++) {
    const prev = solutionPath[(i - 1 + pathLength) % pathLength];
    const current = solutionPath[i];
    const next = solutionPath[(i + 1) % pathLength];

    // Check if this is a straight path (no turn)
    const isStraight =
      (prev.row === current.row && current.row === next.row) ||
      (prev.col === current.col && current.col === next.col);

    turnMap.set(`${current.row},${current.col}`, !isStraight);
  }

  return turnMap;
}
