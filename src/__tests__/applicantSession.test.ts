// The applicant's own verification must name the application's session: the
// server refuses it otherwise (409 applicant_session_required). It was left
// off, the fire-and-forget caller swallowed the refusal, and reopening the app
// resumed the application at the applicant's ID step (2026-09-29).
import { buildApplicantVerifyRequest } from '../store/submitApplicant';
import { createVerificationStore } from '../store/verificationStore';
import type { ResolvedVerificationConfig } from '../types/config';

jest.useFakeTimers();

function makeStore() {
  return createVerificationStore({
    apiKey: 'pk_test_x',
    country: 'NG',
    metadata: {},
  } as unknown as ResolvedVerificationConfig);
}

describe('applicant verification request', () => {
  it("names the application's session", () => {
    const store = makeStore();
    store.setState({ selectedIdType: 'bvn', idNumber: '22222222222', sessionId: 'sess_parent' });
    const req = buildApplicantVerifyRequest(store.getState(), 'kp_1', undefined);
    expect(req.sessionId).toBe('sess_parent');
    expect(req.metadata?.userId).toBe('kp_1');
  });

  it('sends no session when the mount has none', () => {
    const store = makeStore();
    store.setState({ selectedIdType: 'bvn', idNumber: '22222222222', sessionId: null });
    const req = buildApplicantVerifyRequest(store.getState(), 'kp_1', undefined);
    expect(req.sessionId).toBeUndefined();
  });
});
