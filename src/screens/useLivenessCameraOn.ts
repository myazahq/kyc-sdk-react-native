import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';

import { useKycStore } from '../components/runtime';
import { latchBrightScreen } from '../lib/bright-screen';

// ---------------------------------------------------------------------------
// Publishing "the liveness camera is on" to the store, for the sheet root
// (components/BrightScreen) to light the face from the screen.
//
// Split out of LivenessStep (200-line rule). LATCHED (lib/bright-screen's
// latchBrightScreen): off through the "I'm ready" and permission primers, on
// from the first render that shows the camera, and on until the step is left,
// so the review after the capture stays lit. Cleared on unmount, so leaving
// the step by any route (Back, Continue, an error, the flow closing) hands the
// theme and the brightness back; the sheet does the restoring.
// ---------------------------------------------------------------------------

export function useLivenessCameraOn(cameraOnScreen: boolean): void {
  const store = useKycStore();
  const setOn = useStore(store, (s) => s.setLivenessCameraOn);
  // Scoped to this mount: a fresh visit to the step starts unlatched.
  const latched = useRef(false);
  latched.current = latchBrightScreen(latched.current, cameraOnScreen);
  const on = latched.current;
  useEffect(() => {
    setOn(on);
  }, [on, setOn]);
  useEffect(() => () => setOn(false), [setOn]);
}
