import { validateIdNumber, maskIdNumber } from '../services/validators';

describe('validateIdNumber', () => {
  it('validates Nigerian number-only IDs', () => {
    expect(validateIdNumber('NG', 'bvn', '12345678901').valid).toBe(true);
    expect(validateIdNumber('NG', 'bvn', '123').valid).toBe(false);
    expect(validateIdNumber('NG', 'nin', '12345678901').valid).toBe(true);
    expect(validateIdNumber('NG', 'vnin', 'ABCD123456789012').valid).toBe(true);
    expect(validateIdNumber('NG', 'vnin', 'short').valid).toBe(false);
  });

  it('validates country-prefixed shared keys (passport, national-id)', () => {
    expect(validateIdNumber('NG', 'passport', 'A12345678').valid).toBe(true);
    expect(validateIdNumber('NG', 'passport', 'A1234567').valid).toBe(false); // GH format, not NG
    expect(validateIdNumber('GH', 'passport', 'A1234567').valid).toBe(true);
    expect(validateIdNumber('KE', 'national-id', '12345678').valid).toBe(true);
    expect(validateIdNumber('ZA', 'national-id', '1234567890123').valid).toBe(true);
  });

  it('validates Ghana Card and PVC patterns', () => {
    expect(validateIdNumber('GH', 'ghana-card', 'GHA-123456789-0').valid).toBe(true);
    expect(validateIdNumber('GH', 'ghana-card', '123456789').valid).toBe(false);
    expect(validateIdNumber('NG', 'pvc', '1234567890123456789').valid).toBe(true);
  });

  it('rejects empty input', () => {
    expect(validateIdNumber('NG', 'bvn', '   ').valid).toBe(false);
  });
});

describe('maskIdNumber', () => {
  it('masks the middle of a long number', () => {
    expect(maskIdNumber('12345678901')).toBe('1234****901');
  });
  it('leaves short values untouched', () => {
    expect(maskIdNumber('1234567')).toBe('1234567');
  });
});
