// ---------------------------------------------------------------------------
// Building the /verify request.
//
// Split from kycStore.ts (200-line rule). Pure: state in, request out — so what
// the SDK actually sends can be reasoned about (and tested) without a store, a
// network, or a running flow.
//
// Two rules shape it. A KYB submission carries registry details instead of an
// ID, so the country source, the `idType` slot and the media all differ. And
// every optional block is sent ONLY when the flow collected it: an inactive
// questionnaire must not put an empty object on the verification record, and an
// unconfigured contact proof must not claim a check that never ran.
// ---------------------------------------------------------------------------

import { collectDeviceMetadata } from '../services/deviceMetadata';
import { generateRequestId } from '../utils/uuid';
import { hasActiveQuestionnaire, questionnairePayload } from '../config/questionnaire';
import { isBusinessFlow } from '../config/business';
import { businessSubmission, effectiveCountry } from './derive';
import type { ClientFingerprint } from '../services/fingerprint';
import type { VerifyRequest } from '../services/api';
import type { KycState } from './state';

export function buildVerifyRequest(
  state: KycState,
  fingerprint: ClientFingerprint | undefined,
): VerifyRequest {
  // A KYB flow submits registry details instead of an ID: a different country
  // source (the picked registry), the product key riding on `idType`, and no
  // capture media at all.
  const business = isBusinessFlow(state.config) ? businessSubmission(state) : null;

  return {
  country: business ? business.country : effectiveCountry(state),
  idType: business ? business.product : (state.selectedIdType ?? ''),
  idNumber: business ? undefined : (state.idNumber ?? undefined),
  ...(business ? { business: business.payload } : {}),
  // The org's user reference (becomes Entity.externalUserId at the KYC seam).
  ...(state.config.userId ? { userId: state.config.userId } : {}),
  userData: business ? undefined : state.config.userData,
  mediaIds: business ? {} : state.mediaIds,
  ...(state.config.workflowId ? { workflowId: state.config.workflowId } : {}),
  ...(state.poaDocumentType ? { proofOfAddressType: state.poaDocumentType } : {}),
  ...(state.contact.emailToken || state.contact.phoneToken
    ? {
        contact: {
          ...(state.contact.emailToken ? { emailToken: state.contact.emailToken } : {}),
          ...(state.contact.phoneToken ? { phoneToken: state.contact.phoneToken } : {}),
        },
      }
    : {}),
  // The chip read, when one succeeded.
  //
  // This was the whole point of the NFC step and it was never sent: the read
  // completed, `setChipData` stored the result, and nothing ever put it in the
  // request. Every field the server wants was sitting in the store while the
  // verification recorded no chip at all — passive authentication never ran,
  // the assurance level never reached `chip`, and the dashboard showed nothing.
  //
  // Omitted entirely when absent rather than sent empty: the server treats a
  // present-but-hollow block as a failed read, which is not the same as a
  // document whose chip was never scanned.
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
  // Only sent when the flow actually asked — an inactive questionnaire
  // must not put an empty object on the verification record.
  ...(hasActiveQuestionnaire(state.config.questionnaire)
    ? {
        questionnaire: questionnairePayload(
          state.config.questionnaire!.fields,
          state.questionnaireAnswers,
        ),
      }
    : {}),
  // `metadata` is free-form passthrough. The SDK-owned keys (`requestId` —
  // the server's idempotency key — and `device`) are written AFTER the
  // caller's metadata so consumer keys can never clobber them. The user
  // reference is the top-level `userId` above. Identical on web + Flutter.
  metadata: {
    ...(state.config.metadata ?? {}),
    requestId: generateRequestId(),
    device: {
      ...(collectDeviceMetadata() as unknown as Record<string, unknown>),
      // Device Intelligence rides the free-form device channel rather
      // than a schema field, so an older server simply ignores it and
      // an older SDK degrades to IP + user-agent only. Off when the
      // workflow disables it — collecting signals nobody will score is
      // data taken for nothing.
      ...(fingerprint ? { fingerprint } : {}),
    },
  },
  };
}
