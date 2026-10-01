// ─── A cancelled session ─────────────────────────────────────────────────────
//
// An organisation (or Myaza support) can cancel a verification session midway,
// reversibly. While it is cancelled the server refuses to reopen or restart
// it: `409 { error: 'session_cancelled', message }` from /session/start,
// /session/:id/progress and /verify, and `status: 'cancelled'` from
// /status/:id. Retrying can never succeed until an admin uncancels it, so the
// SDK stops on a dedicated screen instead of offering Try again. Pure so every
// call site reads the refusal the same way.

export const SESSION_CANCELLED_CODE = 'session_cancelled';

/** Shown when the server sent no message of its own. UK English, no em dashes. */
export const DEFAULT_CANCELLED_MESSAGE =
  'This verification was cancelled. Contact the organisation that sent it if you think this is a mistake.';

/** The title of the cancelled screen. */
export const CANCELLED_TITLE = 'This verification was cancelled';

/**
 * The cancellation an API failure carries, or null when it is anything else.
 * Read off the server's own code (never the status alone: a 409 also means
 * other things, such as a session already submitted).
 */
export function cancelledRefusalOf(err: unknown): { message: string } | null {
  // Read structurally (a KYCApiError carries `code` and `body`), so this never
  // depends on which copy of the error class a caller holds.
  if (err === null || typeof err !== 'object') return null;
  const { code, body } = err as { code?: unknown; body?: { message?: unknown } | null };
  if (code !== SESSION_CANCELLED_CODE) return null;
  const sent = typeof body?.message === 'string' ? body.message.trim() : '';
  return { message: sent || DEFAULT_CANCELLED_MESSAGE };
}

/**
 * Should a failed /session/start stop the flow? Starting a session is
 * best-effort by contract (verifying never depends on one existing), so every
 * failure is swallowed and the flow carries on, EXCEPT a cancellation: the
 * server has said this attempt may not continue, and walking the applicant
 * through capture steps only to refuse them at submit would waste their time.
 */
export function shouldStopOnSessionStartFailure(err: unknown): boolean {
  return cancelledRefusalOf(err) !== null;
}

/** The status poll's terminal word for a cancelled session (add-only). */
export function isCancelledStatus(status: string): boolean {
  return status === 'cancelled';
}
