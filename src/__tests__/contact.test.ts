import {
  contactCodeLength,
  contactIsRequired,
  hasEmailVerificationStep,
  hasPhoneVerificationStep,
  isValidContactEmail,
  isValidContactPhone,
  normalizeContactPhone,
  offeredPhoneChannels,
} from '../config/contact';
import { attemptsRemaining, describeCheckError, describeSendError } from '../services/contactErrors';
import { KYCApiError } from '../services/api';

// ─── Contact verification ─────────────────────────────────────────────────────
//
// A possession check before any capture or registry spend. Two things decide
// whether it helps or hurts: the client-side shape checks must not reject
// addresses that actually work (the user cannot argue with a disabled button),
// and every failure must say what to do next, because all of them are
// recoverable and the user is mid-flow.

describe('step presence', () => {
  it('needs an explicit enable', () => {
    expect(hasEmailVerificationStep({ enabled: true })).toBe(true);
    expect(hasEmailVerificationStep({})).toBe(false);
    expect(hasEmailVerificationStep(undefined)).toBe(false);
    expect(hasPhoneVerificationStep({ enabled: true })).toBe(true);
  });
});

describe('delivery channels', () => {
  it('falls back to SMS, matching the server default for an omitted `via`', () => {
    expect(offeredPhoneChannels(undefined)).toEqual(['sms']);
    expect(offeredPhoneChannels([])).toEqual(['sms']);
  });

  it('keeps the workflow order, so its first entry is what starts selected', () => {
    expect(offeredPhoneChannels(['whatsapp', 'sms'])).toEqual(['whatsapp', 'sms']);
  });

  it('drops channels this build cannot render, and never empties the list', () => {
    // A channel added server-side must not appear as an unlabelled option in
    // an app built before it existed.
    expect(offeredPhoneChannels(['sms', 'telegram'])).toEqual(['sms']);
    expect(offeredPhoneChannels(['telegram'])).toEqual(['sms']);
  });

  it('collapses duplicates', () => {
    expect(offeredPhoneChannels(['sms', 'sms', 'whatsapp'])).toEqual(['sms', 'whatsapp']);
  });
});

describe('whether it can be skipped', () => {
  it('is required by default once enabled', () => {
    // A workflow that adds an OTP step and says nothing about `required` meant
    // to require it — defaulting the other way would silently weaken flows.
    expect(contactIsRequired({ enabled: true })).toBe(true);
  });

  it('offers a skip only when explicitly optional', () => {
    expect(contactIsRequired({ enabled: true, required: false })).toBe(false);
  });
});

describe('code length', () => {
  it('defaults to six', () => {
    expect(contactCodeLength(undefined)).toBe(6);
  });

  it('clamps to what the server will accept', () => {
    // Rendering ten slots for a code the server caps at eight would leave two
    // that can never fill and a Verify button that never enables.
    expect(contactCodeLength({ codeLength: 2 })).toBe(4);
    expect(contactCodeLength({ codeLength: 12 })).toBe(8);
    expect(contactCodeLength({ codeLength: 5 })).toBe(5);
  });
});

describe('email shape', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidContactEmail('user@example.com')).toBe(true);
  });

  it('accepts the shapes a strict pattern gets wrong', () => {
    // Rejecting these is worse than accepting a typo: the code either arrives
    // or it does not, but a false rejection is an argument the user cannot win.
    expect(isValidContactEmail('user+kyc@example.co.uk')).toBe(true);
    expect(isValidContactEmail('user@subdomain.example.travel')).toBe(true);
    expect(isValidContactEmail('用户@example.com')).toBe(true);
  });

  it('rejects what obviously cannot receive mail', () => {
    expect(isValidContactEmail('')).toBe(false);
    expect(isValidContactEmail('user')).toBe(false);
    expect(isValidContactEmail('user@')).toBe(false);
    expect(isValidContactEmail('user@host')).toBe(false);
    expect(isValidContactEmail('a@b.c d')).toBe(false);
    expect(isValidContactEmail('a@@b.com')).toBe(false);
    expect(isValidContactEmail('user@.com')).toBe(false);
  });
});

describe('phone shape', () => {
  it('accepts E.164', () => {
    expect(isValidContactPhone('+2348012345678')).toBe(true);
    expect(isValidContactPhone('+14155550123')).toBe(true);
  });

  it('accepts a number the user formatted by hand', () => {
    expect(isValidContactPhone('+234 801 234 5678')).toBe(true);
    expect(isValidContactPhone('+1 (415) 555-0123')).toBe(true);
  });

  it('rejects a national number with no country code', () => {
    // The server cannot route it, so accepting it just moves the failure to
    // after the send attempt.
    expect(isValidContactPhone('08012345678')).toBe(false);
  });

  it('rejects lengths outside E.164', () => {
    expect(isValidContactPhone('+1234')).toBe(false);
    expect(isValidContactPhone('+1234567890123456')).toBe(false);
  });

  it('strips formatting for submission', () => {
    expect(normalizeContactPhone('+234 (801) 234-5678')).toBe('+2348012345678');
  });
});

describe('failure copy', () => {
  it('says what to do about an expired code', () => {
    const msg = describeCheckError(new KYCApiError('x', 400, 'challenge_expired'));
    expect(msg).toMatch(/expired/i);
    expect(msg).toMatch(/new one/i);
  });

  it('distinguishes a wrong code from a dead one', () => {
    expect(describeCheckError(new KYCApiError('x', 400, 'invalid_code'))).not.toBe(
      describeCheckError(new KYCApiError('x', 400, 'challenge_expired')),
    );
  });

  it('names a rate limit rather than blaming the code', () => {
    expect(describeSendError(new KYCApiError('x', 429, 'send_rate_limited'))).toMatch(/wait/i);
  });

  it('calls a network failure a network failure', () => {
    expect(describeSendError(new TypeError('Network request failed'))).toMatch(/connection/i);
  });

  it('still says something useful for a code it has never seen', () => {
    expect(describeCheckError(new KYCApiError('x', 500, 'brand_new_code'))).toMatch(/try again/i);
  });
});

describe('attempts remaining', () => {
  it('reads the count the server reports', () => {
    // Without it the user has no signal that the code is about to die, and
    // burns the whole budget guessing.
    const err = new KYCApiError('x', 400, 'invalid_code', { attemptsRemaining: 2 });
    expect(attemptsRemaining(err)).toBe(2);
  });

  it('is absent when the server did not say', () => {
    expect(attemptsRemaining(new KYCApiError('x', 400, 'invalid_code'))).toBeUndefined();
    expect(attemptsRemaining(new Error('boom'))).toBeUndefined();
  });
});
