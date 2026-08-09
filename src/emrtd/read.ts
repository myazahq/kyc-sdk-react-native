import { Platform } from 'react-native';

import { nativeModule } from './native';
import { readChip, type EmrtdReadResult, EmrtdSessionError } from './session';
import {
  MAX_CHIP_ATTEMPTS,
  chipRetryDelayMs,
  isRetryableChipError,
  isRetryableStartError,
} from './retry';
import { nfcSheetMessage, type NfcReadStage } from './stages';
import type { MrzKeyFields } from './crypto';

// ---------------------------------------------------------------------------
// The read loop: open the session, run BAC with the MRZ key, read the files,
// close the session — and when the chip drops, do the whole thing again.
//
// A dropped session is retried by opening a NEW one, because that is the only
// recovery there is: iOS tears the session down and secure messaging dies with
// it — the BAC-derived keys and the send-sequence counter cannot outlive the
// session, so there is nothing to resume into.
//
// The session is ALWAYS closed, including on failure — a session left open
// holds iOS's NFC sheet on screen over a flow that has already moved on, and
// on Android keeps reader mode attached to a dead activity.
//
// Nothing here concludes that a chip is genuine. The files go to the server,
// which hashes DG1 against the signed security object and checks the document
// signer's signature. A client-side "authentic" flag would be a claim an
// attacker controls.
// ---------------------------------------------------------------------------

export interface ChipReadOptions {
  /** Shown in iOS's system NFC sheet. Android has none and ignores it. */
  alertMessage?: string;
  /** Shown when the read finishes, on iOS. */
  successMessage?: string;
  /** Read progress, so the UI can narrate an otherwise invisible operation. */
  onStage?: (stage: NfcReadStage) => void;
}

/**
 * Read generation. Each read claims a fresh value; `cancelChipRead` (and any
 * newer read) bumps it, and a loop that wakes from its between-attempt sleep
 * to find the world has moved on stops INSTEAD of reopening a session over
 * whatever screen the user is on now. Closing the current session alone cannot
 * do that — the loop's whole job is to open another one.
 */
let generation = 0;

/**
 * Abandon a read that is still in progress.
 *
 * Necessary because opening the session BLOCKS until a document is presented —
 * on Android for up to a minute. A user who leaves the step during that wait
 * cannot be rescued by `readPassportChip`'s own cleanup: that runs in the catch
 * around `readChip`, which is never reached while the session is still waiting
 * for a tap. Without this, reader mode stays attached to an activity the flow
 * has already left, and on iOS the system sheet sits over the next screen.
 *
 * Safe to call when nothing is running — closing an already-closed session is a
 * no-op, so callers do not have to track whether a read is live.
 */
export async function cancelChipRead(): Promise<void> {
  generation += 1;
  const native = nativeModule();
  if (!native) return;
  try {
    await native.stopSession('Cancelled');
  } catch {
    // Nothing to cancel, or the session had already gone. Either way there is
    // nothing left to clean up and nobody to report it to.
  }
}

