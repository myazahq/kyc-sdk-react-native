import { pickedAddressState } from './address-helpers';
import { KEEP_PICKED_LABEL_RADIUS_M, PIN_EPSILON, metersBetween } from './address-flow';
import type { AddressState } from '../store/state';

// ---------------------------------------------------------------------------
// What the address becomes when the pin moves.
//
// Pure, so the rules that decide whether a human-confirmed label survives can
// be read and tested without a map, a store, or a GPS. The hook does the
// dispatching; these decide.
//
// A MIRROR of the web SDK's setPin / applyCurrentFix / adoptPinAddress bodies.
// ---------------------------------------------------------------------------

/** Where a pin move lands. `ignore` means the map settled, it did not move. */
export type PinMove =
  | { kind: 'ignore' }
  /** The picked label stands: only the coordinates (and the keep flag) change,
   *  and NO reverse geocode is wanted. */
  | { kind: 'keep-label'; address: AddressState }
  /** The address is rebuilt around the new spot and wants a fresh label. */
  | { kind: 'rebuild'; address: AddressState };

export function pinMove(
  cur: AddressState | null,
  next: { lat: number; lng: number },
  accuracy: number | null,
): PinMove {
  // A map settle within about a metre of the current pin is the tile roundtrip
  // drifting, not a move. Acting on it rebuilt the address WITHOUT its label,
  // and the reverse geocoder then overwrote a searched-and-picked address with
  // the area line. BOTH axes must be inside the epsilon.
  if (
    cur &&
    Math.abs(cur.lat - next.lat) < PIN_EPSILON &&
    Math.abs(cur.lng - next.lng) < PIN_EPSILON
  ) {
    return { kind: 'ignore' };
  }

  // A PICKED label names the property; the pin refines where its roof is, so
  // the label survives the move and the applicant decides its fate. Crossing
  // the credibility radius only resets a prior "keep", so the question is
  // asked again exactly once out there.
  if (cur?.pickedAt && cur.label) {
    const beyond = metersBetween(cur.pickedAt, next) > KEEP_PICKED_LABEL_RADIUS_M;
    return {
      kind: 'keep-label',
      address: {
        ...cur,
        lat: next.lat,
        lng: next.lng,
        accuracy,
        ...(beyond && cur.labelKept ? { labelKept: false } : {}),
      },
    };
  }

  // Typed fields AND a captured Street View frame survive a re-pin; the
  // coordinates always win. A DERIVED label dies with the old spot.
  return {
    kind: 'rebuild',
    address: {
      ...pickedAddressState(cur, { lat: next.lat, lng: next.lng, houseNumber: null }),
      accuracy,
      ...(cur?.streetView ? { streetView: cur.streetView } : {}),
    },
  };
}

/**
 * The address after landing on the device's current fix — the bootstrap
 * override, used while no address exists yet.
 *
 * It sets NO `pickedAt`, so the resulting label counts as DERIVED and
 * re-derives freely on the next move. A fix is where the phone is, not a
 * property the applicant named.
 */
export function fixApplied(
  cur: AddressState | null,
  fix: { lat: number; lng: number; accuracy: number | null; label: string | null; parts?: unknown },
): AddressState {
  return {
    ...pickedAddressState(cur, { lat: fix.lat, lng: fix.lng, houseNumber: null }),
    accuracy: fix.accuracy,
    ...(cur?.streetView ? { streetView: cur.streetView } : {}),
    ...(fix.label ? { label: fix.label } : {}),
    ...(fix.parts ? { parts: fix.parts as AddressState['parts'] } : {}),
  };
}

/** The address with the human-confirmed label dropped, ready to be relabelled
 *  from the pin. */
export function withoutPickedLabel(cur: AddressState): AddressState {
  const { label: _l, parts: _p, pickedAt: _a, labelKept: _k, ...rest } = cur;
  return rest;
}
