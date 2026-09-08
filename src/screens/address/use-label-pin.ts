import { useCallback, useEffect, useRef, useState } from 'react';

import { REVERSE_DEBOUNCE_MS, addressVendorsStubbed, SAMPLE_ADDRESS_LINE } from '../../lib/address-flow';
import type { KycStore } from '../../store/state';

// ---------------------------------------------------------------------------
// Reverse geocoding: the pin's human-readable line. Split from
// use-pin-actions.ts (200-line rule).
//
// Debounced, because a drag settles several times, and DROPPED when the pin
// moved again meanwhile: the comparison is exact coordinate equality, so a
// late answer can never label somewhere the applicant has already left.
// Failures are swallowed; the line is a convenience. Display only, and the
// pin's own country is handed to `onGeocoded` so the declaration can follow
// the evidence (lib/country-adoption.ts). Mirrors Flutter's
// address_pin_label.dart.
// ---------------------------------------------------------------------------

export function useLabelPin(
  store: KycStore,
  onGeocoded: (country: string | null | undefined) => void,
): { labelPin: (lat: number, lng: number, delay?: number) => void; labelling: boolean } {
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The summary line shows nothing while a pin has no address, so it has to
  // say WHY: an answer is coming, or none is.
  const [labelling, setLabelling] = useState(false);

  useEffect(
    () => () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
    },
    [],
  );

  const labelPin = useCallback(
    (lat: number, lng: number, delay = REVERSE_DEBOUNCE_MS) => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
      setLabelling(true);
      // SANDBOX never reverse-geocodes: the sample line demonstrates the
      // summary card with no network call (the web SDK's preview/sandbox rule).
      if (addressVendorsStubbed({ environment: store.getState().serverConfig.environment })) {
        reverseTimer.current = setTimeout(() => {
          const cur = store.getState().address;
          if (!cur || cur.lat !== lat || cur.lng !== lng || cur.label) return;
          store.getState().setAddress({ ...cur, label: SAMPLE_ADDRESS_LINE });
          setLabelling(false);
        }, 0);
        return;
      }
      reverseTimer.current = setTimeout(() => {
        void store
          .getState()
          .api.addressReverse(lat, lng)
          .then((r) => {
            const cur = store.getState().address;
            // Exact coordinate equality: anything else means the pin moved
            // while the request was out, and this answer describes a spot the
            // applicant has already left.
            if (!r.line || !cur || cur.lat !== lat || cur.lng !== lng) return;
            store.getState().setAddress({
              ...cur,
              label: r.line,
              ...(r.parts ? { parts: r.parts } : {}),
              // A resolved street retires the typed one (its input hides) —
              // back to UNDEFINED, never '': the details sheet reads '' as
              // deliberately cleared, which suppressed the resolved-street
              // prefill it should be showing.
              ...(r.parts?.street ? { street: undefined } : {}),
            });
            onGeocoded(r.parts?.country);
          })
          .catch(() => undefined)
          .finally(() => setLabelling(false));
      }, delay);
    },
    [onGeocoded, store],
  );

  return { labelPin, labelling };
}
