import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Platform } from 'react-native';

// iOS presents the flow as a swipe-down card sheet (the RN equivalent of
// Flutter's showModalBottomSheet); Android uses a full-screen page (matching
// Flutter's Android MaterialPageRoute).
const MODAL_PRESENTATION = Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen';

// 'slide' drives the present animation: on iOS the native pageSheet slides up and
// keeps its native drag-to-dismiss; on Android the full-screen page slides up.
// ('none' suppresses the present transition, leaving no slide-up and no drag.)
const MODAL_ANIMATION = 'slide';

import type { KYCStep, MyazaKYCConfig, SupportedCountry } from './types/config';
import { KycRuntimeProvider, useKycStore } from './components/runtime';
import { KycFlow, type BackResult } from './components/KycFlow';
import { MyazaButton } from './components/MyazaButton';

/**
 * Builds the `<Modal onRequestClose>` handler (Android hardware back / TV menu).
 * It first asks the flow's back handler (via `backRef`) to navigate a step back;
 * only when the flow is at its first step ('close') and close isn't disabled
 * does it actually close. This is why back walks the flow backward instead of
 * dismissing the whole SDK. Falls back to `close()` if the flow hasn't wired a
 * handler yet (e.g. before first paint).
 */
function makeRequestClose(
  backRef: React.MutableRefObject<(() => BackResult) | null>,
  close: () => void,
  blockDismiss: boolean,
): () => void {
  return () => {
    const result = backRef.current?.();
    if (result === 'navigated' || result === 'blocked') return;
    // result === 'close' (first step, close allowed) or no handler yet.
    if (!blockDismiss) close();
  };
}

// ---------------------------------------------------------------------------
// Public entry points — `<MyazaKYC />` (trigger + modal) and `useMyazaKYC()`
// (custom trigger). Mirrors the web SDK's component + hook API, adapted to React
// Native's `<Modal>` (the RN equivalent of the web modal/portal).
// ---------------------------------------------------------------------------

export interface MyazaKYCProps<C extends SupportedCountry = SupportedCountry> extends MyazaKYCConfig<C> {
  /** Custom trigger label (defaults to "Verify with {companyName}" / "Verify Identity"). */
  children?: string;
  /** Disable the built-in trigger button. */
  disabled?: boolean;
}

function defaultTriggerLabel(config: MyazaKYCConfig): string {
  const name = config.appearance?.companyName;
  return name ? `Verify with ${name}` : 'Verify Identity';
}

export function MyazaKYC<C extends SupportedCountry = SupportedCountry>(
  props: MyazaKYCProps<C>,
): React.ReactElement {
  const { children, disabled, ...config } = props;
  // The provider wraps BOTH the trigger and the modal so the built-in trigger
  // button can read the theme. The store is created once and `reset()` on each
  // open for a fresh run.
  return (
    <KycRuntimeProvider config={config}>
      <MyazaKYCTrigger config={config} label={children} disabled={disabled} />
    </KycRuntimeProvider>
  );
}

