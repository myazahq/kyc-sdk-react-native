import { EmrtdSessionError } from '../../emrtd/session';

// ---------------------------------------------------------------------------
// What to tell the user when a chip read fails.
//
// NEVER the platform's own string. iOS produces things like
//   Error Domain=NFCError Code=202 "Session invalidated unexpectedly"
// which was being rendered verbatim on the screen: it tells the user nothing
// they can act on, and reads as a crash rather than a retryable hiccup.
//
// Each message names the thing the user can actually change — where the phone
// is, which document was scanned, whether to try again. Mirrors the Flutter
// SDK's `_messageFor`.
// ---------------------------------------------------------------------------

/** Raw platform error shapes worth distinguishing, matched in the string. */
const RAW_PATTERNS: Array<[RegExp, string]> = [
  // 200 — the user dismissed the system sheet. Not a failure worth apologising
  // for; just offer the read again.
  [/Code=200\b/, 'Chip reading was cancelled. You can try again.'],
  // 201 — the sheet timed out waiting for a document.
  [
    /Code=201\b/,
    'No chip was found in time. Hold the top edge of your document flat against the back of your phone and try again.',
  ],
  // 202 — the session ended on its own. Almost always the document shifting out
  // of range mid-read, which is exactly what the user should adjust.
  [
    /Code=202\b/,
    'The connection to the chip dropped. Hold the document still against the back of your phone and try again.',
  ],
  // 203 — the NFC radio is busy elsewhere (Apple Pay, another reader).
  [/Code=203\b/, 'The NFC reader is busy. Wait a moment and try again.'],
  // 100–104 — the transceive-level family: how a physical drop surfaces while a
  // command is in flight (tag lost / retry exceeded / response error / session
  // invalidated / not connected). Same user remedy as 202: keep it still.
  [
    /Code=10[0-4]\b/,
    'The connection to the chip dropped. Hold the document still against the back of your phone and try again.',
  ],
  // Android's IsoDep raises TagLostException("Tag was lost.") for the same
  // physical case.
  [
    /tag was lost/i,
    'The connection to the chip dropped. Hold the document still against the back of your phone and try again.',
  ],
  // Android's own detection timeout (see HybridMyazaEmrtd.kt) — the reader
  // waited and no document ever arrived.
  [
    /no chip was detected/i,
    'No chip was found in time. Hold the top edge of your document flat against the back of your phone and try again.',
  ],
];

/**
 * A human sentence for a failed chip read.
 *
 * `stageAtFailure` (when the caller tracked it) disambiguates the one code
 * that means two different things: a 202 AFTER chip contact is the document
 * shifting out of range, but a 202 while still `'waiting'` — before any chip
 * was ever detected — means the READER itself failed to start (a wedged NFC
 * daemon, or a build signed without the NFC entitlement). Telling that user
 * to hold the document still sends them chasing a positioning problem that
 * does not exist; a phone restart is what actually clears a wedged reader.
 */
export function readErrorMessage(err: unknown, stageAtFailure?: string): string {
  if (stageAtFailure === 'waiting') {
    const raw = err instanceof Error ? err.message : String(err ?? '');
    if (/Code=202\b/.test(raw)) {
      return "The NFC reader couldn't start. Restart your phone and try again.";
    }
  }
  if (err instanceof EmrtdSessionError) {
    switch (err.code) {
      case 'bac_failed':
        // The MRZ is check-digit validated, so this is not a typo — the chip
        // belongs to a different document than the page that was scanned.
        return "Couldn't unlock the chip with this document's details. Make sure you scanned the photo page of the same document.";
      case 'select_failed':
        return "This document's chip could not be opened. It may not be an electronic document.";
      case 'read_failed':
        return 'The chip moved out of range. Hold the document still against the back of your phone.';
      default:
        break;
    }
  }

  const raw = err instanceof Error ? err.message : String(err ?? '');
  for (const [pattern, message] of RAW_PATTERNS) {
    if (pattern.test(raw)) return message;
  }
  return "Couldn't read the chip. Please try again.";
}
