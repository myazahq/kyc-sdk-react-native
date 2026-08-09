import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * The height the software keyboard currently covers, as a bottom inset.
 *
 * Exists for ANDROID. The flow presents inside a `statusBarTranslucent`
 * `<Modal>`, and on Android that combination disables `adjustResize` — the
 * window never shrinks for the keyboard, so a ScrollView inside it never
 * learns the bottom half of the screen is gone and the focused input stays
 * buried. (iOS doesn't use this: the ScrollView's
 * `automaticallyAdjustKeyboardInsets` is the platform's own, better handling —
 * it insets AND reveals the focused input.)
 *
 * Padding the scroll content by this amount restores what adjustResize would
 * have done: everything above the keyboard is reachable by scrolling.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setInset(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
}
