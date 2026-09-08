// Workflow SCOPE — what a flow verifies about the subject (mirror of the
// server's lib/workflows/scope.ts and the web SDK's lib/scope.ts; keep the
// three in lockstep). Absent = the full verification.

export type WorkflowScope =
  | 'address'
  | 'biometric-authentication'
  | 'biometric-enrollment'
  | 'questionnaire'
  | 'contact';

/** The marker idType a scoped submission carries (the KYB product-in-idType
 *  convention — the server requires the matching published workflow). */
export const SCOPE_ID_TYPES: Record<WorkflowScope, string> = {
  address: 'address',
  'biometric-authentication': 'biometric-auth',
  'biometric-enrollment': 'biometric-enroll',
  questionnaire: 'questionnaire',
  contact: 'contact',
};

export function configScope(config: { scope?: WorkflowScope | string }): WorkflowScope | null {
  const value = config.scope;
  return value && value in SCOPE_ID_TYPES ? (value as WorkflowScope) : null;
}

/** The biometric scopes run the liveness capture; every other scope has no
 *  camera step at all. */
export function isFaceScope(scope: WorkflowScope | null): boolean {
  return scope === 'biometric-authentication' || scope === 'biometric-enrollment';
}
