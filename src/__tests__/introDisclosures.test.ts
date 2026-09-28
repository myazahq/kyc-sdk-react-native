import { describeInMonorepo, readPackageFile as read } from './helpers/monorepo';

// ─── The address intro gate: its disclosures actually open, and say the same
//     thing on every SDK ──────────────────────────────────────────────────────
//
// The three disclosures are the consent artefact a data protection review asks
// to see, so two things have to hold. They must OPEN — this SDK animates the
// body's height from a measurement, and a body measured at zero inside its own
// clipped, collapsed parent left every row expanding to an empty box. And they
// must say the same thing everywhere: three files in three languages carry one
// piece of copy, so it is pinned here rather than left to drift.
//
// The copy is customisable text now, so it lives in each SDK's i18n defaults
// and the screens read it by key. Flutter is mid-move (its screen already reads
// by key), so its sources are the screen AND the candidate defaults files: the
// line must be in one of them.

const COPY_SOURCES: Record<string, string[]> = {
  web: ['kyc-sdk-react/src/i18n/groups/address-intro.ts'],
  rn: ['kyc-sdk-react-native/src/i18n/defaults/address-intro.ts'],
  flutter: [
    'kyc-sdk-flutter/lib/src/screens/address/address_intro_disclosures.dart',
    'kyc-sdk-flutter/lib/src/i18n/defaults_address_intro.dart',
    'kyc-sdk-flutter/lib/src/i18n/defaults_address.dart',
  ],
};

/** Every source that exists, joined; a candidate not written yet is skipped. */
const readAll = (rels: string[]) =>
  rels
    .map((rel) => {
      try {
        return read(rel);
      } catch {
        return '';
      }
    })
    .join('\n');

const RN_DISCLOSURES = 'kyc-sdk-react-native/src/screens/address/IntroDisclosures.tsx';

const GATES = {
  web: 'kyc-sdk-react/src/steps/address/AddressIntroGate.tsx',
  rn: 'kyc-sdk-react-native/src/screens/address/AddressIntroGate.tsx',
  flutter: 'kyc-sdk-flutter/lib/src/screens/address/address_intro_gate.dart',
};

// Dart wraps a long body over adjacent string literals and the languages
// disagree about which quote to use, so both sides are compared with the
// quoting and the wrapping taken out.
const flatten = (source: string) => source.replace(/['"`\s]/g, '');

const COPY = [
  'How it works',
  'After you finish, your device periodically confirms it is at this address over the coming days. Only day-level summaries ever leave your phone, never your movements.',
  'After you finish, your phone confirms it is at this address over the coming days, even when the app is closed. Only day-level summaries ever leave your phone, never your movements.',
  'You stay in control',
  'You can turn location off at any time in your device settings. An unfinished check simply expires. It never counts against you.',
  'Your data is protected',
  "Location summaries are used only to confirm this address and are handled under your country's data protection rules.",
];

describeInMonorepo('the disclosure copy is one text on three SDKs', () => {
  it.each(Object.entries(COPY_SOURCES))('%s carries every line', (_name, rels) => {
    const source = flatten(readAll(rels));
    for (const line of COPY) expect(source).toContain(flatten(line));
  });
});

describe('the RN disclosures read that copy by key', () => {
  it.each([
    'address.intro.howItWorks.title',
    'address.intro.howItWorks.body',
    'address.intro.howItWorks.body.background',
    'address.intro.control.title',
    'address.intro.control.body',
    'address.intro.privacy.title',
    'address.intro.privacy.body',
  ])('%s', (key) => {
    expect(read(RN_DISCLOSURES)).toContain(`'${key}'`);
  });
});

describe('an open disclosure shows its body', () => {
  const source = read(RN_DISCLOSURES);

  it('measures the body OUT OF FLOW', () => {
    // The regression: the body was measured as an ordinary child of its own
    // clipped, zero-height parent. A view reports its natural height there;
    // TEXT is clamped to the available height, which is zero. Every row then
    // opened to the padding alone, showing an empty strip.
    expect(source).toMatch(/onLayout=\{[\s\S]{0,600}?position: 'absolute'/);
  });

  it('never stores a zero measurement', () => {
    expect(source).toMatch(/measured > 0 && measured !== bodyHeight/);
  });
});

describeInMonorepo('the eyebrow pill wears the same mark everywhere', () => {
  it.each([
    ['web', GATES.web, /<MapPinCheck className=/],
    ['rn', GATES.rn, /name="map-pin-check"/],
    ['flutter', GATES.flutter, /MyazaIcons\.mapPinCheck/],
  ])('%s', (_name, rel, pattern) => {
    expect(read(rel as string)).toMatch(pattern as RegExp);
  });
});
