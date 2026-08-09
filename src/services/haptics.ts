import { Vibration } from 'react-native';

/**
 * A success buzz, best-effort.
 *
 * A chip read has no shutter, no sound and nothing physical — the haptic is
 * what makes it land as a completed action rather than a screen that quietly
 * changed.
 *
 * `expo-haptics` gives the proper taptic pattern, but it is NOT a dependency of
 * this SDK: adding one for a single buzz would force every consumer to rebuild.
 * So it is loaded on demand where the host app already has it, and otherwise
 * this falls back to RN's built-in vibrate, which needs nothing. Hardware with
 * no taptic engine does nothing at all, which is also fine.
 */
export function successHaptic(): void {
  try {
    // Typed structurally rather than via `typeof import(...)`: the package is
    // not a dependency here, so a type import would fail to resolve and break
    // the build for the sake of a buzz.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const haptics = require('expo-haptics') as {
      notificationAsync: (t: unknown) => Promise<void>;
      NotificationFeedbackType: { Success: unknown };
    };
    void haptics
      .notificationAsync(haptics.NotificationFeedbackType.Success)
      .catch(() => undefined);
    return;
  } catch {
    // Not installed — fall through to the built-in.
  }
  try {
    Vibration.vibrate(30);
  } catch {
    // A device that refuses to vibrate is not a problem worth reporting.
  }
}
