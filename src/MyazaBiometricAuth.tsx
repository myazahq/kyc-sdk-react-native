import React, { useCallback, useState } from 'react';
import { Modal, Platform } from 'react-native';

import { KycRuntimeProvider, MyazaThemeProvider } from './components/runtime';
import { MyazaButton } from './components/MyazaButton';
import { BiometricAuthFlow } from './screens/biometric/BiometricAuthFlow';
import { primeFaceModel } from './liveness/visionCameraFaceDetector';
import { defaultReauthLabel } from './lib/biometric-auth';
import type { KYCAppearance, ResolvedKYCConfig, SupportedCountry } from './types/config';
import type { KYCError } from './types/verification';
import type { BiometricAuthResponse } from './services/api-types-biometric';

// ---------------------------------------------------------------------------
// MyazaBiometricAuth — returning-user face re-authentication ("prove it's
// still you"). Mirrors the web SDK's MyazaBiometricAuth: a verified user
// re-authenticates with a live selfie matched 1:1 against their enrollment
// reference (no gov-DB call, no re-KYC). Self-contained: its own trigger +
// modal, hosting the SDK's real liveness step inside a scoped runtime.
// ---------------------------------------------------------------------------

export interface MyazaBiometricAuthProps {
  /** Publishable API key (`pk_…`). The environment is derived from its prefix. */
  apiKey: string;
  /** Dev-only base-URL override for `pk_dev_` keys. */
  devUrl?: string;
  /** The org's user reference (Entity.externalUserId) to re-authenticate. */
  externalUserId: string;
  /** Presence Intelligence method (default 'gestures'). */
  livenessMode?: 'gestures' | 'flash' | 'both';
  flashSequenceLength?: number;
  appearance?: KYCAppearance;
  disableClose?: boolean;
  /** Open the modal on mount (no trigger button is rendered). */
  defaultOpen?: boolean;
  /** Custom trigger label (default "Verify it's you"). */
  children?: string;
  disabled?: boolean;
  onOpen?: () => void;
  /** The user re-authenticated. `token` is a single-use proof — verify it from
   *  your backend with a secret key at `/biometric/verify-proof`. */
  onAuthenticated?: (result: { attemptId: string; confidence: number | null; token?: string }) => void;
  /** The check ran but the user did not pass (no match / liveness failed). */
  onFailed?: (result: { status: BiometricAuthResponse['status']; attemptId: string; confidence: number | null }) => void;
  /** A technical error (network, not enrolled, insufficient credits, …). */
  onError?: (error: KYCError) => void;
  onClose?: () => void;
}

const MODAL_PRESENTATION = Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen';

export function MyazaBiometricAuth(props: MyazaBiometricAuthProps): React.ReactElement {
  const { children, disabled, defaultOpen, onOpen, onAuthenticated, onFailed, onError, onClose } = props;
  const [open, setOpen] = useState(defaultOpen === true);

  // The liveness step reads exactly the keys a KYC flow's config carries; the
  // scope parks the step order on consent → liveness → submitted, and the
  // flow only ever mounts the middle one. `country` is required by the
  // resolved shape but nothing on this path reads it.
  const config: ResolvedKYCConfig = {
    apiKey: props.apiKey,
    devUrl: props.devUrl,
    country: 'NG' as SupportedCountry,
    scope: 'biometric-authentication',
    enableSelfie: true,
    livenessMode: props.livenessMode ?? 'gestures',
    flashSequenceLength: props.flashSequenceLength,
    appearance: props.appearance,
    disableClose: props.disableClose,
    userId: props.externalUserId,
    onError,
  };

  const openFlow = useCallback(() => {
    void primeFaceModel();
    setOpen(true);
    onOpen?.();
  }, [onOpen]);
  const close = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);
  const blockDismiss = props.disableClose === true;

  return (
    <MyazaThemeProvider appearance={props.appearance}>
      {defaultOpen !== true && (
        <MyazaButton
          label={children ?? defaultReauthLabel(props.appearance?.companyName)}
          disabled={disabled}
          fullWidth={false}
          onPress={openFlow}
        />
      )}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle={blockDismiss ? 'fullScreen' : MODAL_PRESENTATION}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={blockDismiss ? () => undefined : close}
        onDismiss={blockDismiss ? undefined : close}
      >
        {open ? (
          // A fresh store per open: the runtime provider creates it once per
          // mount, and the modal's children mount once per open.
          <KycRuntimeProvider config={config}>
            <BiometricAuthFlow
              externalUserId={props.externalUserId}
              onAuthenticated={(r) => onAuthenticated?.({ attemptId: r.attemptId, confidence: r.confidence, token: r.token })}
              onFailed={(r) => onFailed?.({ status: r.status, attemptId: r.attemptId, confidence: r.confidence })}
              onError={onError}
              onClose={close}
            />
          </KycRuntimeProvider>
        ) : null}
      </Modal>
    </MyazaThemeProvider>
  );
}
