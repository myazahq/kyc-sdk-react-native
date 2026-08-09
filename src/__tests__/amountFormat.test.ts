import { formatGroupedAmount, parseGroupedAmount } from '../utils/amountFormat';

// Ported from the Flutter SDK's AmountInputFormatter. The display is grouped
// but the ANSWER stays a number — storing "250,000" would fail the money
// validator (`Number("250,000")` is NaN) and reach the server as text.

describe('formatGroupedAmount', () => {
  it('groups thousands as the user types', () => {
    expect(formatGroupedAmount('250000')).toBe('250,000');
    expect(formatGroupedAmount('1000')).toBe('1,000');
    expect(formatGroupedAmount('1234567')).toBe('1,234,567');
  });

  it('leaves short numbers alone', () => {
    expect(formatGroupedAmount('0')).toBe('0');
    expect(formatGroupedAmount('999')).toBe('999');
  });

  it('regroups text that already has separators', () => {
    // Every keystroke re-formats the whole field, so this is the common path.
    expect(formatGroupedAmount('250,000')).toBe('250,000');
    expect(formatGroupedAmount('250,0001')).toBe('2,500,001');
  });

  it('keeps one decimal point and caps the decimals', () => {
    expect(formatGroupedAmount('250000.5')).toBe('250,000.5');
    expect(formatGroupedAmount('250000.567')).toBe('250,000.56');
    expect(formatGroupedAmount('1.2.3')).toBe('1.23');
  });

  it('drops the fraction entirely when integer-only', () => {
    // Skipping just the '.' would splice "1234.99" into "123499".
    expect(formatGroupedAmount('1234.99', 0)).toBe('1,234');
  });

  it('strips anything that is not a digit', () => {
    expect(formatGroupedAmount('₦250 000abc')).toBe('250,000');
    expect(formatGroupedAmount('')).toBe('');
    expect(formatGroupedAmount('abc')).toBe('');
  });
});

describe('parseGroupedAmount', () => {
  it('reads the number back out of a grouped string', () => {
    expect(parseGroupedAmount('250,000')).toBe(250000);
    expect(parseGroupedAmount('250,000.50')).toBe(250000.5);
    expect(parseGroupedAmount(' 1,000 ')).toBe(1000);
  });

  it('returns null for nothing usable, so the answer clears', () => {
    expect(parseGroupedAmount('')).toBeNull();
    expect(parseGroupedAmount('.')).toBeNull();
    expect(parseGroupedAmount('abc')).toBeNull();
  });

  it('round-trips what the formatter produces', () => {
    for (const raw of ['1', '999', '250000', '1234567.89']) {
      expect(parseGroupedAmount(formatGroupedAmount(raw))).toBe(Number(raw));
    }
  });
});
