// ---------------------------------------------------------------------------
// Document identity signals.
//
// "Is the thing in frame actually the document the user picked?" — answered
// from recognized text alone.
//
// Geometry cannot answer it: an aspect ratio cannot tell a passport from a
// driver's licence. Text can, and more specifically — a passport page says
// PASSPORT and carries an MRZ; a Nigerian licence says FRSC.
//
// Deliberately mirrors the SERVER's DOCUMENT_SIGNALS / detectDocumentType
// (kyc-core src/lib/ocr-parser.ts). The server rejects a mismatched document
// AFTER upload with `document_type_mismatch`, so matching its vocabulary here
// means the camera refuses to shoot exactly what the server would later throw
// away. Keep the lists in sync when either changes — and with the Flutter SDK's
// document_type_signals.dart, which is the direct counterpart.
// ---------------------------------------------------------------------------

/** Keyword signals per country → ID type. Uppercase; matched as substrings. */
export const DOCUMENT_SIGNALS: Record<string, Record<string, string[]>> = {
  NG: {
    passport: ['PASSPORT', 'TRAVEL DOCUMENT', 'P<NGA'],
    'drivers-license': [
      'DRIVER', 'LICENSE', 'FRSC', 'FEDERAL ROAD SAFETY', 'DRIVING LICENCE',
    ],
    pvc: [
      'VOTER', "VOTER'S CARD", 'PVC', 'INEC', 'INDEPENDENT NATIONAL ELECTORAL',
      'PERMANENT VOTER', 'ELECTORAL COMMISSION', 'VIN',
    ],
  },
  GH: {
    passport: ['PASSPORT', 'REPUBLIC OF GHANA', 'P<GHA'],
    'ghana-card': ['GHANA CARD', 'NATIONAL IDENTIFICATION AUTHORITY', 'NIA', 'GHA-'],
    voters: ['VOTER', 'ELECTORAL COMMISSION', 'EC OF GHANA'],
    'drivers-license': ['DRIVER', 'LICENSE', 'DVLA', 'DRIVING AND VEHICLE'],
    ssnit: ['SSNIT', 'SOCIAL SECURITY', 'NATIONAL INSURANCE'],
  },
  KE: {
    passport: ['PASSPORT', 'REPUBLIC OF KENYA', 'P<KEN'],
    'national-id': [
      'REPUBLIC OF KENYA', 'NATIONAL ID', 'JAMHURI YA KENYA', 'IDENTITY CARD',
    ],
  },
  ZA: {
    passport: ['PASSPORT', 'P<ZAF'],
    'national-id': [
      'REPUBLIC OF SOUTH AFRICA', 'IDENTITY', 'ID NUMBER', 'REPUBLIEK VAN SUID-AFRIKA',
    ],
  },
  CI: {
    cni: ['CARTE NATIONALE', 'IDENTITE', 'REPUBLIQUE DE COTE', 'CNI'],
    'residence-card': ['CARTE DE SEJOUR', 'RESIDENCE', 'TITRE DE SEJOUR'],
  },
};

/**
 * Words that identify a passport in ANY country — an MRZ, or the word itself in
 * English or French. Global Documents means most countries have no curated
 * list, and a passport is the one document that identifies itself everywhere.
 */
const UNIVERSAL_PASSPORT_WORDS = ['PASSPORT', 'PASSEPORT'];

/**
 * True when `lines` contain two or more machine-readable-zone lines. A cheap
 * STRUCTURAL check — no check-digit validation, which `extractMrz` does.
 */
export function hasMrzLines(lines: string[]): boolean {
  let count = 0;
  for (const line of lines) {
    const stripped = line.toUpperCase().replace(/[^A-Z0-9<]/g, '');
    if (stripped.length >= 40 && stripped.includes('<')) count += 1;
  }
  return count >= 2;
}

export interface DocumentTypeMatch {
  /** The ID type the text matches best, or null when nothing matched. */
  type: string | null;
  /**
   * 0..1 share of that type's keywords present.
   *
   * A RATIO, so it shrinks as a type's synonym list grows — which is why it
   * cannot be the only bar for "is this the right document". See `matched`.
   */
  confidence: number;
  /**
   * How many keywords actually hit.
   *
   * The evidence that matters when deciding the document IS the expected one:
   * two independent hits mean the same thing whether the type lists three
   * synonyms or eight, where `confidence` would call the same evidence 0.67 or
   * 0.25. Kept alongside rather than replacing it — the wrong-type comparison
   * still wants a ratio, so two types are weighed on one scale.
   */
  matched: number;
}

const NO_MATCH: DocumentTypeMatch = { type: null, confidence: 0, matched: 0 };

/**
 * True when we have signals to verify this (country, idType) at all. When
 * false the caller CANNOT check identity and must not block on it — most
 * Global Documents countries have no curated list.
 */
export function hasDocumentSignals(country: string, idType: string): boolean {
  if (DOCUMENT_SIGNALS[country]?.[idType]) return true;
  // A passport identifies itself in any country.
  return idType === 'passport';
}

function isShortAcronym(keyword: string): boolean {
  return keyword.length <= 4 && /^[A-Z]+$/.test(keyword);
}

/**
 * How many of `keywords` appear in `upper`.
 *
 * Short acronyms match on WORD BOUNDARIES, not as bare substrings. `VIN` sits
 * inside "driVINg", so a Nigerian driver's licence would otherwise score a
 * voter-card hit — harmless while every score is diluted by the keyword count,
 * and a false identification the moment anything counts hits directly.
 */
export function countSignalHits(upper: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (isShortAcronym(keyword)) {
      if (new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(upper)) {
        hits += 1;
      }
    } else if (upper.includes(keyword)) {
      hits += 1;
    }
  }
  return hits;
}

/** Best-matching document type for the recognized `lines` within `country`. */
export function detectDocumentType(lines: string[], country: string): DocumentTypeMatch {
  if (lines.length === 0) return NO_MATCH;
  const upper = lines.join('\n').toUpperCase();
  const signals = DOCUMENT_SIGNALS[country] ?? {};

  let bestType: string | null = null;
  let bestConfidence = 0;
  let bestMatched = 0;

  for (const [type, keywords] of Object.entries(signals)) {
    if (keywords.length === 0) continue;
    const matched = countSignalHits(upper, keywords);
    const confidence = matched / keywords.length;
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatched = matched;
      bestType = type;
    }
  }

  // Universal passport fallback — an MRZ is worth a lot on its own, since only
  // travel documents carry one.
  const mrz = hasMrzLines(lines);
  const saysPassport = UNIVERSAL_PASSPORT_WORDS.some((w) => upper.includes(w));
  if (mrz || saysPassport) {
    const keywords = signals.passport ?? [];
    const matched = countSignalHits(upper, keywords);
    const base = keywords.length === 0 ? 0 : matched / keywords.length;
    const confidence = Math.min(1, Math.max(0, base + (mrz ? 0.5 : 0.25)));
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatched = matched + 1; // the MRZ / the word itself is evidence too
      bestType = 'passport';
    }
  }

  return bestType == null
    ? NO_MATCH
    : { type: bestType, confidence: bestConfidence, matched: bestMatched };
}
