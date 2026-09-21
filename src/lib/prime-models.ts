import { useEffect, useRef } from 'react';

import { primeFaceModel } from '../liveness/visionCameraFaceDetector';
import { primeLivenessAvatars } from '../liveness/avatarSource';
import { primeTextModel } from '../mrz/textRecognizer';

// ─── Warming the on-device work the flow is about to need ────────────────────
//
// Android fetches ML Kit's models through Play Services rather than bundling
// them, and the gesture animations are served rather than shipped. All three
// are wanted in front of a camera, which is the worst possible moment to start
// a download — so they start the moment the flow opens instead, overlapping
// the screens the user is already reading (consent, ID type, the document
// step). Mirrors the web SDK's primeFaceMesh().
//
// Best-effort throughout: every step still gates on its own readiness, so a
// failure here costs a head start and nothing else.
//
// SHARED BY BOTH ENTRY POINTS, and that is the whole point of the file. This
// effect used to live inside the <MyazaKYC/> trigger component, so a consumer
// using useMyazaKYC() — the hook the SDK's own example uses, and the one
// documented for programmatic control — primed NOTHING. The face model was
// first requested when the liveness step mounted, in front of a camera the
// user was already looking at, and the gesture GIFs were fetched at the same
// moment. On a device that had never downloaded the model (a fresh install,
// the common case for a real applicant) that is a ~8 MB wait with the camera
// already up. A warm device hides it completely, which is why it survived:
// isModelReady() answers true on the first call and every path looks correct.
//
// The text model is the exception that proves it — useAutoCapture primes it at
// the document step, so it kept a head start on both paths regardless.
export function usePrimeModels(
  wantOpen: boolean,
  apiKey: string,
  devUrl?: string,
): void {
  // Once per open sequence: priming is idempotent, but re-running it on every
  // render would ask Play Services the same question a few times a second.
  const primedRef = useRef(false);
  useEffect(() => {
    if (!wantOpen || primedRef.current) return;
    primedRef.current = true;
    primeFaceModel();
    // The larger of the two, and wanted EARLIER in the flow than the face one
    // (the document step comes before liveness), so it has the least time to
    // arrive and the most to gain from the head start.
    primeTextModel();
    primeLivenessAvatars(apiKey, devUrl);
  }, [wantOpen, apiKey, devUrl]);
}
