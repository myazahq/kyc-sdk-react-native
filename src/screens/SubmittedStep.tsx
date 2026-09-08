import React, { useCallback, useEffect, useRef, useState } from 'react';

import { mapToKycError, safeReportError } from '../services/errors';
import { contactStepFor, expiredContactChannels } from '../lib/contact-recovery';
import { KYCError, type KYCSubmission } from '../types/verification';
import { useKyc, useKycConfig, useKycStore } from '../components/runtime';
import { configScope } from '../lib/scope';
import { describeWaiting } from '../lib/result-copy';
import { biometricCopyFor } from '../lib/biometric-copy';
import { awaitSelfieUpload, IDLE_SELFIE_UPLOAD } from '../lib/selfie-upload-wait';
import { showsDoneButton, showsSelfieReview, waitsForResult } from '../config/biometricOptions';
import { SubmittedWaiting } from './SubmittedWaiting';
import { SubmittedResult } from './SubmittedResult';
import { SubmittedSuccess } from './SubmittedSuccess';
import { SubmittedError } from './SubmittedError';

// Terminal step — 1:1 with the Flutter SDK's SubmittedScreen. Calls submitAsync
// on mount and renders one of: the waiting screen, the success screen, the
// error screen, or (on a flow that waits for its verdict) the result screen,
// which owns the whole wait from the first render. The views live in their
// own files (200-line rule); this file is the orchestration only. The header
// title is empty for this step.

type Phase = 'submitting' | 'success' | 'error';

export function SubmittedStep({ onClose }: { onClose: () => void }): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const existingResult = useKyc((s) => s.submissionResult);

  const [phase, setPhase] = useState<Phase>('submitting');
  const [error, setError] = useState<KYCError | null>(null);
  const [retry, setRetry] = useState<{ attempt: number; total: number } | null>(null);
  const reportedRef = useRef(false);
  const kickedRef = useRef(false);

  const submit = useCallback(async () => {
    setPhase('submitting');
    setError(null);
    setRetry(null);
    // The biometric scopes hand over BEFORE the selfie upload lands (the
    // review is off, so nothing on the liveness step gated on it): wait for
    // the upload's own record here, under the same loading screen. A failed
    // upload was already reported to onError by the hook that ran it.
    if (!showsSelfieReview(config)) {
      const upload = await awaitSelfieUpload({
        read: () => ({ selfieUpload: store.getState().selfieUpload, selfieMediaId: store.getState().mediaIds.selfie }),
        subscribe: (listener) => store.subscribe(listener),
      });
      if (!upload.ok) {
        setError(new KYCError('upload_failed', upload.message));
        setPhase('error');
        return;
      }
    }
    try {
      const result = await store.getState().submitAsync((attempt, total) => setRetry({ attempt, total }));
      const submission: KYCSubmission = {
        verificationId: result.verificationId,
        status: 'processing',
        metadata: config.metadata ?? {},
        submittedAt: new Date().toISOString(),
      };
      config.onSubmit?.(submission);
      setPhase('success');
    } catch (err) {
      // A refusal over stale contact proofs is recoverable in-flow: clear the
      // dead tokens and walk back to the contact step, which routes straight
      // back here once re-verified (see lib/contact-recovery.ts).
      const expired = expiredContactChannels(err);
      if (expired.length > 0) {
        store.getState().clearContactProofs(expired);
        store.getState().goToStep(contactStepFor(expired[0]!));
        return;
      }
      const kycError = mapToKycError(err, 'verify');
      setError(kycError);
      if (!reportedRef.current) {
        reportedRef.current = true;
        safeReportError(config.onError, kycError);
      }
      setPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, config]);

  useEffect(() => {
    if (existingResult) {
      setPhase('success');
      return;
    }
    if (!kickedRef.current) {
      kickedRef.current = true;
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Try Again after a failed selfie upload re-enters the liveness step, whose
  // mount resumes the interrupted upload and hands straight back here. The
  // record is reset first so this step waits for the NEW attempt rather than
  // reading the old failure a second time.
  const retryUpload = () => {
    store.getState().setSelfieUpload(IDLE_SELFIE_UPLOAD);
    store.getState().goToStep('liveness');
  };

  if (phase === 'error' && error) {
    return (
      <SubmittedError
        error={error}
        onRetry={error.code === 'upload_failed' ? retryUpload : error.code === 'network_error' ? () => void submit() : null}
        onClose={onClose}
      />
    );
  }

  // A flow that waits for its verdict (a biometric re-authentication, by
  // default) renders the result screen from the FIRST render: it shows the
  // one loading screen through the upload, the submission and the poll, then
  // the verdict. onSubmit has already fired by the time the id lands: the
  // submission is a fact whichever screen follows it.
  if (waitsForResult(config)) {
    return (
      <SubmittedResult
        verificationId={phase === 'success' ? (existingResult?.verificationId ?? null) : null}
        retry={retry}
        showDone={showsDoneButton(config)}
        onClose={onClose}
      />
    );
  }

  if (phase === 'submitting') {
    const copy = describeWaiting({
      scope: configScope(config),
      waitsForResult: false,
      retry,
      override: biometricCopyFor(config).waiting,
    });
    return <SubmittedWaiting title={copy.title} description={copy.description} retrying={retry != null} />;
  }

  return <SubmittedSuccess showDone={showsDoneButton(config)} onClose={onClose} />;
}
