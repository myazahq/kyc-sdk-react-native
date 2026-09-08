import { groupCountriesByRegion, pinGeoRow } from '../config/regions';
import type { DialCodeOption } from './DialCodePicker';

// ---------------------------------------------------------------------------
// What the country sheet lists, as data. Extracted from DialCodePicker
// (200-line rule) so the FlatList only renders: the search, the pinned geo
// row and the optional REGION grouping all decide here, and a unit test reads
// the result without mounting a sheet. Grouping is what the address-scope
// country control asks for (user decision 2026-09-06): its sheet reads like
// the web's region menu and the country-select step — a continent header,
// then its countries A–Z — rather than one 240-row alphabet. Mirrors
// Flutter's dial_code_rows.dart.
// ---------------------------------------------------------------------------

export type DialCodeItem =
  | { kind: 'row'; option: DialCodeOption }
  | { kind: 'header'; region: string };

/**
 * Match the name, the ISO code, or the dial code with or without its '+',
 * because people search for "+234", "234" and "Nigeria" in equal measure.
 */
export function filterDialCodeOptions(options: DialCodeOption[], query: string): DialCodeOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  const bare = q.replace(/^\+/, '');
  return options.filter(
    (o) =>
      o.name.toLowerCase().includes(q) ||
      o.code.toLowerCase() === q ||
      (o.dialCode != null && o.dialCode.replace(/^\+/, '').startsWith(bare)),
  );
}

/**
 * The sheet's items over the ALREADY-FILTERED options: where they appear to be
 * first (lifted out of the alphabet, still subject to the search), then the
 * rest — flat in the given order, or under region headers when `grouped`.
 */
export function buildDialCodeItems(
  visible: DialCodeOption[],
  geoCountry: string | null | undefined,
  grouped: boolean,
): { geo: DialCodeOption | null; items: DialCodeItem[] } {
  const { pinned: geo, rest } = pinGeoRow(visible, geoCountry, (o) => o.code);
  const items: DialCodeItem[] = geo ? [{ kind: 'row', option: geo }] : [];
  if (!grouped) {
    for (const option of rest) items.push({ kind: 'row', option });
    return { geo, items };
  }
  const byCode = new Map(rest.map((o) => [o.code.toUpperCase(), o]));
  for (const group of groupCountriesByRegion(rest.map((o) => o.code))) {
    items.push({ kind: 'header', region: group.region });
    for (const entry of group.countries) {
      const option = byCode.get(entry.code);
      if (option) items.push({ kind: 'row', option });
    }
  }
  return { geo, items };
}

export function dialCodeItemKey(item: DialCodeItem): string {
  return item.kind === 'header' ? `region:${item.region}` : item.option.code;
}
