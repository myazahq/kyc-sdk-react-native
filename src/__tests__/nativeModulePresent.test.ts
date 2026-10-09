import { nativeModulePresent } from '../lib/native-module-present';

// An optional package whose JavaScript is installed but whose native module
// is not in the build must never be loaded: its initialisation throws, and a
// release build treats that as fatal whatever try/catch surrounds the load.

describe('nativeModulePresent', () => {
  it('is false when Expo says the native module is absent', () => {
    expect(nativeModulePresent('ExpoBackgroundTask', () => null)).toBe(false);
    expect(nativeModulePresent('ExpoBackgroundTask', () => undefined)).toBe(false);
  });

  it('is true when Expo returns the module', () => {
    expect(nativeModulePresent('ExpoTaskManager', () => ({}))).toBe(true);
  });

  it('is false when the lookup itself throws', () => {
    expect(
      nativeModulePresent('ExpoTaskManager', () => {
        throw new Error('boom');
      }),
    ).toBe(false);
  });

  it('is true when there is no lookup to ask, leaving the caller to guard the load', () => {
    expect(nativeModulePresent('ExpoTaskManager', null)).toBe(true);
  });

  it('asks for the module by the name it was given', () => {
    const asked: string[] = [];
    nativeModulePresent('ExpoBrightness', (name) => {
      asked.push(name);
      return {};
    });
    expect(asked).toEqual(['ExpoBrightness']);
  });
});
