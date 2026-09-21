import { useEffect, useRef, useState } from 'react';

// ─── The on-device model readiness gate ───────────────────────────────────────
//
// Android fetches ML Kit's models through Play Services rather than bundling
// them, which keeps ~18.5 MB per device out of the APK but leaves a window
// where a detector cannot run: first launch before the download lands, or a
// device with no Google Play Services at all.
//
// This has to be answered BEFORE the camera opens, and neither detector can
// answer it itself. The face detector reports through `FaceResult`, where a
// missing model and an empty frame are both `faceCount: 0`; the text recogniser
// reports through `TextResult`, where both are an empty `lines` array. Gating on
// the per-frame result would strand the user on "position your face", or aiming
// at a passport that never reads, with the SDK unable to say why. That single
// failure mode is the whole reason this gate exists.
//
// Shared by both because the rule and the reasoning are identical — a copy per
// detector would be two places for one decision to drift.
//
// iOS is always ready (Apple Vision is a system framework), so this resolves on
// the first tick there and costs nothing.

export type ModelReadyState = 'ready' | 'preparing' | 'unavailable';

/**
 * How long to wait for a model before calling it unavailable. Generous on
 * purpose: the text model is about 10 MB, the native side requests it as an
 * urgent install, and a slow connection is the common case. The cost is that a
 * phone with no Play Services at all waits the full minute before being told;
 * the bundled build (`myazaKycBundledMlKit`) is the answer for those fleets.
 */
const MODEL_WAIT_MS = 60_000;
/** Gap between readiness polls while the download is in flight. */
const POLL_INTERVAL_MS = 500;

/**
 * Tracks whether an on-device model can run.
 *
 * Returns `'preparing'` while Play Services fetches it, `'ready'` once it can
 * run, and `'unavailable'` when it could not be obtained within
 * {@link MODEL_WAIT_MS} — no Play Services, no network, or a declined install.
 *
 * The flow primes the download at open (see `MyazaKYC.tsx`), so by the time the
 * user reaches the step this is normally already `'ready'` and no waiting screen
 * is ever shown.
 *
 * @param isReady whether the model can run right now
 * @param prime starts the download; called again here because the step can be
 *   reached directly in a resumed flow, and priming is a no-op once ready
 */
export function useNativeModelReady(
  isReady: () => boolean,
  prime: () => void,
): ModelReadyState {
  const [state, setState] = useState<ModelReadyState>(() =>
    isReady() ? 'ready' : 'preparing',
  );
  const startedAt = useRef(Date.now());
  // Refs, not deps: a caller passing inline arrows would otherwise restart the
  // poll, and the wait clock with it, on every render.
  const fns = useRef({ isReady, prime });
  fns.current = { isReady, prime };

  useEffect(() => {
    if (state !== 'preparing') return;

    fns.current.prime();

    const id = setInterval(() => {
      if (fns.current.isReady()) {
        setState('ready');
      } else if (Date.now() - startedAt.current > MODEL_WAIT_MS) {
        setState('unavailable');
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [state]);

  return state;
}
