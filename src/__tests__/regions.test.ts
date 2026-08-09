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
