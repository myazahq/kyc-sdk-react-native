import { resolvePresenceTier, type TierInputs } from '../presence/tier';

// The one table behind presenceStatus().tier. The Flutter mirror
// (presence_tier_test.dart) pins the same rows — keep the two in lockstep.

const base: TierInputs = {
  pinStored: true,
  locationServicesEnabled: true,
  foregroundPermission: 'granted',
  backgroundPermission: 'granted',
  geofenceArmed: true,
  foregroundServiceRunning: false,
};

describe('resolvePresenceTier', () => {
  it('background when the always grant is in and something is armed', () => {
    expect(resolvePresenceTier(base)).toBe('background');
    expect(resolvePresenceTier({ ...base, geofenceArmed: false, foregroundServiceRunning: true })).toBe('background');
  });

  it('foreground when only the while-in-use grant is in, or nothing is armed', () => {
    expect(resolvePresenceTier({ ...base, backgroundPermission: 'denied' })).toBe('foreground');
    expect(resolvePresenceTier({ ...base, geofenceArmed: false })).toBe('foreground');
  });

  it('none without a pin, or without any grant', () => {
    expect(resolvePresenceTier({ ...base, pinStored: false })).toBe('none');
    expect(resolvePresenceTier({ ...base, foregroundPermission: 'denied', backgroundPermission: 'denied' })).toBe('none');
  });

  it('none when location services are OFF, whatever the grants say', () => {
    // The silent case: permission granted, toggle off, no fix ever. The
    // switch outranks every permission because nothing can run without it.
    expect(resolvePresenceTier({ ...base, locationServicesEnabled: false })).toBe('none');
  });
});
