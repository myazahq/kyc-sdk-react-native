import type {
  BiometricAuthRequest,
  BiometricAuthResponse,
  BiometricStatusResponse,
} from './api-types-biometric';

// ---------------------------------------------------------------------------
// The biometric re-authentication calls, split out of createKYCApi (200-line
// rule). Given the client's own `request`, so they ride the same base URL,
// bearer key, SDK-version header and error mapping as everything else.
// ---------------------------------------------------------------------------

export type JsonRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export function biometricCalls(request: JsonRequest) {
  return {
    /**
     * Re-authenticate a verified user by matching a live selfie 1:1 against
     * their KYC enrollment reference. Publishable-safe. Uniform 404
     * `not_enrolled` — a missing entity, a business entity and no template
     * all answer the same, so nothing can be probed.
     */
    async authenticate(body: BiometricAuthRequest): Promise<BiometricAuthResponse> {
      return request<BiometricAuthResponse>('/biometric/authenticate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    /** Whether a user is enrolled for face re-auth (whether to OFFER it). */
    async getBiometricStatus(externalUserId: string): Promise<BiometricStatusResponse> {
      return request<BiometricStatusResponse>(
        `/biometric/status/${encodeURIComponent(externalUserId)}`,
      );
    },
  };
}
