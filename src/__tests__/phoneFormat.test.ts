import { formatNationalNumber } from '../config/phone';

// Mirrors the web SDK's phone-format.test.ts — the two share this logic, so a
// regression must fail on both platforms rather than quietly on one.
//
// The bug it prevents: libphonenumber's national formats are keyed to the
// country's TRUNK PREFIX, so a Nigerian number typed the way a dial-code picker
// collects it ("8031234567", no leading 0) matched no format and came back as
// raw digits — the field looked broken for the SDK's primary market.

describe('formatNationalNumber', () => {
  it('groups a Nigerian number typed without the trunk prefix', () => {
    expect(formatNationalNumber('8031234567', 'NG')).toBe('803 123 4567');
  });

  it('groups progressively as the user types', () => {
    expect(formatNationalNumber('80312', 'NG')).toBe('803 12');
    expect(formatNationalNumber('803123456', 'NG')).toBe('803 123 456');
  });

  it('keeps the trunk prefix where it is part of the number', () => {
    // Italy's leading 0 belongs to the number, which is why this cannot just
    // delete leading zeros.
    expect(formatNationalNumber('0612345678', 'IT')).toBe('06 1234 5678');
  });

  it('leaves countries libphonenumber already handled alone', () => {
    expect(formatNationalNumber('4155550123', 'US')).toBe('(415) 555-0123');
  });

  it('formats the rest of the SDK primary markets', () => {
    expect(formatNationalNumber('241234567', 'GH')).toBe('24 123 4567');
    expect(formatNationalNumber('712345678', 'KE')).toBe('712 345678');
    expect(formatNationalNumber('821234567', 'ZA')).toBe('82 123 4567');
  });

  it('ignores anything that is not a digit', () => {
    expect(formatNationalNumber('803-123 4567', 'NG')).toBe('803 123 4567');
    expect(formatNationalNumber('', 'NG')).toBe('');
  });
});
