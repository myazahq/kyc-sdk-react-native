import { KYCApiError } from '../services/api';
import { mapToKycError } from '../services/errors';

describe('mapToKycError', () => {
  it('maps 401 → invalid_api_key', () => {
    const e = mapToKycError(new KYCApiError('nope', 401), 'verify');
    expect(e.code).toBe('invalid_api_key');
  });

  it('maps 402 → insufficient_credits with details', () => {
    const e = mapToKycError(new KYCApiError('no credits', 402, undefined, { required: 5, balance: 1, currency: 'USD' }), 'verify');
    expect(e.code).toBe('insufficient_credits');
    expect(e.details).toEqual({ required: 5, balance: 1, currency: 'USD' });
  });

  it('maps 403 id_type_not_allowed and feature_disabled → feature_disabled', () => {
    expect(mapToKycError(new KYCApiError('x', 403, 'id_type_not_allowed'), 'verify').code).toBe('feature_disabled');
    expect(mapToKycError(new KYCApiError('x', 403, 'feature_disabled', { feature: 'gov_db_check' }), 'verify').code).toBe('feature_disabled');
  });

  it('maps 5xx by context (upload_failed vs network_error)', () => {
    expect(mapToKycError(new KYCApiError('x', 503), 'upload').code).toBe('upload_failed');
    expect(mapToKycError(new KYCApiError('x', 503), 'verify').code).toBe('network_error');
  });

  it('maps a network TypeError → network_error', () => {
    expect(mapToKycError(new TypeError('Network request failed'), 'verify').code).toBe('network_error');
  });

  it('falls back to the context code for unknown errors', () => {
    expect(mapToKycError(new Error('weird'), 'upload').code).toBe('upload_failed');
    expect(mapToKycError(new Error('weird'), 'verify').code).toBe('unknown');
  });
});