export async function readPassportChip(
  mrz: MrzKeyFields,
  options: ChipReadOptions = {},
): Promise<EmrtdReadResult> {
  const native = nativeModule();
  if (!native) {
    throw new EmrtdSessionError('This build cannot read NFC chips.', 'transport');
  }

  const run = ++generation;
  const abandoned = (): boolean => generation !== run;
  const settle = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, chipRetryDelayMs(Platform.OS)));

  // The stage the read died at is the single most diagnostic fact a failure
  // carries — 'waiting' is a session/detection problem, 'authenticating' is
  // SELECT/BAC (first contact), the read stages are a mid-transfer drop — so
  // it is tracked here and logged with the RAW platform error per attempt.
  // The same wrapper narrates the iOS system sheet, which COVERS the app
  // during the read: without it the sheet sits on its opening line while
  // three files transfer, and the silence reads as a hang (Flutter updates
  // its sheet per stage; this is that, for RN).
  let lastStage: NfcReadStage = 'waiting';
  const onStage = (stage: NfcReadStage): void => {
    lastStage = stage;
    if (stage !== 'waiting' && stage !== 'done') {
      try {
        // Older installed builds predate this native method — narration is a
        // courtesy, never a reason to fail a read.
        void native.updateSessionMessage(nfcSheetMessage(stage)).catch(() => undefined);
      } catch {
        // Method absent on this build.
      }
    }
    options.onStage?.(stage);
  };

  // A read that got DG1 but not the SOD is usable yet WORTH RETRYING: without
  // the security object the server cannot verify the chip against the issuer,
  // and the portrait is never fetched. Bank the partial and spend remaining
  // attempts going for the complete read — settle for the partial only when
  // the budget is exhausted.
  let partial: EmrtdReadResult | null = null;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_CHIP_ATTEMPTS; attempt += 1) {
    try {
      // A completeness retry re-presents the sheet moments after it closed on
      // what looked like a finished read — without an explanation, the natural
      // move is to take the document away, which forfeits the retry.
      await native.startSession(
        partial
          ? 'Almost done — keep the document against your phone to finish'
          : options.alertMessage ?? 'Hold your phone near the passport',
      );
    } catch (err) {
      // Opening can be refused TRANSIENTLY: iOS reports an immediate
      // `Code=202` for a session begun while the previous sheet is still
      // dismissing — the very failure this loop exists to recover from, and
      // exactly what a reopen straight after a drop runs into. Those get the
      // settle-and-retry treatment like any other drop; a refusal another
      // attempt cannot change (cancelled sheet, no document presented, no
      // radio) is reported as-is.
      lastError = err;
      devLog(attempt, 'session-open', err);
      // startSession can fail AFTER arming the radio (Android enables reader
      // mode before discovery/connect can still throw), so the session must be
      // torn down on this path too — or reader mode outlives the attempt,
      // attached to the activity with a dead callback.
      await native.stopSession('').catch(() => undefined);
      if (attempt >= MAX_CHIP_ATTEMPTS || !isRetryableStartError(err)) throw err;
      await settle();
      if (abandoned()) throw cancelledError();
      continue;
    }

    try {
      onStage('waiting');
      const result = await readChip(native, mrz, onStage);
      if (!result.sod && attempt < MAX_CHIP_ATTEMPTS && !abandoned()) {
        partial = result;
        devLog(attempt, 'security-file', new Error('EF.SOD missing — retrying for a complete read'));
        await native.stopSession('').catch(() => undefined);
        onStage('waiting');
        await settle();
        if (abandoned()) throw cancelledError();
        continue;
      }
      await native.stopSession(options.successMessage ?? 'Passport read');
      return result;
    } catch (err) {
      lastError = err;
      devLog(attempt, lastStage, err);
      const willRetry = attempt < MAX_CHIP_ATTEMPTS && isRetryableChipError(err) && !abandoned();
      // Between attempts the sheet is dismissed QUIETLY — painting it with an
      // error the next attempt may erase reads as a crash mid-recovery. The
      // message is reserved for the terminal failure, where it is the user's
      // only feedback on iOS (the system sheet covers the app) — unless a
      // banked partial makes this a success after all.
      await native
        .stopSession(
          willRetry || partial
            ? ''
            : err instanceof EmrtdSessionError
              ? err.message
              : 'Could not read the chip',
        )
        .catch(() => undefined);

      if (!willRetry) {
        // A banked DG1-only read beats surfacing an error: the user already
        // saw their data come off the chip once this run.
        if (partial) return partial;
        throw err;
      }

      // Back to the start: the next attempt re-runs BAC from scratch, which is
      // what a new session requires. The pause lets iOS finish dismissing the
      // sheet and the user reseat the document.
      onStage('waiting');
      await settle();
      if (abandoned()) throw cancelledError();
    }
  }

  // The attempt budget ran out — a banked partial is still a read.
  if (partial) return partial;
  // Unreachable — the loop either returns or throws — but it keeps the function
  // honest about always producing a result.
  throw lastError ?? new EmrtdSessionError('Could not read the chip.', 'transport');
}

/** The read was abandoned mid-loop (step left, or a newer read superseded it). */
function cancelledError(): EmrtdSessionError {
  return new EmrtdSessionError('The chip read was cancelled.', 'transport');
}

/**
 * Per-attempt failure diagnostics, dev builds only.
 *
 * The friendly on-screen message deliberately hides the platform error, which
 * makes field debugging impossible without this line: the STAGE names where in
 * the protocol the read died, and the raw string names why.
 */
function devLog(attempt: number, stage: string, err: unknown): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const raw = err instanceof Error ? err.message : String(err ?? '');
  console.log(`[myaza] nfc attempt ${attempt} failed at '${stage}': ${raw}`);
}
