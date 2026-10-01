import type { MyazaDeviceIntel } from '../specs/MyazaDeviceIntel.nitro';
import { collectAttestation, type ChallengeApi } from '../services/device-intel/attestation';
import { classifyIntegrity, collectIntegrity } from '../services/device-intel/integrity';
import { collectStableId } from '../services/device-intel/ids';
import { setDeviceIntelNativeForTests } from '../services/device-intel/native';
import { collectFingerprint, withoutAttestation } from '../services/fingerprint';

// ─── Device Intelligence: the native signals (kyc-core DEVICE_INTEL_WIRE.md) ──
//
// The native halves cannot run here, so a fake stands in for the Nitro module.
// What is tested is everything the TypeScript side decides: the token sorting,
// which attestation flavour to ask for, and that every failure (a missing
// module, a refused challenge, a hung native call) ends in OMISSION, never in a
// thrown error or a blocked submission.

function fakeNative(over: Partial<MyazaDeviceIntel> = {}): MyazaDeviceIntel {
  return {
    stableId: () => 'stable-uuid',
    integritySignals: async () => [],
    appAttestSupported: () => true,
    appAttestKeyId: () => '',
    appAttestAttestNewKey: async () => ({ keyId: 'new-key', attestation: 'ATT' }),
    appAttestAssert: async () => 'ASSERT',
    playIntegrityToken: async () => 'PI-TOKEN',
    ...over,
  } as MyazaDeviceIntel;
}

function challengeApi(attest?: boolean): ChallengeApi & { deviceChallenge: jest.Mock } {
  return {
    deviceChallenge: jest.fn(async () => ({
      challengeId: 'ch_1',
      challenge: 'AAAA',
      expiresAt: '2026-10-01T00:00:00Z',
      ...(attest === undefined ? {} : { attest }),
    })),
  };
}

afterEach(() => setDeviceIntelNativeForTests(null));

describe('classifyIntegrity', () => {
  it('reports unknown, never clean, when the checks could not run', () => {
    expect(classifyIntegrity(null)).toEqual({ rooted: null, hooked: null, signals: [] });
  });

  it('reports clean when the checks ran and nothing fired', () => {
    expect(classifyIntegrity([])).toEqual({ rooted: false, hooked: false, signals: [] });
  });

  it('sorts tokens into rooted and hooked, dedupes, and drops unknown ones', () => {
    expect(classifyIntegrity(['frida', 'su_binary', 'made_up', 'frida'])).toEqual({
      rooted: true,
      hooked: true,
      signals: ['frida', 'su_binary'],
    });
    expect(classifyIntegrity(['debugger'])).toMatchObject({ rooted: false, hooked: true });
    expect(classifyIntegrity(['jailbreak_paths'])).toMatchObject({ rooted: true, hooked: false });
  });
});

describe('collectIntegrity', () => {
  it('is omitted when there is no native module', async () => {
    await expect(collectIntegrity()).resolves.toBeUndefined();
  });

  it('classifies what the native checks report', async () => {
    setDeviceIntelNativeForTests(fakeNative({ integritySignals: async () => ['magisk'] }));
    await expect(collectIntegrity()).resolves.toEqual({ rooted: true, hooked: false, signals: ['magisk'] });
  });

  it('reports unknown when the native checks fail', async () => {
    setDeviceIntelNativeForTests(fakeNative({ integritySignals: () => Promise.reject(new Error('x')) }));
    await expect(collectIntegrity()).resolves.toEqual({ rooted: null, hooked: null, signals: [] });
  });
});

describe('collectAttestation — iOS App Attest', () => {
  it('attests a new key when the install has none, sending no keyId', async () => {
    setDeviceIntelNativeForTests(fakeNative());
    const api = challengeApi();
    const out = await collectAttestation({ api, platform: 'ios' });
    expect(api.deviceChallenge.mock.calls[0][0]).toEqual({ platform: 'ios' });
    expect(out).toEqual({ platform: 'ios', kind: 'app_attest', challengeId: 'ch_1', keyId: 'new-key', attestation: 'ATT' });
  });

  it('asserts with the stored key when the server knows it', async () => {
    const assert = jest.fn(async () => 'ASSERT');
    setDeviceIntelNativeForTests(fakeNative({ appAttestKeyId: () => 'kept', appAttestAssert: assert }));
    const api = challengeApi(false);
    const out = await collectAttestation({ api, platform: 'ios' });
    expect(api.deviceChallenge.mock.calls[0][0]).toEqual({ platform: 'ios', keyId: 'kept' });
    expect(assert).toHaveBeenCalledWith('kept', 'AAAA');
    expect(out).toEqual({ platform: 'ios', kind: 'app_attest', challengeId: 'ch_1', keyId: 'kept', assertion: 'ASSERT' });
  });

  it('attests a NEW key when the server does not know the stored one', async () => {
    setDeviceIntelNativeForTests(fakeNative({ appAttestKeyId: () => 'unknown-to-server' }));
    const out = await collectAttestation({ api: challengeApi(true), platform: 'ios' });
    expect(out).toMatchObject({ keyId: 'new-key', attestation: 'ATT' });
    expect(out).not.toHaveProperty('assertion');
  });

  it('is omitted, without spending a challenge, where App Attest is unsupported', async () => {
    setDeviceIntelNativeForTests(fakeNative({ appAttestSupported: () => false }));
    const api = challengeApi();
    await expect(collectAttestation({ api, platform: 'ios' })).resolves.toBeUndefined();
    expect(api.deviceChallenge).not.toHaveBeenCalled();
  });
});

