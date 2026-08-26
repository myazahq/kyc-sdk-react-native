// Session step log — records each SDK step the user reaches, with a
// timestamp, so the server can reconstruct the journey on the verification
// timeline ("consent opened → ID type chosen → document captured → …").
// Rides the verify submission as metadata.device.stepLog — the same free-form
// channel the Device Intelligence fingerprint uses: no extra network calls,
// no new endpoint, and old SDKs simply never send it. `sentAt` is stamped at
// collect time so the server can correct client-clock skew against its own
// receipt time. Step names only — never PII. Mirrors the web SDK's
// lib/step-log.ts; keep the two in lockstep.

export interface StepLogEntry {
  step: string;
  at: string;
  /**
   * Which multi-ID check the applicant was on (1-based). Absent on ordinary
   * runs and on the first check.
   *
   * The SERVER cannot tell a slot advance from a back-press: a multi-ID run
   * legitimately returns to the ID picker for its next ID, and by step name
   * that is identical to pressing Back. Only the client knows a slot was
   * committed, so only the client can say.
   */
  slot?: number;
  /** The ID type selected AT THAT MOMENT — a slot's final pick is not what the
   *  applicant was doing earlier in it (pick one ID, go back, settle on
   *  another, and the earlier step would be named for an ID not yet chosen). */
  idType?: string;
}

export interface StepLog {
  steps: StepLogEntry[];
  sentAt: string;
}

const MAX_ENTRIES = 40;

let entries: StepLogEntry[] = [];

/** Fresh slate per session (called from the store's reset — each modal open). */
export function resetStepLog(): void {
  entries = [];
}

/** Records a step visit. Consecutive duplicates are collapsed; back-and-forth
 *  navigation is kept — repeat visits are honest journey data. */
export function recordStep(step: string, slot?: number, idType?: string): void {
  if (entries.length >= MAX_ENTRIES) return;
  const last = entries[entries.length - 1];
  // A revisit on a NEW check, or on a DIFFERENT ID, is a different visit.
  if (last?.step === step && last.slot === slot && last.idType === idType) return;
  entries.push({
    step,
    at: new Date().toISOString(),
    ...(slot ? { slot } : {}),
    ...(idType ? { idType } : {}),
  });
}

/** Snapshot attached to the verify submission. Null when nothing was recorded
 *  so the field is simply absent. */
export function getStepLog(): StepLog | null {
  if (entries.length === 0) return null;
  return { steps: [...entries], sentAt: new Date().toISOString() };
}
