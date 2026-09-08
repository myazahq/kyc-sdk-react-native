import { captureStreetViewFrame, frameFov } from '../lib/street-view-fov';

// A port of the web SDK's street-view-fov.test.ts; the Flutter twin is
// street_view_fov_test.dart. The three implementations must agree, because a
// frame captured on one platform is fetched by the server for all of them.

describe('frameFov', () => {
  it('a full-width frame captures the full viewport', () => {
    expect(frameFov(90, 1)).toBeCloseTo(90, 6);
  });

  it('an entrance-sized frame captures the slice it subtends, through the projection', () => {
    // 58% of a 90-degree view: 2·atan(0.58·tan(45°)) ≈ 60.23°, NOT 52.2° —
    // the mapping is tan-linear, not angle-linear, and the difference is the
    // gate cropped wrong at the edges.
    expect(frameFov(90, 0.58)).toBeCloseTo(60.23, 1);
  });

  it('is monotonic: a smaller frame never widens the shot', () => {
    expect(frameFov(90, 0.4)).toBeLessThan(frameFov(90, 0.6));
    expect(frameFov(120, 0.5)).toBeLessThan(120);
  });

  it('an unmeasurable fraction is floored, never zero or negative fov', () => {
    expect(frameFov(90, 0)).toBeGreaterThan(0);
    expect(frameFov(90, -3)).toBeGreaterThan(0);
  });
});

describe('captureStreetViewFrame', () => {
  const pov = { panoId: 'p1', heading: 12.5, pitch: 3, viewFov: 90 };

  it('stores the slice the frame subtends when both widths are known', () => {
    const frame = captureStreetViewFrame(pov, 58, 100);
    expect(frame.panoId).toBe('p1');
    expect(frame.heading).toBe(12.5);
    expect(frame.fov).toBeCloseTo(60.23, 1);
  });

  it('falls back to the whole view when a width is unmeasured, and clamps', () => {
    expect(captureStreetViewFrame(pov, 0, 100).fov).toBe(90);
    expect(captureStreetViewFrame({ ...pov, viewFov: 200, pitch: 140 }, 0, 0)).toEqual({
      panoId: 'p1',
      heading: 12.5,
      pitch: 90,
      fov: 120,
    });
    expect(captureStreetViewFrame({ ...pov, viewFov: 4, pitch: -140 }, 0, 0).fov).toBe(10);
  });
});
