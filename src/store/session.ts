import type { KycState, KycStore } from './state';
import { getStepLog } from '../lib/step-log';
import { emptyKeyPerson, type KeyPersonEntry } from '../config/keyPeople';
import type { SessionStartResponse } from '../services/api-types';
import { persistentDeviceId } from '../services/fingerprint-sources';

// ---------------------------------------------------------------------------
// The attempt SESSION: minting at launch, and progress writes as the user moves.
//
// Ported from the web SDK (MyazaKYC.tsx beginSession + useSessionProgress),
// with the same contracts:
//
//   Best-effort throughout. Sessions power resumability, the dashboard's live
//   attempt view, session webhooks, and the registry check at selection —
//   verifying is never conditional on one existing, so every failure here is
//   swallowed.
//
//   Untouched progress is never written. The presence of stored progress IS
//   "they started"; a save-on-mount would make every opened flow look started,
//   and the server tells an abandoned first screen from a worked-through form
//   by exactly this absence.
//
//   A remount RESTORES the user to where they were, like web: the resumed
//   session's stored progress hydrates the store (restoreAttemptProgress),
//   so their step, captures and typed data survive an app restart.
// ---------------------------------------------------------------------------

const SAVE_DEBOUNCE_MS = 800;

// Collapses concurrent mints into one request per launch (mirrors the web
// SDK's start-session-once). Dev-mode double-invocation fired /session/start
// twice ~600ms apart; without an externalUserId the server has nothing to
// resume by, so the second call minted a SECOND session — the flow adopted one
// and the orphan sat on the org's list forever as "Not started". Short window
// on purpose: it collapses a double-invoke, never caches sessions, and a
// failure clears immediately so a retry is a real retry.
const inflightStarts = new Map<string, Promise<SessionStartResponse>>();

/** Mint (or resume) the attempt session and remember its id. Fire-and-forget. */
export function startAttemptSession(store: KycStore): void {
  const s = store.getState();
  if (s.sessionId) return;
  const externalUserId = s.config.userId ?? s.config.metadata?.['userId'];
  const key = `${s.config.apiKey}|${s.config.workflowId ?? ''}|${externalUserId ?? ''}`;
  let start = inflightStarts.get(key);
  if (!start) {
    // The device id is the anonymous-mount resume fallback: without a userId
    // the server has nothing else to find the previous attempt by, and every
    // app relaunch minted a fresh session. Hashed server-side before storage.
    start = persistentDeviceId().then((deviceRef) =>
      s.api.startSession({
        externalUserId,
        ...(deviceRef ? { deviceRef } : {}),
        ...(s.config.workflowId ? { workflowId: s.config.workflowId } : {}),
      }),
    );
    inflightStarts.set(key, start);
    start.then(
      () => setTimeout(() => inflightStarts.delete(key), 2000),
      () => inflightStarts.delete(key),
    );
  }
  void start
    .then((res) => {
      store.getState().setSessionId(res.sessionId, res.url ?? null);
      // Resuming: put the user back where they were, exactly as web does.
      // Media references are pruned server-side of anything expired, so a
      // restored capture slot is one whose bytes genuinely still exist.
      if (res.progress) restoreAttemptProgress(store, res.progress);
    })
    .catch(() => undefined);
}

/**
 * Hydrate the store from a resumed session's stored progress — the RN mirror
 * of the web reducer's RESTORE_PROGRESS. Only fields the snapshot carries are
 * touched; everything else keeps its launch value, so a partial or old
 * snapshot degrades to restoring less, never to breaking the flow.
 */
