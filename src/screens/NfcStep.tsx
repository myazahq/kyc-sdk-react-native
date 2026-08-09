import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MyazaPulseLoader } from '../components/MyazaPulseLoader';
import { Icon } from '../components/Icon';
import { cancelChipRead, nfcUnavailableReason, readPassportChip, type EmrtdReadResult } from '../emrtd';
import { useNfcAvailability } from './nfc/useNfcAvailability';
import { readErrorMessage } from './nfc/readErrorMessage';
import { successHaptic } from '../services/haptics';
import { NfcSuccessPanel } from './nfc/NfcSuccessPanel';
import { NfcMrzPrompt } from './nfc/NfcMrzPrompt';
import { NfcReadBody } from './nfc/NfcReadBody';
import type { NfcReadStage } from '../emrtd';
import type { MrzScan } from '../mrz/parse';

// ---------------------------------------------------------------------------
// Reading the passport's chip.
//
// The chip holds the same biodata as the printed page, but SIGNED by the
// issuing government — which is what makes it worth reading. The MRZ scanned
// from the photo page is the key that unlocks it: possession of the document is
// the access control.
//
// Everything here is BEST-EFFORT. A phone without NFC, a chip that will not
// read, a user who gives up — all of them continue the flow. Absence of a chip
// read is not evidence of anything; the document checks that already ran still
// stand, and the server treats a missing chip as a missing signal rather than a
// failure. The ONE exception lives on the server: a chip that positively fails
// its cryptographic checks fails the verification, because that is proof of
// tampering rather than absence of proof.
// ---------------------------------------------------------------------------

export const nfcMeta = {
  title: 'Scan Document Chip',
  description: 'Hold your document to the back of your phone.',
};

type Phase = 'idle' | 'reading' | 'done' | 'failed';

// Attempt-first skip: the escape hatch is EARNED, never ambient. It appears
// after the first failed read — or after this long on the step, which covers
// the reads that never fail but never end either (Android reader mode sits
// listening for a tag the user can't position) and an MRZ hunt that won't lock
// on. Showing it on arrival invites "don't feel like it" exits from users
// whose chip would have read fine; hiding it forever traps the ones whose chip
// never will. Once revealed it stays.
const SKIP_REVEAL_MS = 15_000;

