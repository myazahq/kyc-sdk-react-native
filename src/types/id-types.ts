// ---------------------------------------------------------------------------
// The country and ID-type matrix.
//
// Split from config.ts (200-line rule). These exist for compile-time ergonomics
// — autocomplete and per-country narrowing — not enforcement: the org's actual
// grants live server-side, and Global Documents means any ISO country can be
// offered. Adding a country here does not grant it.
// ---------------------------------------------------------------------------

export type SupportedCountry = 'NG' | 'GH' | 'KE' | 'ZA' | 'CI';

export type NigeriaIdType = 'bvn' | 'bvn-premium' | 'nin' | 'vnin' | 'tax-id' | 'passport' | 'drivers-license' | 'pvc';
export type GhanaIdType = 'ghana-card' | 'voters' | 'drivers-license' | 'ssnit' | 'passport';
export type KenyaIdType = 'national-id' | 'passport';
export type SouthAfricaIdType = 'national-id';
export type IvoryCoastIdType = 'cni' | 'residence-card';

export type IdType =
  | NigeriaIdType
  | GhanaIdType
  | KenyaIdType
  | SouthAfricaIdType
  | IvoryCoastIdType;

/** Maps a country code to the ID types available in that country. */
export type IdTypeForCountry<C extends SupportedCountry> =
  C extends 'NG' ? NigeriaIdType :
  C extends 'GH' ? GhanaIdType :
  C extends 'KE' ? KenyaIdType :
  C extends 'ZA' ? SouthAfricaIdType :
  C extends 'CI' ? IvoryCoastIdType :
  never;

export interface IdTypeDefinition {
  key: IdType;
  label: string;
  /**
   * What the user actually types when it differs from the ID's name — e.g.
   * Tax ID lookups are keyed off the person's NIN, so the input asks for a NIN.
   */
  inputLabel?: string;
  digits?: number;
  pattern?: RegExp;
  /** Whether this ID type requires photographing/uploading a physical document. */
  requiresDocumentCapture: boolean;
  /**
   * How many sides of the document need to be scanned. Only present when
   * `requiresDocumentCapture` is true.
   * - `front_only` — single scan (passports, data-page only)
   * - `front_and_back` — both sides required
   */
  scanSides?: 'front_only' | 'front_and_back';
}

export type IdTypesByCountry = {
  [K in SupportedCountry]: readonly IdTypeDefinition[];
};
