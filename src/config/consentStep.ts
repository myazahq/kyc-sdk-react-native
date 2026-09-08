import type { KYCStep } from '../types/config';

// ─── The consent screen switch (`consentStep`) ──────────────────────────────
//
// A workflow can switch the opening consent (welcome) screen off, for a host
// app that has already asked: the flow then opens on its first real step.
// Mirrors the server's `WorkflowConfigSchema.consentStep` and the web /
// Flutter helpers of the same name; keep the default in lockstep.

/** Whether the flow opens on the consent screen. Absent = yes. */
export function hasConsentStep(config: { consentStep?: boolean | null }): boolean {
  return config.consentStep !== false;
}

/** The step a built order opens on; 'consent' for an empty order, which no
 *  flow produces. */
export function openingStepOf(order: readonly KYCStep[]): KYCStep {
  return order[0] ?? 'consent';
}
