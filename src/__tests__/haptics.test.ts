// The taps in the hand (services/haptics). expo-haptics is a dependency, but
// an app not yet rebuilt with it has no native half. The regression: such an
// app felt nothing, because the guard for the missing module returned before
// the built-in vibrate it was meant to fall back to.

const vibrate = jest.fn();
const check = jest.fn();
const platform = { OS: 'android' };
let expoPresent = false;
const impactAsync = jest.fn(() => Promise.resolve());
const performAndroidHapticsAsync = jest.fn(() => Promise.resolve());

jest.mock('react-native', () => ({
  Platform: platform,
  Vibration: { vibrate: (ms: number) => vibrate(ms) },
  PermissionsAndroid: { check: (p: string) => check(p) },
}));
jest.mock('../lib/native-module-present', () => ({
  nativeModulePresent: () => expoPresent,
}));
jest.mock('expo-haptics', () => ({
  impactAsync,
  performAndroidHapticsAsync,
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  AndroidHaptics: { Virtual_Key: 'virtual-key', Keyboard_Tap: 'keyboard-tap' },
}));

import { resetHapticsForTest, successHaptic, tapHaptic } from '../services/haptics';

const settle = (): Promise<void> => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.clearAllMocks();
  resetHapticsForTest();
  platform.OS = 'android';
  expoPresent = false;
  check.mockResolvedValue(true);
});

describe('haptics', () => {
  it('falls back to the built-in vibrate when the app was built without expo-haptics', async () => {
    tapHaptic();
    successHaptic();
    await settle();
    expect(vibrate.mock.calls).toEqual([[15], [40]]);
    expect(check).toHaveBeenCalledWith('android.permission.VIBRATE');
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('never vibrates on Android without the permission', async () => {
    check.mockResolvedValue(false);
    tapHaptic();
    successHaptic();
    await settle();
    expect(vibrate).not.toHaveBeenCalled();
  });

  // The same effects as the Flutter SDK's lightImpact and mediumImpact.
  it('on Android plays the system haptic effects, never the vibrator', async () => {
    expoPresent = true;
    tapHaptic();
    successHaptic();
    await settle();
    expect(performAndroidHapticsAsync.mock.calls).toEqual([['virtual-key'], ['keyboard-tap']]);
    expect(impactAsync).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('on an iPhone plays a light and a medium impact', async () => {
    expoPresent = true;
    platform.OS = 'ios';
    tapHaptic();
    successHaptic();
    await settle();
    expect(impactAsync.mock.calls).toEqual([['light'], ['medium']]);
    expect(performAndroidHapticsAsync).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  // iOS has one vibrate, a long buzz: nothing is better than that.
  it('an iPhone built without expo-haptics feels nothing, never the long buzz', async () => {
    platform.OS = 'ios';
    tapHaptic();
    successHaptic();
    await settle();
    expect(vibrate).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
  });
});
