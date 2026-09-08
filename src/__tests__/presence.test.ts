import { haversineMeters, insideFence, localDayAndNight } from '../presence/math';
import { PIN_TTL_DAYS, pinExpired } from '../presence/store';

// The on-device presence math — what decides whether a fix counts as "at the
// address" and what local day/night it lands on. This is the whole privacy
// contract: only these DERIVED values ever leave the phone.

describe('haversineMeters', () => {
  it('zero distance for the same point', () => {
    expect(haversineMeters(6.4281, 3.4219, 6.4281, 3.4219)).toBe(0);
  });

  it('roughly 111 km per degree of latitude', () => {
    const d = haversineMeters(6, 3, 7, 3);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });
});

describe('insideFence', () => {
  const pin = { lat: 6.4281, lng: 3.4219 };

  it('a fix at the pin is inside', () => {
    expect(insideFence(pin, { lat: 6.4281, lng: 3.4219, accuracy: 10 })).toBe(true);
  });

  it('a fix ~180 m away is inside the 250 m base radius', () => {
    expect(insideFence(pin, { lat: 6.4297, lng: 3.4219, accuracy: 10 })).toBe(true);
  });

  it('a fix ~2 km away is outside', () => {
    expect(insideFence(pin, { lat: 6.4461, lng: 3.4219, accuracy: 10 })).toBe(false);
  });

  it('poor accuracy widens the fence, capped at 1 km', () => {
    const kmAway = { lat: 6.4361, lng: 3.4219 }; // ~890 m
    expect(insideFence(pin, { ...kmAway, accuracy: 950 })).toBe(true);
    const farAway = { lat: 6.4471, lng: 3.4219 }; // ~2.1 km
    expect(insideFence(pin, { ...farAway, accuracy: 5000 })).toBe(false);
  });
});

describe('localDayAndNight', () => {
  it('formats the DEVICE-local day and flags the night band', () => {
    const night = localDayAndNight(new Date(2026, 7, 20, 22, 30));
    expect(night.day).toBe('2026-08-20');
    expect(night.nightPresent).toBe(true);

    const morning = localDayAndNight(new Date(2026, 7, 20, 9, 0));
    expect(morning.nightPresent).toBe(false);

    const smallHours = localDayAndNight(new Date(2026, 7, 21, 2, 0));
    expect(smallHours.day).toBe('2026-08-21');
    expect(smallHours.nightPresent).toBe(true);
  });
});

describe('pinExpired', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const at = (daysAgo: number) => ({
    lat: 4.9,
    lng: 8.3,
    savedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
  });

  it('keeps a pin alive through the whole plausible watch lifetime', () => {
    expect(pinExpired(at(44))).toBe(false);
    // Exactly the boundary is still alive: expiry is strictly past the TTL,
    // and the Flutter mirror compares the same way.
    expect(pinExpired(at(PIN_TTL_DAYS))).toBe(false);
  });

  it('expires a pin past the TTL so the device stops sampling location', () => {
    expect(pinExpired(at(PIN_TTL_DAYS + 1))).toBe(true);
  });

  it('treats an unparseable stamp as expired, never as immortal', () => {
    expect(pinExpired({ lat: 4.9, lng: 8.3, savedAt: 'garbage' })).toBe(true);
  });
});
