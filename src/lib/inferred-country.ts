import { tryRequire } from '../services/fingerprint-sources';

// ---------------------------------------------------------------------------
// The visitor's most likely country, for DEFAULTS only (never evidence). A
// mirror of the web SDK's lib/inferred-country.ts — keep the three in
// lockstep.
//
// Two tiers: the server's IP-derived `geoCountry` when it exists, else the
// device's own locale region (en-NG → NG). The second tier is what makes
// inference work where the IP cannot answer at all — a dev server on a
// loopback address, a carrier GeoLite2 cannot place — from a signal the
// device already carries. Both are guesses a person can correct; nothing
// recorded branches on them.
// ---------------------------------------------------------------------------

const ISO2 = /^[A-Z]{2}$/;

interface LocalizationLike {
  getLocales?: () => Array<{ regionCode?: string | null; languageTag?: string | null }>;
}

/** The region subtag of a BCP-47 tag (`en-NG`, `en_NG`, `yo-Latn-NG`). The
 *  first subtag is the LANGUAGE ("en"), never a region, so it is skipped. */
export function regionOfLocaleTag(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const [, ...rest] = tag.split(/[-_]/);
  const region = rest.find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase();
  return region && ISO2.test(region) ? region : null;
}

/** The device's locale tags, best first. expo-localization when the host
 *  installed it (it carries an explicit region), else the JS runtime's. */
export function deviceLocaleTags(): string[] {
  const tags: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const localization = tryRequire<LocalizationLike>(() => require('expo-localization'));
  try {
    for (const locale of localization?.getLocales?.() ?? []) {
      if (locale.regionCode) tags.push(`und-${locale.regionCode}`);
      else if (locale.languageTag) tags.push(locale.languageTag);
    }
  } catch {
    // A partial module; fall through to the runtime.
  }
  try {
    const runtime = Intl.DateTimeFormat().resolvedOptions().locale;
    if (runtime) tags.push(runtime);
  } catch {
    // No Intl on this runtime.
  }
  return tags;
}

export function inferredCountry(
  geoCountry?: string | null,
  localeTags: string[] = deviceLocaleTags(),
): string | null {
  const geo = geoCountry?.trim().toUpperCase();
  if (geo && ISO2.test(geo)) return geo;
  for (const tag of localeTags) {
    const region = regionOfLocaleTag(tag);
    if (region) return region;
  }
  return null;
}
