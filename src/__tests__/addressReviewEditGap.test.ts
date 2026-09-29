import { describeInMonorepo, readPackageFile as read } from './helpers/monorepo';

// ─── Edit keeps clear of the entrance photo ──────────────────────────────────
//
// The review card's band reserves exactly 128 on the right for the entrance
// photo hanging over it, and the photo is 112 wide, 16 from the card's edge:
// Edit sat flush against the photo's border (user report 2026-09-29). The
// 128 cannot grow (12 more starved the "Pinned address" pill on a 360-wide
// phone), so with something hanging over the band Edit moves under the
// address in all three SDKs, and stays beside it otherwise. Flutter pins the
// laid-out positions in address_review_band_test.dart; this pins the rule in
// each source so the three cannot drift.

describeInMonorepo('Edit moves under the address when an entrance hangs over the band', () => {
  it('react native', () => {
    const src = read('kyc-sdk-react-native/src/screens/address/ReviewAddressBand.tsx');
    expect(src).toMatch(/\{clearsHero \? null : editLink\}/);
    expect(src).toMatch(/\{clearsHero \? <View[^>]*>\{editLink\}<\/View> : null\}/);
  });

  it('flutter', () => {
    const src = read('kyc-sdk-flutter/lib/src/screens/address/address_review_band.dart');
    expect(src).toMatch(/if \(hangs\) \.\.\.\[\s*const SizedBox\(height: MyazaSpacing\.sm\),\s*editLink,/);
    expect(src).toMatch(/if \(!hangs\) \.\.\.\[\s*const SizedBox\(width: MyazaSpacing\.sm\),\s*editLink,/);
  });

  it('web', () => {
    const src = read('kyc-sdk-react/src/steps/address/AddressReviewStep.tsx');
    expect(src).toMatch(/\{hero && <div className="pt-1">\{editButton\}<\/div>\}/);
    expect(src).toMatch(/\{!hero && editButton\}/);
  });

  it('the clearance itself stays at 128', () => {
    expect(read('kyc-sdk-react-native/src/screens/address/ReviewAddressBand.tsx')).toMatch(/const BAND_CLEARANCE = 128;/);
    expect(read('kyc-sdk-flutter/lib/src/screens/address/address_review_band.dart')).toMatch(/const double _kBandClearance = 128;/);
  });
});