export function NfcStep(): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const { colors } = useTheme();
  const mrz = useKyc((s) => s.mrzScan);

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  // Dev builds also show WHERE the read died and the raw platform error — the
  // friendly message deliberately hides both, which made field reports
  // ("the connection dropped") impossible to tell apart: a session that never
  // opened, a BAC refusal at first contact, and a mid-transfer drop all
  // rendered identically.
  const [result, setResult] = useState<EmrtdReadResult | null>(null);
  const [stage, setStage] = useState<NfcReadStage>('waiting');
  const stageRef = useRef<NfcReadStage>('waiting');
  const liveRef = useRef(true);
  // Tracked separately from `phase` because the cleanup below runs after the
  // last render and would otherwise close over a stale value.
  const readingRef = useRef(false);
  useEffect(() => () => {
    liveRef.current = false;
    // Leaving this step must close the session UNCONDITIONALLY. Opening one
    // BLOCKS until a document is presented — up to a minute on Android — so a
    // user who backs out during that wait would otherwise strand reader mode
    // on an activity the flow has left, and hold iOS's system sheet over the
    // next screen. It used to be gated on `readingRef`, which is cleared in
    // the read's `finally` — so after a FAILED read, leaving performed no
    // cleanup at all and reader mode outlived the screen for the rest of the
    // process. cancelChipRead is idempotent; calling it with nothing open is
    // free.
    void cancelChipRead();
  }, []);

  // Settled, not sampled: a false on the first render can just mean the native
  // module has not landed yet, and acting on it deletes this step entirely.
  const availability = useNfcAvailability();
  const advance = useCallback(() => store.getState().nextStep(), [store]);

  // Attempt-first skip reveal (see SKIP_REVEAL_MS above). A failed read also
  // reveals it immediately, in the read's catch.
  const allowSkip = config.nfc?.allowSkip === true;
  const [skipRevealed, setSkipRevealed] = useState(false);
  useEffect(() => {
    if (!allowSkip || skipRevealed) return;
    const timer = setTimeout(() => setSkipRevealed(true), SKIP_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [allowSkip, skipRevealed]);

  useEffect(() => {
    // NOTHING auto-skips this step any more.
    //
    // `readingAvailable` was the gate, and it has been wrong every time we could
    // check it against reality — reporting unsupported on a phone that had read
    // chips minutes earlier, across app restarts, a foreground transition and a
    // reinstall. Two plausible causes (the Nitro registry not yet populated,
    // then iOS answering mid-foreground-transition) each explained one
    // occurrence and not the next, so the real one is still unidentified.
    //
    // Gating on a signal we cannot trust is worse than not gating at all, and
    // the costs are wildly asymmetric: a wrong skip silently removes a
    // verification factor and tells nobody, while a wrong render costs one tap
    // on a device with no NFC — where the user still has the skip affordance and
    // the back button.
    //
    // So the step renders regardless and the READ decides. If NFC genuinely is
    // unavailable, iOS says so when the session opens: an honest answer, and a
    // far better diagnostic than a screen that never appeared.
    if (__DEV__ && availability === 'unsupported') {
      console.log('[myaza] NFC reported unavailable, showing the step anyway:', nfcUnavailableReason() ?? 'unknown');
    }
  }, [availability]);

  // A read that has been superseded (a newer read started, or the step was
  // left) still settles eventually — the retry loop sleeps between attempts —
  // and its late rejection must not clobber the state of whatever replaced it.
  const readSeqRef = useRef(0);
  const read = useCallback(async () => {
    if (!mrz) return;
    const seq = ++readSeqRef.current;
    setPhase('reading');
    setError(null);
    setStage('waiting');
    stageRef.current = 'waiting';
    readingRef.current = true;
    try {
      const result = await readPassportChip(
        {
          documentNumber: mrz.documentNumber,
          dateOfBirth: toMrzDate(mrz.dateOfBirth),
          dateOfExpiry: toMrzDate(mrz.dateOfExpiry),
        },
        {
          onStage: (s) => {
            if (!liveRef.current || seq !== readSeqRef.current) return;
            stageRef.current = s;
            setStage(s);
          },
        },
      );
      if (!liveRef.current || seq !== readSeqRef.current) return;
      store.getState().setChipData(result);
      setResult(result);
      setPhase('done');
      // A chip read has no shutter, no sound, nothing physical — the haptic is
      // what makes it land as a completed action. Fire-and-forget: hardware
      // without one simply does nothing.
      successHaptic();
    } catch (err) {
      if (!liveRef.current || seq !== readSeqRef.current) return;
      setPhase('failed');
      // A real attempt just failed — the skip is earned now, no need to make
      // the user wait out the reveal timer on top of a failure.
      setSkipRevealed(true);
      // Never the platform's own string — see readErrorMessage. The stage
      // disambiguates a reader that never started from a chip that dropped.
      setError(readErrorMessage(err, stageRef.current));
      // Console ONLY — a stack trace on a KYC screen reads as a crash to the
      // person holding the passport, and dev builds are exactly where real
      // documents get tested. The friendly message above is the UI.
      if (__DEV__) {
        const raw = err instanceof Error ? err.message : String(err ?? '');
        console.warn(`[kyc.nfc] read died at '${stageRef.current}' — ${raw}`);
      }
    } finally {
      if (seq === readSeqRef.current) readingRef.current = false;
    }
  }, [mrz, store, advance]);

  // Start the read as soon as the step opens.
  //
  // The MRZ was already lifted off the photo page during document capture, so
  // everything needed to unlock the chip is in hand — asking the user to press
  // a button first adds a step that answers no question. Flutter goes straight
  // to the read for the same reason, and a user who has just been told to hold
  // the document to the phone expects it to be listening.
  //
  // Once per arrival: `startedRef` is cleared only when the step is left, so a
  // failure shows its own Try again rather than being restarted underneath the
  // user.
  const startedRef = useRef(false);
  useEffect(() => {
    // Attempt the read on any settled verdict, not only a positive one — the
    // availability check is no longer trusted to veto (see above). `checking`
    // still waits, so a session is never opened before the module has resolved.
    if (availability === 'checking' || !mrz) return;
    if (startedRef.current) return;
    startedRef.current = true;
    void read();
  }, [availability, mrz, read]);

  // The success panel lives in its own file (200-line rule) — it is the only
  // part of this step with real layout.
  if (phase === 'done' && result) {
    return (
      <NfcSuccessPanel
        result={result}
        mrz={mrz}
        onContinue={advance}
        onRescan={() => {
          // Straight back into a read — there is no idle "Scan chip" button any
          // more (the step reads on arrival, like Flutter), so parking on idle
          // would dead-end.
          setResult(null);
          void read();
        }}
      />
    );
  }


  // The live MRZ scan lives in its own file (200-line rule).
  if (!mrz) {
    return (
      <NfcMrzPrompt
        onScanned={(scan) => store.getState().setMrzScan(scan)}
        onSkip={allowSkip && skipRevealed ? advance : null}
      />
    );
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <NfcReadBody reading={phase === 'reading'} stage={stage} scan={mrz} />

      {error ? (
        <>
          <View style={{ height: spacing.md }} />
          <MyazaText variant="bodySmall" color={colors.error} style={{ textAlign: 'center' }}>
            {error}
          </MyazaText>
        </>
      ) : null}

      <View style={{ height: spacing.lg }} />
      <View style={{ alignSelf: 'stretch' }}>
        {/* No "Scan chip" button: the read starts on arrival (like Flutter),
            so a button naming an action already underway only invites a tap
            that restarts it. The retry appears only once there is something to
            retry. */}
        {phase === 'failed' ? (
          <MyazaButton label="Try scanning the chip again" onPress={() => void read()} />
        ) : null}
        {/* Attempt-first: hidden until a failed read (or the reveal timer)
            earns it — see SKIP_REVEAL_MS. Opt-IN, matching Flutter
            (`allowSkip: json['allowSkip'] ?? false`): an absent flag shows no
            skip, because that is what the server sends unless an org turns it
            on. Once revealed it stays tappable even mid-read while the reader
            is still WAITING for a tag — that wait can be endless on Android,
            and leaving cancels the session (the unmount cleanup) — but not
            once a chip is actually transferring, where a tap would rip up a
            read that is about to succeed. */}
        {allowSkip && skipRevealed ? (
          <>
            {phase === 'failed' ? <View style={{ height: spacing.sm }} /> : null}
            <MyazaButton
              label="Continue without the chip"
              variant="ghost"
              disabled={phase === 'reading' && stage !== 'waiting'}
              onPress={advance}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

/**
 * ISO date (YYYY-MM-DD) → the MRZ's YYMMDD.
 *
 * The BAC key is computed over the MRZ form, so this has to be the two-digit
 * year the document actually prints — not the four-digit one the rest of the
 * SDK passes around.
 */
function toMrzDate(iso: string): string {
  return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
}
