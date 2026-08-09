// ---------------------------------------------------------------------------
// Merging a resolved workflow over the consumer's props.
//
// A published flow is the org's authored template; the props are the
// developer's code. The flow WINS on every key it defines, and props fill the
// gaps — so mounting with `workflowId` gives the org control over the flow's
// shape without the developer having to mirror every builder change.
//
// Mirrors the web SDK's `lib/workflow-merge.ts`.
// ---------------------------------------------------------------------------

/**
 * The prop keys a published flow may override. Exactly the template surface —
 * runtime data (apiKey, devUrl, userId, userData, metadata, callbacks) is never
 * flow-controlled and always comes from the consumer's code.
 */
export const WORKFLOW_KEYS = [
  'subjectType',
  'business',
  'country',
  'countries',
  'idTypes',
  'enableSelfie',
  'enableDocumentCapture',
  'allowDocumentUpload',
  'enableLiveness',
  'livenessMode',
  'flashSequenceLength',
  'deviceIntelligence',
  'requireMobileDevice',
  'voiceGuidance',
  'showThemeToggle',
  'disableClose',
  'appearance',
  'consent',
  'success',
  'emailVerification',
  'phoneVerification',
  'questionnaire',
  'proofOfAddress',
  'nfc',
] as const;

export type WorkflowKey = (typeof WORKFLOW_KEYS)[number];

/**
 * Merge a resolved flow config over the consumer's props — flow wins on every
 * key it DEFINES; an absent key leaves the prop alone (which is how a flow that
 * only sets, say, `livenessMode` doesn't wipe a prop-supplied `userId`).
 *
 * `appearance` merges shallowly with flow keys winning per-field, so a flow
 * that only sets `primaryColor` doesn't wipe a prop-supplied `logo`.
 *
 * Pure and side-effect free.
 */
export function mergeWorkflowConfig<P extends Record<string, unknown>>(
  flowConfig: Record<string, unknown>,
  props: P,
): P {
  const merged: Record<string, unknown> = { ...props };

  for (const key of WORKFLOW_KEYS) {
    const value = flowConfig[key];
    if (value === undefined) continue;
    if (key === 'appearance') {
      const propAppearance = props['appearance'];
      merged[key] = {
        ...(typeof propAppearance === 'object' && propAppearance !== null ? propAppearance : {}),
        ...(value as Record<string, unknown>),
      };
    } else {
      merged[key] = value;
    }
  }

  // Business (KYB) workflows carry no top-level country — fall back to the
  // registry country so downstream code that expects one never sees undefined.
  // The business submission reads business.country anyway.
  if (merged['country'] === undefined && flowConfig['subjectType'] === 'business') {
    const business = flowConfig['business'] as { country?: string } | undefined;
    if (business?.country) merged['country'] = business.country;
  }

  return merged as P;
}

/**
 * The template keys a mapped APPLICANT workflow (business.applicant.workflowId)
 * overlays onto a KYB mount — the individual capture-leg surface only. KYB
 * publish REJECTS these keys on the business config itself, so the overlay is
 * collision-free by construction. Contact OTPs, the questionnaire, branding and
 * device policy stay the KYB workflow's own. Mirrors the web SDK.
 */
const APPLICANT_LEG_KEYS = [
  'country',
  'countries',
  'idTypes',
  'enableSelfie',
  'enableDocumentCapture',
  'allowDocumentUpload',
  'enableLiveness',
  'livenessMode',
  'flashSequenceLength',
  'nfc',
] as const;

/**
 * Overlay a resolved applicant workflow's capture template over an (already
 * workflow-merged) KYB config, recording its id as `applicantWorkflowId` so
 * the applicant's own submission is stamped with it. No-op when nothing was
 * mapped/resolved.
 */
export function overlayApplicantWorkflow<P extends Record<string, unknown>>(
  applicantWorkflow: { id: string; config: Record<string, unknown> } | null | undefined,
  merged: P,
): P {
  if (!applicantWorkflow) return merged;
  const out: Record<string, unknown> = { ...merged, applicantWorkflowId: applicantWorkflow.id };
  for (const key of APPLICANT_LEG_KEYS) {
    const value = applicantWorkflow.config[key];
    if (value !== undefined) out[key] = value;
  }
  return out as P;
}
