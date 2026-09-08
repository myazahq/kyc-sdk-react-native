import { locationFailureMessage } from '../lib/address-current-location';
import { precisePositionOutcome } from '../services/location';

// ─── Location failures are CLASSIFIED ────────────────────────────────────────
//
// A refused permission, a phone with location switched off, and a fix that
// took too long are three problems with three remedies; the copy names the
// right one, and every line ends with the manual pin, which always works. The
// classifier is exercised against a stubbed expo-location, one branch each.

jest.mock('expo-location', () => ({
  Accuracy: { High: 4, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Location = require('expo-location') as {
  requestForegroundPermissionsAsync: jest.Mock;
  hasServicesEnabledAsync: jest.Mock;
  watchPositionAsync: jest.Mock;
};

describe('locationFailureMessage', () => {
  const reasons = ['denied', 'unavailable', 'timeout', 'unsupported', null] as const;

  it('names a different remedy per reason, always ending with the manual pin', () => {
    const messages = reasons.map(locationFailureMessage);
    expect(new Set(messages.slice(0, 4)).size).toBe(4);
    for (const m of messages) expect(m).toMatch(/place the pin yourself\.$/i);
    expect(locationFailureMessage('denied')).toMatch(/Settings/);
    expect(locationFailureMessage('unavailable')).toMatch(/switched on/);
    expect(locationFailureMessage(null)).toBe(locationFailureMessage('unsupported'));
  });

  it('carries no em dash and reads in UK English', () => {
    for (const r of reasons) {
      const m = locationFailureMessage(r);
      expect(m).not.toContain('—');
      expect(m).not.toMatch(/\bcenter\b|\bcolor\b/);
    }
  });
});

describe('precisePositionOutcome', () => {
  beforeEach(() => {
    jest.useRealTimers();
    Location.requestForegroundPermissionsAsync.mockReset();
    Location.hasServicesEnabledAsync.mockReset();
    Location.watchPositionAsync.mockReset();
    Location.hasServicesEnabledAsync.mockResolvedValue(true);
  });

  it('a refused prompt is denied', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    expect(await precisePositionOutcome()).toEqual({ failure: 'denied' });
  });

  it('a missing location module is unsupported', async () => {
    Location.requestForegroundPermissionsAsync.mockRejectedValue(new Error('no native module'));
    expect(await precisePositionOutcome()).toEqual({ failure: 'unsupported' });
  });

  it('permission granted with the toggle off is unavailable, before any watch', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.hasServicesEnabledAsync.mockResolvedValue(false);
    expect(await precisePositionOutcome()).toEqual({ failure: 'unavailable' });
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('a watch that cannot start is unavailable', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.watchPositionAsync.mockRejectedValue(new Error('provider gone'));
    expect(await precisePositionOutcome()).toEqual({ failure: 'unavailable' });
  });

  it('a precise reading resolves the fix at once', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.watchPositionAsync.mockImplementation(async (_opts: unknown, cb: (pos: unknown) => void) => {
      cb({ coords: { latitude: 4.9, longitude: 8.3, accuracy: 10 }, timestamp: 1, mocked: false });
      return { remove: jest.fn() };
    });
    const outcome = await precisePositionOutcome();
    expect('fix' in outcome && outcome.fix).toMatchObject({ lat: 4.9, lng: 8.3, accuracy: 10, mocked: false });
  });

  it('a silent watch is a timeout once the window elapses', async () => {
    jest.useFakeTimers();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.watchPositionAsync.mockResolvedValue({ remove: jest.fn() });
    const pending = precisePositionOutcome();
    // Let the permission + services probes settle before the clock moves.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(8_100);
    expect(await pending).toEqual({ failure: 'timeout' });
  });
});
