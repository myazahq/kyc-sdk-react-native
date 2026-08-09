// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require('../../app.plugin.js');

const {
  applyNfcInfoPlist,
  applyNfcEntitlements,
  EMRTD_AID,
} = plugin as {
  applyNfcInfoPlist: (p: Record<string, unknown>, msg?: string) => Record<string, unknown>;
  applyNfcEntitlements: (p: Record<string, unknown>) => Record<string, unknown>;
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
