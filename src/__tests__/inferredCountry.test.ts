import { inferredCountry, regionOfLocaleTag } from '../lib/inferred-country';

// The visitor's likely country is a DEFAULT, never evidence: the server's IP
// answer first, the device locale's region second, nothing when neither can
// say. These pin the tiers and that a language subtag is never read as one.

describe('regionOfLocaleTag', () => {
  it('reads the region subtag in either separator', () => {
    expect(regionOfLocaleTag('en-NG')).toBe('NG');
    expect(regionOfLocaleTag('en_GB')).toBe('GB');
    expect(regionOfLocaleTag('yo-Latn-NG')).toBe('NG');
    expect(regionOfLocaleTag('und-KE')).toBe('KE');
  });

  it('never mistakes the language for a region', () => {
    expect(regionOfLocaleTag('en')).toBeNull();
    expect(regionOfLocaleTag('fr')).toBeNull();
    expect(regionOfLocaleTag('')).toBeNull();
    expect(regionOfLocaleTag(null)).toBeNull();
  });
});

describe('inferredCountry', () => {
  it('prefers the server geo answer', () => {
    expect(inferredCountry(' ng ', ['en-GB'])).toBe('NG');
  });

  it('falls back to the first locale tag that carries a region', () => {
    expect(inferredCountry(null, ['en', 'en-KE', 'en-GB'])).toBe('KE');
    expect(inferredCountry(undefined, ['und-GH'])).toBe('GH');
  });

  it('returns null when nothing can say', () => {
    expect(inferredCountry('419', ['en'])).toBeNull();
    expect(inferredCountry(null, [])).toBeNull();
  });
});
