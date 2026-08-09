import type { IdTypeDefinition, IdTypesByCountry } from '../types/config';

/**
 * Source of truth for the supported `(country, idType)` matrix — identical to
 * the web SDK's `utils/countries.ts` and the Flutter SDK's `id_types.dart`.
 * `requiresDocumentCapture: false` ⇒ number-only path (no document scan).
 */
export const ID_TYPES: IdTypesByCountry = {
  NG: [
    { key: 'bvn',             label: 'BVN',                            digits: 11,                    requiresDocumentCapture: false },
    { key: 'bvn-premium',     label: 'BVN Premium',                    digits: 11,                    requiresDocumentCapture: false },
    { key: 'tax-id',          label: 'Tax ID', inputLabel: 'NIN',      digits: 11,                    requiresDocumentCapture: false },
    { key: 'nin',             label: 'NIN',                            digits: 11,                    requiresDocumentCapture: false },
    { key: 'vnin',            label: 'Virtual NIN (vNIN)',             digits: 16,                    requiresDocumentCapture: false },
    { key: 'passport',        label: 'International Passport',          pattern: /^[A-Z]\d{8}$/,       requiresDocumentCapture: true, scanSides: 'front_only'     },
    { key: 'drivers-license', label: "Driver's License",               pattern: /^[A-Z]{3}\d{5,12}$/, requiresDocumentCapture: true, scanSides: 'front_and_back' },
    { key: 'pvc',             label: "Permanent Voter's Card",         pattern: /^\d{19}$/,           requiresDocumentCapture: true, scanSides: 'front_and_back' },
  ],
  GH: [
    { key: 'ghana-card',      label: 'Ghana Card',                     pattern: /^GHA-\d{9}-\d$/,     requiresDocumentCapture: true, scanSides: 'front_and_back' },
    { key: 'voters',          label: "Voter's Card",                   digits: 10,                    requiresDocumentCapture: true, scanSides: 'front_and_back' },
    { key: 'drivers-license', label: "Driver's License",                                              requiresDocumentCapture: true, scanSides: 'front_and_back' },
    { key: 'ssnit',           label: 'SSNIT',                          digits: 13,                    requiresDocumentCapture: true, scanSides: 'front_only'     },
    { key: 'passport',        label: 'Passport',                       pattern: /^[A-Z]\d{7}$/,       requiresDocumentCapture: true, scanSides: 'front_only'     },
  ],
  KE: [
    { key: 'national-id',     label: 'National ID',                    digits: 8,                     requiresDocumentCapture: true, scanSides: 'front_and_back' },
    { key: 'passport',        label: 'Passport',                                                      requiresDocumentCapture: true, scanSides: 'front_only'     },
  ],
  ZA: [
    { key: 'national-id',     label: 'National ID',                    digits: 13,                    requiresDocumentCapture: true, scanSides: 'front_and_back' },
  ],
  CI: [
    { key: 'cni',             label: "CNI (Carte Nationale d'Identité)",                              requiresDocumentCapture: true, scanSides: 'front_and_back' },
    { key: 'residence-card',  label: 'Residence Card',                                                requiresDocumentCapture: true, scanSides: 'front_and_back' },
  ],
} as const;

const ALL_ID_TYPES = Object.values(ID_TYPES).flat();

/**
 * Returns true for IDs that skip document capture and go straight to the
 * id-input form (user types their number manually). Nigeria: BVN, NIN, vNIN.
 */
export function isNumberOnlyIdType(idType: string): boolean {
  const def = ALL_ID_TYPES.find((t) => t.key === idType);
  return def ? !def.requiresDocumentCapture : false;
}

/**
 * ID keys whose physical document carries an ICAO 9303 eMRTD chip.
 *
 * A FALLBACK only. Chip capability is catalogue-driven SERVER-side and arrives
 * per row on `/api/kyc/config` as `supportsNfc`; that answer is authoritative
 * and covers documents this local list has never heard of (every country's
 * passport, for one). This list is what the flow uses before config lands.
 *
 * Matches the Flutter SDK's `IdTypeConfig.supportsNfc`.
 */
const CHIP_CAPABLE_KEYS = new Set(['passport', 'ghana-card', 'cni']);

/**
 * Whether the document behind this ID has a readable chip.
 *
 * `serverSupportsNfc` is the row from `/api/kyc/config` when it has loaded —
 * pass it and it wins outright, including its `false`.
 */
