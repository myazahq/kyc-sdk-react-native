import { readFileSync } from 'fs';
import { join } from 'path';
import { KYCApiError } from '../services/api';
import { defaultReauthLabel, mapAuthError, outcomeOf } from '../lib/biometric-auth';

// Face re-auth mirrors the web SDK: the error vocabulary an integrator
// branches on, the verdict split, and the one structural rule — the flow
// hosts the real liveness step and never the submitted one, so a re-auth can
// never turn into a /verify.

describe('mapAuthError', () => {
  it('names not-enrolled, credits and key problems; everything else is network', () => {
    expect(mapAuthError(new KYCApiError('x', 404, 'not_enrolled')).code).toBe('unknown');
    expect(mapAuthError(new KYCApiError('x', 402)).code).toBe('insufficient_credits');
    expect(mapAuthError(new KYCApiError('x', 401)).code).toBe('invalid_api_key');
    expect(mapAuthError(new KYCApiError('x', 403)).code).toBe('invalid_api_key');
    expect(mapAuthError(new KYCApiError('x', 500)).code).toBe('network_error');
    expect(mapAuthError(new Error('boom')).code).toBe('network_error');
  });
});

describe('outcomeOf', () => {
  const base = { status: 'no_match' as const, confidence: 40, live: true, attemptId: 'ba_1' };
  it('splits on the verdict, not the status string', () => {
    expect(outcomeOf({ ...base, authenticated: true, status: 'authenticated' }).kind).toBe('success');
    expect(outcomeOf({ ...base, authenticated: false }).kind).toBe('failed');
  });
});

describe('the flow', () => {
  const src = readFileSync(join(__dirname, '../screens/biometric/BiometricAuthFlow.tsx'), 'utf8');
  it('hosts the real liveness step and never the submitted one', () => {
    expect(src).toMatch(/<LivenessStep \/>/);
    expect(src).not.toMatch(/SubmittedStep/);
    expect(src).not.toMatch(/\.verify\(/);
  });
  it("labels the trigger with the org's name when it has one", () => {
    expect(defaultReauthLabel('Acme')).toBe("Verify it's you with Acme");
    expect(defaultReauthLabel()).toBe("Verify it's you");
  });
});
