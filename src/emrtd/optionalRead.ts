import { readFile, type Transceive } from './files';
import type { SecureMessagingSession } from './secureMessaging';

// ---------------------------------------------------------------------------
// Best-effort file reads (EF.SOD, DG2).
//
// These files are optional by CONTRACT — the read stands without them — but
// they are not optional in VALUE: without the SOD the server cannot verify
// DG1 against the issuer, and without DG2 there is no portrait. A transient
// wobble a few chunks into a kilobyte transfer was costing both, silently:
// one bare `.catch(() => null)` threw away the file AND the reason.
//
// So an optional read gets a second in-session attempt (the file is
// re-selected from scratch, so a clean retry is protocol-safe — the
// send-sequence counter advances per exchange either way), and every failure
// is named in dev builds instead of vanishing.
// ---------------------------------------------------------------------------

/** In-session tries per optional file, including the first. */
const OPTIONAL_READ_TRIES = 2;

export async function readOptionalFile(
  sm: SecureMessagingSession,
  transceive: Transceive,
  fileId: number,
  name: string,
): Promise<Uint8Array | null> {
  for (let attempt = 1; attempt <= OPTIONAL_READ_TRIES; attempt += 1) {
    try {
      return await readFile(sm, transceive, fileId);
    } catch (err) {
      // A dead session fails the retry instantly, so trying again costs
      // nothing when it cannot help — and saves the file when the failure was
      // a single misread chunk.
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        const raw = err instanceof Error ? err.message : String(err ?? '');
        console.log(`[myaza] nfc ${name} read failed (try ${attempt}/${OPTIONAL_READ_TRIES}): ${raw}`);
      }
    }
  }
  return null;
}
