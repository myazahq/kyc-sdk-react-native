// ---------------------------------------------------------------------------
// Address state shaping — the pure half of "the pin moved".
//
// Split from address-flow.ts (the step model + the label rules) per the
// 200-line rule, and a MIRROR of the web SDK's steps/address-helpers.ts.
//
// The device fixes themselves live in services/location.ts, which owns the
// expo-location calls; nothing here touches hardware.
// ---------------------------------------------------------------------------

/**
 * The address state after picking a search candidate: the pin lands on the
 * hit, the applicant's typed fields survive, and the house number prefills
 * ONLY when they have not typed one (their word always beats the map's).
 *
 * The shape is FIXED on purpose. Spreading it as the new address DROPS
 * `label`, `parts`, `pickedAt`, `labelKept`, `streetView` and the device
 * fields, so a caller that wants one of those back has to re-add it
 * explicitly rather than carrying a stale label to a new spot by accident.
 */
export function pickedAddressState(
  prev:
    | { directions?: string; propertyName?: string; propertyNumber?: string; street?: string }
    | null
    | undefined,
  hit: { lat: number; lng: number; houseNumber: string | null },
): {
  lat: number;
  lng: number;
  accuracy: null;
  directions: string;
  propertyName: string;
  propertyNumber: string;
  street: string | undefined;
} {
  return {
    lat: hit.lat,
    lng: hit.lng,
    accuracy: null,
    directions: prev?.directions ?? '',
    propertyName: prev?.propertyName ?? '',
    propertyNumber: prev?.propertyNumber?.trim() ? prev.propertyNumber : (hit.houseNumber ?? ''),
    // Undefined, not '': the details sheet reads '' as "deliberately cleared"
    // and undefined as "never touched" — initialising with '' suppressed the
    // resolved-street prefill forever.
    street: prev?.street,
  };
}