function MyazaKYCTrigger({
  config,
  label,
  disabled,
}: {
  config: MyazaKYCConfig;
  label?: string;
  disabled?: boolean;
}): React.ReactElement {
  const store = useKycStore();
  const [open, setOpen] = useState(false);
  // Idempotent close — the X button, Android back, and iOS swipe-down dismiss can
  // each fire; `onClose` must run at most once per open.
  const closedRef = useRef(true);
  const backRef = useRef<(() => BackResult) | null>(null);

  const openFlow = useCallback(() => {
    closedRef.current = false;
    store.getState().reset();
    setOpen(true);
  }, [store]);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    setOpen(false);
    config.onClose?.();
  }, [config]);

  // `disableClose` presents full-screen on iOS (kills the swipe-down drag). The
  // Android hardware back goes through `onRequestClose`, which walks the flow
  // back a step (or closes from the first step, unless disableClose).
  const blockDismiss = config.disableClose === true;
  const presentation = blockDismiss ? 'fullScreen' : MODAL_PRESENTATION;
  const onRequestClose = useCallback(
    () => makeRequestClose(backRef, close, blockDismiss)(),
    [close, blockDismiss],
  );

  return (
    <>
      <MyazaButton
        label={label ?? defaultTriggerLabel(config)}
        disabled={disabled}
        fullWidth={false}
        onPress={openFlow}
      />
      <Modal
        visible={open}
        animationType={MODAL_ANIMATION}
        presentationStyle={presentation}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={onRequestClose}
        onDismiss={blockDismiss ? undefined : close}
      >
        {open ? <KycFlow onClose={close} backRef={backRef} /> : null}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// useMyazaKYC — for fully custom triggers. Returns the controller plus a bound
// `MyazaKYCModal` host element to render once in your tree. The consumer's own
// trigger element is plain (no theme dependency); the modal carries its own
// provider, mounted fresh on each open.
// ---------------------------------------------------------------------------

export interface UseMyazaKYCReturn {
  open: () => void;
  close: () => void;
  isOpen: boolean;
  currentStep: KYCStep | null;
  /** Render this once in your component tree (RN has no implicit portal). */
  MyazaKYCModal: React.FC;
}

export function useMyazaKYC<C extends SupportedCountry = SupportedCountry>(
  config: MyazaKYCConfig<C>,
): UseMyazaKYCReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<KYCStep | null>(null);
  const closedRef = useRef(true);

  // Consumers pass an inline config object, so its identity changes on every
  // render of their component. Keep the LATEST config in a ref and read it from
  // the (stable) callbacks below. This is what keeps `wrappedConfig` and the
  // `MyazaKYCModal` element stable across re-renders — otherwise a step change
  // (which re-renders the consumer) would rebuild the modal subtree, and on iOS
  // a remounted presented <Modal> fires onDismiss → an unwanted close().
  const configRef = useRef(config);
  configRef.current = config;
  const backRef = useRef<(() => BackResult) | null>(null);

  const open = useCallback(() => {
    closedRef.current = false;
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    setIsOpen(false);
    setCurrentStep(null);
    configRef.current.onClose?.();
  }, []);

  // Stable wrapped config: spreads the latest config but overrides onStepChange
  // to surface the live step to the consumer. Built once (the spread reads the
  // ref at call time via the wrapped callbacks), so the modal's provider/store
  // isn't recreated on each render.
  const wrappedConfig = useMemo<MyazaKYCConfig<C>>(
    () => ({
      ...configRef.current,
      onStart: () => configRef.current.onStart?.(),
      onStepChange: (step: KYCStep) => {
        setCurrentStep(step);
        configRef.current.onStepChange?.(step);
      },
      onSubmit: (submission) => configRef.current.onSubmit?.(submission),
      onError: (error) => configRef.current.onError?.(error),
      onClose: () => configRef.current.onClose?.(),
    }),
    [],
  );

  // disableClose blocks user-initiated dismissal — only the returned close()
  // can dismiss. Present full-screen (no iOS swipe-down). The Android hardware
  // back goes through onRequestClose, which walks the flow back a step (or
  // closes from the first step, unless disableClose) — same as the trigger
  // component. Read once from the ref so the modal element stays stable; the
  // flag isn't expected to flip mid-session.
  const blockDismiss = configRef.current.disableClose === true;
  const onRequestClose = useCallback(
    () => makeRequestClose(backRef, close, blockDismiss)(),
    [close, blockDismiss],
  );

  // Stable modal element — depends only on open/close state, never on the
  // changing consumer config (see configRef above).
  const MyazaKYCModal = useCallback<React.FC>(
    () => (
      <Modal
        visible={isOpen}
        animationType={MODAL_ANIMATION}
        presentationStyle={blockDismiss ? 'fullScreen' : MODAL_PRESENTATION}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={onRequestClose}
        onDismiss={blockDismiss ? undefined : close}
      >
        {/* Fresh provider/store per open. */}
        {isOpen ? (
          <KycRuntimeProvider config={wrappedConfig}>
            <KycFlow onClose={close} backRef={backRef} />
          </KycRuntimeProvider>
        ) : null}
      </Modal>
    ),
    [wrappedConfig, isOpen, close, blockDismiss, onRequestClose],
  );

  return { open, close, isOpen, currentStep, MyazaKYCModal };
}
