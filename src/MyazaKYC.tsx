import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { KycRuntimeProvider, MyazaThemeProvider } from './components/runtime';
import { WorkflowGate } from './components/WorkflowGate';
import { useWorkflowMount } from './components/useWorkflowMount';
import { safeReportError } from './services/errors';
import { primeFaceModel } from './liveness/visionCameraFaceDetector';
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
  // The theme provider wraps the trigger so the built-in button is branded
  // before anything is resolved; the flow's own provider (with the resolved
  // workflow's appearance) is mounted inside the modal by the gate.
  return (
    <MyazaThemeProvider appearance={config.appearance}>
      <MyazaKYCTrigger config={config} label={children} disabled={disabled} />
    </MyazaThemeProvider>
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
  const [wantOpen, setWantOpen] = useState(false);
  // Idempotent close — the X button, Android back, and iOS swipe-down dismiss can
  // each fire; `onClose` must run at most once per open.
  const closedRef = useRef(true);
  const backRef = useRef<(() => BackResult) | null>(null);

  // Resolution happens HERE, outside the modal, and starts on mount rather than
  // on press. The modal is only presented once it has settled, so its very
  // first frame carries the workflow's own appearance instead of coming up in
  // the default brand and recolouring underneath the user.
  const { state, retry, refresh } = useWorkflowMount(config);
  const settled = state.status !== 'resolving';
  const open = wantOpen && settled;

  // Start fetching the face model the moment the user opens the flow, so the
  // download overlaps consent and ID-type selection rather than stalling in
  // front of the camera. Mirrors the web SDK's primeFaceMesh() on mount; the
  // liveness step still gates on isFaceModelReady(), so this is best-effort.
  const primedRef = useRef(false);
  useEffect(() => {
    if (!wantOpen || primedRef.current) return;
    primedRef.current = true;
    primeFaceModel();
  }, [wantOpen]);

  // Reported only once the user has actually tried to start. Prefetching must
  // not fire a consumer's error handler for a flow they never opened.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (!wantOpen || state.status !== 'error' || reportedRef.current) return;
    reportedRef.current = true;
    safeReportError(config.onError, state.error);
  }, [wantOpen, state, config]);

  const retryFlow = useCallback(() => {
    reportedRef.current = false;
    retry();
  }, [retry]);

  // Each open mounts a fresh gate → provider → store, so there is no state to
  // reset; the previous run's store is discarded with its provider.
  const openFlow = useCallback(() => {
    closedRef.current = false;
    // Re-resolve on every open: the mount-time prefetch is a warm-up, not a
    // cache, so a workflow published since the app started is still picked up.
    reportedRef.current = false;
    refresh();
    setWantOpen(true);
  }, [refresh]);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    setWantOpen(false);
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
        // Pressed, but the workflow has not arrived yet. Without this the press
        // would look ignored — gating the modal on a resolved config trades a
        // wrong colour for a dead button unless the wait is shown.
        loading={wantOpen && !settled}
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
        {open ? (
          <WorkflowGate config={config} state={state} onRetry={retryFlow} onClose={close}>
            {(mount) => (
              <KycRuntimeProvider config={mount.config} serverConfig={mount.serverConfig}>
                <KycFlow onClose={close} backRef={backRef} />
              </KycRuntimeProvider>
            )}
          </WorkflowGate>
        ) : null}
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
  /**
   * Opening was requested but the workflow has not resolved yet.
   *
   * Show a spinner on your trigger while this is true. The modal is deliberately
   * withheld until the config has settled so it opens in the right brand rather
   * than recolouring underneath the user — which means the press has to be
   * acknowledged somewhere, or it looks ignored.
   */
  isPreparing: boolean;
  currentStep: KYCStep | null;
  /** Render this once in your component tree (RN has no implicit portal). */
  MyazaKYCModal: React.FC;
}

export function useMyazaKYC<C extends SupportedCountry = SupportedCountry>(
  config: MyazaKYCConfig<C>,
): UseMyazaKYCReturn {
  const [wantOpen, setWantOpen] = useState(false);
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

  // `refresh` is defined further down (it needs `wrappedConfig`), so it is
  // reached through a ref rather than reordering the component around it.
  const refreshRef = useRef<() => void>(() => undefined);
  // Only reported once the consumer has actually tried to start — prefetching
  // must not fire their error handler for a flow they never opened.
  const reportedRef = useRef(false);
  const open = useCallback(() => {
    closedRef.current = false;
    // Re-resolve on every open — see the trigger above.
    reportedRef.current = false;
    refreshRef.current();
    setWantOpen(true);
  }, []);
  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    setWantOpen(false);
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

  // Resolution runs outside the modal and starts on mount, so the modal's first
  // frame already carries the workflow's appearance.
  const { state, retry, refresh } = useWorkflowMount(wrappedConfig);
  refreshRef.current = refresh;
  const settled = state.status !== 'resolving';
  const presenting = wantOpen && settled;

  useEffect(() => {
    if (!wantOpen || state.status !== 'error' || reportedRef.current) return;
    reportedRef.current = true;
    safeReportError(configRef.current.onError, state.error);
  }, [wantOpen, state]);

  const retryFlow = useCallback(() => {
    reportedRef.current = false;
    retry();
  }, [retry]);

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
        visible={presenting}
        animationType={MODAL_ANIMATION}
        presentationStyle={blockDismiss ? 'fullScreen' : MODAL_PRESENTATION}
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={onRequestClose}
        onDismiss={blockDismiss ? undefined : close}
      >
        {/* Fresh gate/provider/store per open. */}
        {presenting ? (
          <WorkflowGate config={wrappedConfig} state={state} onRetry={retryFlow} onClose={close}>
            {(mount) => (
              <KycRuntimeProvider config={mount.config} serverConfig={mount.serverConfig}>
                <KycFlow onClose={close} backRef={backRef} />
              </KycRuntimeProvider>
            )}
          </WorkflowGate>
        ) : null}
      </Modal>
    ),
    [wrappedConfig, presenting, state, retryFlow, close, blockDismiss, onRequestClose],
  );

  // `isOpen` stays the consumer's intent, not the presentation state — a
  // trigger disabled on it must stay disabled through the preparing window.
  return {
    open,
    close,
    isOpen: wantOpen,
    isPreparing: wantOpen && !settled,
    currentStep,
    MyazaKYCModal,
  };
}
