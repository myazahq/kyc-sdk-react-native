import type { AddressState } from './state';

// ---------------------------------------------------------------------------
// Restoring a saved address pin.
//
// The whole address object is written into session progress verbatim, so the
// snapshot was written by WHATEVER build saved it: coerce every field back to
// its declared type and degrade to restoring less, never to breaking the flow.
//
// Deliberately does NOT restore the device fix (deviceLat / deviceLng /
// deviceAccuracy / capturedAt). That is the attest-presence reading, and it is
// taken fresh at confirm — a stale one would claim the applicant stood at the
// address on a day they did not.
//
// Split from session.ts per the 200-line rule. A MIRROR of the web SDK's
// RESTORE_PROGRESS address branch and the Flutter port.
// ---------------------------------------------------------------------------

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/** The `parts` breakdown, when the snapshot carries an object for it. */
function restoreParts(v: unknown): Pick<AddressState, 'parts'> {
  if (!v || typeof v !== 'object') return {};
  const p = v as Record<string, unknown>;
  return {
    parts: {
      street: str(p['street']),
      area: str(p['area']),
      city: str(p['city']),
      state: str(p['state']),
      postcode: str(p['postcode']),
      country: str(p['country']),
    },
  };
}

/** The picked-label anchor, only when it is a real coordinate pair. */
function restorePickedAt(v: unknown): Pick<AddressState, 'pickedAt'> {
  if (!v || typeof v !== 'object') return {};
  const p = v as Record<string, unknown>;
  return typeof p['lat'] === 'number' && typeof p['lng'] === 'number'
    ? { pickedAt: { lat: p['lat'], lng: p['lng'] } }
    : {};
}

/** The Street View frame, only when every field of it survived. A partial
 *  frame cannot be re-rendered, and half of one is not a capture. */
function restoreStreetView(v: unknown): Pick<AddressState, 'streetView'> {
  if (!v || typeof v !== 'object') return {};
  const sv = v as Record<string, unknown>;
  return typeof sv['panoId'] === 'string' &&
    typeof sv['heading'] === 'number' &&
    typeof sv['pitch'] === 'number' &&
    typeof sv['fov'] === 'number'
    ? {
        streetView: {
          panoId: sv['panoId'],
          heading: sv['heading'],
          pitch: sv['pitch'],
          fov: sv['fov'],
        },
      }
    : {};
}

/**
 * Rebuild the address from a progress snapshot. The caller has already checked
 * that `lat` and `lng` are numbers — without those there is no pin, and there
 * is nothing to restore.
 */
export function restoreAddress(a: Record<string, unknown>): AddressState {
  return {
    lat: a['lat'] as number,
    lng: a['lng'] as number,
    accuracy: typeof a['accuracy'] === 'number' ? a['accuracy'] : null,
    directions: typeof a['directions'] === 'string' ? a['directions'] : '',
    propertyName: typeof a['propertyName'] === 'string' ? a['propertyName'] : '',
    propertyNumber: typeof a['propertyNumber'] === 'string' ? a['propertyNumber'] : '',
    // The resolved line and its breakdown survive a restart too. Dropping them
    // is why a resumed session showed raw coordinates where the applicant had
    // picked an address.
    ...(typeof a['label'] === 'string' ? { label: a['label'] } : {}),
    ...(typeof a['street'] === 'string' ? { street: a['street'] } : {}),
    // The edit-details claims survive a restart like every other typed field.
    ...(typeof a['unit'] === 'string' ? { unit: a['unit'] } : {}),
    ...(typeof a['neighbourhood'] === 'string' ? { neighbourhood: a['neighbourhood'] } : {}),
    ...(typeof a['city'] === 'string' ? { city: a['city'] } : {}),
    ...(typeof a['state'] === 'string' ? { state: a['state'] } : {}),
    ...(typeof a['postcode'] === 'string' ? { postcode: a['postcode'] } : {}),
    ...(a['labelKept'] === true ? { labelKept: true } : {}),
    ...restorePickedAt(a['pickedAt']),
    ...restoreParts(a['parts']),
    ...restoreStreetView(a['streetView']),
  };
}
