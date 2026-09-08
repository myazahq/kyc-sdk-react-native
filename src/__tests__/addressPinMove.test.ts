import { fixApplied, pinMove, withoutPickedLabel } from '../lib/address-pin-move';
import { KEEP_PICKED_LABEL_RADIUS_M, PIN_EPSILON } from '../lib/address-flow';
import type { AddressState } from '../store/state';

// ─── Every way the pin can move ──────────────────────────────────────────────
//
// One rule runs through all of it: a HUMAN-CONFIRMED label is never silently
// discarded, and never silently kept against the applicant's wishes either.
// These are the same cases the web and Flutter SDKs must pass.

const AT = { lat: 4.9324, lng: 8.3254 };

function address(over: Partial<AddressState> = {}): AddressState {
  return {
    ...AT,
    accuracy: null,
    directions: '',
    propertyName: '',
    propertyNumber: '',
    ...over,
  };
}

/** A point `metres` due north of `AT` — one degree of latitude is ~111,320m. */
function north(metres: number): { lat: number; lng: number } {
  return { lat: AT.lat + metres / 111_320, lng: AT.lng };
}

describe('the settle guard', () => {
  it('ignores a move inside the epsilon on BOTH axes', () => {
    const cur = address();
    const drift = { lat: AT.lat + PIN_EPSILON / 2, lng: AT.lng - PIN_EPSILON / 2 };
    expect(pinMove(cur, drift, null).kind).toBe('ignore');
  });

  it('acts when only one axis is inside it', () => {
    const cur = address();
    const move = { lat: AT.lat + PIN_EPSILON / 2, lng: AT.lng + 0.01 };
    expect(pinMove(cur, move, null).kind).not.toBe('ignore');
  });

  it('never ignores the first pin', () => {
    expect(pinMove(null, AT, null).kind).toBe('rebuild');
  });
});

describe('a picked label survives the move', () => {
  const picked = address({ label: '11 Bassey Street', pickedAt: AT });

  it('keeps the label and wants no fresh geocode', () => {
    const move = pinMove(picked, north(40), 12);
    expect(move.kind).toBe('keep-label');
    if (move.kind !== 'keep-label') return;
    expect(move.address.label).toBe('11 Bassey Street');
    expect(move.address.pickedAt).toEqual(AT);
    expect(move.address.accuracy).toBe(12);
  });

  it('leaves an answered "keep" alone inside the credibility radius', () => {
    const move = pinMove({ ...picked, labelKept: true }, north(KEEP_PICKED_LABEL_RADIUS_M - 50), null);
    expect(move.kind === 'keep-label' && move.address.labelKept).toBe(true);
  });

  it('re-opens the question once the pin crosses the radius', () => {
    const move = pinMove({ ...picked, labelKept: true }, north(KEEP_PICKED_LABEL_RADIUS_M + 50), null);
    expect(move.kind === 'keep-label' && move.address.labelKept).toBe(false);
  });
});

describe('a derived label dies with its spot', () => {
  it('rebuilds, keeping what the applicant typed', () => {
    const cur = address({
      label: 'Idim Ita, Calabar',
      propertyNumber: '8',
      directions: 'black gate',
      streetView: { panoId: 'p', heading: 1, pitch: 2, fov: 90 },
    });
    const move = pinMove(cur, north(300), null);
    expect(move.kind).toBe('rebuild');
    if (move.kind !== 'rebuild') return;
    expect(move.address.label).toBeUndefined();
    expect(move.address.propertyNumber).toBe('8');
    expect(move.address.directions).toBe('black gate');
    // A frame captured on a hosted page and resumed here is a capture the
    // applicant already made; a re-pin must not discard it.
    expect(move.address.streetView).toEqual({ panoId: 'p', heading: 1, pitch: 2, fov: 90 });
  });
});

describe('landing on the current fix', () => {
  it('sets no pickedAt, so the label stays derived', () => {
    const next = fixApplied(null, { lat: 1, lng: 2, accuracy: 9, label: 'Somewhere', parts: null });
    expect(next.pickedAt).toBeUndefined();
    expect(next.label).toBe('Somewhere');
    expect(next.accuracy).toBe(9);
  });

  it('keeps the applicant’s typed fields', () => {
    const cur = address({ propertyNumber: '11', directions: 'past the kiosk' });
    const next = fixApplied(cur, { lat: 1, lng: 2, accuracy: null, label: null });
    expect(next.propertyNumber).toBe('11');
    expect(next.directions).toBe('past the kiosk');
  });
});

describe('adopting the pin’s address', () => {
  it('drops the pick and everything anchored to it', () => {
    const cur = address({
      label: '11 Bassey Street',
      pickedAt: AT,
      labelKept: true,
      parts: { street: 'Bassey Street', area: null, city: null, state: null, postcode: null },
      propertyNumber: '8',
    });
    const next = withoutPickedLabel(cur);
    expect(next.label).toBeUndefined();
    expect(next.pickedAt).toBeUndefined();
    expect(next.labelKept).toBeUndefined();
    expect(next.parts).toBeUndefined();
    // The pin and the applicant's own entries are not part of the question.
    expect(next.propertyNumber).toBe('8');
    expect(next.lat).toBe(AT.lat);
  });
});
