// ---------------------------------------------------------------------------
// Is NFC actually unavailable, or has the native module simply not appeared yet?
//
// These two look identical at the first render and mean opposite things. Nitro
// populates its registry asynchronously, so `isNfcAvailable()` can report false
// for a moment on a phone that reads chips perfectly well — observed on a real
// device where three consecutive reloads reported available and the fourth did
// not, with no code change between them.
//
// The consequence is out of proportion to the cause: the chip step SKIPS ITSELF
// when NFC is unavailable, so one unlucky sample deletes the whole NFC screen
// with nothing logged. That is how it first surfaced — reported as the screen
// simply not being there.
//
// Deliberately free of native imports so the rule is testable on its own.
// ---------------------------------------------------------------------------

/**
 * How long to keep asking before believing the answer is no.
 *
 * Two failures wear the same face and deserve different patience:
 *
 *   • `device_unsupported` — the native module answered, and the answer is that
 *     this phone cannot read chips. Final; no amount of waiting changes it.
 *   • `module_not_registered` — Nitro's registry has not produced the object
 *     yet. That is OUR race, not the device's, and it resolves in milliseconds
 *     once the registry lands.
 *
 * The window was 1200ms and the capability probe was still reporting false at
 * 1500ms on real launches — with the rectangle detector failing alongside it,
 * which has nothing to do with NFC hardware and so proves the registry, not the
 * phone, was the problem. Three seconds costs a one-off wait only on devices
 * that genuinely have no NFC, and buys back a step that was vanishing on
 * perfectly capable ones.
 */
export const SETTLE_MS = 3000;
/** Gap between samples. Short — the registry usually lands on the first retry. */
export const POLL_MS = 120;

export type NfcAvailability =
  /** Still resolving — render nothing yet. */
  | 'checking'
  /** The chip step can run. */
  | 'available'
  /** The native module answered: this device cannot read chips. Skip. */
  | 'unsupported'
  /**
   * The native module never registered. NOT the same as the device saying no —
   * this is our own wiring failing, and it must not delete a verification step.
   */
  | 'module_missing';

/**
 * Asymmetric on purpose: a positive answer is trusted immediately, a negative
 * one only after the window has elapsed.
 *
 * The two errors are not equally costly. Believing a false negative removes a
 * verification step entirely; believing a premature positive costs nothing,
 * because the read itself still has to succeed on its own merits.
 */
export function settleVerdict(
  present: boolean,
  elapsedMs: number,
  reason?: 'module_not_registered' | 'device_unsupported' | null,
): NfcAvailability {
  if (present) return 'available';
  if (elapsedMs < SETTLE_MS) return 'checking';
  // Whose failure is it? A device that says it cannot read chips is a fact to
  // act on. A module that never registered is OUR bug, and silently dropping
  // the chip read to hide it is the worst of the three options — the user is
  // told nothing and the verification quietly loses a factor.
  return reason === 'device_unsupported' ? 'unsupported' : 'module_missing';
}