export function supportsNfcChip(
  _country: string,
  idType: string,
  serverSupportsNfc?: boolean,
): boolean {
  if (serverSupportsNfc !== undefined) return serverSupportsNfc;
  return CHIP_CAPABLE_KEYS.has(idType);
}

/** Returns true when the selected ID type requires a physical document scan. */
export function requiresDocumentCapture(idType: string): boolean {
  const def = ALL_ID_TYPES.find((t) => t.key === idType);
  return def ? def.requiresDocumentCapture : true;
}

/**
 * Returns the scan-sides configuration for a document ID type. Defaults to
 * `'front_only'` when not explicitly set.
 */
export function getScanSides(idType: string): 'front_only' | 'front_and_back' {
  const def = ALL_ID_TYPES.find((t) => t.key === idType);
  return def?.scanSides ?? 'front_only';
}

/**
 * The document's name, short enough to sit in a pill beside a flag.
 *
 * The catalogue label is written for a PICKER, where "International Passport"
 * disambiguates. Beside a flag it is redundant twice over — the country is
 * already shown, and nobody is choosing anything at the camera. Keyed off the
 * ID type rather than trimmed from the string, so it holds for every country's
 * passport whatever its catalogue label says.
 */
export function shortDocumentLabel(idType: string | null, label: string): string {
  return idType === 'passport' ? 'Passport' : label;
}

/** `drivers-license` → `Drivers License`. Last-resort label for an unknown key. */
export function humanizeIdType(key: string): string {
  return key
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

/** The server-config metadata a row carries for one (country, idType) pair. */
export interface IdTypeRowMeta {
  label?: string;
  requiresDocumentCapture?: boolean;
  scanSides?: string;
  supportsNfc?: boolean;
}

/**
 * The definition for a (country, idType) pair.
 *
 * A curated entry wins; otherwise one is SYNTHESIZED from the server row. That
 * fallback is the whole point: the curated table only covers the five gov-DB
 * countries, while Global Documents lets a workflow offer any of ~240. Without
 * it, every country outside that table renders an empty ID list — the flow
 * looks like the org has no access when it simply has no curated entry.
 *
 * Mirrors the Flutter SDK's `resolveIdTypeDefinition`.
 */
export function resolveIdTypeDefinition(
  country: string,
  key: string,
  meta: IdTypeRowMeta = {},
): IdTypeDefinition {
  // Indexed loosely on purpose: `IdTypesByCountry` is keyed by the five curated
  // countries, and the whole point here is being asked about the other ~235.
  const table = ID_TYPES as Record<string, readonly IdTypeDefinition[] | undefined>;
  const curated = (table[country.toUpperCase()] ?? []).find((t) => t.key === key);
  if (curated) return curated;

  // Default to needing a document: an unknown ID is far more likely to be a
  // physical card than a number the user can type, and asking for a photo that
  // wasn't needed is recoverable in a way that skipping capture is not.
  const needsCapture = meta.requiresDocumentCapture ?? true;
  return {
    key: key as IdTypeDefinition['key'],
    label: meta.label && meta.label.length > 0 ? meta.label : humanizeIdType(key),
    requiresDocumentCapture: needsCapture,
    ...(needsCapture
      ? { scanSides: meta.scanSides === 'front_and_back' ? 'front_and_back' : 'front_only' }
      : {}),
  } as IdTypeDefinition;
}

// Card-guide / crop aspect (width ÷ height) for the live camera. Mirrors the
// Flutter SDK's documentGuideAspect: ID-1 cards use 1.586; passports use a taller
// 1.42 so the data page's bottom MRZ band isn't cropped off.
export const CARD_GUIDE_ASPECT = 85.6 / 53.98; // ISO/IEC 7810 ID-1 ≈ 1.586
export const PASSPORT_GUIDE_ASPECT = 1.42;

export function documentGuideAspect(idType: string | null): number {
  return idType === 'passport' ? PASSPORT_GUIDE_ASPECT : CARD_GUIDE_ASPECT;
}

export const COUNTRY_LABELS: Record<string, string> = {
  NG: 'Nigeria',
  GH: 'Ghana',
  KE: 'Kenya',
  ZA: 'South Africa',
  CI: "Côte d'Ivoire",
};
