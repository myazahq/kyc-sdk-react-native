import { restoreAddress } from '../store/address';
import { addressPayload } from '../config/addressCollection';
import type { AddressState } from '../store/state';

// A progress snapshot was written by WHATEVER build saved it, so every field is
// coerced back to its declared type on the way in. The failure this prevents is
// a resumed session handing a screen a shape it cannot read.

describe('restoreAddress', () => {
  it('restores the pin, the confirmed line and its breakdown', () => {
    const out = restoreAddress({
      lat: 4.9324,
      lng: 8.3254,
      accuracy: 12,
      directions: 'black gate opposite the kiosk',
      propertyNumber: '11',
      label: '11 Bassey Street, Idim Ita, Calabar',
      street: 'Wisdom Close',
      labelKept: true,
      pickedAt: { lat: 4.9323, lng: 8.3253 },
      parts: { street: 'Bassey Street', city: 'Calabar' },
      streetView: { panoId: 'pano_1', heading: 90, pitch: 0, fov: 75 },
    });

    expect(out).toMatchObject({
      lat: 4.9324,
      lng: 8.3254,
      accuracy: 12,
      directions: 'black gate opposite the kiosk',
      propertyNumber: '11',
      label: '11 Bassey Street, Idim Ita, Calabar',
      street: 'Wisdom Close',
      labelKept: true,
      pickedAt: { lat: 4.9323, lng: 8.3253 },
      streetView: { panoId: 'pano_1', heading: 90, pitch: 0, fov: 75 },
    });
    // Every key of the breakdown is present, unset ones as null.
    expect(out.parts).toEqual({
      street: 'Bassey Street',
      area: null,
      city: 'Calabar',
      state: null,
      postcode: null,
      country: null,
    });
  });

  it('drops a wrong-typed field rather than restoring it', () => {
    const out = restoreAddress({
      lat: 4.9324,
      lng: 8.3254,
      accuracy: 'very',
      directions: 42,
      propertyName: null,
      propertyNumber: { number: 11 },
      label: 99,
      street: false,
      labelKept: 'yes',
      pickedAt: { lat: 4.93 },
      parts: 'Calabar',
      streetView: { panoId: 'pano_1', heading: 90 },
    });

    expect(out.accuracy).toBeNull();
    expect(out.directions).toBe('');
    expect(out.propertyName).toBe('');
    expect(out.propertyNumber).toBe('');
    expect(out.label).toBeUndefined();
    expect(out.street).toBeUndefined();
    // 'yes' is not the answer the applicant gave, so the keep/update question
    // is asked again rather than assumed answered.
    expect(out.labelKept).toBeUndefined();
    expect(out.pickedAt).toBeUndefined();
    expect(out.parts).toBeUndefined();
    // A half-restored frame cannot be re-rendered, so it is not a capture.
    expect(out.streetView).toBeUndefined();
  });

  it('never restores the attest fix, which is taken fresh at confirm', () => {
    const out = restoreAddress({
      lat: 4.9324,
      lng: 8.3254,
      deviceLat: 4.9,
      deviceLng: 8.3,
      deviceAccuracy: 9,
      capturedAt: '2026-08-30T10:00:00.000Z',
    });
    expect(out.deviceLat).toBeUndefined();
    expect(out.deviceLng).toBeUndefined();
    expect(out.deviceAccuracy).toBeUndefined();
    expect(out.capturedAt).toBeUndefined();
  });
});

describe('addressPayload', () => {
  const base: AddressState = {
    lat: 4.9324,
    lng: 8.3254,
    accuracy: null,
    directions: '  ',
    propertyName: '',
    propertyNumber: '  11 ',
  };

  it('sends the pin, the confirmed line and the typed fields, trimmed', () => {
    const out = addressPayload({
      ...base,
      label: ' 11 Bassey Street, Calabar ',
      street: ' Wisdom Close ',
      accuracy: 12,
    });
    expect(out).toEqual({
      lat: 4.9324,
      lng: 8.3254,
      label: '11 Bassey Street, Calabar',
      accuracy: 12,
      propertyNumber: '11',
      street: 'Wisdom Close',
    });
  });

  it('omits the display-only bookkeeping the server has no use for', () => {
    const out = addressPayload({
      ...base,
      label: '11 Bassey Street',
      pickedAt: { lat: 4.9323, lng: 8.3253 },
      labelKept: true,
      parts: { street: 'Bassey Street', area: null, city: null, state: null, postcode: null },
    }) as Record<string, unknown>;
    expect(out['pickedAt']).toBeUndefined();
    expect(out['labelKept']).toBeUndefined();
    expect(out['parts']).toBeUndefined();
  });

  it('sends the device fix only as a pair', () => {
    // One coordinate of a position is not a position.
    const half = addressPayload({ ...base, deviceLat: 4.9, deviceAccuracy: 9 }) as Record<
      string,
      unknown
    >;
    expect(half['deviceLat']).toBeUndefined();
    expect(half['deviceAccuracy']).toBeUndefined();

    const whole = addressPayload({
      ...base,
      deviceLat: 4.9,
      deviceLng: 8.3,
      deviceAccuracy: 9,
      capturedAt: '2026-08-30T10:00:00.000Z',
    });
    expect(whole).toMatchObject({
      deviceLat: 4.9,
      deviceLng: 8.3,
      deviceAccuracy: 9,
      capturedAt: '2026-08-30T10:00:00.000Z',
    });
  });

  it('carries a Street View frame a hosted session began', () => {
    const frame = { panoId: 'pano_1', heading: 90, pitch: 0, fov: 75 };
    expect(addressPayload({ ...base, streetView: frame }).streetView).toEqual(frame);
  });
});
