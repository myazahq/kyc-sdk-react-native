import type { HybridObject } from 'react-native-nitro-modules';

// ---------------------------------------------------------------------------
// Nitro spec for the Device Intelligence signals only native code can answer:
// an id that survives a reinstall, root / jailbreak / hook heuristics, and the
// platform's own attestation (App Attest on iOS, Play Integrity on Android).
//
// The wire contract is kyc-core's docs/DEVICE_INTEL_WIRE.md. Everything here
// COLLECTS; the server judges. Every call is best-effort at the call site
// (src/services/device-intel/), which treats any throw as "signal absent".
//
// Platform-specific methods exist on both sides because a Nitro spec is one
// interface: the other platform's implementation rejects / returns its empty
// value, and the TypeScript side never calls it there anyway.
//
// Bytes cross the bridge as base64, as in MyazaEmrtd. "Nothing" is an EMPTY
// STRING rather than a nullable, for the same reason MyazaEmrtd.decodeImage
// gives: a nullable string is a variant type both native sides must unwrap.
// ---------------------------------------------------------------------------

/** A freshly generated, attested App Attest key. Both fields base64. */
export interface AppAttestKey {
  keyId: string;
  attestation: string;
}

export interface MyazaDeviceIntel extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * An id that survives an uninstall + reinstall. iOS: a random UUID kept in
   * the Keychain (service `co.myazahq.kyc`, account `device-stable-id`,
   * this-device-only, never synced), created on first call. Android:
   * `Settings.Secure.ANDROID_ID`. Empty when it cannot be read.
   */
  stableId(): string;

  /**
   * The root / jailbreak / instrumentation heuristics that FIRED, as contract
   * tokens (su_binary, magisk, …, frida, debugger). Async because a couple of
   * them touch the filesystem or a local socket. Never prompts, never needs a
   * permission. Rejects only if the checks could not run at all.
   */
  integritySignals(): Promise<string[]>;

  // ── iOS: App Attest ──────────────────────────────────────────────────────

  /** `DCAppAttestService.shared.isSupported`. Always false on Android. */
  appAttestSupported(): boolean;

  /** The keyId kept in the Keychain (account `app-attest-key-id`), or ''. */
  appAttestKeyId(): string;

  /**
   * Generate a NEW key, attest it against SHA256(challenge), and only then
   * store its keyId. A key can be attested once, so re-attesting always means
   * a new key; the old id is replaced only when the new one is proven.
   */
  appAttestAttestNewKey(challengeBase64: string): Promise<AppAttestKey>;

  /** `generateAssertion(keyId, SHA256(challenge))`, base64. */
  appAttestAssert(keyId: string, challengeBase64: string): Promise<string>;

  // ── Android: Play Integrity (Standard API) ───────────────────────────────

  /**
   * Prepare a token provider once per process for this cloud project, then
   * request a token with requestHash = lowercase hex SHA-256 of the challenge
   * bytes. Rejects on iOS.
   */
  playIntegrityToken(cloudProjectNumber: string, challengeBase64: string): Promise<string>;
}
