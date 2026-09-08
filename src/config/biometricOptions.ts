import { configScope } from '../lib/scope';

// ─── The biometric scopes' flow options ─────────────────────────────────────
//
// Mirrors the server's lib/workflows/biometric-options.ts; keep the defaults
// in lockstep. All three are UX policy this SDK enforces (user decision
// 2026-09-07, React Native first). A published workflow sets them in the
// builder's Presence Intelligence panel; a prop-configured mount passes the
// same `biometric` block.
//
//   selfieReview    Show the captured selfie with Retake and Continue before
//                   submitting. OFF by default on both biometric scopes: a
//                   re-authentication is a few-second check, and a review
//                   screen is a stop in the middle of it. The liveness step
//                   hands straight over once the ring has closed.
//   resultDelivery  WHERE the verdict lands. 'both' (the default) and 'app'
//                   both hold the person on one loading screen from the
//                   shutter to the verdict, polling the publishable status
//                   endpoint until the check settles, because a
//                   re-authentication is answered NOW or it is useless; they
//                   differ only on the SERVER, which sends no webhook for an
//                   'app' check. 'webhook' is the fire-and-forget model every
//                   other flow runs. Enrolment has no verdict to deliver, so
//                   it never waits.
//   doneButton      Whether the final screen carries a Done button (default
//                   ON). Off when the host app dismisses the flow itself from
//                   `onResult` (or `onSubmit` on a webhook delivery), so the
//                   person is never shown a button the app is about to act
//                   for. The screen then stays until the host closes the SDK.

/** One screen's words. A field absent (or blank) means the SDK's default
 *  shows. `{firstName}` / `{lastName}` tokens fill from `userData`, exactly as
 *  the consent and success copy do. */
export interface BiometricCopyText {
  title?: string;
  description?: string;
}

/**
 * The org's own words on the biometric screens (the builder's "Face check
 * screens" fields; user decision 2026-09-07). `waiting` is the ONE loading
 * screen from the shutter to the verdict, on both scopes; `verified` and
 * `declined` are the in-flow verdict screens, so they apply to a
 * re-authentication only (publish refuses them on enrolment, which shows no
 * verdict). A `declined` description wins over the server's reason: the org
 * chose to say that. Resolved for rendering by lib/biometric-copy.ts.
 */
export interface BiometricCopy {
  waiting?: BiometricCopyText;
  verified?: BiometricCopyText;
  declined?: BiometricCopyText;
}

export interface BiometricFlowConfig {
  selfieReview?: boolean;
  resultDelivery?: 'app' | 'webhook' | 'both';
  doneButton?: boolean;
  copy?: BiometricCopy;
}

export interface BiometricFlowOptions {
  selfieReview: boolean;
  /** Null on enrolment: nothing is delivered, so there is nothing to wait for. */
  resultDelivery: 'app' | 'webhook' | 'both' | null;
  doneButton: boolean;
}

type BiometricConfigLike = { scope?: string; biometric?: BiometricFlowConfig | null };

/** The effective options, or null when the flow is not a biometric scope. */
export function biometricFlowOptions(config: BiometricConfigLike): BiometricFlowOptions | null {
  const scope = configScope(config);
  if (scope !== 'biometric-authentication' && scope !== 'biometric-enrollment') return null;
  const block = config.biometric ?? {};
  return {
    selfieReview: block.selfieReview ?? false,
    resultDelivery: scope === 'biometric-authentication' ? (block.resultDelivery ?? 'both') : null,
    doneButton: block.doneButton ?? true,
  };
}

/** Whether the liveness step shows the selfie review before handing over. A
 *  full verification always does; only the biometric scopes can switch it off. */
export function showsSelfieReview(config: BiometricConfigLike): boolean {
  return biometricFlowOptions(config)?.selfieReview ?? true;
}

/** Whether the submitted step waits for the verdict in the flow ('app' and
 *  'both') rather than leaving it to the webhook. Only a re-authentication
 *  ever does. */
export function waitsForResult(config: BiometricConfigLike): boolean {
  const delivery = biometricFlowOptions(config)?.resultDelivery;
  return delivery === 'app' || delivery === 'both';
}

/** Whether the final screen carries a Done button. Always on off the
 *  biometric scopes; only they can hide it. */
export function showsDoneButton(config: BiometricConfigLike): boolean {
  return biometricFlowOptions(config)?.doneButton ?? true;
}
