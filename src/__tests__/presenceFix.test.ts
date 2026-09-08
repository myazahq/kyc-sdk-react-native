jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Location = require('expo-location') as {
  requestForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
  getLastKnownPositionAsync: jest.Mock;
};

import { currentPosition, LAST_KNOWN_MAX_AGE_MS } from '../services/location';

// ─── The presence report's one fix ───────────────────────────────────────────
//
// Every RN report on the iPhone came back `no_fix` while Flutter's reported
// fine (2026-09-08): Expo's iOS read waits for a fix that MEETS the requested
// accuracy, and High indoors never lands inside the window. The fix now
// resolves in rungs: a Balanced read, the platform's last known position, the
// module's own recent fix. The null case runs FIRST, before any fix is
// remembered at module level.

const pos = (lat: number, lng: number, timestamp: number) => ({
  coords: { latitude: lat, longitude: lng, accuracy: 30 },
  timestamp,
});

beforeEach(() => {
  jest.clearAllMocks();
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
});

describe('currentPosition', () => {
  it('reports nothing when the phone cannot place itself at all', async () => {
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('timeout'));
    Location.getLastKnownPositionAsync.mockResolvedValue(null);
    expect(await currentPosition()).toBeNull();
  });

  it('never reads without the permission', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    expect(await currentPosition()).toBeNull();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('falls back to a recent last-known position when the fresh read fails', async () => {
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('timeout'));
    Location.getLastKnownPositionAsync.mockResolvedValue(pos(4.93, 8.32, Date.now() - 60_000));
    const fix = await currentPosition();
    expect(fix).toMatchObject({ lat: 4.93, lng: 8.32 });
    expect(Location.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: LAST_KNOWN_MAX_AGE_MS });
  });

  it('takes a fresh fix at balanced accuracy when one lands', async () => {
    Location.getCurrentPositionAsync.mockResolvedValue(pos(6.45, 3.39, Date.now()));
    const fix = await currentPosition();
    expect(fix).toMatchObject({ lat: 6.45, lng: 3.39 });
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 3 });
    expect(Location.getLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  it('keeps the fix it last took when both platform reads fail', async () => {
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('timeout'));
    Location.getLastKnownPositionAsync.mockResolvedValue(null);
    // The previous test's fresh fix, seconds old.
    expect(await currentPosition()).toMatchObject({ lat: 6.45, lng: 3.39 });
  });
});
