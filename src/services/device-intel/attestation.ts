import type { DeviceChallengeResponse } from '../api-types';
import { deviceIntelNative, withDeadline } from './native';

// ---------------------------------------------------------------------------
// `fingerprint.attestation` — the platform vouching for the app and the device
// (kyc-core docs/DEVICE_INTEL_WIRE.md): App Attest on iOS, Play Integrity on
// Android, both bound to a single-use server challenge.
//
// Best-effort end to end. A failed challenge, an unsupported device, a missing
// native module, a missing Play Integrity project, or the 5-second bound all
// lead to the same place: the field is omitted and the submission goes ahead.
// This never blocks or fails a verification.
// ---------------------------------------------------------------------------

export interface AppAttestPayload {
  platform: 'ios';
  kind: 'app_attest';
  challengeId: string;
  keyId: string;
  attestation?: string;
  assertion?: string;
}

export interface PlayIntegrityPayload {
  platform: 'android';
  kind: 'play_integrity';
  challengeId: string;
  token: string;
}

export type DeviceAttestation = AppAttestPayload | PlayIntegrityPayload;

/** The slice of the API client attestation needs (a seam for tests). */
export interface ChallengeApi {
  deviceChallenge(
    body: { platform: 'ios' | 'android'; keyId?: string },
    signal?: AbortSignal,
  ): Promise<DeviceChallengeResponse>;
}

export interface AttestationContext {
  api: ChallengeApi;
  platform: string;
  /** From `deviceAttestation.playIntegrityCloudProjectNumber`; Android only. */
  playIntegrityCloudProjectNumber?: string | null;
}

/** The whole step's bound, challenge round trip included. */
export const ATTESTATION_TIMEOUT_MS = 5000;

/** Collect an attestation, or undefined. Never throws; never exceeds the bound. */
export async function collectAttestation(
  ctx: AttestationContext,
  timeoutMs: number = ATTESTATION_TIMEOUT_MS,
): Promise<DeviceAttestation | undefined> {
  const controller = new AbortController();
  const result = await withDeadline(attest(ctx, controller.signal), timeoutMs);
  // Stop a challenge request still in flight; the native half cannot be
  // cancelled and its late answer is simply ignored.
  if (result === undefined) controller.abort();
  return result ?? undefined;
}

async function attest(
  ctx: AttestationContext,
  signal: AbortSignal,
): Promise<DeviceAttestation | null> {
  if (ctx.platform === 'ios') return appAttest(ctx.api, signal);
  if (ctx.platform === 'android') return playIntegrity(ctx, signal);
  return null;
}

async function appAttest(api: ChallengeApi, signal: AbortSignal): Promise<AppAttestPayload | null> {
  const native = deviceIntelNative();
  // Simulators and old devices: App Attest is unavailable, so omit — and do
  // not spend a server challenge finding that out.
  if (!native || !native.appAttestSupported()) return null;
  const storedKeyId = native.appAttestKeyId();
  const challenge = await api.deviceChallenge(
    { platform: 'ios', ...(storedKeyId ? { keyId: storedKeyId } : {}) },
    signal,
  );
  const base = { platform: 'ios' as const, kind: 'app_attest' as const, challengeId: challenge.challengeId };
  // The server asks for a fresh attestation when it has no key on file for
  // this install (none sent, or one it does not know). A key can be attested
  // only once, so that always means a new key.
  if (challenge.attest === true || !storedKeyId) {
    const fresh = await native.appAttestAttestNewKey(challenge.challenge);
    return { ...base, keyId: fresh.keyId, attestation: fresh.attestation };
  }
  const assertion = await native.appAttestAssert(storedKeyId, challenge.challenge);
  return { ...base, keyId: storedKeyId, assertion };
}

async function playIntegrity(
  ctx: AttestationContext,
  signal: AbortSignal,
): Promise<PlayIntegrityPayload | null> {
  const project = ctx.playIntegrityCloudProjectNumber?.trim();
  // No project served: the platform cannot decode a token, so do not ask for one.
  if (!project) return null;
  const native = deviceIntelNative();
  if (!native) return null;
  const challenge = await ctx.api.deviceChallenge({ platform: 'android' }, signal);
  const token = await native.playIntegrityToken(project, challenge.challenge);
  if (!token) return null;
  return { platform: 'android', kind: 'play_integrity', challengeId: challenge.challengeId, token };
}
