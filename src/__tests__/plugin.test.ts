// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require('../../app.plugin.js');

const {
  applyNfcInfoPlist,
  applyNfcEntitlements,
  androidPermissionsFor,
  ensureNfcFeatureOptional,
  EMRTD_AID,
} = plugin as {
  applyNfcInfoPlist: (p: Record<string, unknown>, msg?: string) => Record<string, unknown>;
  applyNfcEntitlements: (p: Record<string, unknown>) => Record<string, unknown>;
  androidPermissionsFor: (o: { nfc: boolean; location: boolean; backgroundLocation: boolean }) => string[];
  ensureNfcFeatureOptional: (manifest: Record<string, any>) => Record<string, any>;
  EMRTD_AID: string;
};

type Feature = { $: Record<string, string> };
const featureNamed = (manifest: Record<string, any>, name: string): Feature | undefined =>
  (manifest['uses-feature'] as Feature[] | undefined)?.find(
    (f) => f?.$?.['android:name'] === name,
  );

const AID_KEY = 'com.apple.developer.nfc.readersession.iso7816.select-identifiers';
const FORMATS_KEY = 'com.apple.developer.nfc.readersession.formats';

// ---------------------------------------------------------------------------
// The NFC entitlement split.
//
// These pin a distinction that has no runtime symptom and no type error — it
// only shows up as a code-signing failure on a real device, which is exactly
// how it was found. The AID list belongs in Info.plist; the entitlements file
// gets the formats key and nothing else. Put the AID in entitlements and Xcode
// refuses to sign at all:
//
//   "Entitlement com.apple.developer.nfc.readersession.iso7816.select-identifiers
//    not found and could not be included in profile."
// ---------------------------------------------------------------------------

describe('NFC config plugin', () => {
  it('puts the AID in Info.plist', () => {
    const plist = applyNfcInfoPlist({});
    expect(plist[AID_KEY]).toEqual([EMRTD_AID]);
  });

  it('adds a usage description, and does not overwrite the app’s own', () => {
    expect(applyNfcInfoPlist({}).NFCReaderUsageDescription).toEqual(expect.any(String));
    const custom = applyNfcInfoPlist({ NFCReaderUsageDescription: 'Ours' });
    expect(custom.NFCReaderUsageDescription).toBe('Ours');
  });

  it('keeps the AID OUT of the entitlements — signing fails if it is there', () => {
    const plist = applyNfcEntitlements({});
    expect(plist[FORMATS_KEY]).toEqual(['TAG']);
    expect(plist).not.toHaveProperty(AID_KEY);
  });

  it('strips an AID left behind by an older plugin version', () => {
    // prebuild MERGES into the existing entitlements file, so a project built
    // once with the broken version carries this key forever unless it is
    // actively removed. Re-running prebuild must repair it, not preserve it.
    const stale = { [AID_KEY]: [EMRTD_AID], [FORMATS_KEY]: ['TAG'] };
    expect(applyNfcEntitlements(stale)).not.toHaveProperty(AID_KEY);
  });

  it('is idempotent — prebuild runs repeatedly and must not duplicate entries', () => {
    let info: Record<string, unknown> = {};
    let ent: Record<string, unknown> = {};
    for (let i = 0; i < 3; i += 1) {
      info = applyNfcInfoPlist(info);
      ent = applyNfcEntitlements(ent);
    }
    expect(info[AID_KEY]).toEqual([EMRTD_AID]);
    expect(ent[FORMATS_KEY]).toEqual(['TAG']);
  });

  it('preserves formats another plugin already declared', () => {
    // NDEF is a different capability; adding TAG must not evict it.
    const ent = applyNfcEntitlements({ [FORMATS_KEY]: ['NDEF'] });
    expect(ent[FORMATS_KEY]).toEqual(['NDEF', 'TAG']);
  });
});

// ---------------------------------------------------------------------------
// Android permissions. What `location: 'always'` declares changes the app's
// Play review posture, so the exact set is pinned: the background grant plus
// the foreground-service pair the Android presence tier needs — and NONE of
// them by default.
// ---------------------------------------------------------------------------

