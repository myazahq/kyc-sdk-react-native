// ---------------------------------------------------------------------------
// The shape of the flash's cut-out.
//
// Kept free of native imports so the geometry can be tested without a renderer.
// The failure it guards against is purely visual — a wrong-shaped hole still
// passes the liveness check, so nothing else would ever raise it.
// ---------------------------------------------------------------------------

/** The preview's position on screen, in window coordinates. */
export interface FlashHole {
  x: number;
  y: number;
  /** The diameter of the circle, or the width of the tall window. */
  size: number;
  /**
   * Set when the preview is the full-screen camera's window: taller than it
   * is wide, with fully round ends. Absent for the sheet's circle.
   */
  height?: number;
}

/**
 * The screen rectangle with the preview circle subtracted, as ONE path.
 *
 * Two subpaths, rendered with `fillRule="evenodd"` so the second is a hole
 * rather than a second filled shape. The surround was originally four
 * rectangles, which can only describe a rectangular gap — against a circular
 * preview that left the corners painted over the user's face, which is the part
 * they need to see to stay framed.
 */
export function holePath(width: number, height: number, hole: FlashHole): string {
  const r = hole.size / 2;
  const cx = hole.x + r;
  if (hole.height != null && hole.height > hole.size) {
    // The tall window: a half-circle at each end, joined by straight sides.
    const top = hole.y + r;
    const bottom = hole.y + hole.height - r;
    return (
      `M0 0 H${width} V${height} H0 Z ` +
      `M${cx - r} ${top} A${r} ${r} 0 0 1 ${cx + r} ${top} ` +
      `V${bottom} A${r} ${r} 0 0 1 ${cx - r} ${bottom} Z`
    );
  }
  const cy = hole.y + r;
  // Two half-arcs rather than one: a single 360° arc has identical start and
  // end points and renders as nothing.
  return (
    `M0 0 H${width} V${height} H0 Z ` +
    `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
  );
}
