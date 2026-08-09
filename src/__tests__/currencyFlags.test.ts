import { currencyFlagCountry, currencyName } from '../config/currencyFlags';

// Ported from the Flutter SDK's currency_flags.dart. A currency that flags
// differently per platform is a visible bug, so the mapping gets the same
// coverage on both sides.

describe('currencyFlagCountry', () => {
  it('derives the country from the ISO 4217 prefix', () => {
    expect(currencyFlagCountry('NGN')).toBe('NG');
    expect(currencyFlagCountry('USD')).toBe('US');
    expect(currencyFlagCountry('KES')).toBe('KE');
    expect(currencyFlagCountry('ZAR')).toBe('ZA');
  });

  it('maps EUR to the EU flag, which has no country prefix', () => {
    expect(currencyFlagCountry('EUR')).toBe('EU');
  });

  it('gives supranational and metal codes no flag at all', () => {
    // "XO" is not a country — rendering an arbitrary flag is worse than blank.
    for (const code of ['XOF', 'XAF', 'XCD', 'XAU', 'XDR']) {
      expect(currencyFlagCountry(code)).toBeNull();
    }
  });

  it('normalizes case and whitespace', () => {
    expect(currencyFlagCountry('  ngn ')).toBe('NG');
    expect(currencyFlagCountry('usd')).toBe('US');
  });

  it('returns null for anything too short to be a currency', () => {
    expect(currencyFlagCountry('')).toBeNull();
    expect(currencyFlagCountry('NG')).toBeNull();
  });
});

describe('currencyName', () => {
  it('names the currencies the operating region actually uses', () => {
    expect(currencyName('NGN')).toBe('Nigerian Naira');
    expect(currencyName('GHS')).toBe('Ghanaian Cedi');
    expect(currencyName('KES')).toBe('Kenyan Shilling');
    expect(currencyName('ZAR')).toBe('South African Rand');
    expect(currencyName('XOF')).toBe('West African CFA Franc');
  });

  it('distinguishes codes that are one letter apart', () => {
    // The whole reason the name is shown at all.
    expect(currencyName('GHS')).not.toBe(currencyName('GMD'));
    expect(currencyName('GMD')).toBe('Gambian Dalasi');
  });

  it('normalizes case and whitespace', () => {
    expect(currencyName(' ngn ')).toBe('Nigerian Naira');
  });

  it('returns null for an unknown code so callers show the bare code', () => {
    expect(currencyName('ZZZ')).toBeNull();
    expect(currencyName('')).toBeNull();
  });
});
