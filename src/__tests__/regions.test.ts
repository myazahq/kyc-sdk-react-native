import { ALL_REGION_CODES, groupCountriesByRegion, regionCountryName } from '../config/regions';

// ─── Country grouping ─────────────────────────────────────────────────────────
//
// Global Documents let a workflow offer any ISO country, and ~200 rows in one
// list is a scroll rather than a chooser. Grouping is what makes the picker
// usable, so what matters is that every offered country lands SOMEWHERE, in a
// predictable order, with a readable name.

describe('names', () => {
  it('gives the English name for a code', () => {
    expect(regionCountryName('NG')).toBe('Nigeria');
    expect(regionCountryName('gh')).toBe('Ghana');
  });

  it('falls back to the code rather than throwing', () => {
    // A picker row reading "ZZ" is worse than "Zambia" and much better than a
    // crash, so an unknown or unsupported code degrades instead of failing.
    expect(regionCountryName('ZZ')).toBe('ZZ');
  });
});

describe('grouping', () => {
  it('puts each country under its region', () => {
    const groups = groupCountriesByRegion(['NG', 'FR', 'BR']);
    const byRegion = Object.fromEntries(
      groups.map((g) => [g.region, g.countries.map((c) => c.code)]),
    );
    expect(byRegion['Africa']).toEqual(['NG']);
    expect(byRegion['Europe']).toEqual(['FR']);
    expect(byRegion['Americas']).toEqual(['BR']);
  });

  it('orders regions consistently, Africa first', () => {
    // Africa leads because that is who this platform serves; a picker whose
    // section order shuffles per selection is disorienting.
    const groups = groupCountriesByRegion(['FR', 'NG', 'BR', 'JP']);
    expect(groups.map((g) => g.region)).toEqual(['Africa', 'Europe', 'Americas', 'Asia & Pacific']);
  });

  it('sorts by NAME within a region, not by code', () => {
    // "Côte d'Ivoire" (CI) must come before "Ghana" (GH) as a reader scans, and
    // codes would have put it there by accident — but "ZA"/"South Africa" is
    // where the two orders actually diverge.
    const africa = groupCountriesByRegion(['ZA', 'GH', 'NG'])[0]!;
    expect(africa.countries.map((c) => c.name)).toEqual(['Ghana', 'Nigeria', 'South Africa']);
  });

  it('normalises lower-case codes', () => {
    expect(groupCountriesByRegion(['ng'])[0]!.countries[0]!.code).toBe('NG');
  });

  it('never drops a country it has no region for', () => {
    // A country missing from the map must still be pickable — losing it makes
    // the flow silently un-completable for whoever lives there.
    const groups = groupCountriesByRegion(['NG', 'ZZ']);
    const all = groups.flatMap((g) => g.countries.map((c) => c.code));
    expect(all).toContain('ZZ');
    expect(groups[groups.length - 1]!.region).toBe('Other');
  });

  it('omits regions with nothing in them', () => {
    expect(groupCountriesByRegion(['NG']).map((g) => g.region)).toEqual(['Africa']);
  });

  it('returns nothing for an empty selection', () => {
    expect(groupCountriesByRegion([])).toEqual([]);
  });
});

describe('the full map', () => {
  it('covers the countries this platform verifies today', () => {
    for (const code of ['NG', 'GH', 'KE', 'ZA', 'CI']) {
      expect(ALL_REGION_CODES).toContain(code);
    }
  });

  it('lists no country twice', () => {
    // A duplicate would render the same country in two sections.
    expect(new Set(ALL_REGION_CODES).size).toBe(ALL_REGION_CODES.length);
  });
});

// ─── The geo row ──────────────────────────────────────────────────────────────
//
// The visitor's IP country is lifted to the top of a picker and tagged, so a
// guess made on their behalf is one tap away rather than buried among two
// hundred rows. ONE rule serves the country-select step (bare codes) and the
// dial-code sheet (option objects); the web SDK and Flutter carry the same
// semantics, and this pins them here.

import { pinGeoRow } from '../config/regions';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('pinGeoRow', () => {
  const codes = ['NG', 'GH', 'FR', 'US'];

  it('lifts the geo country out and drops it from the rest', () => {
    expect(pinGeoRow(codes, 'GH', (c) => c)).toEqual({ pinned: 'GH', rest: ['NG', 'FR', 'US'] });
  });

  it('is case-insensitive about the guess', () => {
    expect(pinGeoRow(codes, ' gh ', (c) => c).pinned).toBe('GH');
  });

  it('pins nothing when there is no guess', () => {
    expect(pinGeoRow(codes, null, (c) => c)).toEqual({ pinned: null, rest: codes });
    expect(pinGeoRow(codes, '', (c) => c)).toEqual({ pinned: null, rest: codes });
  });

  it('stays subject to the search: a guess the filter excluded is not resurrected', () => {
    // `visible` is the already-filtered list; typing "fr" left GH out of it.
    expect(pinGeoRow(['FR'], 'GH', (c) => c)).toEqual({ pinned: null, rest: ['FR'] });
  });

  it('works over option objects, returning the same instance', () => {
    const options = [
      { code: 'NG', name: 'Nigeria', dialCode: '+234' },
      { code: 'GH', name: 'Ghana', dialCode: '+233' },
    ];
    const { pinned, rest } = pinGeoRow(options, 'GH', (o) => o.code);
    expect(pinned).toBe(options[1]);
    expect(rest).toEqual([options[0]]);
  });
});

describe('every picker offers the geo row', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

  it('the country-select step hands the picker the IP country', () => {
    expect(read('screens/CountrySelectStep.tsx')).toMatch(/geoCountry=\{serverConfig\.geoCountry\}/);
    expect(read('components/CountryRegionPicker.tsx')).toMatch(/badge="Your location"/);
  });

  it('the phone field pins it in the dial-code sheet, on both mounts', () => {
    expect(read('components/PhoneNumberInput.tsx')).toMatch(/pinned=\{geoCountry\}/);
    expect(read('components/DialCodePicker.tsx')).toMatch(/'Your location'/);
    expect(read('screens/ContactVerificationStep.tsx')).toMatch(/geoCountry=\{serverConfig\.geoCountry\}/);
    expect(read('screens/BusinessDetailsStep.tsx')).toMatch(/geoCountry=\{geoCountry\}/);
    expect(read('screens/CompanyInfoFields.tsx')).toMatch(/geoCountry=\{geoCountry\}/);
  });

  it('the address-scope country control pins it on top of a region-grouped sheet', () => {
    // The sheet, not a line under the field: "Your location looks like X. Use
    // it" was removed (user decision 2026-09-06) in favour of the same pinned
    // row the country-select step and the phone field carry.
    const control = read('screens/AddressCountryControl.tsx');
    expect(control).toMatch(/geoCountry=\{inferredCountry\(geo\)\}/);
    expect(control).toMatch(/\n\s+grouped\n/);
    expect(control).not.toMatch(/looks like/);
    const field = read('components/CountryField.tsx');
    expect(field).toMatch(/pinned=\{geoCountry\}/);
    expect(field).toMatch(/grouped=\{grouped\}/);
  });
});
