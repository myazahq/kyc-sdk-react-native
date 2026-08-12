import { parseDg1 } from '../emrtd/dg1';
import { mrzCheckDigit, parseMrz } from '../mrz/parse';

// The real document this was found on: a Nigerian passport read over PACE on a
// Galaxy S24.
//
// Line 2 is BUILT with `mrzCheckDigit` rather than typed out. Hand-writing check
// digits produces a fixture that fails for a reason unrelated to what is being
// tested (it did, first time round) — and worse, a fixture whose digits happened
// to be wrong in the same way as the code would pass while proving nothing.
const DOC = 'B51305135';
const DOB = '990725';
const EXPIRY = '341029';

const L1 = 'P<NGAINGWE<<RICHARD<UNIMKE'.padEnd(44, '<');

const L2 = ((): string => {
  const head =
    DOC +
    mrzCheckDigit(DOC) +
    'NGA' +
    DOB +
    mrzCheckDigit(DOB) +
    'M' +
    EXPIRY +
    mrzCheckDigit(EXPIRY) +
    '<'.repeat(14) + // personal number: unused
    '<'; // …and its check digit, which the parser accepts as filler
  const composite = head.slice(0, 10) + head.slice(13, 20) + head.slice(21, 43);
  return head + mrzCheckDigit(composite);
})();

const MRZ = L1 + L2;

/**
 * DG1 as the chip returns it: 61 <len> 5F1F <len> <mrz>.
 *
 * The outer length covers the inner element ENTIRE — its two tag bytes, its
 * length byte, and its value — so it is `mrz.length + 3`, not + 4. Getting that
 * wrong produces a DG1 that is one byte short of its own declaration, which
 * `readTlv` rejects as incomplete (it did, first time round).
 */
function dg1(mrz: string): string {
  const chars = [...mrz].map((c) => c.charCodeAt(0));
  const bytes = Uint8Array.from([
    0x61,
    chars.length + 3,
    0x5f,
    0x1f,
    chars.length,
    ...chars,
  ]);
  return Buffer.from(bytes).toString('base64');
}

describe('parseDg1', () => {
  it('reads the holder name off the chip exactly', () => {
    const scan = parseDg1(dg1(MRZ));
    expect(scan?.lastName).toBe('INGWE');
    expect(scan?.firstName).toBe('RICHARD UNIMKE');
    expect(scan?.documentNumber).toBe('B51305135');
    expect(scan?.nationality).toBe('NGA');
  });

  it('returns null rather than throwing on absent or malformed DG1', () => {
    expect(parseDg1(undefined)).toBeNull();
    expect(parseDg1(null)).toBeNull();
    expect(parseDg1('')).toBeNull();
    expect(parseDg1('not base64 at all $$$')).toBeNull();
    // Well-formed TLV, but the value is not an MRZ of a length we recognise.
    expect(parseDg1(dg1('TOO SHORT'))).toBeNull();
  });

  // The defect this module exists for. The on-device recogniser read the FIRST
  // '<' of the '<<' surname separator as 'K'. Line 2 is untouched, so every
  // check digit still validates and the scan is accepted: the name is silently
  // wrong and nothing in the MRZ can tell, because TD3 carries no check digit
  // over the name field.
  it('is immune to the camera misread that produced "KKKK INGWEK RICHARD UNIMKE"', () => {
    const misread = L1.replace('INGWE<<RICHARD', 'INGWEK<RICHARD').replace(
      /<{4}$/,
      'KKKK',
    );
    expect(misread).toHaveLength(44);

    const fromCamera = parseMrz(misread + L2);
    // It validates. That is the trap.
    expect(fromCamera).not.toBeNull();
    expect(
      [fromCamera?.firstName, fromCamera?.lastName].filter(Boolean).join(' '),
    ).toBe('KKKK INGWEK RICHARD UNIMKE');

    // The chip is unaffected by whatever the camera thought it saw.
    const fromChip = parseDg1(dg1(MRZ));
    expect([fromChip?.firstName, fromChip?.lastName].join(' ')).toBe(
      'RICHARD UNIMKE INGWE',
    );
  });
});
