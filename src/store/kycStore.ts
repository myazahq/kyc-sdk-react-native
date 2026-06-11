// ---------------------------------------------------------------------------
// kycStore — the main flow/state store (mirrors Flutter's KYCNotifier + KYCState).
//
// One store is created per modal instance via `createKycStore(config)` so the
// flow state (and the resolved API client) is scoped to a single launch. The
// React layer (Step 2) exposes it through context + a `useStore` selector hook.
// ---------------------------------------------------------------------------

import { createStore, type StoreApi } from 'zustand/vanilla';

import { createKYCApi, type KYCApi, type VerifyRequest } from '../services/api';
import { resolveBaseUrl, normalizeDevAssetUrl } from '../services/resolveUrl';
import { withRetry } from '../services/retry';
import { collectDeviceMetadata } from '../services/deviceMetadata';
import { requiresDocumentCapture } from '../config/idTypes';
import { generateRequestId } from '../utils/uuid';
import type { IdType, KYCStep, MyazaKYCConfig } from '../types/config';
import {
  INITIAL_SERVER_CONFIG,
  describeConfigError,
  featuresFor,
  type ServerConfigState,
} from './serverConfig';

export interface KYCMediaIds {
  documentFront?: string;
  documentBack?: string;
  selfie?: string;
  documentFrontVideo?: string;
  documentBackVideo?: string;
  livenessVideo?: string;
}

export interface KYCSubmissionResult {
  verificationId: string;
  status: 'pending';
}

export type DocumentScanPhase = 'front' | 'back' | 'complete';

/** Document-capture sub-phase — drives the sheet header title/description. */
export type DocumentCapturePhase = 'front' | 'front-preview' | 'back' | 'review';

/** The mediaIds keys settable via `setMediaId`. */
export type MediaIdKey = keyof KYCMediaIds;

export interface KycState {
  config: MyazaKYCConfig;
  api: KYCApi;

  currentStep: KYCStep;
  selectedIdType: IdType | null;
  idNumber: string | null;
  mediaIds: KYCMediaIds;
  submissionResult: KYCSubmissionResult | null;
  serverConfig: ServerConfigState;
  documentScanPhase: DocumentScanPhase;
  /** Sub-phase of the document-capture step — synced by the screen so the header
   *  title/description can be phase-aware (mirrors Flutter's docReviewPhase). */
  documentCapturePhase: DocumentCapturePhase;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadServerConfig: () => Promise<void>;
  setIdType: (idType: IdType) => void;
  setIdNumber: (idNumber: string) => void;
  setMediaId: (key: MediaIdKey, mediaId: string) => void;
  setDocumentMediaId: (mediaId: string, side: 'front' | 'back') => void;
  setDocumentCapturePhase: (phase: DocumentCapturePhase) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: KYCStep) => void;
  submitAsync: (onRetry?: (attempt: number, total: number) => void) => Promise<KYCSubmissionResult>;
  reset: () => void;
}

export type KycStore = StoreApi<KycState>;

// ---------------------------------------------------------------------------
// Flow navigation — single source of truth for the 5-step sequence.
// ---------------------------------------------------------------------------

function livenessEnabled(state: KycState): boolean {
  // Consumer baseline: liveness is on unless explicitly disabled.
  if (state.config.enableLiveness === false) return false;
  const idType = state.selectedIdType;
  if (!idType) return true;
  // Server flag wins when present; otherwise keep the consumer baseline (on).
  const features = featuresFor(state.serverConfig, state.config.country, idType);
  return features ? features.livenessCheck : true;
}

/** The step that follows `step`, given the current selection + flags. */
function nextStepAfter(step: KYCStep, state: KycState): KYCStep {
  switch (step) {
    case 'consent':
      return 'id-type';
    case 'id-type':
      return state.selectedIdType && requiresDocumentCapture(state.selectedIdType)
        ? 'document-capture'
        : 'id-input';
    case 'document-capture':
    case 'id-input':
      return livenessEnabled(state) ? 'liveness' : 'submitted';
    case 'liveness':
      return 'submitted';
    case 'submitted':
      return 'submitted';
    default:
      return step;
  }
}

/** The step before `step` (for the back button). */
function previousStepBefore(step: KYCStep, state: KycState): KYCStep {
  switch (step) {
    case 'id-type':
      return 'consent';
    case 'document-capture':
    case 'id-input':
      return 'id-type';
    case 'liveness':
      return state.selectedIdType && requiresDocumentCapture(state.selectedIdType)
        ? 'document-capture'
        : 'id-input';
    case 'submitted':
      // Submitted is terminal; back is a no-op in practice.
      return livenessEnabled(state) ? 'liveness' : step;
    case 'consent':
    default:
      return 'consent';
  }
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

export function createKycStore(config: MyazaKYCConfig): KycStore {
  const baseUrl = resolveBaseUrl(config.apiKey, config.devUrl);
  const api = createKYCApi(baseUrl, config.apiKey);

  return createStore<KycState>((set, get) => {
    function emitStepChange(step: KYCStep): void {
      config.onStepChange?.(step);
    }

    return {
      config,
      api,

      currentStep: 'consent',
      selectedIdType: null,
      idNumber: null,
      mediaIds: {},
      submissionResult: null,
      serverConfig: INITIAL_SERVER_CONFIG,
      documentScanPhase: 'front',
      documentCapturePhase: 'front',
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

      setDocumentCapturePhase(phase) {
        if (get().documentCapturePhase !== phase) set({ documentCapturePhase: phase });
      },

      nextStep() {
        const next = nextStepAfter(get().currentStep, get());
        if (next !== get().currentStep) {
          set({ currentStep: next });
          emitStepChange(next);
        }
      },

      previousStep() {
        const prev = previousStepBefore(get().currentStep, get());
        if (prev !== get().currentStep) {
          set({ currentStep: prev });
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
        const request: VerifyRequest = {
          country: state.config.country,
          idType: state.selectedIdType ?? '',
          idNumber: state.idNumber ?? undefined,
          userData: state.config.userData,
          mediaIds: state.mediaIds,
          metadata: {
            requestId: generateRequestId(),
            device: collectDeviceMetadata() as unknown as Record<string, unknown>,
            ...(state.config.metadata ?? {}),
          },
        };
        try {
          const res = await withRetry(() => api.verify(request), { onRetry });
          const result: KYCSubmissionResult = {
            verificationId: res.verificationId,
            status: 'pending',
          };
          set({ submissionResult: result, isLoading: false });
          return result;
        } catch (err) {
          set({ isLoading: false, error: err instanceof Error ? err.message : 'Submission failed' });
          throw err;
        }
      },

      reset() {
        set({
          currentStep: 'consent',
          selectedIdType: null,
          idNumber: null,
          mediaIds: {},
          submissionResult: null,
          documentScanPhase: 'front',
          documentCapturePhase: 'front',
          isLoading: false,
          error: null,
        });
      },
    };
  });
}

// Re-export the flow helpers for tests + screens that need to reason about
// navigation without mutating the store.
export { livenessEnabled, nextStepAfter, previousStepBefore };
