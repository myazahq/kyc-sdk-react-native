import {
  chipRetryDelayMs,
  isRetryableChipError,
  isRetryableStartError,
  MAX_CHIP_ATTEMPTS,
} from '../emrtd/retry';
import { EmrtdSessionError } from '../emrtd/session';

// ---------------------------------------------------------------------------
// Which chip-read failures earn another session, and how long we wait first.
//
// A dropped session cannot be resumed: iOS tears it down, and the BAC-derived
// session keys and send-sequence counter die with it. So recovery is always a
// NEW session, and the only question is whether a second one could plausibly
// succeed where the first did not.
//
// The delay matters as much as the classification: a reopen that comes too
// fast on iOS is refused with an immediate Code=202 — which then rendered as
// "the connection to the chip dropped" for a blip that was fully recoverable.
// ---------------------------------------------------------------------------

const ios = (code: number) => new Error(`Error Domain=NFCError Code=${code} "..."`);

describe('chipRetryDelayMs', () => {
  it('waits out the iOS sheet dismissal before reopening', () => {
    // The system sheet takes well over a second to animate away; a session
    // begun inside that window is refused with an immediate Code=202.
    expect(chipRetryDelayMs('ios')).toBeGreaterThanOrEqual(2000);
  });

  it('only needs a reseat beat on Android', () => {
    expect(chipRetryDelayMs('android')).toBeLessThan(1000);
  });
});

describe('isRetryableChipError', () => {
  it('retries a session that terminated on its own', () => {
    // 202 — overwhelmingly the document shifting out of range. Nothing is wrong
    // with the document or the user, so trying again is the right move.
    expect(isRetryableChipError(ios(202))).toBe(true);
  });

  it('retries a timeout and a busy radio', () => {
    expect(isRetryableChipError(ios(201))).toBe(true);
    expect(isRetryableChipError(ios(203))).toBe(true);
  });

  it('retries the transceive-level drop codes', () => {
    // How a physical drop surfaces while a command is IN FLIGHT — during
    // SELECT/BAC these arrive raw, before anything wraps them in an
    // EmrtdSessionError.
    for (const code of [100, 101, 102, 103, 104]) {
      expect(isRetryableChipError(ios(code))).toBe(true);
    }
    // 105 (packet too long) is a protocol bug a new session reproduces.
    expect(isRetryableChipError(ios(105))).toBe(false);
  });

  it("retries Android's TagLostException", () => {
    expect(isRetryableChipError(new Error('android.nfc.TagLostException: Tag was lost.'))).toBe(
      true,
    );
  });

  it('does NOT retry when the user cancelled', () => {
    // They meant it. Reopening the sheet fights the user.
    expect(isRetryableChipError(ios(200))).toBe(false);
  });

  it('does NOT retry a BAC failure', () => {
    // The MRZ is check-digit validated before being used as a key, so this is
    // not a misread — the chip belongs to a different document. A second
    // attempt fails identically and wastes the user's time twice.
    expect(isRetryableChipError(new EmrtdSessionError('bac', 'bac_failed'))).toBe(false);
  });

  it('does NOT retry a chip that could not be selected', () => {
    // Not an electronic document; another session changes nothing.
    expect(isRetryableChipError(new EmrtdSessionError('sel', 'select_failed'))).toBe(false);
  });

  it('retries a chip that stopped answering mid-read', () => {
    // The physical case again — the document moved during a long file read.
    expect(isRetryableChipError(new EmrtdSessionError('lost', 'read_failed'))).toBe(true);
    expect(isRetryableChipError(new EmrtdSessionError('t', 'transport'))).toBe(true);
  });

  it('does not retry the unrecognised', () => {
    expect(isRetryableChipError(new Error('something odd'))).toBe(false);
    expect(isRetryableChipError(null)).toBe(false);
  });

  it('bounds the attempts', () => {
    // Unbounded retries would reopen the system sheet forever on a document
    // that is never going to read.
    expect(MAX_CHIP_ATTEMPTS).toBeGreaterThan(1);
    expect(MAX_CHIP_ATTEMPTS).toBeLessThanOrEqual(4);
  });
});

describe('isRetryableStartError', () => {
  it('retries a session refused while the previous sheet dismisses', () => {
    expect(isRetryableStartError(ios(202))).toBe(true);
    expect(isRetryableStartError(ios(203))).toBe(true);
  });

  it('respects the user: no reopening after a cancel or a full timeout', () => {
    expect(isRetryableStartError(ios(200))).toBe(false);
    expect(isRetryableStartError(ios(201))).toBe(false);
  });

  it('does not retry the unrecognised', () => {
    expect(isRetryableStartError(new Error('No foreground activity'))).toBe(false);
  });
});
