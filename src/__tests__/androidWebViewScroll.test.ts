import { readFileSync } from 'fs';
import { join } from 'path';

// ─── A map inside a scroll view still moves on Android ──────────────────────
//
// Both framed surfaces (the map and the Street View panorama) are WebViews
// inside StickyActions' ScrollView, and on Android a ScrollView intercepts
// every vertical drag its children start: the map moved a few pixels and
// stopped while the page scrolled instead (Galaxy S24, 2026-09-07). The
// WebView must ask the parent not to intercept, and the OSM fallback must
// refuse the parent's request to take the drag over.

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

describe('framed WebViews inside a ScrollView', () => {
  it.each(['components/FramedMapPicker.tsx', 'screens/address/FramedStreetView.tsx'])(
    '%s asks Android not to intercept its drags',
    (rel) => {
      expect(read(rel)).toMatch(/<WebView[\s\S]*?nestedScrollEnabled[\s\S]*?\/>/);
    },
  );

  it('the OSM picker refuses to hand a drag to the scroll view', () => {
    const source = read('components/MapPinPicker.tsx');
    expect(source).toContain('onPanResponderTerminationRequest: () => false');
    expect(source).toContain('onShouldBlockNativeResponder: () => true');
  });

  it('a failed entrance thumbnail leaves the review rather than an empty box', () => {
    // The review step is split: the failure flag lives on the step, the band's
    // clearance on ReviewAddressBand.
    const source = read('screens/address/AddressReviewStep.tsx') + read('screens/address/ReviewAddressBand.tsx');
    expect(source).toContain('setHeroFailed(true)');
    expect(source).toContain('paddingRight: clearsHero ?');
  });
});
