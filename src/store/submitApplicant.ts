// ---------------------------------------------------------------------------
// The APPLICANT's own verification — a SECOND, ordinary INDIVIDUAL submission
// fired after the business one succeeds, linked back to the application via
// `metadata.userId = applicantKeyPersonId` (the server-side contract that binds
// the applicant's KYC to their KeyPerson row). Mirrors the web SDK's
// submitApplicantVerification and Flutter's _submitApplicantVerification.
//
// When the org mapped an applicant workflow (business.applicant.workflowId,
// overlaid onto the config by the workflow gate), its id rides along so the
// server applies THAT workflow's gates, pricing and decision graph.
// ---------------------------------------------------------------------------

import { collectDeviceMetadata } from '../services/deviceMetadata';
import { generateRequestId } from '../utils/uuid';
import { splitFullName } from '../config/keyPeople';
import { effectiveCountry } from './derive';
import type { ClientFingerprint } from '../services/fingerprint';
import type { VerifyRequest } from '../services/api';
import type { KycState } from './state';

/** Whether the applicant capture leg actually produced something to submit. */
export function applicantMediaCaptured(state: KycState): boolean {
  return Boolean(
    state.selectedIdType &&
      (state.mediaIds.selfie || state.mediaIds.documentFront || (state.idNumber ?? '').trim() !== ''),
  );
}

export function buildApplicantVerifyRequest(
  state: KycState,
  applicantKeyPersonId: string,
  fingerprint: ClientFingerprint | undefined,
): VerifyRequest {
  // Name: the consumer's userData wins; the applicant-role step's optional
  // full name fills the gaps. Same precedence as the web SDK.
  const cfgUser = state.config.userData;
  const split = splitFullName((state.businessApplication.applicantName ?? '').trim()) ?? {};
  const firstName = cfgUser?.firstName?.trim() || split.firstName;
  const lastName = cfgUser?.lastName?.trim() || split.lastName;
  const userData =
    firstName || lastName
      ? { ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}) }
      : undefined;

  return {
    // The applicant's own leg country — their country-select choice (or the
    // overlaid applicant workflow's / registry fallback), never forced to the
    // business registry country.
    country: effectiveCountry(state),
    idType: state.selectedIdType ?? '',
    ...(state.idNumber?.trim() ? { idNumber: state.idNumber } : {}),
    ...(state.config.applicantWorkflowId ? { workflowId: state.config.applicantWorkflowId } : {}),
    ...(userData ? { userData } : {}),
    mediaIds: state.mediaIds,
    // The chip read, when the leg ran the NFC step (an overlaid applicant
    // workflow can enable it). Same block as the individual flow's builder.
    ...(state.chipData
      ? {
          nfc: {
            dg1: state.chipData.dg1,
            ...(state.chipData.sod ? { sod: state.chipData.sod } : {}),
            ...(state.chipData.dg2 ? { dg2: state.chipData.dg2 } : {}),
            chipAuth: state.chipData.chipAuth,
          },
        }
      : {}),
    // NO top-level `userId` here on purpose: the server prefers it over
    // metadata.userId, so sending the org's own user ref would sever the
    // KeyPerson link this submission exists to make.
    metadata: {
      ...(state.config.metadata ?? {}),
      requestId: generateRequestId(),
      device: {
        ...(collectDeviceMetadata() as unknown as Record<string, unknown>),
        ...(fingerprint ? { fingerprint } : {}),
      },
      // The link back to the application — written last so nothing clobbers it.
      userId: applicantKeyPersonId,
    },
  };
}
