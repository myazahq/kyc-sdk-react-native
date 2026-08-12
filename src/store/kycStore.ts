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
  type KYCSubmissionResult,
  type KycState,
  type KycStore,
} from './state';
import { nextStepAfter, nfcDecision, previousStepBefore } from './derive';
import { recordStep, resetStepLog } from '../lib/step-log';
import { buildVerifyRequest } from './submit';
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
      selectedCountry: null,
      selectedIdType: null,
      idNumber: null,
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
        set((s) => ({
          selectedCountry: country,
          selectedIdType: s.selectedCountry === country ? s.selectedIdType : null,
          idNumber: s.selectedCountry === country ? s.idNumber : null,
        }));
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
        set((s) => ({
          contact:
            channel === 'email'
              ? { ...s.contact, emailAddress: destination, emailToken: token }
              : { ...s.contact, phoneNumber: destination, phoneToken: token },
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

      setBusinessField(key, value) {
        set((s) => ({ business: { ...s.business, [key]: value } }));
      },

      setKeyPeople(rows) {
        set((s) => ({ businessApplication: { ...s.businessApplication, keyPeople: rows } }));
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
            status: 'pending',
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
        recordStep('consent');
        set({
          currentStep: 'consent',
          selectedCountry: null,
          selectedIdType: null,
          idNumber: null,
          mediaIds: {},
          submissionResult: null,
          documentScanPhase: 'front',
          documentCapturePhase: 'front',
          immersiveCapture: false,
          flashPaint: null,
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
    if (s.currentStep !== prev.currentStep) recordStep(s.currentStep);
  });

  // A fresh store IS a fresh session: the runtime provider creates one per
  // modal launch and reset() is NOT part of the open path, so the journey
  // starts here — and the opening step must be recorded explicitly (the
  // subscription above only fires on CHANGE, and a new store already sits on
  // 'consent').
  resetStepLog();
  recordStep(store.getState().currentStep);

  return store;
}

// Re-export the flow helpers for tests + screens that need to reason about
// navigation without mutating the store.
