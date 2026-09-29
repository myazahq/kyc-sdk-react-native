import { KYCApiError } from '../services/api';
import type { KYCStep } from '../types/config';
import { recoveryStepFor, serverRefusalOf } from '../lib/submit-recovery';

// Mirrors the Flutter SDK's business_documents_resume_test.dart cases for
// submit_recovery.dart, and the web SDK's lib/submit-recovery.test.ts.

const kyb: KYCStep[] = [
  'consent',
  'business-details',
  'business-documents',
  'business-key-people',
  'id-type',
  'document-capture',
  'liveness',
  'submitted',
];

describe('recoveryStepFor', () => {
  it('lands on the step that owns the refusal', () => {
    expect(recoveryStepFor('missing_documents', kyb)).toBe('business-documents');
    expect(recoveryStepFor('missing_company_info', kyb)).toBe('business-details');
    expect(recoveryStepFor('key_people_required', kyb)).toBe('business-key-people');
  });

  it('reads the capture an invalid_media refusal names', () => {
    expect(recoveryStepFor('invalid_media', kyb, { mediaKey: 'selfie' })).toBe('liveness');
    expect(recoveryStepFor('invalid_media', kyb, { mediaKey: 'documentBack' })).toBe('document-capture');
    const address: KYCStep[] = ['consent', 'address-collection', 'address-entrance', 'address-review', 'submitted'];
    expect(recoveryStepFor('invalid_media', address, { mediaKey: 'addressPhoto' })).toBe('address-entrance');
    // A mediaKey only counts on invalid_media, and an unknown one falls back.
    expect(recoveryStepFor('invalid_media', kyb, { mediaKey: 'somethingNew' })).toBe('liveness');
    expect(recoveryStepFor('something_else', kyb, { mediaKey: 'documentFront' })).toBe('liveness');
  });

  it('falls back to the last step before submission', () => {
    expect(recoveryStepFor('something_else', kyb)).toBe('liveness');
    // A named step this flow does not have.
    expect(recoveryStepFor('questionnaire_invalid', kyb)).toBe('liveness');
    expect(recoveryStepFor('invalid_media', kyb, { mediaKey: 'proofOfAddress' })).toBe('liveness');
  });

  it('offers nothing where going back cannot help', () => {
    for (const code of ['insufficient_credits', 'invalid_api_key', 'feature_disabled', 'business_not_approved', 'rate_limited']) {
      expect(recoveryStepFor(code, kyb)).toBeNull();
    }
  });

  it('offers nothing when there is no step before submission', () => {
    expect(recoveryStepFor('missing_documents', ['submitted'])).toBeNull();
    expect(recoveryStepFor('missing_documents', [])).toBeNull();
  });

  it('does not read inherited keys as refusal codes', () => {
    expect(recoveryStepFor('constructor', kyb)).toBe('liveness');
    expect(recoveryStepFor('invalid_media', kyb, { mediaKey: 'toString' })).toBe('liveness');
  });
});

describe('serverRefusalOf', () => {
  it('reads the raw server code and mediaKey, not a mapped client code', () => {
    expect(serverRefusalOf(new KYCApiError('x', 422, 'missing_documents', { missing: ['memart'] }))).toEqual({
      code: 'missing_documents',
      mediaKey: null,
    });
    expect(serverRefusalOf(new KYCApiError('x', 400, 'invalid_media', { mediaKey: 'selfie' }))).toEqual({
      code: 'invalid_media',
      mediaKey: 'selfie',
    });
  });

  it('reads 401 and 402 as the client does, whatever the body says', () => {
    expect(serverRefusalOf(new KYCApiError('x', 401, 'unauthorized'))?.code).toBe('invalid_api_key');
    expect(serverRefusalOf(new KYCApiError('x', 402))?.code).toBe('insufficient_credits');
  });

  it('is null for anything that is not a server refusal', () => {
    expect(serverRefusalOf(new TypeError('Network request failed'))).toBeNull();
    expect(serverRefusalOf(new Error('boom'))).toBeNull();
  });
});