export function restoreAttemptProgress(
  store: KycStore,
  progress: NonNullable<SessionStartResponse['progress']>,
): void {
  const s = store.getState();
  const d = (progress.data ?? {}) as Record<string, unknown>;

  const app = d['businessApplication'] as
    | (Partial<KycState['businessApplication']> & { keyPeople?: Array<Record<string, unknown>> })
    | undefined;

  store.setState({
    // The terminal step is a RESULT, not a position. A submission that FAILED
    // still writes `submitted` as the last step reached, so resuming there
    // submits again, fails the same way and writes it again: closing the app
    // and reopening lands straight back on the error with no way forward.
    // Starting the flow again also re-resolves the workflow, so an applicant
    // caught mid-flight across a republish walks the CURRENT steps rather than
    // submitting against rules they were never shown.
    ...(typeof progress.step === 'string' && progress.step !== 'submitted'
      ? { currentStep: progress.step as KycState['currentStep'] }
      : {}),
    ...(progress.mediaIds ? { mediaIds: { ...s.mediaIds, ...progress.mediaIds } } : {}),
    ...(typeof d['selectedCountry'] === 'string'
      ? { selectedCountry: d['selectedCountry'] as string }
      : {}),
    ...(typeof d['selectedIdType'] === 'string'
      ? { selectedIdType: d['selectedIdType'] as KycState['selectedIdType'] }
      : {}),
    ...(typeof d['idNumber'] === 'string' ? { idNumber: d['idNumber'] as string } : {}),
    ...(d['business'] && typeof d['business'] === 'object'
      ? { business: { ...s.business, ...(d['business'] as object) } }
      : {}),
    ...(app
      ? {
          businessApplication: {
            ...s.businessApplication,
            ...app,
            // Rows saved BEFORE the sectioned redesign predate `roles`, `title`
            // and `owners`; a restored attempt must not hand the cards a shape
            // they cannot read. Same normalization as web's RESTORE_PROGRESS.
            ...(app.keyPeople
              ? {
                  keyPeople: app.keyPeople.map((row) => ({
                    ...emptyKeyPerson(),
                    ...row,
                    roles:
                      Array.isArray(row['roles']) && (row['roles'] as unknown[]).length > 0
                        ? (row['roles'] as KeyPersonEntry['roles'])
                        : [(row['role'] as KeyPersonEntry['role']) ?? 'director'],
                    title: typeof row['title'] === 'string' ? (row['title'] as string) : '',
                    owners: Array.isArray(row['owners'])
                      ? (row['owners'] as KeyPersonEntry['owners'])
                      : [],
                  })),
                }
              : {}),
          } as KycState['businessApplication'],
        }
      : {}),
    ...(d['contact'] && typeof d['contact'] === 'object'
      ? { contact: { ...s.contact, ...(d['contact'] as object) } }
      : {}),
    ...(d['questionnaireAnswers'] && typeof d['questionnaireAnswers'] === 'object'
      ? {
          questionnaireAnswers: {
            ...s.questionnaireAnswers,
            ...(d['questionnaireAnswers'] as object),
          },
        }
      : {}),
  });
}

/** The progress snapshot the server stores — mirrors the web SDK's shape, so
 *  the dashboard's attempt page reads both without branching. */
export function progressFromState(s: ReturnType<KycStore['getState']>): Record<string, unknown> {
  const mediaIds = Object.fromEntries(
    Object.entries(s.mediaIds ?? {}).filter(([, v]) => typeof v === 'string' && v),
  );
  return {
    step: s.currentStep,
    stepLog: getStepLog(),
    mediaIds,
    data: {
      selectedCountry: s.selectedCountry ?? undefined,
      selectedIdType: s.selectedIdType ?? undefined,
      idNumber: s.idNumber || undefined,
      business: s.business,
      businessApplication: s.businessApplication,
      contact: s.contact,
      questionnaireAnswers: s.questionnaireAnswers,
    },
  };
}

/** Nothing here needs saving until they move off the opening screen. */
export function isUntouchedProgress(payload: Record<string, unknown>): boolean {
  if (payload['step'] !== 'consent') return false;
  return Object.keys((payload['mediaIds'] as object) ?? {}).length === 0;
}

/**
 * Persist progress as the user advances. Debounced, deduped by snapshot, and
 * a no-op until the session exists.
 */
export function watchSessionProgress(store: KycStore): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSaved = '';

  const unsubscribe = store.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const s = store.getState();
      if (!s.sessionId) return;
      const payload = progressFromState(s);
      if (isUntouchedProgress(payload)) return;
      const fingerprint = JSON.stringify(payload);
      if (fingerprint === lastSaved) return;
      lastSaved = fingerprint;
      void s.api.saveProgress(s.sessionId, payload).catch(() => undefined);
    }, SAVE_DEBOUNCE_MS);
  });

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}
