import React, { useCallback, useEffect, useRef } from 'react';
import { findNodeHandle, NativeModules, Platform, StyleSheet, View } from 'react-native';

// Themes the Android modal's status/navigation bars from the SDK theme. RN's
// <Modal> runs in its own Dialog window that JS StatusBar/SystemBars APIs can't
// reach (they target the activity window). So we render a tiny real native view
// INSIDE the modal and hand its tag to MyazaStatusBarModule, which resolves the
// view and applies the bar appearance to ITS window (the Dialog). Native modules
// (unlike legacy view managers) work fine on the New Architecture. Android-only.

const StatusBarModule: { setBarStyle?: (viewTag: number, light: boolean) => void } | undefined =
  Platform.OS === 'android' ? NativeModules.MyazaStatusBarModule : undefined;

/** `barStyle: 'light'` = light glyphs (dark bg), `'dark'` = dark glyphs (light bg). */
export function StatusBarController({ barStyle }: { barStyle: 'light' | 'dark' }): React.ReactElement | null {
  const ref = useRef<View>(null);

  const apply = useCallback(() => {
    if (!StatusBarModule?.setBarStyle) return;
    const tag = findNodeHandle(ref.current);
    if (tag != null) StatusBarModule.setBarStyle(tag, barStyle === 'light');
  }, [barStyle]);

  // Re-apply whenever the theme flips. On the FIRST open the modal's Dialog window
  // resets its own bar appearance as it finishes presenting, which overrides an
  // immediate apply (the bar would stay on the host style until a manual toggle).
  // So re-apply on a couple of short delays past the present animation. `onLayout`
  // additionally covers the apply once the view attaches to the Dialog.
  useEffect(() => {
    apply();
    const timers = [setTimeout(apply, 250), setTimeout(apply, 600)];
    return () => timers.forEach(clearTimeout);
  }, [apply]);

  if (Platform.OS !== 'android') return null;
  // `collapsable={false}` keeps it a real native view so the module can resolve it.
  return <View ref={ref} collapsable={false} onLayout={apply} style={styles.hidden} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 0, height: 0 },
});
