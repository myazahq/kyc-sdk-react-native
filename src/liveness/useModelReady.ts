import { useEffect, useRef, useState } from 'react';

import { isFaceModelReady, primeFaceModel } from './visionCameraFaceDetector';

// ─── Face-model readiness gate ────────────────────────────────────────────────
//
// Android fetches ML Kit's face model through Play Services rather than bundling
// it, which keeps ~8 MB per device out of the APK but leaves a window where
// detection cannot run: first launch before the download lands, or a device with
// no Google Play Services at all.
//
// This has to be answered BEFORE the camera opens. `detectFace` reports through
// `FaceResult`, where a missing model and an empty frame are both
// `faceCount: 0` — so gating on the per-frame result would strand the user on
// "position your face" indefinitely, with the SDK unable to say why. That is the
// single failure mode this whole gate exists to prevent.
//
// iOS is always ready (Apple Vision is a system framework), so this resolves on
// the first tick there and costs nothing.

export type ModelReadyState = 'ready' | 'preparing' | 'unavailable';

/** How long to wait for the model before calling it unavailable. */
const MODEL_WAIT_MS = 20_000;
/** Gap between readiness polls while the download is in flight. */
const POLL_INTERVAL_MS = 500;

/**
 * Tracks whether on-device face detection can run.
 *
 * Returns `'preparing'` while Play Services fetches the model, `'ready'` once it
 * can run, and `'unavailable'` when it could not be obtained within
 * {@link MODEL_WAIT_MS} — no Play Services, no network, or a declined install.
 *
 * The flow primes the download at open (see `MyazaKYC.tsx`), so by the time the
 * user reaches liveness this is normally already `'ready'` and no waiting screen
 * is ever shown.
 */
export function useFaceModelReady(): ModelReadyState {
  const [state, setState] = useState<ModelReadyState>(() =>
    isFaceModelReady() ? 'ready' : 'preparing',
  );
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (state !== 'preparing') return;

    // Re-prime rather than assume the open-time call ran: the step can be
    // reached directly in a resumed flow, and prepareModel() is a no-op once
    // the model is present.
    primeFaceModel();

    const id = setInterval(() => {
      if (isFaceModelReady()) {
        setState('ready');
      } else if (Date.now() - startedAt.current > MODEL_WAIT_MS) {
        setState('unavailable');
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [state]);

  return state;
}
