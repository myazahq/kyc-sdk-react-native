import { describeInMonorepo, readPackageFile as read } from './helpers/monorepo';

// ─── Street View reaches every SDK through ONE protocol ──────────────────────
//
// The hosted /embed/street-view page speaks one vocabulary and the three
// map-frame mirrors (web, RN, Flutter) must all understand it: a token missing
// from one mirror is a platform where the entrance step silently falls back to
// the photo. Read across the monorepo, the way foldVectors.test.ts reads the
// Flutter fixture. The second group pins this SDK's own wiring.

const MIRRORS = {
  web: 'sdk-react/src/lib/map-frame.ts',
  rn: 'sdk-react-native/src/lib/map-frame.ts',
  flutter: 'sdk-flutter/lib/src/config/street_view_frame.dart',
};

describeInMonorepo('the street-view protocol is mirrored on every SDK', () => {
  it.each(Object.entries(MIRRORS))('%s carries every page message and the page path', (_name, rel) => {
    const source = read(rel);
    for (const token of ['sv-ready', 'sv-unavailable', 'sv-pov', 'panoId', 'viewFov', '/embed/street-view']) {
      expect(source).toContain(token);
    }
  });
});

describe('this SDK offers the framed street view', () => {
  it('the entrance step renders FramedStreetView and falls back to the photo', () => {
    const step = read('sdk-react-native/src/screens/address/AddressEntranceStep.tsx');
    expect(step).toMatch(/<FramedStreetView/);
    expect(step).toMatch(/onUnavailable=/);
    expect(step).toMatch(/streetViewFrameUrlOf\(/);
  });

  it('the flow model derives the offer from the maps frame URL and an installed WebView', () => {
    for (const rel of ['sdk-react-native/src/store/derive.ts', 'sdk-react-native/src/screens/address/use-address-flow.ts']) {
      const source = read(rel);
      expect(source).toMatch(/mapsFrameUrl\)\s*&&\s*webViewAvailable\(\)/);
    }
  });

  it('the entrance step fills the viewport so its actions can stick', () => {
    expect(read('sdk-react-native/src/components/VerificationFlow.tsx')).toMatch(/currentStep === 'address-entrance'/);
  });
});
