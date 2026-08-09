import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { buildStepOrder } from '../config/stepOrder';
import { stepOrderOptions } from '../store/kycStore';
import { KYCError } from '../types/verification';
import { safeReportError } from '../services/errors';
import type { KYCStep, SupportedCountry } from '../types/config';
import { useEffectiveCountry, useKyc, useKycConfig, useKycStore, useTheme } from './runtime';
import { COUNTRY_SEARCH_THRESHOLD } from '../screens/CountrySelectStep';
import { KycSheet } from './KycSheet';
import { FatalConfigError } from './flow/FatalConfigError';
import { ToastProvider } from './toast';
import { MyazaText } from './Typography';
import { MyazaButton } from './MyazaButton';
import { Icon } from './Icon';
import { StepView } from './StepView';
import { stepHeaderMeta } from './stepHeaderMeta';
import { countrySelectOptions } from '../store/derive';

// The step router — 1:1 with the Flutter SDK's _KycFlowWidget. Computes per-step
// header title/description, the 4-step indicator info, back/country, fetches the
// server config on mount, and gates the flow on fatal auth failures.

/**
 * Result of a back request handled inside the flow:
 *   'navigated' — went back a step; the caller should NOT close.
 *   'blocked'   — nowhere to go back AND close is disabled; swallow it.
 *   'close'     — at the first step with close allowed; the caller should close.
 */
export type BackResult = 'navigated' | 'blocked' | 'close';

export function KycFlow({
  onClose,
  backRef,
}: {
  onClose: () => void;
  /** Populated with the flow's back-aware handler so the Modal's onRequestClose
   *  (Android hardware back) can navigate a step instead of dismissing. */
  backRef?: React.MutableRefObject<(() => BackResult) | null>;
}): React.ReactElement {
  const { colors } = useTheme();
  const config = useKycConfig();
  const country = useEffectiveCountry();
  const store = useKycStore();
  const currentStep = useKyc((s) => s.currentStep);
  const selectedIdType = useKyc((s) => s.selectedIdType);
  const documentCapturePhase = useKyc((s) => s.documentCapturePhase);
  const contactChallenge = useKyc((s) => s.contactChallenge);
  const serverConfig = useKyc((s) => s.serverConfig);
  const immersiveCapture = useKyc((s) => s.immersiveCapture);

  const startedRef = useRef(false);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      config.onStart?.();
      // A resolved workflow already delivered the allowlist + branding, so
      // there is nothing to fetch.
      if (store.getState().serverConfig.status !== 'ready') {
        void store.getState().loadServerConfig();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFatal = serverConfig.status === 'error' && serverConfig.fatal;
  useEffect(() => {
    if (isFatal && !reportedRef.current) {
      reportedRef.current = true;
      const code = serverConfig.statusCode === 401 ? 'invalid_api_key' : 'feature_disabled';
      safeReportError(config.onError, new KYCError(code, serverConfig.message ?? 'Unable to start verification.'));
    }
  }, [isFatal, serverConfig.statusCode, serverConfig.message, config.onError]);

  // ── Per-step header meta ──────────────────────────────────────────────────
  const meta = useMemo(
    () =>
      stepHeaderMeta(currentStep, {
        config,
        country,
        selectedIdType,
        documentCapturePhase,
        contactChallenge,
      }),
    [currentStep, config, country, selectedIdType, documentCapturePhase, contactChallenge],
  );

  // ── Step indicator info ───────────────────────────────────────────────────
  // Read from the SAME ordered list navigation uses, so the dots can never
  // describe a different flow than the one the user is walking. This used to be
  // its own hand-written copy of the sequence, which meant a step added to the
  // flow silently didn't count towards progress.
  //
  // 'submitted' is excluded on purpose — it is the terminal screen, not a step
  // to make progress towards, and the indicator is hidden there.
  //
  // The derivation is memoised rather than done inside the selector: zustand
  // compares snapshots by identity, so a selector that mints a fresh object on
  // every call re-renders forever.
  const state = useKyc((s) => s);
  const stepInfo = useMemo(() => {
    if (state.currentStep === 'submitted') return null;
    const steps = buildStepOrder(stepOrderOptions(state)).filter((s) => s !== 'submitted');
    const idx = steps.indexOf(state.currentStep);
    if (idx < 0) return null;
    return { progress: (idx + 1) / steps.length, stepCount: steps.length };
  }, [state]);

  // The flag beside the title names the country whose IDs are on screen.
  const headerCountry =
    currentStep === 'id-type' || currentStep === 'id-input' ? country : null;
  const onBack = currentStep === 'consent' || currentStep === 'submitted' ? null : () => store.getState().previousStep();

  // Android hardware back arrives via the <Modal>'s onRequestClose. Expose a
  // back-aware handler through `backRef` so that handler navigates a step back
  // when the flow can, instead of dismissing the whole SDK. It only reports
  // 'close' from the first step (consent) with close allowed; with
  // `disableClose` set it reports 'blocked' so back can never force the flow
  // closed. (iOS has no hardware back; its swipe-down keeps the standard
  // dismiss behaviour, handled by the Modal.)
  const canGoBack = !isFatal && onBack != null;
  const disableClose = config.disableClose === true;
  useEffect(() => {
    if (!backRef) return undefined;
    backRef.current = (): BackResult => {
      if (canGoBack) {
        store.getState().previousStep();
        return 'navigated';
      }
      return disableClose ? 'blocked' : 'close';
    };
    return () => {
      backRef.current = null;
    };
  }, [backRef, canGoBack, disableClose, store]);

  if (isFatal) {
    return <FatalConfigError message={serverConfig.message} onClose={onClose} />;
  }

  return (
    <ToastProvider>
      <KycSheet
        title={meta.title}
        description={meta.description}
        progress={stepInfo?.progress ?? null}
        stepCount={stepInfo?.stepCount ?? null}
        country={headerCountry}
        onBack={onBack}
        onClose={onClose}
        // The searchable country picker pins its search box above a list that
        // can run to ~240 rows. Only the multi-country variant needs it: a
        // short flat list is happier in the normal scroll body.
        fillsViewport={
          currentStep === 'country-select' &&
          countrySelectOptions({ config, serverConfig }).length > COUNTRY_SEARCH_THRESHOLD
        }
        // A live camera asks for the whole screen: the sheet's header, padding
        // and scroll view are exactly what force a small viewfinder on a short
        // phone, and a camera you have to scroll to is a broken camera.
        //
        // Passed as a PROP rather than rendered as its own tree. The earlier
        // shape early-returned a different element tree, which changed the
        // step's parent MID-STEP — React unmounted and remounted it, wiping the
        // acknowledged primer and bouncing straight back to it. Scoped to the
        // step as well as the flag so the next step cannot inherit it.
        immersive={immersiveCapture && currentStep === 'document-capture'}
      >
        <StepView step={currentStep} onClose={onClose} />
      </KycSheet>
    </ToastProvider>
  );
}
