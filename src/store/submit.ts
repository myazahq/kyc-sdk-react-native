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
import { multiIdWireSlots } from '../lib/multi-id';
import { isBusinessFlow } from '../config/business';
import { businessSubmission, effectiveCountry } from './derive';
import type { ClientFingerprint } from '../services/fingerprint';
import type { VerifyRequest } from '../services/api';
import type { KycState } from './state';

/** The chip payload as the wire wants it. One builder, so a slot's chip and a
 *  single-ID run's are byte-identical to the server. */
export function nfcPayload(
  chip: NonNullable<KycState['chipData']>,
): NonNullable<VerifyRequest['nfc']> {
  return {
    dg1: chip.dg1,
    ...(chip.sod ? { sod: chip.sod } : {}),
    ...(chip.dg2 ? { dg2: chip.dg2 } : {}),
    ...(chip.dg7 ? { dg7: chip.dg7 } : {}),
    ...(chip.dg11 ? { dg11: chip.dg11 } : {}),
    ...(chip.dg12 ? { dg12: chip.dg12 } : {}),
    ...(chip.dg15 ? { dg15: chip.dg15 } : {}),
    ...(chip.aaSignature ? { aaSignature: chip.aaSignature } : {}),
    ...(chip.aaChallengeId ? { aaChallengeId: chip.aaChallengeId } : {}),
    chipAuth: chip.chipAuth,
    // The PACE diagnostic. Read on every session and, until now, dropped here:
    // every RN chip read reached the server with paceOutcome null, so the one
    // question the field exists to answer — did this chip decline PACE, or did
    // ours fail? — was unanswerable for the whole install base. Flutter has
    // always sent it.
    ...(chip.paceOutcome ? { paceOutcome: chip.paceOutcome } : {}),
    ...(chip.paceDetail ? { paceDetail: chip.paceDetail } : {}),
  };
}

export function buildVerifyRequest(
  state: KycState,
  fingerprint: ClientFingerprint | undefined,
): VerifyRequest {
  // A KYB flow submits registry details instead of an ID: a different country
  // source (the picked registry), the product key riding on `idType`, and no
  // capture media at all.
  const business = isBusinessFlow(state.config) ? businessSubmission(state) : null;

  // Multi-ID: every check was committed as a slot, and the whole run submits as
  // ONE verification the server judges by the workflow's pass policy. The FIRST
  // slot fills the single-ID fields, so anything reading a verification's own
  // idType/idNumber keeps one meaning.
  const multiSlots = !business && state.multiIdSlots.length >= 2 ? state.multiIdSlots : null;
  const primary = multiSlots?.[0];

  return {
  country: business ? business.country : effectiveCountry(state),
  idType: business ? business.product : (primary?.idType ?? state.selectedIdType ?? ''),
  idNumber: business ? undefined : (primary?.idNumber ?? state.idNumber ?? undefined),
  ...(multiSlots
    ? {
        idChecks: multiIdWireSlots(multiSlots).map((wire, i) => {
          const chip = multiSlots[i]?.chipData;
          return chip ? { ...wire, nfc: nfcPayload(chip) } : wire;
        }),
      }
    : {}),
  ...(business ? { business: business.payload } : {}),
  // The org's user reference (becomes Entity.externalUserId at the KYC seam).
  ...(state.config.userId ? { userId: state.config.userId } : {}),
  userData: business ? undefined : state.config.userData,
  // Multi-ID: the slot documents ride idChecks; only the RUN-level media (the
  // one selfie and its video) sit at the top level. Sending a slot's document
  // here too would file the last ID's capture as though it were the
  // verification's own.
  mediaIds: business
    ? {}
    : multiSlots
      ? { ...state.mediaIds, documentFront: undefined, documentBack: undefined }
      : state.mediaIds,
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
  // Multi-ID: the chip rides its OWN check (above) — a top-level payload could
  // only ever be attributed to the primary one.
  ...(!multiSlots && state.chipData ? { nfc: nfcPayload(state.chipData) } : {}),
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
  // The attempt session this run happened under: the verification adopts its
  // id, and any registry check paid at selection is not paid again at submit.
  ...(state.sessionId ? { sessionId: state.sessionId } : {}),
  // `metadata` is free-form passthrough. The SDK-owned keys (`requestId` —
  // the server's idempotency key — and `device`) are written AFTER the
  // caller's metadata so consumer keys can never clobber them. The user
  // reference is the top-level `userId` above. Identical on web + Flutter.
  metadata: {
    ...(state.config.metadata ?? {}),
    // Ignored by production, so it is safe to send whenever it is set.
    ...(business && state.business.sandboxOutcome
      ? { sandboxOutcome: state.business.sandboxOutcome }
      : {}),
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
