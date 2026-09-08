import { useCallback, useEffect, useMemo, useState } from 'react';

import { fixApplied, pinMove, withoutPickedLabel } from '../../lib/address-pin-move';
import { isAddressStep } from '../../lib/address-flow';
import {
  currentFix as cachedFix,
  currentFixFailure,
  locating as fixInFlight,
  locationFailureMessage,
  prefetchCurrentFix,
  type CurrentFix,
} from '../../lib/address-current-location';
import { adoptionDecision } from '../../lib/country-adoption';
import { configScope } from '../../lib/scope';
import { useLabelPin } from './use-label-pin';
import { fixSourceFor } from './fix-source';
import type { KycStore } from '../../store/state';

// ---------------------------------------------------------------------------
// The pin's mechanics — the shared current-location fix and every way the pin
// can move. Split from use-address-flow.ts (200-line rule); the reverse
// geocode that labels the pin lives in use-label-pin.ts, the fix source in
// fix-source.ts. A MIRROR of the web SDK's steps/address/use-pin-actions.ts.
//
// One rule runs through all of it: a HUMAN-CONFIRMED label is never silently
// discarded, and never silently kept against the applicant's wishes either.
// They decide, via the pin step's keep/update row.
// ---------------------------------------------------------------------------

export interface PinActions {
  currentFix: CurrentFix | null;
  locating: boolean;
  startPrefetch: () => void;
  applyCurrentFix: (onDone?: () => void, opts?: { silent?: boolean }) => Promise<void>;
  setPin: (next: { lat: number; lng: number }, accuracy?: number | null) => void;
  keepPickedLabel: () => void;
  adoptPinAddress: () => void;
  relabelPin: () => void;
  locateToPin: () => Promise<void>;
  /** The declared country follows the evidence: the rule, and why each of
   *  its guards exists, is lib/country-adoption.ts. */
  adoptGeocodedCountry: (country: string | null | undefined, opts?: { explicit?: boolean }) => void;
  /** A reverse geocode is out: the pin has no line YET, rather than none. */
  labelling: boolean;
}

export function usePinActions(
  store: KycStore,
  setError: (message: string | null) => void,
): PinActions {
  const [fix, setFix] = useState<CurrentFix | null>(cachedFix());
  const [fixPending, setFixPending] = useState(fixInFlight());

  const fixSource = useMemo(() => fixSourceFor(store), [store]);

  const adoptGeocodedCountry = useCallback(
    (country: string | null | undefined, opts?: { explicit?: boolean }) => {
      const st = store.getState();
      const decision = adoptionDecision({
        country,
        selectedCountry: st.selectedCountry,
        countryAutoPicked: st.countryAutoPicked,
        scope: configScope(st.config),
        accepted: st.config.proofOfAddress?.countries,
        explicit: opts?.explicit,
      });
      if (!decision) return;
      if (decision.auto) st.setCountryAuto(decision.country);
      else st.setCountry(decision.country);
    },
    [store],
  );
  const { labelPin, labelling } = useLabelPin(store, adoptGeocodedCountry);

  // The fix may have resolved on an earlier step (it is module-level): a
  // guessed declaration is corrected on this mount too, not only when the
  // prefetch happens to finish here.
  useEffect(() => {
    adoptGeocodedCountry(cachedFix()?.parts?.country);
  }, [adoptGeocodedCountry]);

  // ── The shared current-location fix ───────────────────────────────────────
  const startPrefetch = useCallback(() => {
    setFixPending(true);
    void prefetchCurrentFix(fixSource).then((f) => {
      setFix(f);
      setFixPending(false);
      adoptGeocodedCountry(f?.parts?.country);
    });
  }, [adoptGeocodedCountry, fixSource]);

  /**
   * Land the pin ON the current fix — the bootstrap override, used while no
   * address exists yet. It sets NO `pickedAt`, so the resulting label is
   * treated as derived and re-derives freely on the next move.
   */
  const applyCurrentFix = useCallback(
    async (onDone?: () => void, opts?: { silent?: boolean }) => {
      setError(null);
      setFixPending(true);
      // A TAP may retry a previously failed attempt (permission may have been
      // granted since); the silent auto path never re-prompts.
      const f = await prefetchCurrentFix(fixSource, { retry: !opts?.silent });
      setFix(f);
      setFixPending(false);
      adoptGeocodedCountry(f?.parts?.country);
      // The fix can take up to eight seconds, and "Skip for now" is a decision
      // the applicant may make inside that window. A late fix writing an
      // address they declined to give (and an onDone navigating them back onto
      // a step they just left) undoes that decision, so a continuation whose
      // step is no longer in the address flow drops everything on the floor.
      if (!isAddressStep(store.getState().currentStep)) return;
      const cur = store.getState().address;
      // The silent apply resolves seconds after it started, and the person may
      // have picked a searched address meanwhile. A late GPS fix must never
      // overwrite a choice they made; an explicit tap still overrides.
      if (opts?.silent && cur) {
        onDone?.();
        return;
      }
      if (f) {
        store.getState().setAddress(fixApplied(cur, f));
      } else if (!opts?.silent) {
        // Which remedy the person needs depends on WHY the read failed.
        setError(locationFailureMessage(currentFixFailure()));
      }
      onDone?.();
    },
    [adoptGeocodedCountry, fixSource, setError, store],
  );

  const setPin = useCallback(
    (next: { lat: number; lng: number }, accuracy: number | null = null) => {
      const move = pinMove(store.getState().address, next, accuracy);
      if (move.kind === 'ignore') return;
      store.getState().setAddress(move.address);
      // A kept label needs no reverse geocode: it already names the property.
      if (move.kind === 'rebuild') labelPin(next.lat, next.lng);
    },
    [labelPin, store],
  );

  const keepPickedLabel = useCallback(() => {
    const cur = store.getState().address;
    if (cur) store.getState().setAddress({ ...cur, labelKept: true });
  }, [store]);

  /** The applicant adopts the PIN's address: drop the pick, re-derive. */
  const adoptPinAddress = useCallback(() => {
    const cur = store.getState().address;
    if (!cur) return;
    store.getState().setAddress(withoutPickedLabel(cur));
    labelPin(cur.lat, cur.lng, 0);
  }, [labelPin, store]);

  /** Reverse-geocode the current pin's line — for a session restored from a
   *  snapshot saved before labels existed, which would show raw coordinates. */
  const relabelPin = useCallback(() => {
    const cur = store.getState().address;
    if (cur && !cur.label) labelPin(cur.lat, cur.lng, 0);
  }, [labelPin, store]);

  /**
   * The on-map locate control: moves the PIN through `setPin`, so a picked
   * address is protected by the same keep/update prompt as any other pin move
   * and a mistaken tap destroys nothing.
   */
  const locateToPin = useCallback(async () => {
    setError(null);
    setFixPending(true);
    const f = await prefetchCurrentFix(fixSource, { retry: true });
    setFix(f);
    setFixPending(false);
    adoptGeocodedCountry(f?.parts?.country);
    if (f) setPin({ lat: f.lat, lng: f.lng }, f.accuracy);
    else setError(locationFailureMessage(currentFixFailure()));
  }, [adoptGeocodedCountry, fixSource, setError, setPin]);

  return {
    labelling,
    currentFix: fix,
    locating: fixPending,
    startPrefetch,
    applyCurrentFix,
    setPin,
    keepPickedLabel,
    adoptPinAddress,
    relabelPin,
    locateToPin,
    adoptGeocodedCountry,
  };
}
