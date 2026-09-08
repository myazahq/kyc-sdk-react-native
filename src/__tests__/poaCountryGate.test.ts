import { readFileSync } from 'fs';
import { join } from 'path';

import { poaCountryDeclared } from '../lib/poa-country-gate';

// The Proof of Address step's Continue holds until the address scope's country
// is declared (user decision 2026-09-08). Mirrored on web and Flutter.
describe('poaCountryDeclared', () => {
  it('outside the address scope the flow country stands', () => {
    expect(poaCountryDeclared({ scope: null, selectedCountry: null, offered: [] })).toBe(true);
    expect(poaCountryDeclared({ scope: 'contact', selectedCountry: null, offered: [] })).toBe(true);
  });

  it('on the address scope a picked country declares it', () => {
    expect(poaCountryDeclared({ scope: 'address', selectedCountry: 'NG', offered: ['NG', 'GH'] })).toBe(true);
    expect(poaCountryDeclared({ scope: 'address', selectedCountry: null, offered: ['NG', 'GH'] })).toBe(false);
    expect(poaCountryDeclared({ scope: 'address', selectedCountry: ' ', offered: ['NG', 'GH'] })).toBe(false);
  });

  it('one accepted country is a settled fact, not a choice', () => {
    expect(poaCountryDeclared({ scope: 'address', selectedCountry: null, offered: ['NG'] })).toBe(true);
  });

  it('the PoA step gates Continue on it', () => {
    const src = readFileSync(join(__dirname, '../screens/ProofOfAddressStep.tsx'), 'utf8');
    expect(src).toContain('poaCountryDeclared(');
    expect(src).toMatch(/label="Continue"[\s\S]{0,120}countryDeclared/);
  });
});
