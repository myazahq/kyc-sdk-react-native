import { humanizeIdType, resolveIdTypeDefinition } from '../config/idTypes';
import { regionCountryName } from '../config/regions';

// ---------------------------------------------------------------------------
// Global Documents: any of ~240 countries, not just the five curated ones.
//
// Both failures these cover were silent — no crash, no type error, just a
// screen that looked empty or unfinished:
//
//  • the ID list was filtered against the curated table, so every country
//    outside it rendered "no ID types are enabled" — indistinguishable from
//    an org that genuinely has no access;
//  • country names came from `Intl.DisplayNames`, which this runtime may not
//    carry region data for, so every row read as a bare ISO code.
// ---------------------------------------------------------------------------

describe('resolveIdTypeDefinition', () => {
  it('prefers the curated entry for a gov-DB country', () => {
    const def = resolveIdTypeDefinition('NG', 'bvn', { label: 'Server Label' });
    // Curated wins outright — the local entry carries digits/pattern the
    // server row has no field for, so a server label must not displace it.
    expect(def.requiresDocumentCapture).toBe(false);
    expect(def.label).not.toBe('Server Label');
  });

  it('synthesizes a definition for an uncurated country from the server row', () => {
    const def = resolveIdTypeDefinition('AD', 'drivers-license', {
      label: "Driver's License",
      requiresDocumentCapture: true,
      scanSides: 'front_and_back',
    });
    expect(def.label).toBe("Driver's License");
    expect(def.requiresDocumentCapture).toBe(true);
    expect(def.scanSides).toBe('front_and_back');
  });

  it('falls back to a humanized label when the row carries none', () => {
    expect(resolveIdTypeDefinition('BF', 'national-id').label).toBe('National Id');
    expect(humanizeIdType('residence-card')).toBe('Residence Card');
  });

  it('assumes a document is needed when the row does not say', () => {
    // Safer default: asking for a photo that wasn't needed is recoverable;
    // skipping capture for a document ID leaves nothing to verify.
    const def = resolveIdTypeDefinition('XX', 'mystery-id');
    expect(def.requiresDocumentCapture).toBe(true);
    expect(def.scanSides).toBe('front_only');
  });

  it('omits scanSides for a number-only ID', () => {
    const def = resolveIdTypeDefinition('XX', 'some-number', {
      requiresDocumentCapture: false,
    });
    expect(def.scanSides).toBeUndefined();
  });
});

describe('regionCountryName', () => {
  it('returns full names, not ISO codes', () => {
    expect(regionCountryName('NG')).toBe('Nigeria');
    expect(regionCountryName('GH')).toBe('Ghana');
    expect(regionCountryName('AD')).toBe('Andorra');
    expect(regionCountryName('BF')).toBe('Burkina Faso');
  });

  it('is case-insensitive', () => {
    expect(regionCountryName('ng')).toBe('Nigeria');
  });

  it('falls back to the code for something genuinely unknown', () => {
    // Better a code than a crash or a misleading "Unknown Region" row.
    expect(regionCountryName('QQ')).toBe('QQ');
  });
});

// The camera pill's label. The catalogue label is written for a PICKER, where
// "International Passport" disambiguates; beside a flag it states the country
// twice and nobody is choosing anything at that point.
import { shortDocumentLabel } from '../config/idTypes';

describe('shortDocumentLabel', () => {
  it('shortens a passport whatever its catalogue label says', () => {
    // Keyed off the ID TYPE rather than trimmed from the string, so it holds
    // for every country — NG says "International Passport", GH says "Passport".
    expect(shortDocumentLabel('passport', 'International Passport')).toBe('Passport');
    expect(shortDocumentLabel('passport', 'Passport')).toBe('Passport');
  });

  it('leaves every other document alone', () => {
    expect(shortDocumentLabel('pvc', "Permanent Voter's Card")).toBe("Permanent Voter's Card");
    expect(shortDocumentLabel(null, 'Document')).toBe('Document');
  });
});
