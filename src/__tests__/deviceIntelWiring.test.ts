import { readFileSync } from 'fs';
import { join } from 'path';

import { createKYCApi, uploadHeaders } from '../services/api';
import {
  submissionFingerprint,
  uploadDeviceIdSource,
} from '../services/device-intel/submission';

// ─── Device Intelligence: the upload header and the gate ─────────────────────
//
// Every upload carries `X-Myaza-Device-Id` (the fingerprint's deviceId) while
// the workflow's deviceIntelligence is on, and NOTHING is collected while it is
// off. A device id that cannot be read costs the header, never the upload.

const mockPersistentDeviceId = jest.fn<Promise<string | undefined>, []>();
jest.mock('../services/fingerprint-sources', () => ({
  ...jest.requireActual('../services/fingerprint-sources'),
  persistentDeviceId: () => mockPersistentDeviceId(),
}));

// Loaded after the mock so it sees the mocked source.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { cachedDeviceId, resetDeviceIdCacheForTests } = require('../services/device-intel/ids') as typeof import('../services/device-intel/ids');

beforeEach(() => {
  resetDeviceIdCacheForTests();
  mockPersistentDeviceId.mockReset();
});

describe('uploadHeaders', () => {
  const base = { Authorization: 'Bearer pk', 'X-SDK-Version': '1' };

  it('adds the device id when there is one', async () => {
    await expect(uploadHeaders(base, async () => 'dev-1')).resolves.toEqual({ ...base, 'X-Myaza-Device-Id': 'dev-1' });
  });

  it('sends no header when the gate is off, the id is unknown, or reading it fails', async () => {
    await expect(uploadHeaders(base, undefined)).resolves.toEqual(base);
    await expect(uploadHeaders(base, async () => undefined)).resolves.toEqual(base);
    await expect(uploadHeaders(base, () => Promise.reject(new Error('no')))).resolves.toEqual(base);
  });
});

describe('the upload request', () => {
  const realFetch = globalThis.fetch;
  const realXhr = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;

  beforeEach(() => {
    // uriToBlob reads the local file through XHR; hand back a small JPEG blob.
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = class {
      response: Blob | null = null;
      responseType = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      open(): void {}
      send(): void {
        this.response = new Blob(['x'], { type: 'image/jpeg' });
        this.onload?.();
      }
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = realXhr;
  });

  async function headersSent(api: ReturnType<typeof createKYCApi>): Promise<Record<string, string>> {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ mediaId: 'm1' }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(api.upload({ uri: 'file:///a.jpg', type: 'image/jpeg' }, 'selfie')).resolves.toBe('m1');
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    return init.headers as Record<string, string>;
  }

  it('carries X-Myaza-Device-Id when a device id source is given', async () => {
    const api = createKYCApi('https://api.example', 'pk_test_x', { deviceId: async () => 'idfv-123' });
    expect((await headersSent(api))['X-Myaza-Device-Id']).toBe('idfv-123');
  });

  it('carries no device header without one', async () => {
    const api = createKYCApi('https://api.example', 'pk_test_x');
    expect(await headersSent(api)).not.toHaveProperty('X-Myaza-Device-Id');
  });
});

describe('cachedDeviceId', () => {
  it('reads the id once and reuses it', async () => {
    mockPersistentDeviceId.mockResolvedValue('abc');
    await expect(cachedDeviceId()).resolves.toBe('abc');
    await expect(cachedDeviceId()).resolves.toBe('abc');
    expect(mockPersistentDeviceId).toHaveBeenCalledTimes(1);
  });

  it('asks again after the OS declined, rather than caching the miss', async () => {
    mockPersistentDeviceId.mockResolvedValueOnce(undefined).mockResolvedValueOnce('late');
    await expect(cachedDeviceId()).resolves.toBeUndefined();
    await expect(cachedDeviceId()).resolves.toBe('late');
  });

  it('omits an id longer than the 64-character header cap', async () => {
    mockPersistentDeviceId.mockResolvedValue('x'.repeat(65));
    await expect(cachedDeviceId()).resolves.toBeUndefined();
  });
});

describe('the deviceIntelligence gate', () => {
  const api = { deviceChallenge: jest.fn() };

  it('collects nothing, and sends no header, when switched off', async () => {
    const collect = jest.fn();
    await expect(submissionFingerprint({ config: { deviceIntelligence: false }, api }, collect)).resolves.toBeUndefined();
    expect(collect).not.toHaveBeenCalled();
    expect(uploadDeviceIdSource({ deviceIntelligence: false })).toBeUndefined();
  });

  it('collects with an attestation context when on (absent means on)', async () => {
    const collect = jest.fn(async () => ({ components: {} }));
    await submissionFingerprint(
      { config: {}, api, playIntegrityCloudProjectNumber: '42', platform: 'android' },
      collect,
    );
    expect(collect).toHaveBeenCalledWith({
      attestation: { api, platform: 'android', playIntegrityCloudProjectNumber: '42' },
    });
    expect(typeof uploadDeviceIdSource({})).toBe('function');
  });

  it('turns a failed collection into no fingerprint, never a failed submission', async () => {
    const collect = jest.fn(() => Promise.reject(new Error('boom')));
    await expect(submissionFingerprint({ config: {}, api }, collect)).resolves.toBeUndefined();
  });
});

describe('store wiring', () => {
  // The omission is of a LINE: a store that stopped passing these would still
  // typecheck and submit, just without the signal.
  const src = readFileSync(join(__dirname, '..', 'store', 'kycStore.ts'), 'utf8');

  it('gives the API client the gated device id source', () => {
    expect(src).toContain('deviceId: uploadDeviceIdSource(config)');
  });

  it('collects through the gate, with the served Play Integrity project', () => {
    expect(src).toContain('submissionFingerprint({');
    expect(src).toContain('state.serverConfig.playIntegrityCloudProjectNumber');
  });

  it('does not replay the spent attestation on the applicant submission', () => {
    expect(src).toContain('withoutAttestation(fingerprint)');
  });

  it('threads the cloud project number from both config sources', () => {
    const gate = readFileSync(join(__dirname, '..', 'services', 'workflowGate.ts'), 'utf8');
    expect(gate).toContain('deviceAttestation?.playIntegrityCloudProjectNumber');
    expect(src).toContain('deviceAttestation?.playIntegrityCloudProjectNumber');
  });
});
