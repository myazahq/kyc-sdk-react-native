import { displayAddressLine } from '../lib/address-flow';
import { ADDRESS_LINE_PENDING, ADDRESS_LINE_UNAVAILABLE } from '../lib/address-line';
import { describeInMonorepo, readPackageFile as read } from './helpers/monorepo';

// ─── A pin without an address never shows its coordinates ────────────────────
//
// A moved pin has no line until the reverse geocode answers, and for that
// second the summary printed "4.93240, 8.32540" — which reads as an address
// while being the one thing an applicant cannot check. All three SDKs now
// return NOTHING there and say whether an answer is on its way, so the rule is
// pinned across the monorepo the way the map protocol is.

const LINE_SOURCES = {
  web: 'kyc-sdk-react/src/steps/address/flow-steps.ts',
  rn: 'kyc-sdk-react-native/src/lib/address-line.ts',
  flutter: 'kyc-sdk-flutter/lib/src/config/address_flow.dart',
};

describeInMonorepo('no SDK falls back to coordinates', () => {
  it.each(Object.entries(LINE_SOURCES))('%s', (_name, rel) => {
    const source = read(rel);
    expect(source).not.toMatch(/toFixed\(5\)|toStringAsFixed\(5\)/);
  });

  it('this SDK returns an empty line for an unread pin', () => {
    expect(displayAddressLine({ lat: 4.9324, lng: 8.3254 })).toBe('');
  });
});

describeInMonorepo('the waiting copy is one text on three SDKs', () => {
  it.each(Object.entries(LINE_SOURCES))('%s carries both lines', (_name, rel) => {
    const source = read(rel);
    expect(source).toContain(ADDRESS_LINE_PENDING);
    expect(source).toContain(ADDRESS_LINE_UNAVAILABLE);
  });
});

// ─── The wait is a skeleton line, not a spinner ──────────────────────────────
//
// A spinner beside grey text said "busy"; a bar drawn where the address will
// land says "the line is coming" and holds the card's height (user decision
// 2026-09-07). The words survive as the live-region label, so this pins the
// shape on the six surfaces and the absence of a spinner on the three pin
// summaries that used to draw one.

const PENDING_SURFACES = {
  'web pin': 'kyc-sdk-react/src/steps/AddressCollectionStep.tsx',
  'web review': 'kyc-sdk-react/src/steps/address/AddressReviewStep.tsx',
  'rn pin': 'kyc-sdk-react-native/src/screens/address/PinSummaryRow.tsx',
  'rn review': 'kyc-sdk-react-native/src/screens/address/ReviewAddressBand.tsx',
  'flutter pin': 'kyc-sdk-flutter/lib/src/screens/address/address_pin_summary.dart',
  'flutter review': 'kyc-sdk-flutter/lib/src/screens/address/address_review_card.dart',
};

describeInMonorepo('the wait is a skeleton line, not a spinner', () => {
  it.each(Object.entries(PENDING_SURFACES))('%s draws the skeleton', (_name, rel) => {
    expect(read(rel)).toMatch(/LineSkeleton/);
  });

  it.each(
    Object.entries(PENDING_SURFACES).filter(([name]) => name.endsWith('pin')),
  )('%s has no spinner left', (_name, rel) => {
    expect(read(rel)).not.toMatch(/Loader2|ActivityIndicator|CircularProgressIndicator/);
  });
});