describe('Android permissions', () => {
  it('declares only camera, internet and foreground location by default', () => {
    const perms = androidPermissionsFor({ nfc: false, location: true, backgroundLocation: false });
    expect(perms).toEqual([
      'android.permission.CAMERA',
      'android.permission.INTERNET',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ]);
  });

  it("adds the background grant AND the foreground-service pair under location: 'always'", () => {
    const perms = androidPermissionsFor({ nfc: false, location: true, backgroundLocation: true });
    expect(perms).toEqual(
      expect.arrayContaining([
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
      ]),
    );
  });

  it('never declares a location permission when location is opted out', () => {
    const perms = androidPermissionsFor({ nfc: true, location: false, backgroundLocation: false });
    expect(perms.some((p) => p.includes('LOCATION'))).toBe(false);
    expect(perms).toContain('android.permission.NFC');
  });

  it('declares NO NFC permission by default — the whole point of the opt-in', () => {
    // The library manifest used to declare android.permission.NFC
    // unconditionally, so it merged into EVERY host app — including the
    // majority whose workflows never read a chip, and who had no way to
    // remove it. The plugin's `nfc` option defaulted to off the whole time,
    // which made the opt-in a fiction. This is that fiction failing.
    const perms = androidPermissionsFor({ nfc: false, location: true, backgroundLocation: false });
    expect(perms).not.toContain('android.permission.NFC');
  });
});

// ---------------------------------------------------------------------------
// The NFC permission and the hardware feature must travel TOGETHER.
//
// Android INFERS `<uses-feature android:name="android.hardware.nfc"
// android:required="true">` from android.permission.NFC whenever the feature
// is not declared explicitly, and Play then hides the app from every device
// with no NFC radio. For a KYC SDK in our markets that is most of the
// catalogue.
//
// The failure has NO runtime symptom: the app builds, installs and runs
// perfectly on the NFC-capable phone the developer is holding. It shows up
// only as an app that is silently absent from the store listing for everyone
// else — which is why it is pinned here rather than left to review.
// ---------------------------------------------------------------------------

describe('NFC uses-feature', () => {
  it('declares the radio as NOT required', () => {
    const manifest = ensureNfcFeatureOptional({});
    expect(featureNamed(manifest, 'android.hardware.nfc')?.$['android:required']).toBe('false');
  });

  it('overrides a required="true" the host or another library declared', () => {
    // Respecting an existing `true` would reintroduce exactly the
    // store-visibility problem this function exists to prevent.
    const manifest = ensureNfcFeatureOptional({
      'uses-feature': [
        { $: { 'android:name': 'android.hardware.nfc', 'android:required': 'true' } },
      ],
    });
    expect(featureNamed(manifest, 'android.hardware.nfc')?.$['android:required']).toBe('false');
    expect(manifest['uses-feature']).toHaveLength(1);
  });

  it('leaves other features alone', () => {
    const manifest = ensureNfcFeatureOptional({
      'uses-feature': [
        { $: { 'android:name': 'android.hardware.camera', 'android:required': 'true' } },
      ],
    });
    expect(featureNamed(manifest, 'android.hardware.camera')?.$['android:required']).toBe('true');
    expect(manifest['uses-feature']).toHaveLength(2);
  });

  it('is idempotent — prebuild runs repeatedly', () => {
    let manifest: Record<string, any> = {};
    for (let i = 0; i < 3; i += 1) manifest = ensureNfcFeatureOptional(manifest);
    expect(manifest['uses-feature']).toHaveLength(1);
  });

  it('is written under the SAME opt-in as the permission', () => {
    // A source scan, deliberately. The permission comes from
    // androidPermissionsFor and the feature from withAndroidNfcFeature — two
    // separate functions, so nothing but this stops a later change adding the
    // permission back without the feature. Reading the source is the only way
    // to pin a relationship that has no observable behaviour in a unit test.
    // Same reasoning as portrait_lock_test.dart in the Flutter SDK.
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '../../app.plugin.js'),
      'utf8',
    ) as string;
    const optIn = source.slice(source.indexOf('if (props.nfc === true) {'));
    expect(optIn).toContain('withAndroidNfcFeature');
    expect(optIn).toContain('withIosNfc');
  });
});
