import { PermissionsAndroid, Platform, Vibration } from 'react-native';
import { nativeModulePresent } from '../lib/native-module-present';

// ---------------------------------------------------------------------------
// Taps in the hand, best-effort.
//
// A liveness step that lands and a chip read that finishes have no shutter and
// no sound: the haptic is what makes each land as a completed action rather
// than a screen that quietly changed. Two strengths, as on the Flutter SDK: a
// light tap for a step, a firmer one for the thing being finished.
//
// `expo-haptics` is a dependency of this SDK and gives the proper taptic
// patterns. Its native half only exists in an app BUILT with it, though: an
// app that takes this JavaScript before its next native build does not have
// it yet. On Android that app falls back to a short tick from RN's built-in
// vibrate, which needs nothing installed. On an iPhone it feels nothing: iOS
// ignores the length and plays its one long buzz, which is a vibration, not a
// tap, and nothing like the Flutter SDK's.
// ---------------------------------------------------------------------------

type ExpoHaptics = {
  impactAsync: (s: unknown) => Promise<void>;
  performAndroidHapticsAsync: (t: unknown) => Promise<void>;
  ImpactFeedbackStyle: { Light: unknown; Medium: unknown };
  AndroidHaptics: { Virtual_Key: unknown; Keyboard_Tap: unknown };
};

// The SAME effects the Flutter SDK's HapticFeedback.lightImpact and
// .mediumImpact play, so the two SDKs feel alike in the hand:
//
//   iOS      the impact generator, light and medium
//   Android  the system's own haptic effects (a key press, a keyboard tap),
//            played through the view rather than the vibrator
//
// expo-haptics' `impactAsync` and `notificationAsync` drive the VIBRATOR on
// Android, which is a buzz, not a tap, and its success notification is a
// double pulse on iOS. Both read as "vibration" beside Flutter's.
function impact(haptics: ExpoHaptics, strength: 'light' | 'medium'): void {
  const played =
    Platform.OS === 'android'
      ? haptics.performAndroidHapticsAsync(
          strength === 'light' ? haptics.AndroidHaptics.Virtual_Key : haptics.AndroidHaptics.Keyboard_Tap,
        )
      : haptics.impactAsync(
          strength === 'light' ? haptics.ImpactFeedbackStyle.Light : haptics.ImpactFeedbackStyle.Medium,
        );
  void played.catch(() => undefined);
}

/** expo-haptics where the app was built with it, else null. */
function expoHaptics(): ExpoHaptics | null {
  // Asked first: an optional Expo package whose native half is missing throws
  // while it loads, and Metro reports that as fatal before a `try` can catch it.
  if (!nativeModulePresent('ExpoHaptics')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-haptics') as ExpoHaptics;
  } catch {
    return null;
  }
}

// Android's vibrator THROWS without the VIBRATE permission, natively, where no
// `try` here can catch it. The permission is the host's to declare (Expo apps
// have it by default), so it is checked once before the first buzz.
let mayVibrate: Promise<boolean> | null = null;
function vibrateAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  mayVibrate ??= PermissionsAndroid.check(
    'android.permission.VIBRATE' as Parameters<typeof PermissionsAndroid.check>[0],
  ).catch(() => false);
  return mayVibrate;
}

/** A short tick on Android. Nothing on iOS, whose only vibrate is a long buzz. */
function vibrate(ms: number): void {
  if (Platform.OS !== 'android') return;
  void vibrateAllowed().then((allowed) => {
    if (!allowed) return;
    try {
      Vibration.vibrate(ms);
    } catch {
      // A device that refuses to vibrate is not a problem worth reporting.
    }
  });
}

/** A light tap: one step of several has landed. */
export function tapHaptic(): void {
  const haptics = expoHaptics();
  if (haptics) {
    impact(haptics, 'light');
    return;
  }
  vibrate(15);
}

/** A firmer one: the photo is taken, the chip is read. */
export function successHaptic(): void {
  const haptics = expoHaptics();
  if (haptics) {
    impact(haptics, 'medium');
    return;
  }
  vibrate(40);
}

/** For tests: forget the remembered permission answer. */
export function resetHapticsForTest(): void {
  mayVibrate = null;
}
