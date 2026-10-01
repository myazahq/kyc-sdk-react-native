import { OS } from '../../utils/platform';
import { collectFingerprint, type ClientFingerprint } from '../fingerprint';
import type { ChallengeApi } from './attestation';
import { cachedDeviceId } from './ids';

// ---------------------------------------------------------------------------
// The two places Device Intelligence meets the flow, and the ONE gate both
// obey: nothing is collected while the workflow's `deviceIntelligence` is off
// (an absent flag means on, as it always has).
//
//   • the submission's fingerprint (kycStore.submitAsync);
//   • every upload's `X-Myaza-Device-Id` header (createKYCApi's `deviceId`).
// ---------------------------------------------------------------------------

export interface DeviceIntelGate {
  deviceIntelligence?: boolean;
}

export function deviceIntelEnabled(config: DeviceIntelGate): boolean {
  return config.deviceIntelligence !== false;
}

/** The upload header's source, or undefined (no header) when the gate is off. */
export function uploadDeviceIdSource(
  config: DeviceIntelGate,
): (() => Promise<string | undefined>) | undefined {
  return deviceIntelEnabled(config) ? cachedDeviceId : undefined;
}

export interface SubmissionFingerprintInput {
  config: DeviceIntelGate;
  api: ChallengeApi;
  playIntegrityCloudProjectNumber?: string | null;
  platform?: string;
}

/**
 * The fingerprint for a submission, or undefined. Best-effort: a fingerprint
 * that fails to collect is a missing signal, never a failed submission.
 * `collect` is a test seam.
 */
export async function submissionFingerprint(
  input: SubmissionFingerprintInput,
  collect: typeof collectFingerprint = collectFingerprint,
): Promise<ClientFingerprint | undefined> {
  if (!deviceIntelEnabled(input.config)) return undefined;
  return collect({
    attestation: {
      api: input.api,
      platform: input.platform ?? OS,
      playIntegrityCloudProjectNumber: input.playIntegrityCloudProjectNumber ?? null,
    },
  }).catch(() => undefined);
}
