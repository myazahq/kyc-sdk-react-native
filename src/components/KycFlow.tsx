import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { buildStepOrder } from '../config/stepOrder';
import { isAddressStep } from '../lib/address-flow';
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
  const addressIntroSeen = useKyc((s) => s.addressIntroSeen);

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

  // ── The flow's ordered steps ──────────────────────────────────────────────
  // ONE list, read by the step indicator AND by the address primer below, so
  // neither can describe a flow the user is not walking. This used to be a
  // hand-written copy of the sequence, which meant a step added to the flow
  // silently didn't count towards progress.
  //
  // The derivation is memoised rather than done inside the selector: zustand
  // compares snapshots by identity, so a selector that mints a fresh object on
  // every call re-renders forever.
  const state = useKyc((s) => s);
  const order = useMemo(() => buildStepOrder(stepOrderOptions(state)), [state]);

  // The presence primer replaces the FIRST address step's body and carries its
  // own title, so the header blanks while it is up. Matched against the order
  // rather than a second copy of "which step comes first".
  const addressIntroPending =
    config.addressCollection?.presence?.enabled === true &&
    !addressIntroSeen &&
    order.find(isAddressStep) === currentStep;

  const meta = useMemo(
    () =>
      stepHeaderMeta(currentStep, {
        config,
        country,
        selectedIdType,
        documentCapturePhase,
        contactChallenge,
        addressIntroPending,
        addressEntranceFraming: state.addressEntranceFraming,
        poaDocumentType: state.poaDocumentType,
      }),
    [
      currentStep,
      config,
      country,
      selectedIdType,
      documentCapturePhase,
      contactChallenge,
      addressIntroPending,
      state.addressEntranceFraming,
      state.poaDocumentType,
    ],
  );

  // ── Step indicator info ───────────────────────────────────────────────────
  // 'submitted' is excluded on purpose — it is the terminal screen, not a step
  // to make progress towards, and the indicator is hidden there.
  const stepInfo = useMemo(() => {
    if (currentStep === 'submitted') return null;
    const steps = order.filter((s) => s !== 'submitted');
    const idx = steps.indexOf(currentStep);
    if (idx < 0) return null;
    return { progress: (idx + 1) / steps.length, stepCount: steps.length };
  }, [currentStep, order]);

  // The flag beside the title names the country whose IDs are on screen. The
  // document steps ask for a country's document just as directly as the ID
  // ones do, so they carry the same flag rather than a second treatment.
  const headerCountry =
    currentStep === 'id-type' ||
    currentStep === 'id-input' ||
    currentStep === 'document-capture' ||
    currentStep === 'nfc'
      ? country
      : null;
  // Back is hidden on the flow's OPENING step (consent, or the first real step
  // when the workflow switched the consent screen off), not on consent by
  // name. A multi-ID run returns to the ID picker for its next check, where
  // Back means "redo the previous one", so a committed slot keeps it.
  const onOpeningStep = currentStep === order[0] && state.multiIdSlots.length === 0;
  const onBack = onOpeningStep || currentStep === 'submitted' ? null : () => store.getState().previousStep();

  // Android hardware back arrives via the <Modal>'s onRequestClose. Expose a
  // back-aware handler through `backRef` so that handler navigates a step back
  // when the flow can, instead of dismissing the whole SDK. It only reports
  // 'close' from the opening step with close allowed; with
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
        // The searchable country picker (>5 countries) pins its search box
        // above a ~240-row list; the address pin and entrance steps fill it
        // too, since a map or panorama owns every touch and their actions
        // ride StickyActions at the bottom of a BOUNDED body.
        fillsViewport={
          (currentStep === 'country-select' &&
            countrySelectOptions({ config, serverConfig }).length > COUNTRY_SEARCH_THRESHOLD) ||
          currentStep === 'address-collection' ||
          currentStep === 'address-entrance'
        }
        // A live camera asks for the whole screen (a camera you have to scroll
        // to is a broken camera). Passed as a PROP rather than rendered as its
        // own tree: an early-returned tree changed the step's parent MID-STEP,
        // so React remounted it and wiped the acknowledged primer. Scoped to
        // the step as well as the flag so the next step cannot inherit it.
        immersive={immersiveCapture && currentStep === 'document-capture'}
      >
        <StepView step={currentStep} onClose={onClose} />
      </KycSheet>
    </ToastProvider>
  );
}
