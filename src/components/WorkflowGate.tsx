import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { KYCError } from '../types/verification';
import type { MyazaKYCConfig } from '../types/config';
import { MyazaThemeProvider, useTheme } from './theme-provider';
import { MyazaPulseLoader } from './MyazaPulseLoader';
import { MyazaText } from './Typography';
import { MyazaButton } from './MyazaButton';
import { Icon } from './Icon';
import type { MountState, ResolvedMount } from './useWorkflowMount';

export type { ResolvedMount } from './useWorkflowMount';

// ---------------------------------------------------------------------------
// What a `workflowId` mount shows once it is inside the modal.
//
// Resolution itself now happens BEFORE the modal is presented (see
// `useWorkflowMount`), so in the normal case this renders `children` on the
// first frame and no barrier is ever seen. The loader survives for the one case
// the caller cannot pre-settle: a Retry after a failure, where the modal is
// already on screen.
//
// A failure is a dead end for the flow — it does NOT fall back to the props,
// because a workflow that cannot be loaded is not the same flow the props
// describe, and silently running a different one is worse than not running: the
// org configured those steps for a reason.
//
// Unlike the Flutter gate this one can be LEFT: the error state offers Retry
// and Close.
// ---------------------------------------------------------------------------

export function WorkflowGate({
  config,
  state,
  onRetry,
  onClose,
  children,
}: {
  config: MyazaKYCConfig;
  state: MountState;
  onRetry: () => void;
  onClose: () => void;
  children: (mount: ResolvedMount) => React.ReactElement;
}): React.ReactElement {
  if (state.status === 'ready') return children(state.mount);

  // These render before there is a resolved config, so they carry their own
  // theme from the props' appearance — the flow's own appearance is precisely
  // the thing being waited on.
  return (
    <MyazaThemeProvider appearance={config.appearance}>
      {state.status === 'resolving' ? (
        <GateLoading />
      ) : (
        <GateError error={state.error} onRetry={onRetry} onClose={onClose} />
      )}
    </MyazaThemeProvider>
  );
}

function GateLoading(): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      testID="kyc.workflow-gate.loading"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        padding: spacing.xl,
      }}
    >
      <MyazaPulseLoader size={64} />
      <View style={{ height: spacing.md }} />
      <MyazaText variant="bodySmall" color={colors.textMuted}>
        Preparing your verification…
      </MyazaText>
    </View>
  );
}

function GateError({
  error,
  onRetry,
  onClose,
}: {
  error: KYCError;
  onRetry: () => void;
  onClose: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  // A bad key or an unpublished flow will fail identically on every attempt —
  // offering Retry there would just invite the user to keep pressing it.
  const retryable = error.code === 'network_error';
  return (
    <View
      testID="kyc.workflow-gate.error"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        padding: spacing.xl,
      }}
    >
      <Icon name="alert" size={40} color={colors.error} />
      <View style={{ height: spacing.md }} />
      <MyazaText variant="heading3" style={{ textAlign: 'center' }}>
        Verification unavailable
      </MyazaText>
      <View style={{ height: spacing.sm }} />
      <MyazaText variant="bodySmall" color={colors.textMuted} style={{ textAlign: 'center' }}>
        {error.message}
      </MyazaText>
      <View style={{ height: spacing.lg }} />
      {retryable ? (
        <>
          <MyazaButton label="Try Again" onPress={onRetry} />
          <View style={{ height: spacing.sm }} />
        </>
      ) : null}
      <MyazaButton label="Close" variant="outline" onPress={onClose} />
    </View>
  );
}
