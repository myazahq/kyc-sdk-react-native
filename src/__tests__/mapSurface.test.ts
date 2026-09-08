import { readFileSync } from 'fs';
import { join } from 'path';

import { MAP_SURFACE, mapSurfaceHeight } from '../lib/map-tiles';

// ─── The pin step's map height and its reachable Continue ────────────────────
//
// The four numbers are the web SDK's (`h-[40vh] min-h-[240px] max-h-[360px]
// sm:h-[420px]`), ported here and to Flutter; a change on one platform is a
// change on all three. The second group pins the WIRING: the pin step's
// actions must ride StickyActions inside a viewport-filling sheet, or on a
// short phone the map swallows every drag and Continue is unreachable.

describe('mapSurfaceHeight', () => {
  it('gives a phone 40% of its height, floored at 240', () => {
    expect(mapSurfaceHeight({ width: 390, height: 500 })).toBe(240);
    expect(mapSurfaceHeight({ width: 390, height: 700 })).toBe(280);
  });

  it('caps a tall phone at 360', () => {
    expect(mapSurfaceHeight({ width: 430, height: 932 })).toBe(360);
  });

  it('is a flat 420 from the wide breakpoint', () => {
    expect(mapSurfaceHeight({ width: 640, height: 500 })).toBe(420);
    expect(mapSurfaceHeight({ width: 1024, height: 1366 })).toBe(420);
  });

  it('carries the web numbers', () => {
    expect(MAP_SURFACE).toEqual({ phoneFraction: 0.4, phoneMin: 240, phoneMax: 360, wideBreakpoint: 640, wide: 420 });
  });
});

describe('the pin step holds its actions at the bottom of a filled viewport', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

  it('wraps its body in StickyActions', () => {
    const step = read('screens/address/AddressPinStep.tsx');
    expect(step).toMatch(/import \{ StickyActions \} from '\.\.\/\.\.\/components\/StickyActions'/);
    expect(step).toMatch(/<StickyActions/);
    expect(step).toMatch(/mapSurfaceHeight\(/);
  });

  it('is listed among the steps the sheet lets fill the viewport', () => {
    const flow = read('components/KycFlow.tsx');
    expect(flow).toMatch(/currentStep === 'address-collection'/);
  });
});
