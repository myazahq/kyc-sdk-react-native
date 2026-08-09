// ---------------------------------------------------------------------------
// Full ISO region grouping for the country-select step.
//
// Global Documents let a workflow offer any of ~200 countries, and a flat list
// that long is not a chooser — it is a scroll. Grouping by region (with search)
// is what makes it usable. Identical to the web SDK's `lib/regions.ts` and the
// dashboard's `lib/country-regions.ts`; keep the three in step.
//
// `Intl.DisplayNames` supplies the names. Hermes ships full-icu, so this works
// on device — but it is guarded anyway, and falls back to the ISO code, because
// a picker showing "NG" is worse than one showing "Nigeria" and much better
// than one that throws.
// ---------------------------------------------------------------------------

import { COUNTRY_NAMES } from './countryNames.g';

let cachedDn: Intl.DisplayNames | null | undefined;
function displayNames(): Intl.DisplayNames | null {
  if (cachedDn === undefined) {
    try {
      // `fallback: 'code'` returns the ISO code for a region CLDR does not
      // know, instead of throwing. A row reading "QQ" is a poor label; a crash
      // in the middle of a picker is a dead flow.
      cachedDn = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' });
    } catch {
      cachedDn = null;
    }
  }
  return cachedDn ?? null;
}

/** English name for an ISO-2 code (falls back to the code itself). */
export function regionCountryName(code: string): string {
  const up = code.toUpperCase();
  // The generated table FIRST. `Intl.DisplayNames` is not dependable on this
  // runtime — Hermes may ship without region data, in which case every row read
  // as a bare ISO code, which is what this fixes. The table is also shared with
  // the Flutter SDK, so both label a country identically.
  const known = COUNTRY_NAMES[up];
  if (known) return known;
  try {
    const name = displayNames()?.of(up);
    // CLDR maps the reserved code ZZ to the literal "Unknown Region", which as
    // a picker row tells the user nothing at all — the code is more use.
    if (!name || name === 'Unknown Region') return up;
    return name;
  } catch {
    return up;
  }
}

export type Region = 'Africa' | 'Europe' | 'Americas' | 'Middle East' | 'Asia & Pacific' | 'Other';

const REGION_ORDER: Region[] = ['Africa', 'Europe', 'Americas', 'Middle East', 'Asia & Pacific', 'Other'];

const REGION_SETS: Record<Exclude<Region, 'Other'>, string[]> = {
  Africa: [
    'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG',
    'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN',
    'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'YT', 'MA',
    'MZ', 'NA', 'NE', 'NG', 'RE', 'RW', 'SH', 'ST', 'SN', 'SC', 'SL', 'SO',
    'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'EH', 'ZM', 'ZW',
  ],
  'Middle East': [
    'AE', 'BH', 'IL', 'IQ', 'IR', 'JO', 'KW', 'LB', 'OM', 'PS', 'QA', 'SA',
    'SY', 'TR', 'YE',
  ],
  Europe: [
    'AD', 'AL', 'AT', 'AX', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE',
    'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GG', 'GI', 'GR', 'HR', 'HU',
    'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME',
    'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SJ',
    'SK', 'SM', 'UA', 'VA', 'XK',
  ],
  Americas: [
    'AG', 'AI', 'AR', 'AW', 'BB', 'BL', 'BM', 'BO', 'BQ', 'BR', 'BS', 'BZ',
    'CA', 'CL', 'CO', 'CR', 'CU', 'CW', 'DM', 'DO', 'EC', 'FK', 'GD', 'GF',
    'GL', 'GP', 'GT', 'GY', 'HN', 'HT', 'JM', 'KN', 'KY', 'LC', 'MF', 'MQ',
    'MS', 'MX', 'NI', 'PA', 'PE', 'PM', 'PR', 'PY', 'SR', 'SV', 'SX', 'TC',
    'TT', 'US', 'UY', 'VC', 'VE', 'VG', 'VI',
  ],
  'Asia & Pacific': [
    'AF', 'AM', 'AS', 'AU', 'AZ', 'BD', 'BN', 'BT', 'CK', 'CN', 'FJ', 'FM',
    'GE', 'GU', 'HK', 'ID', 'IN', 'JP', 'KG', 'KH', 'KI', 'KP', 'KR', 'KZ',
    'LA', 'LK', 'MH', 'MM', 'MN', 'MO', 'MP', 'MV', 'MY', 'NC', 'NF', 'NP',
    'NR', 'NU', 'NZ', 'PF', 'PG', 'PH', 'PK', 'PN', 'PW', 'SB', 'SG', 'TH',
    'TJ', 'TK', 'TL', 'TM', 'TO', 'TV', 'TW', 'UZ', 'VN', 'VU', 'WF', 'WS',
  ],
};

const BY_CODE = new Map<string, Region>();
for (const [region, codes] of Object.entries(REGION_SETS) as Array<[Region, string[]]>) {
  for (const code of codes) BY_CODE.set(code, region);
}

/** Every ISO code in the region map — the "all countries" picker source. */
export const ALL_REGION_CODES: string[] = Object.values(REGION_SETS).flat();

export interface RegionGroup {
  region: Region;
  countries: Array<{ code: string; name: string }>;
}

/** Group ISO codes by region (Africa first, 'Other' last), names A→Z within. */
export function groupCountriesByRegion(codes: string[]): RegionGroup[] {
  const buckets = new Map<Region, Array<{ code: string; name: string }>>();
  for (const raw of codes) {
    const code = raw.toUpperCase();
    const region = BY_CODE.get(code) ?? 'Other';
    const list = buckets.get(region) ?? [];
    list.push({ code, name: regionCountryName(code) });
    buckets.set(region, list);
  }
  return REGION_ORDER.filter((r) => buckets.has(r)).map((region) => ({
    region,
    countries: buckets.get(region)!.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
