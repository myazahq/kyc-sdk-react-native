import React, { useEffect, useRef } from 'react';

import { useKycConfig } from '../../components/runtime';
import { configScope } from '../../lib/scope';
import { describeWaiting } from '../../lib/result-copy';
import { waitsForResult } from '../../config/biometricOptions';
import { biometricCopyFor } from '../../lib/biometric-copy';
import { SubmittedWaiting } from '../SubmittedWaiting';

// ─── Handing over without the review ────────────────────────────────────────
//
// On the biometric scopes the selfie review (Retake / Continue) is OFF by
// default (config/biometricOptions.ts): a re-authentication is a few-second
// check and a review screen is a stop in the middle of it. The step hands
// over the moment the ring has closed, WITHOUT waiting for the upload: the
// upload keeps running and reports to the store, and the submitted step waits
// on that record (lib/selfie-upload-wait.ts). So the person sees one loading
// screen from the shutter to the verdict, not one per step. The view below
// exists for the single render between "ready" and the step change, and it
// is the same screen the submitted step shows, so nothing visibly changes.
// An upload that fails BEFORE the ring closes still gets the review, whose
// Try Again is the recovery.

/** Advance exactly once, the first render on which `ready` holds. */
export function useSelfieAutoAdvance(opts: { enabled: boolean; ready: boolean; onAdvance: () => void }): void {
  const advanced = useRef(false);
  const { enabled, ready, onAdvance } = opts;
  useEffect(() => {
    if (!enabled || !ready || advanced.current) return;
    advanced.current = true;
    onAdvance();
  }, [enabled, ready, onAdvance]);
}

export function LivenessHandover(): React.ReactElement {
  const config = useKycConfig();
  const copy = describeWaiting({
    scope: configScope(config),
    waitsForResult: waitsForResult(config),
    override: biometricCopyFor(config).waiting,
  });
  return <SubmittedWaiting title={copy.title} description={copy.description} />;
}
