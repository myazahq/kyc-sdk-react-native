import { mrzCheckDigit, parseMrz } from '../mrz/parse';
import { extractMrz, looksLikeMrzLine, sanitizeMrzLine } from '../mrz/extract';

// ─── MRZ parsing ──────────────────────────────────────────────────────────────
//
// The canonical TD3 specimen from ICAO 9303 Part 3 (Utopia / ANNA MARIA
// ERIKSSON). Using the standard's OWN example means the check-digit arithmetic
// is verified against the spec rather than against our reading of it.
//
// The property that matters most: a misread MRZ must produce NOTHING, not
// something plausible. A wrong document number would be spent on a paid
// government lookup that returns a confident "not found", or handed to a chip
// as a BAC key that silently refuses — both far worse than another frame.

const TD3_L1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
const TD3_L2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';
const NOW = new Date('2026-01-01T00:00:00Z');

describe('the check digit', () => {
  it('matches the ICAO worked examples', () => {
    expect(mrzCheckDigit('520727')).toBe(3);
    expect(mrzCheckDigit('AB2134<<<')).toBe(5);
  });

  it('treats filler as zero', () => {
    expect(mrzCheckDigit('<<<')).toBe(0);
  });
});

describe('TD3 (passports)', () => {
  it('parses the ICAO specimen', () => {
    const scan = parseMrz(TD3_L1 + TD3_L2, NOW);
    expect(scan).not.toBeNull();
    expect(scan!.format).toBe('TD3');
    expect(scan!.documentNumber).toBe('L898902C3');
    expect(scan!.dateOfBirth).toBe('1974-08-12');
    expect(scan!.dateOfExpiry).toBe('2012-04-15');
    expect(scan!.lastName).toBe('ERIKSSON');
    expect(scan!.firstName).toBe('ANNA MARIA');
    expect(scan!.nationality).toBe('UTO');
  });

  it('rejects a corrupted check digit', () => {
    // Flip the document-number check digit 6 → 7. This is exactly what one
    // misread character looks like, and it must not survive.
    const bad = TD3_L2.slice(0, 9) + '7' + TD3_L2.slice(10);
    expect(parseMrz(TD3_L1 + bad, NOW)).toBeNull();
  });

  it('rejects a wrong-length MRZ', () => {
    expect(parseMrz(TD3_L1, NOW)).toBeNull();
    expect(parseMrz('', NOW)).toBeNull();
  });

  it('ignores whitespace and case the recogniser introduced', () => {
    const messy = `${TD3_L1}\n  ${TD3_L2.toLowerCase()}  `;
    expect(parseMrz(messy, NOW)?.documentNumber).toBe('L898902C3');
  });
});

describe('century inference', () => {
  it('reads a birth year later than today as last century', () => {
    // The MRZ carries no century. A two-digit birth year in the future has to
    // be 19xx — nobody being verified was born next year.
    expect(parseMrz(TD3_L1 + TD3_L2, NOW)!.dateOfBirth).toBe('1974-08-12');
  });

  it('pivots expiry at 70, because validity is at most ten years', () => {
    // '12' expiry with a 2026 "now" is 2012 — a lapsed passport, which is a
    // legitimate thing to read; treating it as 2112 would be nonsense.
    expect(parseMrz(TD3_L1 + TD3_L2, NOW)!.dateOfExpiry).toBe('2012-04-15');
  });
});

describe('finding it on the page', () => {
  it('picks the MRZ out of ordinary printed text', () => {
    const scan = extractMrz(
      ['PASSPORT', 'Type P  Code UTO', 'Surname ERIKSSON', TD3_L1, TD3_L2],
      NOW,
    );
    expect(scan?.documentNumber).toBe('L898902C3');
  });

  it('handles a recogniser that merged both lines', () => {
    expect(extractMrz([TD3_L1 + TD3_L2], NOW)?.documentNumber).toBe('L898902C3');
  });

  it('recovers a line clipped of its trailing filler', () => {
    // Recognisers routinely drop the last '<' or two off a padded line.
    expect(extractMrz([TD3_L1.slice(0, 43), TD3_L2], NOW)?.documentNumber).toBe(
      'L898902C3',
    );
  });

  it('recovers a line with a stray glyph from the page edge', () => {
    expect(extractMrz([`${TD3_L1}#`, TD3_L2], NOW)?.documentNumber).toBe('L898902C3');
  });

  it('returns nothing for a frame with no MRZ', () => {
    expect(extractMrz(['Hello', 'World'], NOW)).toBeNull();
    expect(extractMrz([], NOW)).toBeNull();
  });

  it('returns nothing rather than a guess when the lines do not validate', () => {
    // Two MRZ-SHAPED lines that are not a real MRZ. The grouping happily tries
    // them; the check digits are what refuse.
    const junk = 'X'.repeat(20) + '<'.repeat(24);
    expect(extractMrz([junk, junk], NOW)).toBeNull();
  });
});

describe('line filtering', () => {
  it('strips characters that cannot appear in an MRZ', () => {
    expect(sanitizeMrzLine('l898-902 c36')).toBe('L898902C36');
  });

  it('needs filler density, not just length, to call a line MRZ-shaped', () => {
    // A passport's printed fields produce plenty of long lines; only the MRZ is
    // padded with '<'.
    expect(looksLikeMrzLine('THISISALONGLINEOFORDINARYTEXTWITHNOFILLER')).toBe(false);
    expect(looksLikeMrzLine(TD3_L1)).toBe(true);
  });

  it('rejects a line too short to be an MRZ row', () => {
    expect(looksLikeMrzLine('P<UTO<<')).toBe(false);
  });
});
