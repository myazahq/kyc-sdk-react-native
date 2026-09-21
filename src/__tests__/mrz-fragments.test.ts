import { extractMrz } from '../mrz/extract';

// ─── MRZ lines the recogniser split ──────────────────────────────────────────
//
// On a high-resolution still, Android's recogniser can return one printed MRZ
// line as two text lines: a passport's two-line band came back as three lines
// and no candidate had the right width (seen on the Flutter SDK, 2026-09-15).
// These pin that split lines are joined back, and that a join still has to
// pass the check digits. Mirrored in kyc-sdk-flutter's mrz_extract_test.dart.

// ICAO 9303 specimen, the same one mrz.test.ts uses.
const TD3_L1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
const TD3_L2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';
const NOW = new Date('2026-01-01T00:00:00Z');

describe('split MRZ lines', () => {
  it('trims a trailing filler run the recogniser over-counted', () => {
    // Every '<' of the name padding read as '«', so the run maps to twice its
    // printed length and the line comes back 63 wide.
    const line1 = `P<UTOERIKSSON<<ANNA<MARIA${'«'.repeat(19)}`;
    expect(extractMrz([line1, TD3_L2], NOW)?.documentNumber).toBe('L898902C3');
  });

  it('pads a trailing filler run the recogniser under-counted', () => {
    const line1 = `P<UTOERIKSSON<<ANNA<MARIA${'<'.repeat(6)}`;
    expect(extractMrz([line1, TD3_L2], NOW)?.documentNumber).toBe('L898902C3');
  });

  it('joins a first line split in two', () => {
    const lines = ['PASSPORT', 'P<UTOERIKSSON<<ANNA<MARIA', '<<<<<<<<<<<<<<<<<<<', TD3_L2];
    expect(extractMrz(lines, NOW)?.documentNumber).toBe('L898902C3');
  });

  it('joins a second line split mid-field', () => {
    const lines = [TD3_L1, 'L898902C36UTO7408122F12', '04159ZE184226B<<<<<10'];
    expect(extractMrz(lines, NOW)?.documentNumber).toBe('L898902C3');
  });

  it('joins both lines split, with page text around them', () => {
    const lines = [
      'Date of Expiry',
      'P<UTOERIKSSON<<',
      'ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
      'L898902C36UTO7408122F',
      '1204159ZE184226B<<<<<10',
      'Holder signature',
    ];
    expect(extractMrz(lines, NOW)?.documentNumber).toBe('L898902C3');
  });

  it('does not accept a join that fails its check digits', () => {
    const lines = [TD3_L1, 'L898902C36UTO7408122F12', '04159ZE184226B<<<<<11'];
    expect(extractMrz(lines, NOW)).toBeNull();
  });

  it('finds nothing in page text alone', () => {
    expect(extractMrz(['FEDERAL REPUBLIC', 'PASSPORT', 'Date of Birth'], NOW)).toBeNull();
  });
});
