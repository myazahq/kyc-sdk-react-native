// The module wraps expo-location; the rule under test never touches it.
jest.mock('expo-location', () => ({}));

import { pickDeviceFix, RECENT_FIX_MAX_AGE_MS } from '../services/location';

// ─── The attest fix falls back on the one the flow already took ────────────
//
// A confirm-time read that times out must not cost the submission its device
// fix when "Use my location" placed the pin on one a minute earlier (iPhone,
// 2026-09-07). Fresh wins; a recent real fix stands in; a stale or mocked one
// never does.

const at = (ageMs: number, mocked: boolean | null = null) => ({
  lat: 4.93,
  lng: 8.32,
  accuracy: 12,
  timestamp: 1_000_000 - ageMs,
  mocked,
});

describe('pickDeviceFix', () => {
  it('prefers the fresh read', () => {
    const fresh = at(0);
    expect(pickDeviceFix(fresh, at(30_000), 1_000_000)).toBe(fresh);
  });

  it('falls back on a recent fix from earlier in the flow', () => {
    const recent = at(60_000);
    expect(pickDeviceFix(null, recent, 1_000_000)).toBe(recent);
  });

  it('never sends a stale or mocked fix', () => {
    expect(pickDeviceFix(null, at(RECENT_FIX_MAX_AGE_MS + 1), 1_000_000)).toBeNull();
    expect(pickDeviceFix(null, at(10_000, true), 1_000_000)).toBeNull();
    expect(pickDeviceFix(null, null, 1_000_000)).toBeNull();
  });
});
