import { KYCApiError } from '../services/api';
import {
  contactStepFor,
  expiredContactChannels,
  stepAfterContactVerified,
} from '../lib/contact-recovery';

describe('expiredContactChannels', () => {
  it('reads the missing channels off a contact_verification_required 422', () => {
    const err = new KYCApiError('required', 422, 'contact_verification_required', {
      missing: ['email'],
    });
    expect(expiredContactChannels(err)).toEqual(['email']);
  });

  it('keeps both channels and drops anything unrecognised', () => {
    const err = new KYCApiError('required', 422, 'contact_verification_required', {
      missing: ['phone', 'email', 'fax'],
    });
    expect(expiredContactChannels(err)).toEqual(['phone', 'email']);
  });

  it('returns nothing for other errors or malformed bodies', () => {
    expect(expiredContactChannels(new KYCApiError('x', 422, 'questionnaire_invalid', {}))).toEqual([]);
    expect(expiredContactChannels(new Error('network'))).toEqual([]);
    expect(expiredContactChannels(new KYCApiError('x', 422, 'contact_verification_required'))).toEqual([]);
    expect(
      expiredContactChannels(new KYCApiError('x', 422, 'contact_verification_required', { missing: 'email' })),
    ).toEqual([]);
  });
});

describe('stepAfterContactVerified', () => {
  it('defers to the ordinary forward walk outside recovery', () => {
    expect(stepAfterContactVerified({ recovery: false, expired: [], channel: 'email' })).toBeNull();
  });

  it('returns straight to submitted in recovery', () => {
    expect(stepAfterContactVerified({ recovery: true, expired: ['email'], channel: 'email' })).toBe('submitted');
  });

  it('visits the other still-refused channel before resubmitting', () => {
    expect(stepAfterContactVerified({ recovery: true, expired: ['email', 'phone'], channel: 'email' })).toBe(
      'phone-verification',
    );
  });

  it('ignores its own channel still being flagged (stale read at auto-advance)', () => {
    expect(stepAfterContactVerified({ recovery: true, expired: ['phone'], channel: 'phone' })).toBe('submitted');
  });
});

describe('contactStepFor', () => {
  it('maps channels to their steps', () => {
    expect(contactStepFor('email')).toBe('email-verification');
    expect(contactStepFor('phone')).toBe('phone-verification');
  });
});
