import { biometricFlowOptions, showsDoneButton, showsSelfieReview, waitsForResult } from '../config/biometricOptions';

// Mirrors the server's biometric-options.test.ts; the defaults are a contract
// the two keep together.
describe('biometricFlowOptions', () => {
  it('re-authentication hides the review, waits for the verdict (delivered to the app and the webhook) and shows Done by default', () => {
    expect(biometricFlowOptions({ scope: 'biometric-authentication' })).toEqual({
      selfieReview: false,
      resultDelivery: 'both',
      doneButton: true,
    });
    expect(showsSelfieReview({ scope: 'biometric-authentication' })).toBe(false);
    expect(waitsForResult({ scope: 'biometric-authentication' })).toBe(true);
    expect(showsDoneButton({ scope: 'biometric-authentication' })).toBe(true);
  });

  it('honours an explicit review, a webhook delivery and a hidden Done button', () => {
    const config = {
      scope: 'biometric-authentication',
      biometric: { selfieReview: true, resultDelivery: 'webhook' as const, doneButton: false },
    };
    expect(biometricFlowOptions(config)).toEqual({ selfieReview: true, resultDelivery: 'webhook', doneButton: false });
    expect(showsSelfieReview(config)).toBe(true);
    expect(waitsForResult(config)).toBe(false);
    expect(showsDoneButton(config)).toBe(false);
  });

  it('an app-only delivery waits exactly as the default does; the difference is the server\'s webhook', () => {
    expect(waitsForResult({ scope: 'biometric-authentication', biometric: { resultDelivery: 'app' } })).toBe(true);
    expect(waitsForResult({ scope: 'biometric-authentication', biometric: { resultDelivery: 'both' } })).toBe(true);
  });

  it('enrolment hides the review too, never waits, and can hide Done', () => {
    expect(biometricFlowOptions({ scope: 'biometric-enrollment' })).toEqual({
      selfieReview: false,
      resultDelivery: null,
      doneButton: true,
    });
    expect(waitsForResult({ scope: 'biometric-enrollment', biometric: { resultDelivery: 'app' } })).toBe(false);
    expect(showsDoneButton({ scope: 'biometric-enrollment', biometric: { doneButton: false } })).toBe(false);
  });

  it('a full verification always reviews, never waits and always shows Done, whatever the block says', () => {
    expect(biometricFlowOptions({})).toBeNull();
    expect(showsSelfieReview({ biometric: { selfieReview: false } })).toBe(true);
    expect(waitsForResult({ scope: 'address', biometric: { resultDelivery: 'both' } })).toBe(false);
    expect(showsDoneButton({ scope: 'contact', biometric: { doneButton: false } })).toBe(true);
  });
});
