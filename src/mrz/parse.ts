// ---------------------------------------------------------------------------
// MRZ parsing (ICAO 9303).
//
// The Machine Readable Zone off a document's photo page: TD3 (passports, 2×44)
// and TD1 (ID cards, 3×30), validated with the 7-3-1 check digits.
//
// Unlike the server — which reads EXACT bytes off the chip's DG1 — this parses
// OCR output, which misreads characters. Two defences:
//
//   1. Numeric-only fields (dates, check digits) get an OCR-confusion pass
//      (O→0, I→1, S→5, …) before validation. It is applied ONLY where the spec
//      says the field is numeric — running it over a name or a document number
//      would corrupt letters that are genuinely there.
//   2. Nothing is accepted unless EVERY check digit passes. That makes a bad
//      frame self-rejecting: the scanner simply keeps looking, and a misread
//      never becomes a wrong document number.
//
// The second point is what makes this safe to trust. A wrong document number
// would be used as a BAC key (the chip refuses, harmlessly) or, worse, sent to
// a paid government lookup that would return a confident "not found".
// ---------------------------------------------------------------------------

const WEIGHTS = [7, 3, 1];

/** 7-3-1 weighted modulus-10 check digit over an MRZ field. */
export function mrzCheckDigit(field: string): number {
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const c = field.charCodeAt(i);
    // '0'–'9' → 0–9, 'A'–'Z' → 10–35, '<' (and anything else) → 0.
    const v = c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 90 ? c - 55 : 0;
    sum += v * WEIGHTS[i % 3]!;
  }
  return sum % 10;
}

/**
 * Letters OCR commonly returns in place of digits.
 *
 * Only ever applied to fields the spec defines as numeric. Applying it to a
 * name or document number would turn a real 'O' into a '0'.
 */
function toDigits(s: string): string {
  return s.replace(/[OQDU]/g, '0').replace(/[IL]/g, '1').replace(/Z/g, '2')
    .replace(/S/g, '5').replace(/G/g, '6').replace(/T/g, '7').replace(/B/g, '8');
}

function digitOk(field: string, checkDigit: string): boolean {
  const fixed = toDigits(checkDigit);
  if (fixed.length !== 1) return false;
  const code = fixed.charCodeAt(0);
  if (code < 48 || code > 57) return false;
  return mrzCheckDigit(field) === code - 48;
}

/**
 * A YYMMDD field as a date.
 *
 * The century is inferred, because the MRZ does not carry it. Birth dates pivot
 * on the current year (a two-digit year later than today must be last century);
 * expiry pivots at 70, since eMRTD validity is at most ten years, so anything
 * that high cannot be a future date.
 */
function mrzDate(raw: string, opts: { expiry: boolean; now: Date }): Date | null {
  const yymmdd = toDigits(raw);
  if (yymmdd.length !== 6 || !/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const nowYY = opts.now.getFullYear() % 100;
  const century = opts.expiry ? (yy >= 70 ? 1900 : 2000) : yy > nowYY ? 1900 : 2000;
  return new Date(Date.UTC(century + yy, mm - 1, dd));
}

/** Filler-stripped text, or null when the field was empty. */
function clean(s: string): string | null {
  const v = s.replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  return v === '' ? null : v;
}

/** The fields the BAC key needs, plus the biodata worth showing back. */
export interface MrzScan {
  format: 'TD1' | 'TD3';
  documentNumber: string;
  /** ISO date (YYYY-MM-DD) — the shape the rest of the SDK passes around. */
  dateOfBirth: string;
  dateOfExpiry: string;
  firstName?: string;
  lastName?: string;
  nationality?: string;
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);

function parseTd3(l1: string, l2: string, now: Date): MrzScan | null {
  const docNumber = l2.slice(0, 9);
  const dob = l2.slice(13, 19);
  const expiry = l2.slice(21, 27);
  const personal = l2.slice(28, 42);
  const personalCd = l2[42]!;
  const composite = l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43);

  const valid =
    digitOk(docNumber, l2[9]!) &&
    digitOk(dob, l2[19]!) &&
    digitOk(expiry, l2[27]!) &&
    // An unused personal-number field carries either filler or '0' as its
    // check digit, depending on the issuer.
    (clean(personal) === null
      ? personalCd === '<' || personalCd === '0'
      : digitOk(personal, personalCd)) &&
    digitOk(composite, l2[43]!);
  if (!valid) return null;

  const birth = mrzDate(dob, { expiry: false, now });
  const expires = mrzDate(expiry, { expiry: true, now });
  const number = clean(docNumber)?.replace(/ /g, '');
  if (!birth || !expires || !number) return null;

  const names = l1.slice(5).split('<<');
  return {
    format: 'TD3',
    documentNumber: number,
    dateOfBirth: iso(birth),
    dateOfExpiry: iso(expires),
    lastName: clean(names[0] ?? '') ?? undefined,
    firstName: clean(names.slice(1).join(' ')) ?? undefined,
    nationality: clean(l2.slice(10, 13)) ?? undefined,
  };
}

function parseTd1(l1: string, l2: string, l3: string, now: Date): MrzScan | null {
  const docNumber = l1.slice(5, 14);
  const dob = l2.slice(0, 6);
  const expiry = l2.slice(8, 14);
  const composite =
    l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);

  const valid =
    digitOk(docNumber, l1[14]!) &&
    digitOk(dob, l2[6]!) &&
    digitOk(expiry, l2[14]!) &&
    digitOk(composite, l2[29]!);
  if (!valid) return null;

  const birth = mrzDate(dob, { expiry: false, now });
  const expires = mrzDate(expiry, { expiry: true, now });
  const number = clean(docNumber)?.replace(/ /g, '');
  if (!birth || !expires || !number) return null;

  const names = l3.split('<<');
  return {
    format: 'TD1',
    documentNumber: number,
    dateOfBirth: iso(birth),
    dateOfExpiry: iso(expires),
    lastName: clean(names[0] ?? '') ?? undefined,
    firstName: clean(names.slice(1).join(' ')) ?? undefined,
    nationality: clean(l2.slice(15, 18)) ?? undefined,
  };
}

/**
 * Parse a continuous MRZ string (88 chars = TD3, 90 = TD1).
 *
 * Returns null when it is not syntactically valid or ANY check digit fails —
 * there is no partial success, because a partially-correct MRZ is a wrong
 * document number wearing a plausible disguise.
 */
export function parseMrz(text: string, now: Date = new Date()): MrzScan | null {
  const flat = text.toUpperCase().replace(/[^A-Z0-9<]/g, '');
  if (flat.length === 88) return parseTd3(flat.slice(0, 44), flat.slice(44), now);
  if (flat.length === 90) {
    return parseTd1(flat.slice(0, 30), flat.slice(30, 60), flat.slice(60), now);
  }
  return null;
}
