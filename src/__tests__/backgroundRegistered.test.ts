// enableBackgroundPresence must not arm a fence (or ask for the "always"
// permission) when registerBackgroundPresence() never ran at the app's root:
// the fence would fire into nothing. The SDK now arms background monitoring
// itself after submit (auto-report.ts), so this guard is what stops it
// prompting people for a tier that cannot work in that host app.

const requestForeground = jest.fn();
const requestBackground = jest.fn();
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: requestForeground,
  requestBackgroundPermissionsAsync: requestBackground,
  stopGeofencingAsync: jest.fn(),
}));
jest.mock('../presence/store', () => ({ loadPresencePin: () => ({ lat: 6.5, lng: 3.3, savedAt: new Date().toISOString() }) }));
jest.mock('../presence/foreground-service', () => ({ defineLocationTask: jest.fn() }));
jest.mock('../presence/geofence', () => ({ PRESENCE_GEOFENCE_TASK: 'myaza-presence-geofence', armGeofence: jest.fn() }));

let defined = false;
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(),
  isTaskDefined: () => defined,
}), { virtual: true });

import { backgroundPresenceRegistered, enableBackgroundPresence } from '../presence/background';

describe('backgroundPresenceRegistered', () => {
  beforeEach(() => {
    requestForeground.mockReset();
    requestBackground.mockReset();
  });

  it('refuses, without prompting, when the task was never defined', async () => {
    defined = false;
    expect(backgroundPresenceRegistered()).toBe(false);
    await expect(enableBackgroundPresence({ apiKey: 'pk_live_x', externalUserId: 'user_42' }))
      .resolves.toEqual({ enabled: false, reason: 'not_registered' });
    expect(requestForeground).not.toHaveBeenCalled();
    expect(requestBackground).not.toHaveBeenCalled();
  });

  it('goes on to ask for permission once the task is defined', async () => {
    defined = true;
    requestForeground.mockResolvedValue({ status: 'denied' });
    expect(backgroundPresenceRegistered()).toBe(true);
    await expect(enableBackgroundPresence({ apiKey: 'pk_live_x', externalUserId: 'user_42' }))
      .resolves.toEqual({ enabled: false, reason: 'foreground_denied' });
    expect(requestForeground).toHaveBeenCalledTimes(1);
  });
});
