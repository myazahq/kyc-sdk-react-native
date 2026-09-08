// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require('../../app.plugin.js');

const {
  applyNfcInfoPlist,
  applyNfcEntitlements,
  androidPermissionsFor,
  EMRTD_AID,
} = plugin as {
  applyNfcInfoPlist: (p: Record<string, unknown>, msg?: string) => Record<string, unknown>;
  applyNfcEntitlements: (p: Record<string, unknown>) => Record<string, unknown>;
  androidPermissionsFor: (o: { nfc: boolean; location: boolean; backgroundLocation: boolean }) => string[];
  EMRTD_AID: string;
};

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
});
