// ---------------------------------------------------------------------------
// kycStore — the flow store (mirrors Flutter's KYCNotifier + KYCState).
//
// One store per modal instance via `createKycStore(config)`, so the flow state
// and its resolved API client are scoped to a single launch. The React layer
// exposes it through context + a `useStore` selector hook.
//
// The state SHAPES live in ./state.ts and the pure derivations in ./derive.ts
// (200-line rule); this file is the store factory and its actions. Both are
// re-exported below so existing importers are unaffected.
// ---------------------------------------------------------------------------

import { createStore } from 'zustand/vanilla';

import { createKYCApi } from '../services/api';

import { resolveBaseUrl, normalizeDevAssetUrl } from '../services/resolveUrl';
import { withRetry } from '../services/retry';
import { collectFingerprint } from '../services/fingerprint';
import type { KYCStep, ResolvedKYCConfig } from '../types/config';
import { INITIAL_SERVER_CONFIG, describeConfigError, type ServerConfigState } from './serverConfig';
import {
  EMPTY_BUSINESS,
  EMPTY_BUSINESS_APPLICATION,
  EMPTY_BUSINESS_CHECK,
  type KYCSubmissionResult,
  type KycState,
  type KycStore,
} from './state';
import { nextStepAfter, nfcDecision, previousStepBefore } from './derive';

/** The steps that make up ONE ID's evidence. Leaving this set is what ends a
 *  multi-ID check — the leg has several exits depending on the ID. */
const ID_EVIDENCE_STEPS = new Set<KYCStep>(['id-input', 'document-capture', 'nfc']);

/** The 1-based check the applicant is on, or undefined outside a multi-ID run.
 *  Only emitted once a slot has been COMMITTED — on an ordinary run the field
 *  would be a constant 1 on every entry, which is noise. */
function multiIdSlotOf(s: KycState): number | undefined {
  return s.multiIdSlots.length > 0 ? s.multiIdSlots.length + 1 : undefined;
}

/** The ID selected at this moment — see StepLogEntry.idType. */
function selectedIdTypeOf(s: KycState): string | undefined {
  return s.selectedIdType ?? undefined;
}

/** The active multi-ID plan for the store's current state, or null. */
function multiIdPlanFor(s: KycState): ReturnType<typeof multiIdPlan> {
  return multiIdPlan(
    { ...s.config, country: s.selectedCountry ?? s.config.country },
    { multiIdSlotIndex: s.multiIdSlotIndex, multiIdSlots: s.multiIdSlots },
    s.serverConfig.status === 'ready' ? s.serverConfig.idTypes : [],
  );
}
import { recordStep, resetStepLog } from '../lib/step-log';
import { multiIdPlan } from '../lib/multi-id';
import { resolveIdTypeDefinition } from '../config/idTypes';
import { buildVerifyRequest } from './submit';
import { resetBusinessCheck, runBusinessCheck } from './businessCheck';
import { startAttemptSession, watchSessionProgress } from './session';
import { applicantMediaCaptured, buildApplicantVerifyRequest } from './submitApplicant';

export * from './state';
export {
  effectiveCountry,
  livenessEnabled,
  nfcEnabled,
  nextStepAfter,
  previousStepBefore,
  stepOrderOptions,
  stepProgress,
} from './derive';

/**
 * `serverConfig` may be PRELOADED: resolving a workflow already returns the
 * org's ID-type allowlist and branding, so seeding it here means the flow never
 * makes the separate `/config` call — and never renders the loading state for
 * data it already has.
 */
