import { EmrtdSessionError } from './session';

// ---------------------------------------------------------------------------
// Which chip-read failures are worth another session.
//
// A dropped session is NOT recoverable in place. iOS tears the whole thing down
// (`NFCError 202`), so there is no session left to retry an APDU into — and
// secure messaging cannot survive it either, because the session keys and the
// send-sequence counter are established by BAC and die with it. The only
// recovery is a NEW session from the top, which is why this is a decision about
// restarting rather than about resending.
//
// Restarting is the right default because the usual cause is physical: the chip
// sits in the cover or centre spread of a booklet, and a few millimetres of
// movement breaks the link. The user has not done anything wrong and the
// document is fine — asking them to press a button to try what we could simply
// try again is friction for its own sake.
//
// What must NOT be retried is anything a second attempt cannot change:
//   • the user cancelling — they meant it, and reopening the sheet fights them;
//   • BAC failing — the MRZ is check-digit validated before it is used as a
//     key, so a mismatch means this chip belongs to a different document. A
//     retry produces the same failure and wastes the user's time twice.
// ---------------------------------------------------------------------------

/** Total session attempts, including the first. */
export const MAX_CHIP_ATTEMPTS = 3;

/**
 * Pause before reopening the session, per platform.
 *
 * iOS: the system sheet takes well over a second to animate away after
 * `invalidate()`, and a new `NFCTagReaderSession` begun while it is still
 * dismissing is refused with an immediate `Code=202 "Session invalidated
 * unexpectedly"` — the very error the retry exists to recover from. The
 * previous 700ms sat inside that window, so the recovery attempt died before
 * its sheet ever appeared and the user was shown the 202 message for a blip
 * that was entirely recoverable. The pause also gives them time to reseat the
 * document — the thing most likely to make the next attempt succeed.
 *
 * Android has no sheet to dismiss; it only needs the reseat beat.
 */
export function chipRetryDelayMs(os: string): number {
  return os === 'ios' ? 2200 : 700;
}

/**
 * iOS session-level `NFCReaderError` codes that justify another session.
 * 200 (user cancelled) is deliberately absent.
 */
const RETRYABLE_IOS_SESSION = /Code=(201|202|203)\b/;

/**
 * iOS transceive-level codes — how a physical drop surfaces while a command is
 * IN FLIGHT: 100 tag connection lost, 101 retry exceeded, 102 tag response
 * error, 103 session invalidated, 104 tag not connected. During SELECT and BAC
 * — the first seconds of contact, where most drops happen — these arrive RAW,
 * because nothing has wrapped them in an EmrtdSessionError yet. 105 (packet too
 * long) is deliberately absent: that is a protocol bug, and a new session
 * reproduces it exactly.
 */
const RETRYABLE_IOS_TRANSCEIVE = /Code=(10[0-4])\b/;

/** Android's IsoDep raises `TagLostException("Tag was lost.")` on a drop. */
const RETRYABLE_ANDROID = /tag was lost/i;

/** Whether a failed chip read is worth reopening the session for. */
export function isRetryableChipError(err: unknown): boolean {
  if (err instanceof EmrtdSessionError) {
    // A chip that stopped answering mid-read is the physical case: the document
    // moved. `bac_failed` and `select_failed` are about WHICH document this is,
    // and a new session cannot change that.
    return err.code === 'read_failed' || err.code === 'transport';
  }
  const raw = err instanceof Error ? err.message : String(err ?? '');
  return (
    RETRYABLE_IOS_SESSION.test(raw) ||
    RETRYABLE_IOS_TRANSCEIVE.test(raw) ||
    RETRYABLE_ANDROID.test(raw)
  );
}

/**
 * Whether a failure to OPEN a session is worth another try.
 *
 * Narrower than the mid-read set, because here the codes mean different
 * things: 202 is the radio refusing a session while the previous sheet is
 * still tearing down, and 203 is the radio busy elsewhere — both are states
 * that pass on their own. 201 means the user never presented a document in the
 * whole wait, and 200 that they dismissed the sheet; reopening it fights them.
 */
export function isRetryableStartError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  // Android: a drop between discovery and connect() surfaces here as
  // TagLostException. Without this arm every Android start failure was
  // terminal — the 3-attempt budget only ever applied to iOS.
  return /Code=(202|203)\b/.test(raw) || RETRYABLE_ANDROID.test(raw);
}
