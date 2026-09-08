import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Street View reaches every SDK through ONE protocol ──────────────────────
//
// The hosted /embed/street-view page speaks one vocabulary and the three
// map-frame mirrors (web, RN, Flutter) must all understand it: a token missing
// from one mirror is a platform where the entrance step silently falls back to
// the photo. Read across the monorepo, the way foldVectors.test.ts reads the
// Flutter fixture. The second group pins this SDK's own wiring.

const PACKAGES = join(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(PACKAGES, rel), 'utf8');

const MIRRORS = {
  web: 'kyc-sdk-react/src/lib/map-frame.ts',
  rn: 'kyc-sdk-react-native/src/lib/map-frame.ts',
  flutter: 'kyc-sdk-flutter/lib/src/config/street_view_frame.dart',
};

describe('the street-view protocol is mirrored on every SDK', () => {
  it.each(Object.entries(MIRRORS))('%s carries every page message and the page path', (_name, rel) => {
    const source = read(rel);
    for (const token of ['sv-ready', 'sv-unavailable', 'sv-pov', 'panoId', 'viewFov', '/embed/street-view']) {
      expect(source).toContain(token);
    }
  });
});

describe('this SDK offers the framed street view', () => {
  it('the entrance step renders FramedStreetView and falls back to the photo', () => {
    const step = read('kyc-sdk-react-native/src/screens/address/AddressEntranceStep.tsx');
    expect(step).toMatch(/<FramedStreetView/);
    expect(step).toMatch(/onUnavailable=/);
    expect(step).toMatch(/streetViewFrameUrlOf\(/);
  });

  it('the flow model derives the offer from the maps frame URL and an installed WebView', () => {
    for (const rel of ['kyc-sdk-react-native/src/store/derive.ts', 'kyc-sdk-react-native/src/screens/address/use-address-flow.ts']) {
      const source = read(rel);
      expect(source).toMatch(/mapsFrameUrl\)\s*&&\s*webViewAvailable\(\)/);
    }
  });

  it('the entrance step fills the viewport so its actions can stick', () => {
    expect(read('kyc-sdk-react-native/src/components/KycFlow.tsx')).toMatch(/currentStep === 'address-entrance'/);
  });
});
