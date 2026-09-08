import { readFileSync } from 'fs';
import { join } from 'path';

import { adoptionDecision, geoDefaultCountry } from '../lib/country-adoption';

// ─── The shared vectors (kyc-sdk-flutter/test/country_adoption_vectors.json)
//
// One rule decides when a geocode or a picked address may change the declared
// country, on all three SDKs. The vectors are the one place it is written
// down as data; the web and Flutter mirrors run the same file. The second
// group pins this SDK's own wiring, since a decision nobody calls is no rule.

interface AdoptionVector {
  name: string;
  input: {
    country: string | null;
    selectedCountry: string | null;
    countryAutoPicked: boolean;
    scope: string | null;
    accepted: string[] | null;
    explicit: boolean;
  };
  expect: 'set' | 'set-auto' | null;
}
interface GeoVector {
  name: string;
  input: { geoCountry: string | null; selectedCountry: string | null; scope: string | null; accepted: string[] | null };
  expect: string | null;
}

const shared = JSON.parse(
  readFileSync(join(__dirname, '../../../kyc-sdk-flutter/test/country_adoption_vectors.json'), 'utf8'),
) as { adoption: AdoptionVector[]; geoDefault: GeoVector[] };

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('adoptionDecision (shared vectors, RN mirror)', () => {
  for (const v of shared.adoption) {
    it(v.name, () => {
      const decision = adoptionDecision(v.input);
      const label = decision === null ? null : decision.auto ? 'set-auto' : 'set';
      expect(label).toBe(v.expect);
      if (decision) expect(decision.country).toMatch(/^[A-Z]{2}$/);
    });
  }
});

describe('geoDefaultCountry (shared vectors, RN mirror)', () => {
  for (const v of shared.geoDefault) {
    it(v.name, () => {
      expect(geoDefaultCountry(v.input)).toBe(v.expect);
    });
  }
});

describe('the flow runs the rule', () => {
  it('every fix and reverse geocode hands its country to adoption', () => {
    expect(read('screens/address/use-label-pin.ts')).toMatch(/onGeocoded\(r\.parts\?\.country\)/);
    const actions = read('screens/address/use-pin-actions.ts');
    expect(actions.match(/adoptGeocodedCountry\(f\?\.parts\?\.country\)/g)).toHaveLength(3);
    expect(actions).toMatch(/adoptGeocodedCountry\(cachedFix\(\)\?\.parts\?\.country\)/);
  });

  it('a picked address is explicit, and the address scope geo-defaults', () => {
    expect(read('screens/address/AddressSearchStep.tsx')).toMatch(
      /adoptGeocodedCountry\(hit\.country, \{ explicit: true \}\)/,
    );
    expect(read('screens/address/use-address-flow.ts')).toMatch(/geoDefaultCountry\(/);
  });

  it('the store flags a guessed country and a pick clears it', () => {
    const store = read('store/kycStore.ts');
    expect(store).toMatch(/setCountryAuto\(country\)/);
    expect(store).toMatch(/selectedCountry: country,\s*countryAutoPicked: false,/);
  });

  it("the pin, hit, place and the restored snapshot all carry the geocoder's country", () => {
    const types = read('services/api-types.ts');
    expect(types.match(/country\?: string \| null;/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(read('store/address.ts')).toMatch(/country: str\(p\['country'\]\)/);
  });
});