export function createKycStore(
  config: ResolvedKYCConfig,
  serverConfig?: ServerConfigState,
): KycStore {
  const baseUrl = resolveBaseUrl(config.apiKey, config.devUrl);
  const api = createKYCApi(baseUrl, config.apiKey);

  const store = createStore<KycState>((set, get) => {
    function emitStepChange(step: KYCStep): void {
      config.onStepChange?.(step);
    }

    return {
      config,
      api,

      currentStep: 'consent',
      sessionId: null,
      sessionUrl: null,
      businessCheck: { ...EMPTY_BUSINESS_CHECK },
      selectedCountry: null,
      selectedIdType: null,
      idNumber: null,
      multiIdSlotIndex: 0,
      multiIdSlots: [],
      multiIdRestored: null,
      mediaIds: {},
      submissionResult: null,
      serverConfig: serverConfig ?? INITIAL_SERVER_CONFIG,
      documentScanPhase: 'front',
      documentCapturePhase: 'front',
      immersiveCapture: false,
      flashPaint: null,
      navDirection: 'forward' as const,
      questionnaireAnswers: {},
      contact: {},
      contactChallenge: null,
      business: EMPTY_BUSINESS,
      businessApplication: EMPTY_BUSINESS_APPLICATION,
      applicantKeyPersonId: null,
      keyPeopleInvites: [],
      captureIntegrity: null,
      mrzScan: null,
      chipData: null,
      poaDocumentType: null,
      poaFileName: null,
      isLoading: false,
      error: null,

      async loadServerConfig() {
        set((s) => ({ serverConfig: { ...s.serverConfig, status: 'loading' } }));
        try {
          const res = await api.config();
          // Make a local dev server's hardcoded `localhost` logo URL reachable on
          // the Android emulator (rewrites the origin to the SDK base; no-op for
          // production CDN URLs).
          const branding = res.branding
            ? { ...res.branding, logo: normalizeDevAssetUrl(res.branding.logo, baseUrl) }
            : res.branding;
          set({
            serverConfig: {
              status: 'ready',
              idTypes: res.idTypes,
              branding,
              geoCountry: res.geoCountry,
              environment: res.environment,
              fatal: false,
            },
          });
        } catch (err) {
          const described = describeConfigError(err);
          set((s) => ({
            serverConfig: { ...s.serverConfig, status: 'error', ...described },
          }));
        }
      },

      setCountry(country) {
        // Changing country invalidates the ID choice: the same key can mean a
        // different document (or none) elsewhere, so it is cleared rather than
        // silently carried across.
        set((s) => {
          const same = s.selectedCountry === country;
          return {
            selectedCountry: country,
            selectedIdType: same ? s.selectedIdType : null,
            idNumber: same ? s.idNumber : null,
            // A multi-ID run's committed slots belong to the country they were
            // picked in; carrying them into a new one would offer an ID no
            // register there can verify.
            multiIdSlotIndex: same ? s.multiIdSlotIndex : 0,
            multiIdSlots: same ? s.multiIdSlots : [],
            multiIdRestored: same ? s.multiIdRestored : null,
          };
        });
      },

      commitMultiIdSlot(nextStep, previews) {
        set((s) => {
          if (!s.selectedIdType) return {};
          const slot = {
            idType: s.selectedIdType,
            ...(s.idNumber ? { idNumber: s.idNumber } : {}),
            ...(s.mediaIds.documentFront ? { documentFront: s.mediaIds.documentFront } : {}),
            ...(s.mediaIds.documentBack ? { documentBack: s.mediaIds.documentBack } : {}),
            ...(s.mediaIds.documentFrontVideo
              ? { documentFrontVideo: s.mediaIds.documentFrontVideo }
              : {}),
            ...(s.mediaIds.documentBackVideo
              ? { documentBackVideo: s.mediaIds.documentBackVideo }
              : {}),
            ...(s.chipData ? { chipData: s.chipData } : {}),
            ...(previews?.front ? { documentFrontImage: previews.front } : {}),
            ...(previews?.back ? { documentBackImage: previews.back } : {}),
          };
          // The working evidence is cleared for the next check; the SELFIE and
          // its video are run-level and deliberately untouched.
          return {
            multiIdSlots: [...s.multiIdSlots, slot],
            multiIdSlotIndex: s.multiIdSlotIndex + 1,
            selectedIdType: null,
            idNumber: null,
            multiIdRestored: null,
            mediaIds: {
              ...s.mediaIds,
              documentFront: undefined,
              documentBack: undefined,
              documentFrontVideo: undefined,
              documentBackVideo: undefined,
            },
            // The chip belongs to the check just committed; the next one reads
            // its own document (or none).
            chipData: null,
            documentScanPhase: 'front' as const,
            currentStep: nextStep,
          };
        });
      },

      uncommitMultiIdSlot(step) {
        set((s) => {
          const last = s.multiIdSlots[s.multiIdSlots.length - 1];
          if (!last) return {};
          // Restore what that check captured — changing an earlier ID must not
          // mean re-photographing a document that is still perfectly good.
          return {
            multiIdSlots: s.multiIdSlots.slice(0, -1),
            multiIdSlotIndex: Math.max(s.multiIdSlots.length - 1, 0),
            selectedIdType: last.idType,
            idNumber: last.idNumber ?? null,
            multiIdRestored: {
              ...(last.documentFrontImage ? { front: last.documentFrontImage } : {}),
              ...(last.documentBackImage ? { back: last.documentBackImage } : {}),
            },
            mediaIds: {
              ...s.mediaIds,
              documentFront: last.documentFront,
              documentBack: last.documentBack,
              documentFrontVideo: last.documentFrontVideo,
              documentBackVideo: last.documentBackVideo,
            },
            chipData: last.chipData ?? null,
            currentStep: step,
          };
        });
      },

      setIdType(idType) {
        set({ selectedIdType: idType });
      },

      setIdNumber(idNumber) {
        set({ idNumber });
      },

      setMediaId(key, mediaId) {
        set((s) => ({ mediaIds: { ...s.mediaIds, [key]: mediaId } }));
      },

      setDocumentMediaId(mediaId, side) {
        set((s) => ({
          mediaIds: {
            ...s.mediaIds,
            [side === 'front' ? 'documentFront' : 'documentBack']: mediaId,
          },
          documentScanPhase: side === 'front' ? 'back' : 'complete',
        }));
      },

      setQuestionnaireAnswer(key, value) {
        set((s) => {
          const next = { ...s.questionnaireAnswers };
          // An undefined answer is REMOVED rather than stored as undefined, so
          // "unanswered" is one state and not two.
          if (value === undefined) delete next[key];
          else next[key] = value;
          return { questionnaireAnswers: next };
        });
      },

      setContactVerified(channel, destination, token) {
        set((s) => {
          // A fresh proof clears its channel's "server refused this" flag.
          const expired = (s.contact.expired ?? []).filter((c) => c !== channel);
          return {
            contact:
              channel === 'email'
                ? { ...s.contact, emailAddress: destination, emailToken: token, expired }
                : { ...s.contact, phoneNumber: destination, phoneToken: token, expired },
          };
        });
      },

      clearContactProofs(channels) {
        // The server refused these proofs at submit (single-use tokens expire
        // ~30 min after the OTP check, and session restore can resurrect a
        // dead one). Drop the tokens, keep the destinations, flag the steps.
        set((s) => ({
          contact: {
            ...s.contact,
            ...(channels.includes('email') ? { emailToken: undefined } : {}),
            ...(channels.includes('phone') ? { phoneToken: undefined } : {}),
            expired: channels,
          },
        }));
      },

      setContactDestination(channel, destination) {
        set((s) => ({
          contact:
            channel === 'email'
              ? { ...s.contact, emailAddress: destination }
              : { ...s.contact, phoneNumber: destination },
        }));
      },

      setSessionId(sessionId, sessionUrl) {
        set({ sessionId, ...(sessionUrl !== undefined ? { sessionUrl } : {}) });
      },

      async checkBusiness() {
        return runBusinessCheck(get, set);
      },

      setBusinessField(key, value) {
        // Any change to WHICH company this is about invalidates the answer we
        // hold, so the check never describes one business while the field names
        // another. Everything the previous register told us about the old
        // company goes with it — only what the REGISTER wrote: an applicant who
        // typed their own address meant it. Clearing it also unblocks the next
        // lookup, whose prefill only ever writes into an empty field, so
        // leftovers were not merely stale, they were suppressing the real
        // answer. Mirrors the web SDK's setDetails.
        const identityChanged =
          key === 'registrationNumber' || key === 'country' || key === 'product';
        set((s) => {
          const business = { ...s.business, [key]: value };
          if (identityChanged) {
            for (const prefilledKey of s.businessCheck.prefilled) {
              if (prefilledKey !== key) (business as Record<string, unknown>)[prefilledKey] = '';
            }
          }
          return { business };
        });
        if (identityChanged) resetBusinessCheck(set);
      },

      applyBusinessPrefill(patch, prefilled) {
        set((s) => ({
          business: { ...s.business, ...patch },
          businessCheck: { ...s.businessCheck, prefilled },
        }));
      },

      setKeyPeople(rows) {
        set((s) => ({ businessApplication: { ...s.businessApplication, keyPeople: rows } }));
      },

      setUboUnidentifiable(checked) {
        set((s) => ({
          businessApplication: { ...s.businessApplication, uboUnidentifiable: checked },
        }));
      },

      setBusinessDocument(doc) {
        set((s) => ({
          businessApplication: {
            ...s.businessApplication,
            // One upload per slot: re-uploading replaces rather than appends,
            // so a user who retakes a photo does not submit both.
            documents: [
              ...s.businessApplication.documents.filter((d) => d.type !== doc.type),
              doc,
            ],
          },
        }));
      },

      removeBusinessDocument(type) {
        set((s) => ({
          businessApplication: {
            ...s.businessApplication,
            documents: s.businessApplication.documents.filter((d) => d.type !== type),
          },
        }));
      },

      setApplicant(role, name, keyPersonIndex = null) {
        set((s) => ({
          businessApplication: {
            ...s.businessApplication,
            applicantRole: role,
            applicantName: name,
            applicantKeyPersonIndex: keyPersonIndex,
          },
        }));
      },

      setCaptureIntegrity(integrity) {
        set({ captureIntegrity: integrity });
      },

      setMrzScan(scan) {
        set({ mrzScan: scan });
      },

      setChipData(data) {
        set({ chipData: data });
      },

      setProofOfAddress(mediaId, docType, fileName) {
        set((s) => ({
          mediaIds: { ...s.mediaIds, proofOfAddress: mediaId },
          poaDocumentType: docType,
          poaFileName: fileName,
        }));
      },

      clearProofOfAddress() {
        set((s) => {
          const { proofOfAddress: _dropped, ...rest } = s.mediaIds;
          return { mediaIds: rest, poaDocumentType: null, poaFileName: null };
        });
      },

      setDocumentCapturePhase(phase) {
        if (get().documentCapturePhase !== phase) set({ documentCapturePhase: phase });
      },

      setContactChallenge(challenge) {
        const prev = get().contactChallenge;
        // Guarded like the capture phase: the header re-renders off this, and a
        // send that changes nothing should not churn it.
        if (
          prev?.channel === challenge?.channel &&
          prev?.destination === challenge?.destination &&
          prev?.via === challenge?.via
        ) {
          return;
        }
        set({ contactChallenge: challenge });
      },

      setFlashPaint(paint) {
        set({ flashPaint: paint });
      },
      setImmersiveCapture(immersive) {
        if (get().immersiveCapture !== immersive) set({ immersiveCapture: immersive });
      },

      nextStep() {
        const next = nextStepAfter(get().currentStep, get());

        // Multi-ID: the run walks the capture leg once PER ID. Intercepted here
        // rather than in each screen because it is one rule — "the applicant
        // finished this check" — and the leg has several exits (a number-only
        // ID leaves from id-input, a document ID from document-capture or the
        // chip read after it).
        const plan = multiIdPlanFor(get());
        if (plan && ID_EVIDENCE_STEPS.has(get().currentStep) && !ID_EVIDENCE_STEPS.has(next)) {
          const previews = get().multiIdRestored ?? undefined;
          if (!plan.last) {
            // Another ID to go: commit this one and hand the picker back.
            get().commitMultiIdSlot('id-type', previews);
            emitStepChange('id-type');
            return;
          }
          // The final check: commit it, then carry on to the shared selfie.
          get().commitMultiIdSlot(next, previews);
          emitStepChange(next);
          return;
        }
        // Leaving document capture is the moment the chip step either appears or
        // silently does not. Four independent gates can remove it and a missing
        // step looks the same however it went missing, so say which one.
        if (__DEV__ && get().currentStep === 'document-capture' && next !== 'nfc') {
          const d = nfcDecision(get());
          if (!d.enabled) console.log('[myaza] NFC step skipped:', d.reason);
        }
        if (next !== get().currentStep) {
          // Lowered on every step change: the flag belongs to a live camera, and
          // leaving it raised means re-entering document-capture renders its
          // primer chrome-free for a frame before the effect corrects it. The
          // step that wants it raises it again on mount.
          set({ currentStep: next, immersiveCapture: false, navDirection: 'forward' });
          emitStepChange(next);
        }
      },

      previousStep() {
        // Multi-ID: stepping back from the picker means re-doing the PREVIOUS
        // check, not leaving the flow. The slot is uncommitted so its ID number
        // and captures come back — changing an earlier ID must not mean
        // re-photographing a document that is still perfectly good.
        const slots = get().multiIdSlots;
        if (get().currentStep === 'id-type' && slots.length > 0) {
          const last = slots[slots.length - 1]!;
          const def = resolveIdTypeDefinition(
            get().selectedCountry ?? get().config.country ?? '',
            last.idType,
          );
          const step: KYCStep = def?.requiresDocumentCapture === false ? 'id-input' : 'document-capture';
          get().uncommitMultiIdSlot(step);
          emitStepChange(step);
          return;
        }
        const prev = previousStepBefore(get().currentStep, get());
        if (prev !== get().currentStep) {
          set({ currentStep: prev, immersiveCapture: false, navDirection: 'back' });
          emitStepChange(prev);
        }
      },

      goToStep(step) {
        if (step !== get().currentStep) {
          set({ currentStep: step });
          emitStepChange(step);
        }
      },

      async submitAsync(onRetry) {
        set({ isLoading: true, error: null });
        const state = get();
        // Best-effort: a fingerprint that fails to collect is a missing signal,
        // never a failed submission.
        const fingerprint =
          state.config.deviceIntelligence === false
            ? undefined
            : await collectFingerprint().catch(() => undefined);
        const request = buildVerifyRequest(state, fingerprint);
        try {
          const res = await withRetry(() => api.verify(request), { onRetry });
          const result: KYCSubmissionResult = {
            verificationId: res.verificationId,
            status: 'processing',
          };
          set({
            submissionResult: result,
            isLoading: false,
            // Kept so the submitted screen can hand out the invite links. A
            // retry of the same requestId returns these again, so they
            // survive a re-submit.
            ...(res.applicantKeyPersonId ? { applicantKeyPersonId: res.applicantKeyPersonId } : {}),
            ...(res.keyPeopleInvites ? { keyPeopleInvites: res.keyPeopleInvites } : {}),
          });
          // Applicant KYC: fire-and-forget — the submitted screen shows after
          // the BUSINESS submit; a failed applicant submit only warns (the org
          // can re-invite the applicant from the dashboard). Mirrors the web
          // and Flutter SDKs.
          if (res.applicantKeyPersonId && applicantMediaCaptured(state)) {
            void withRetry(() =>
              api.verify(buildApplicantVerifyRequest(state, res.applicantKeyPersonId!, fingerprint)),
            ).catch((err) => {
              console.warn(
                '[MyazaKYC] Applicant identity submission failed — the organization can re-invite the applicant from the dashboard:',
                err,
              );
            });
          }
          return result;
        } catch (err) {
          set({ isLoading: false, error: err instanceof Error ? err.message : 'Submission failed' });
          throw err;
        }
      },

      reset() {
        // Fresh step journey per session; the explicit record covers a store
        // already sitting on 'consent' (the subscribe below only fires on
        // change, and recordStep dedupes if it fires too).
        resetStepLog();
        recordStep('consent', multiIdSlotOf(get()), selectedIdTypeOf(get()));
        set({
          currentStep: 'consent',
          selectedCountry: null,
          selectedIdType: null,
          idNumber: null,
          multiIdSlotIndex: 0,
          multiIdSlots: [],
          multiIdRestored: null,
          mediaIds: {},
          submissionResult: null,
          documentScanPhase: 'front',
          documentCapturePhase: 'front',
          immersiveCapture: false,
          flashPaint: null,
          sessionId: null,
          sessionUrl: null,
          businessCheck: { ...EMPTY_BUSINESS_CHECK },
          questionnaireAnswers: {},
          contact: {},
          contactChallenge: null,
          business: EMPTY_BUSINESS,
          businessApplication: EMPTY_BUSINESS_APPLICATION,
          applicantKeyPersonId: null,
          keyPeopleInvites: [],
          captureIntegrity: null,
          mrzScan: null,
          chipData: null,
          poaDocumentType: null,
          poaFileName: null,
          isLoading: false,
          error: null,
        });
      },
    };
  });

  // Step journey log — records every step the user reaches (the subscription
  // catches ALL currentStep writes, whatever action made them; recordStep
  // collapses consecutive duplicates). Rides the submission as
  // metadata.device.stepLog for the dashboard timeline.
  store.subscribe((s, prev) => {
    if (s.currentStep !== prev.currentStep) {
      recordStep(s.currentStep, multiIdSlotOf(s), selectedIdTypeOf(s));
    }
  });

  // A fresh store IS a fresh session: the runtime provider creates one per
  // modal launch and reset() is NOT part of the open path, so the journey
  // starts here — and the opening step must be recorded explicitly (the
  // subscription above only fires on CHANGE, and a new store already sits on
  // 'consent').
  resetStepLog();
  recordStep(
    store.getState().currentStep,
    multiIdSlotOf(store.getState()),
    selectedIdTypeOf(store.getState()),
  );

  // The attempt session: minted at launch (a fresh store IS a fresh attempt),
  // with progress written as the user moves. Both best-effort by contract.
  startAttemptSession(store);
  watchSessionProgress(store);

  return store;
}

// Re-export the flow helpers for tests + screens that need to reason about
// navigation without mutating the store.
