jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getBackgroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));
jest.mock('../presence/store', () => ({ loadPresencePin: jest.fn() }));
jest.mock('../presence/post', () => ({ postObservations: jest.fn() }));
jest.mock('../presence/geofence', () => ({ armGeofence: jest.fn(), geofenceArmed: jest.fn() }));
jest.mock('../presence/background-store', () => {
  const state: Record<string, unknown> = {};
  return {
    __state: state,
    loadEnterAt: (u: string) => (state[`enter:${u}`] as number | undefined) ?? null,
    saveEnterAt: (u: string, v: number | null) => {
      state[`enter:${u}`] = v ?? undefined;
    },
    loadReporterConfig: (u: string) => state[`cfg:${u}`] ?? null,
    loadFenceUser: () => state.fenceUser ?? null,
    pendingObservations: (u: string) => (state[`q:${u}`] as unknown[]) ?? [],
    replacePending: (u: string, v: unknown[]) => {
      state[`q:${u}`] = v;
    },
    queueObservations: (u: string, fresh: unknown[], merge: (a: unknown[], b: unknown[]) => unknown[]) => {
      state[`q:${u}`] = merge((state[`q:${u}`] as unknown[]) ?? [], fresh);
    },
  };
});

/* eslint-disable @typescript-eslint/no-require-imports */
const Location = require('expo-location') as {
  getBackgroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
  getLastKnownPositionAsync: jest.Mock;
};
const { loadPresencePin } = require('../presence/store') as { loadPresencePin: jest.Mock };
const { postObservations } = require('../presence/post') as { postObservations: jest.Mock };
const geofence = require('../presence/geofence') as { armGeofence: jest.Mock; geofenceArmed: jest.Mock };
const store = require('../presence/background-store') as { __state: Record<string, unknown> };
/* eslint-enable @typescript-eslint/no-require-imports */

import { recordCheckIn, runPeriodicCheckIn } from '../presence/checkin';

// "Still here" check-ins: a confirmed inside reading records a stay while the
// person is still there, instead of waiting for an exit that may never come.

const PIN = { lat: 6.4281, lng: 3.4219, savedAt: Date.now() };
const USER = 'user_42';
const HOUR = 3600_000;
const at = (y: number, mo: number, d: number, h: number) => new Date(y, mo - 1, d, h).getTime();
const inside = (timestamp: number) => ({ lat: PIN.lat, lng: PIN.lng, accuracy: 20, timestamp, mocked: false });

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(store.__state)) delete store.__state[k];
  loadPresencePin.mockReturnValue(PIN);
  postObservations.mockResolvedValue(true);
  geofence.geofenceArmed.mockResolvedValue(true);
  geofence.armGeofence.mockResolvedValue(undefined);
  store.__state[`cfg:${USER}`] = { apiKey: 'pk_test_x' };
});

describe('recordCheckIn', () => {
  it('does nothing when the background tier was never enabled', async () => {
    delete store.__state[`cfg:${USER}`];
    await recordCheckIn(USER, inside(at(2026, 9, 3, 12)));
    expect(store.__state[`enter:${USER}`]).toBeUndefined();
    expect(postObservations).not.toHaveBeenCalled();
  });

  it('opens a stay the fence never stamped', async () => {
    await recordCheckIn(USER, inside(at(2026, 9, 3, 12)));
    expect(store.__state[`enter:${USER}`]).toBe(at(2026, 9, 3, 12));
    expect(postObservations).not.toHaveBeenCalled();
  });

  it('records a long stay now and restarts it, rather than waiting for an exit', async () => {
    store.__state[`enter:${USER}`] = at(2026, 9, 3, 9);
    await recordCheckIn(USER, inside(at(2026, 9, 3, 13)));
    expect(store.__state[`enter:${USER}`]).toBe(at(2026, 9, 3, 13));
    expect(postObservations).toHaveBeenCalledWith('pk_test_x', undefined, USER, [
      expect.objectContaining({ day: '2026-09-03', dwellMinutes: 240, source: 'geofence' }),
    ]);
    expect(store.__state[`q:${USER}`]).toEqual([]);
  });

  it('keeps the queue when the flush fails', async () => {
    postObservations.mockResolvedValue(false);
    store.__state[`enter:${USER}`] = at(2026, 9, 3, 9);
    await recordCheckIn(USER, inside(at(2026, 9, 3, 13)));
    expect(store.__state[`q:${USER}`]).toHaveLength(1);
  });
});

describe('runPeriodicCheckIn', () => {
  const position = (timestamp: number) => ({
    coords: { latitude: PIN.lat, longitude: PIN.lng, accuracy: 30 },
    timestamp,
  });

  beforeEach(() => {
    store.__state.fenceUser = USER;
    Location.getBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  });

  it('does nothing without a fenced user', async () => {
    delete store.__state.fenceUser;
    expect(await runPeriodicCheckIn()).toBe(false);
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('never reads location without the background permission', async () => {
    Location.getBackgroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    expect(await runPeriodicCheckIn()).toBe(false);
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('records the stay from a fresh reading', async () => {
    store.__state[`enter:${USER}`] = at(2026, 9, 3, 18);
    Location.getCurrentPositionAsync.mockResolvedValue(position(at(2026, 9, 3, 18) + 5 * HOUR));
    expect(await runPeriodicCheckIn()).toBe(true);
    expect(postObservations).toHaveBeenCalledWith('pk_test_x', undefined, USER, [
      expect.objectContaining({ day: '2026-09-03', nightPresent: true }),
    ]);
  });

  it('falls back to the last known position, and re-arms a dropped fence', async () => {
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('timeout'));
    Location.getLastKnownPositionAsync.mockResolvedValue(position(at(2026, 9, 3, 12)));
    geofence.geofenceArmed.mockResolvedValue(false);
    expect(await runPeriodicCheckIn()).toBe(true);
    expect(store.__state[`enter:${USER}`]).toBe(at(2026, 9, 3, 12));
    expect(geofence.armGeofence).toHaveBeenCalledWith(USER, PIN);
  });
});
