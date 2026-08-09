import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isNfcAvailable, nfcUnavailableReason } from '../../emrtd';
import { POLL_MS, settleVerdict, type NfcAvailability } from './availability';

export { settleVerdict, type NfcAvailability } from './availability';

// ---------------------------------------------------------------------------
// Is NFC actually unavailable, or has the native module simply not appeared yet?
//
// These two look identical at first render and mean opposite things. Nitro's
// registry is populated asynchronously, so `isNfcAvailable()` can report false
// for a moment on a phone that reads chips perfectly well — observed on a
// device where three consecutive reloads reported true and the fourth false,
// with no code change between them.
//
// That mattered because the chip step SKIPS ITSELF when NFC is unavailable. A
// single unlucky read therefore deleted the whole NFC screen with nothing
// logged and no way to get back to it — indistinguishable from a phone with no
// radio, which is why it was first reported as "there was no NFC screen".
//
// So: don't decide on one sample. Re-check across a short window and only
// conclude "unavailable" once it has stayed false the whole time. A device
// that genuinely has no radio pays a fraction of a second before skipping; a
// device that has one no longer loses the step to a race.
// ---------------------------------------------------------------------------

/**
 * Availability as a settled verdict rather than a snapshot.
 *
 * `available` is returned as soon as it is true — the wait only ever applies to
 * the negative answer, because that is the one that is destructive if wrong.
 */
export function useNfcAvailability(): NfcAvailability {
  const [state, setState] = useState<NfcAvailability>(() =>
    isNfcAvailable() ? 'available' : 'checking',
  );

  // A verdict reached while the app was not fully foregrounded is not a verdict.
  //
  // `NFCTagReaderSession.readingAvailable` is documented as a device capability,
  // but iOS reports it FALSE while the app is backgrounded or mid-transition —
  // and this flow sends users away and back (a passport arrives from a chat, the
  // phone is unlocked mid-step). A device that reads chips perfectly well then
  // answers "unsupported" once, permanently, for that mount.
  //
  // So a settled negative is re-opened when the app becomes active again. The
  // positive is never re-examined: it cannot become wrong.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') setState((prev) => (prev === 'available' ? prev : 'checking'));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (state !== 'checking') return;

    let live = true;
    const startedAt = Date.now();

    const tick = (): void => {
      if (!live) return;
      const verdict = settleVerdict(isNfcAvailable(), Date.now() - startedAt, nfcUnavailableReason());
      if (verdict !== 'checking') {
        setState(verdict);
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };

    let timer = setTimeout(tick, POLL_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // Runs once: after the first resolution the verdict is final for this mount.
  }, [state]);

  return state;
}
