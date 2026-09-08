import { NO_BIOMETRIC_COPY, biometricCopyFor } from '../lib/biometric-copy';

// Mirrors the web SDK's biometric-copy.test.ts and Flutter's
// biometric_copy_test.dart; the resolution rules are a contract the three keep.
const copy = {
  waiting: { title: 'One moment, {firstName}', description: '  ' },
  verified: { description: 'Welcome back, {firstName} {lastName}.' },
  declined: { title: '{firstName}, that did not match' },
};

describe('biometricCopyFor', () => {
  it('fills the tokens and drops a field that empties out', () => {
    const words = biometricCopyFor({
      scope: 'biometric-authentication',
      biometric: { copy },
      userData: { firstName: 'Ada', lastName: 'Okafor' },
    });
    expect(words).toEqual({
      waiting: { title: 'One moment, Ada' },
      verified: { description: 'Welcome back, Ada Okafor.' },
      declined: { title: 'Ada, that did not match' },
    });
  });

  it('a title that is only a missing token falls back to the default, never a blank', () => {
    const words = biometricCopyFor({ scope: 'biometric-authentication', biometric: { copy: { waiting: { title: '{firstName}' } } } });
    expect(words.waiting).toBeNull();
  });

  it('enrolment keeps the waiting words and ignores the verdict screens it never shows', () => {
    const words = biometricCopyFor({ scope: 'biometric-enrollment', biometric: { copy }, userData: { firstName: 'Ada' } });
    expect(words.waiting).toEqual({ title: 'One moment, Ada' });
    expect(words.verified).toBeNull();
    expect(words.declined).toBeNull();
  });

  it('is all-null off the biometric scopes and with no block', () => {
    expect(biometricCopyFor({ scope: 'address', biometric: { copy } })).toBe(NO_BIOMETRIC_COPY);
    expect(biometricCopyFor({ scope: 'biometric-authentication' })).toBe(NO_BIOMETRIC_COPY);
    expect(biometricCopyFor({ biometric: { copy } })).toBe(NO_BIOMETRIC_COPY);
  });
});