describe('collectAttestation — Android Play Integrity', () => {
  it('is omitted when the server serves no cloud project', async () => {
    setDeviceIntelNativeForTests(fakeNative());
    const api = challengeApi();
    for (const project of [undefined, null, '', '  ']) {
      await expect(
        collectAttestation({ api, platform: 'android', playIntegrityCloudProjectNumber: project }),
      ).resolves.toBeUndefined();
    }
    expect(api.deviceChallenge).not.toHaveBeenCalled();
  });

  it('requests a token for the served project, bound to the challenge', async () => {
    const token = jest.fn(async () => 'PI-TOKEN');
    setDeviceIntelNativeForTests(fakeNative({ playIntegrityToken: token }));
    const api = challengeApi();
    const out = await collectAttestation({ api, platform: 'android', playIntegrityCloudProjectNumber: '123456' });
    expect(api.deviceChallenge.mock.calls[0][0]).toEqual({ platform: 'android' });
    expect(token).toHaveBeenCalledWith('123456', 'AAAA');
    expect(out).toEqual({ platform: 'android', kind: 'play_integrity', challengeId: 'ch_1', token: 'PI-TOKEN' });
  });
});

describe('collectAttestation — failure is omission', () => {
  it('omits when the challenge request fails (404 / 503 / offline)', async () => {
    setDeviceIntelNativeForTests(fakeNative());
    const api = { deviceChallenge: jest.fn(() => Promise.reject(new Error('503'))) };
    await expect(collectAttestation({ api, platform: 'ios' })).resolves.toBeUndefined();
  });

  it('omits when the native call hangs past the bound', async () => {
    setDeviceIntelNativeForTests(fakeNative({ appAttestAttestNewKey: () => new Promise(() => undefined) }));
    await expect(collectAttestation({ api: challengeApi(), platform: 'ios' }, 20)).resolves.toBeUndefined();
  });

  it('omits on a platform with no attestation, and with no native module', async () => {
    await expect(collectAttestation({ api: challengeApi(), platform: 'ios' })).resolves.toBeUndefined();
    setDeviceIntelNativeForTests(fakeNative());
    await expect(collectAttestation({ api: challengeApi(), platform: 'web' })).resolves.toBeUndefined();
  });
});

describe('stableId and the fingerprint additions', () => {
  // Under this runner utils/platform falls back to 'ios', so the stable id is
  // the native (Keychain) one.
  it('reads the native stable id, and omits an empty or oversize one', () => {
    setDeviceIntelNativeForTests(fakeNative());
    expect(collectStableId()).toBe('stable-uuid');
    setDeviceIntelNativeForTests(fakeNative({ stableId: () => '' }));
    expect(collectStableId()).toBeUndefined();
    setDeviceIntelNativeForTests(fakeNative({ stableId: () => 'x'.repeat(129) }));
    expect(collectStableId()).toBeUndefined();
  });

  it('adds stableId, integrity and attestation BESIDE components, never inside', async () => {
    setDeviceIntelNativeForTests(fakeNative({ integritySignals: async () => ['debugger'] }));
    const bare = await collectFingerprint();
    const fp = await collectFingerprint({ attestation: { api: challengeApi(), platform: 'ios' } });
    expect(fp.stableId).toBe('stable-uuid');
    expect(fp.integrity).toEqual({ rooted: false, hooked: true, signals: ['debugger'] });
    expect(fp.attestation).toMatchObject({ kind: 'app_attest', challengeId: 'ch_1' });
    // A new key in components would move every device's server-side hash.
    expect(Object.keys(fp.components).sort()).toEqual(Object.keys(bare.components).sort());
    expect(bare).not.toHaveProperty('attestation');
  });

  it('omits every native field when there is no native module', async () => {
    const fp = await collectFingerprint({ attestation: { api: challengeApi(), platform: 'ios' } });
    expect(fp).not.toHaveProperty('stableId');
    expect(fp).not.toHaveProperty('integrity');
    expect(fp).not.toHaveProperty('attestation');
  });

  it('drops a spent attestation for a second submission, keeping the rest', () => {
    const fp = { components: {}, stableId: 's', attestation: { platform: 'android' as const, kind: 'play_integrity' as const, challengeId: 'c', token: 't' } };
    expect(withoutAttestation(fp)).toEqual({ components: {}, stableId: 's' });
    expect(withoutAttestation(undefined)).toBeUndefined();
  });
});
