import { collectDeviceMetadata, inferDeviceType } from '../services/deviceMetadata';

// expo-device's DeviceType enum: UNKNOWN=0, PHONE=1, TABLET=2, DESKTOP=3, TV=4.
describe('inferDeviceType', () => {
  it('maps the expo-device DeviceType enum to the dashboard classes', () => {
    expect(inferDeviceType({ deviceType: 1 })).toBe('mobile'); // PHONE
    expect(inferDeviceType({ deviceType: 2 })).toBe('tablet'); // TABLET
    expect(inferDeviceType({ deviceType: 3 })).toBe('desktop'); // DESKTOP
    expect(inferDeviceType({ deviceType: 4 })).toBe('unknown'); // TV
    expect(inferDeviceType({ deviceType: 0 })).toBe('unknown'); // UNKNOWN
  });

  it('falls back to the platform when expo-device is unavailable (Node → ios → mobile)', () => {
    expect(inferDeviceType(undefined)).toBe('mobile');
    expect(inferDeviceType({ deviceType: null })).toBe('mobile');
  });
});

describe('collectDeviceMetadata', () => {
  it('always sets a device.type (never the empty dashboard "—")', () => {
    const meta = collectDeviceMetadata();
    expect(meta.device.type).toBeDefined();
    expect(['mobile', 'tablet', 'desktop', 'unknown']).toContain(meta.device.type);
  });

  it('keeps sdkType react-native and includes the device sub-object', () => {
    const meta = collectDeviceMetadata();
    expect(meta.sdkType).toBe('react-native');
    // Under the Node test runner expo-device isn't resolvable, so the type comes
    // from the platform fallback (ios → mobile) and brand/vendor are omitted.
    expect(meta.device.type).toBe('mobile');
    expect(meta.device).toHaveProperty('type');
  });
});
