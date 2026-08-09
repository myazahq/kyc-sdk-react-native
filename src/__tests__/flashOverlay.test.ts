import { holePath } from '../components/flashHoleGeometry';

// ---------------------------------------------------------------------------
// The shape of the flash's cut-out.
//
// The preview is a circle; the first implementation drew the surround as four
// rectangles, which can only ever describe a rectangular gap. The corners
// stayed painted over the user's face — the exact part they need to see to stay
// framed during a sequence that asks them to hold still.
//
// Geometry is testable without a renderer, and nothing else would catch this:
// the failure is purely visual, and the check still passes with a wrong-shaped
// hole, so no error is ever raised.
// ---------------------------------------------------------------------------

describe('holePath', () => {
  const hole = { x: 40, y: 100, size: 200 };

  it('subtracts the circle rather than drawing a second shape', () => {
    // Two subpaths — the screen rect and the circle. `fillRule="evenodd"` on the
    // element turns the second into a hole; without a second subpath there is
    // nothing to subtract.
    const d = holePath(390, 844, hole);
    expect(d.match(/M/g)?.length).toBe(2);
    expect(d).toContain('A'); // arcs, not lines: the hole is round
  });

  it('centres the circle on the measured rect', () => {
    // cx = 40 + 100 = 140, cy = 100 + 100 = 200, r = 100.
    // The path starts at the circle's leftmost point (cx - r).
    const d = holePath(390, 844, hole);
    expect(d).toContain('M40 200 A100 100');
    expect(d).toContain('240 200'); // cx + r, the opposite point
  });

  it('spans the whole screen, not the sheet', () => {
    // The screen IS the light source — a surround smaller than the display puts
    // less light on the face and pushes flashes toward inconclusive.
    expect(holePath(390, 844, hole)).toContain('M0 0 H390 V844 H0 Z');
  });

  it('uses two half-arcs, since a single 360° arc renders as nothing', () => {
    // Identical start and end points make one full arc a no-op in SVG.
    expect(holePath(390, 844, hole).match(/A/g)?.length).toBe(2);
  });
});
