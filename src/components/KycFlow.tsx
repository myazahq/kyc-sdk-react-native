import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { ID_TYPES, requiresDocumentCapture } from '../config/idTypes';
import { KYCError } from '../types/verification';
import { safeReportError } from '../services/errors';
import type { KYCStep, SupportedCountry } from '../types/config';
import { useKyc, useKycConfig, useKycStore, useTheme } from './runtime';
import { KycSheet } from './KycSheet';
import { ToastProvider } from './toast';
import { MyazaText } from './Typography';
import { MyazaButton } from './MyazaButton';
import { Icon } from './Icon';
import { ConsentStep } from '../screens/ConsentStep';
import { IdTypeStep } from '../screens/IdTypeStep';
import { IdInputStep } from '../screens/IdInputStep';
import { DocumentCaptureStep, documentCaptureMeta } from '../screens/DocumentCaptureStep';
import { LivenessStep } from '../screens/LivenessStep';
import { SubmittedStep } from '../screens/SubmittedStep';

// The step router — 1:1 with the Flutter SDK's _KycFlowWidget. Computes per-step
// header title/description, the 4-step indicator info, back/country, fetches the
// server config on mount, and gates the flow on fatal auth failures.

function labelFor(country: SupportedCountry, idType: string | null): string {
  if (!idType) return 'Document';
  return Object.values(ID_TYPES).flat().find((t) => t.key === idType)?.label ?? 'Document';
}

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
  const store = useKycStore();
  const currentStep = useKyc((s) => s.currentStep);
  const selectedIdType = useKyc((s) => s.selectedIdType);
  const documentCapturePhase = useKyc((s) => s.documentCapturePhase);
  const serverConfig = useKyc((s) => s.serverConfig);

  const startedRef = useRef(false);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      config.onStart?.();
      void store.getState().loadServerConfig();
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
  const meta = useMemo(() => {
    const label = labelFor(config.country, selectedIdType);
    switch (currentStep) {
      case 'consent':
        return { title: '', description: null as string | null };
      case 'id-type':
        return { title: 'Select ID Type', description: "Choose the type of identification document you'd like to use." };
      case 'id-input':
        return { title: 'Enter Your Details', description: `Provide your ${label} for verification.` };
      case 'document-capture':
        // Phase-aware title/description live in the header (synced from the
        // capture screen via `documentCapturePhase`) — mirrors Flutter.
        return documentCaptureMeta(documentCapturePhase, label);
      case 'liveness':
        return { title: 'Face Verification', description: 'Follow the on-screen instructions' };
      case 'submitted':
      default:
        return { title: '', description: null };
    }
  }, [currentStep, config.country, selectedIdType, documentCapturePhase]);

  // ── Step indicator info (consent, id-type, capture|input, liveness?) ───────
  const stepInfo = useMemo(() => {
    if (currentStep === 'submitted') return null;
    const hasCapture =
      config.enableDocumentCapture && (selectedIdType ? requiresDocumentCapture(selectedIdType) : true);
    const hasLiveness = config.enableLiveness !== false && config.enableSelfie !== false;
    const steps: KYCStep[] = ['consent', 'id-type', hasCapture ? 'document-capture' : 'id-input'];
    if (hasLiveness) steps.push('liveness');
    const idx = steps.indexOf(currentStep);
    if (idx < 0) return null;
    return { progress: (idx + 1) / steps.length, stepCount: steps.length };
  }, [currentStep, config.enableDocumentCapture, config.enableLiveness, config.enableSelfie, selectedIdType]);

  const country = currentStep === 'id-type' || currentStep === 'id-input' ? config.country : null;
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
    return (
      <KycSheet title="" onClose={onClose} hideBrand>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: radius.full,
              backgroundColor: `${colors.error}1A`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="alert" size={40} color={colors.error} />
          </View>
          <View style={{ height: spacing.lg }} />
          <MyazaText variant="heading2" style={{ textAlign: 'center' }}>
            Unable to start verification
          </MyazaText>
          <View style={{ height: spacing.xs }} />
          <MyazaText variant="bodyMedium" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            {serverConfig.message ?? 'Please check your API key and try again.'}
          </MyazaText>
          <View style={{ height: spacing.lg }} />
          <View style={{ width: '100%' }}>
            <MyazaButton label="Close" onPress={onClose} />
          </View>
        </View>
      </KycSheet>
    );
  }

  return (
    <ToastProvider>
      <KycSheet
        title={meta.title}
        description={meta.description}
        progress={stepInfo?.progress ?? null}
        stepCount={stepInfo?.stepCount ?? null}
        country={country}
        onBack={onBack}
        onClose={onClose}
      >
        <StepView step={currentStep} onClose={onClose} />
      </KycSheet>
    </ToastProvider>
  );
}

function StepView({ step, onClose }: { step: KYCStep; onClose: () => void }): React.ReactElement {
  switch (step) {
    case 'consent':
      return <ConsentStep />;
    case 'id-type':
      return <IdTypeStep />;
    case 'id-input':
      return <IdInputStep />;
    case 'document-capture':
      return <DocumentCaptureStep />;
    case 'liveness':
      return <LivenessStep />;
    case 'submitted':
      return <SubmittedStep onClose={onClose} />;
    default:
      return <ConsentStep />;
  }
}
