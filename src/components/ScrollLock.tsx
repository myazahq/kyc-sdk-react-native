import { createContext, useContext } from 'react';

// ---------------------------------------------------------------------------
// Lets a control that is dragged with a finger hold the sheet's scroll still
// while the finger is down.
//
// Claiming the JS responder is not enough on iOS: the sheet's scroll view is a
// native UIScrollView whose own pan recogniser still takes a vertical drag, so
// a signature drawn with any downward stroke scrolled the page under the
// finger. Switching the scroll view off for the length of the touch is the one
// thing that holds on both platforms.
//
// The sheet provides it (KycSheet). Outside a sheet it does nothing.
// ---------------------------------------------------------------------------

export type SetScrollLocked = (locked: boolean) => void;

export const ScrollLockContext = createContext<SetScrollLocked>(() => undefined);

export function useScrollLock(): SetScrollLocked {
  return useContext(ScrollLockContext);
}
