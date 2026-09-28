import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, findNodeHandle, Platform, StyleSheet, View } from 'react-native';
import { useStore } from 'zustand';

import { brightScreenEnabled, shouldBoostBrightness, themeFadeMs } from '../lib/bright-screen';
import { createBrightnessBooster, type BrightnessBooster } from '../lib/brightness-booster';
import { loadBrightnessBackend } from './brightness-backend';
import { useKycConfig, useKycStore, useTheme } from './runtime';
import { useReduceMotion } from './StaggerIn';

// ---------------------------------------------------------------------------
// The bright screen during liveness, at the sheet root.
//
// The liveness step only says that its camera is on (`livenessCameraOn`); this
// does the lighting: forces the light theme, raises the screen brightness,
// and puts both back. It lives at the sheet root, beside FlashOverlay, for two
// reasons: the sheet OUTLIVES the step, so a step left mid-capture (Back, a
// retake, an error) still restores everything; and on Android the brightness
// is set on the modal's own window, which this view's anchor resolves.
//
// Rules in lib/bright-screen; the brightness ordering in lib/brightness-booster.
// ---------------------------------------------------------------------------

export function BrightScreen(): React.ReactElement {
  const store = useKycStore();
  const cameraOn = useStore(store, (s) => s.livenessCameraOn);
  const config = useKycConfig();
  const { setForcedMode } = useTheme();
  const wanted = cameraOn && brightScreenEnabled(config);

  // Theme: light while the camera is on. The person's own choice is kept
  // underneath and returns when this lets go.
  useEffect(() => {
    setForcedMode(wanted ? 'light' : null);
  }, [wanted, setForcedMode]);
  useEffect(() => () => setForcedMode(null), [setForcedMode]);

  // Brightness: full while the camera is on AND the app is in front. Leaving
  // the app puts it back (on iOS the screen brightness is system-wide, so a
  // raise must never outlive the app's time on screen); coming back raises it
  // again from whatever it is then.
  const anchorRef = useRef<View>(null);
  const boosterRef = useRef<BrightnessBooster | null>(null);
  if (!boosterRef.current) {
    boosterRef.current = createBrightnessBooster(
      loadBrightnessBackend(() => findNodeHandle(anchorRef.current)),
    );
  }
  const [appState, setAppState] = useState<string>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);
  const boost = shouldBoostBrightness({ wanted, appState });
  useEffect(() => {
    const booster = boosterRef.current;
    if (!booster) return;
    void (boost ? booster.boost() : booster.restore());
  }, [boost]);
  // The flow closing (or crashing past this component) restores too.
  useEffect(() => () => void boosterRef.current?.restore(), []);

  return (
    <>
      {/* Android resolves the modal's own window from this view. A real native
          view (collapsable={false}), sized to nothing. */}
      {Platform.OS === 'android' ? (
        <View ref={anchorRef} collapsable={false} pointerEvents="none" style={styles.anchor} />
      ) : null}
      <ThemeVeil />
    </>
  );
}

interface Veil {
  color: string;
  opacity: Animated.Value;
  ms: number;
}

/**
 * The fade between the two themes.
 *
 * Every screen reads its colours from the theme at render, so the palette
 * itself cannot be animated without re-rendering the camera at frame rate.
 * Instead, on the render where the FORCED mode changes, a sheet of the
 * previous background is laid over everything at full opacity and faded out:
 * the new theme is revealed through it. Worked out during render, so no frame
 * of the new theme shows before the veil does. Reduced motion: no veil, the
 * switch is instant. A toggle by the person is not veiled (they asked for it).
 */
function ThemeVeil(): React.ReactElement | null {
  const { colors, forced } = useTheme();
  const reduced = useReduceMotion();
  const [seen, setSeen] = useState({ forced, background: colors.background });
  const [veil, setVeil] = useState<Veil | null>(null);

  if (seen.forced !== forced || seen.background !== colors.background) {
    setSeen({ forced, background: colors.background });
    const ms = themeFadeMs(forced, reduced);
    if (seen.forced !== forced && seen.background !== colors.background && ms > 0) {
      setVeil({ color: seen.background, opacity: new Animated.Value(1), ms });
    }
  }

  useEffect(() => {
    if (!veil) return;
    const anim = Animated.timing(veil.opacity, {
      toValue: 0,
      duration: veil.ms,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) setVeil((v) => (v === veil ? null : v));
    });
    return () => anim.stop();
  }, [veil]);

  if (!veil) return null;
  return (
    <Animated.View
      pointerEvents="none"
      // Above the header (elevation on Android) and the body, below the flash.
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: veil.color, opacity: veil.opacity, zIndex: 90, elevation: 90 },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0 },
});
