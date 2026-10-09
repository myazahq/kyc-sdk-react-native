import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { getHostComponent } from 'react-native-nitro-modules';

import type { MyazaTouchGuardMethods, MyazaTouchGuardProps } from '../specs/MyazaTouchGuard.nitro';

// ---------------------------------------------------------------------------
// Laid over a control that is dragged with a finger (the signature pad), so
// the drag is not also taken by the sheet's scroll or by the gesture that
// pulls a page sheet down. See specs/MyazaTouchGuard.nitro.ts.
//
// iOS only: it renders nothing on Android, where the JS responder's claim is
// honoured. The touch still reaches the control underneath, measured against
// this view, so it must cover the control exactly.
// ---------------------------------------------------------------------------

const NativeTouchGuard =
  Platform.OS === 'ios'
    ? getHostComponent<MyazaTouchGuardProps, MyazaTouchGuardMethods>('MyazaTouchGuard', () =>
        require('../../nitrogen/generated/shared/json/MyazaTouchGuardConfig.json'),
      )
    : null;

export function TouchGuard({ guarding = true }: { guarding?: boolean }): React.ReactElement | null {
  if (!NativeTouchGuard) return null;
  return <NativeTouchGuard style={StyleSheet.absoluteFill} guarding={guarding} />;
}
