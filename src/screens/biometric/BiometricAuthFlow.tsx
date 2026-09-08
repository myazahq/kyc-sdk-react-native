import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { spacing } from '../../config/theme';
import { useKyc, useKycConfig, useKycStore, useTheme } from '../../components/runtime';
import { KycSheet } from '../../components/KycSheet';
import { ToastProvider } from '../../components/toast';
import { MyazaText } from '../../components/Typography';
import { MyazaButton } from '../../components/MyazaButton';
import { Icon } from '../../components/Icon';
import { LivenessStep } from '../LivenessStep';
import { mapAuthError, outcomeOf, type BiometricAuthOutcome } from '../../lib/biometric-auth';
import type { KYCError } from '../../types/verification';
import type { BiometricAuthResponse } from '../../services/api-types-biometric';

// ---------------------------------------------------------------------------
// The re-auth flow inside its own runtime: intro → the REAL liveness step →
// authenticating → result. The liveness step is the ordinary one — camera,
// challenges, capture ring, selfie upload — mounted alone with the store
// parked on 'liveness'. Its Continue advances the store to 'submitted' (the
// scope's step order), which is the hand-over: the uploaded selfie's mediaId
// is read off the store and sent to /biometric/authenticate. The submitted
// screen is never rendered, so nothing ever calls /verify.
// ---------------------------------------------------------------------------

type View_ = 'intro' | 'capture' | 'authenticating' | 'result';

export function BiometricAuthFlow({
  externalUserId,
  onAuthenticated,
  onFailed,
  onError,
  onClose,
}: {
  externalUserId: string;
  onAuthenticated?: (result: BiometricAuthResponse) => void;
  onFailed?: (result: BiometricAuthResponse) => void;
  onError?: (error: KYCError) => void;
  onClose: () => void;
}): React.ReactElement {
  const config = useKycConfig();
  const store = useKycStore();
  const currentStep = useKyc((s) => s.currentStep);
  const selfieId = useKyc((s) => s.mediaIds.selfie);
  const immersive = useKyc((s) => s.immersiveCapture);
  const [view, setView] = useState<View_>('intro');
  const [outcome, setOutcome] = useState<BiometricAuthOutcome | null>(null);
  const inFlight = useRef(false);

  const startCapture = () => {
    store.setState({ currentStep: 'liveness', mediaIds: {}, selfiePreviewUri: null });
    setOutcome(null);
    setView('capture');
  };

  // The hand-over: the step's Continue moved the store past 'liveness' with
  // the selfie uploaded.
  useEffect(() => {
    if (view !== 'capture' || currentStep === 'liveness' || !selfieId || inFlight.current) return;
    inFlight.current = true;
    setView('authenticating');
    const mode = config.livenessMode ?? 'gestures';
    store
      .getState()
      .api.authenticate({ externalUserId, selfie: selfieId, liveness: { mode, passed: true } })
      .then((result) => {
        const next = outcomeOf(result);
        setOutcome(next);
        if (next.kind === 'success') onAuthenticated?.(result);
        else onFailed?.(result);
      })
      .catch((err: unknown) => {
        const kyc = mapAuthError(err);
        setOutcome({ kind: 'error', message: kyc.message });
        onError?.(kyc);
      })
      .finally(() => {
        inFlight.current = false;
        setView('result');
      });
  }, [view, currentStep, selfieId, config.livenessMode, externalUserId, store, onAuthenticated, onFailed, onError]);

  const title =
    view === 'capture' ? 'Face check' : view === 'authenticating' ? "Verifying it's you" : "Verify it's you";
  const dismissBlocked = config.disableClose === true || view === 'authenticating';

  return (
    <ToastProvider>
      <KycSheet
        title={title}
        description={view === 'capture' ? 'Follow the prompts, then hold still for the photo.' : null}
        progress={null}
        stepCount={null}
        onBack={view === 'capture' ? () => setView('intro') : null}
        onClose={dismissBlocked ? () => undefined : onClose}
        immersive={immersive}
      >
        {view === 'intro' && <Intro onStart={startCapture} />}
        {view === 'capture' && <LivenessStep />}
        {view === 'authenticating' && <Authenticating />}
        {view === 'result' && outcome && <Result outcome={outcome} onRetry={startCapture} onClose={onClose} />}
      </KycSheet>
    </ToastProvider>
  );
}

function Intro({ onStart }: { onStart: () => void }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${colors.primary}1A`, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="user" size={36} color={colors.primary} />
      </View>
      <View style={{ height: spacing.lg }} />
      <MyazaText variant="body" style={{ textAlign: 'center' }} color={colors.textSecondary}>
        We'll take a quick face check to confirm your identity. No documents needed.
      </MyazaText>
      <View style={{ height: spacing.xl }} />
      <MyazaButton label="Start" onPress={onStart} />
    </View>
  );
}

function Authenticating(): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl * 2 }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <View style={{ height: spacing.lg }} />
      <MyazaText variant="body" style={{ fontWeight: '600' }}>Verifying it's you…</MyazaText>
      <MyazaText variant="bodySmall" color={colors.textSecondary}>This only takes a moment.</MyazaText>
    </View>
  );
}

function Result({ outcome, onRetry, onClose }: { outcome: BiometricAuthOutcome; onRetry: () => void; onClose: () => void }): React.ReactElement {
  const { colors } = useTheme();
  const ok = outcome.kind === 'success';
  const tint = ok ? colors.success : colors.error;
  const heading = ok ? "You're verified" : outcome.kind === 'failed' ? "Couldn't verify you" : 'Something went wrong';
  const detail = ok
    ? "We confirmed it's really you."
    : outcome.kind === 'failed'
      ? "We couldn't confirm it's you. Make sure your face is clear and well lit, then try again."
      : outcome.message;
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${tint}1A`, alignItems: 'center', justifyContent: 'center' }}>
        {/* The web's result: a check, or the alert circle the flow's own
            verdict screen uses (never a bare X), under a heading-font title. */}
        <Icon name={ok ? 'check' : 'alert'} size={36} color={tint} />
      </View>
      <View style={{ height: spacing.lg }} />
      <MyazaText variant="heading2" style={{ textAlign: 'center' }}>{heading}</MyazaText>
      <View style={{ height: spacing.xs }} />
      <MyazaText variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>{detail}</MyazaText>
      <View style={{ height: spacing.xl }} />
      {ok ? (
        <MyazaButton label="Done" onPress={onClose} />
      ) : (
        <>
          <MyazaButton label="Try again" onPress={onRetry} />
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8} style={{ paddingVertical: spacing.md }}>
            <MyazaText variant="body" color={colors.textSecondary}>Close</MyazaText>
          </Pressable>
        </>
      )}
    </View>
  );
}
