import { readFileSync } from 'fs';
import { join } from 'path';

import { bytesToBase64, fetchImageDataUri } from '../lib/authed-image';

// ─── Server pictures never ride an <Image> header ───────────────────────────
//
// React Native's Android <Image> drops `source.headers`: the server answered
// 401 to every review thumbnail and the card drew an empty box (S24,
// 2026-09-07). The review step must fetch through lib/authed-image, and a
// refused request must surface as a failure rather than a silent blank.

describe('fetchImageDataUri', () => {
  it('rejects with the status when the server refuses', async () => {
    const original = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    try {
      await expect(
        fetchImageDataUri({ uri: 'https://trust.myaza.app/api/kyc/address/static-map', headers: { Authorization: 'Bearer x' } }),
      ).rejects.toThrow('HTTP 401');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://trust.myaza.app/api/kyc/address/static-map',
        expect.objectContaining({ headers: { Authorization: 'Bearer x' } }),
      );
    } finally {
      global.fetch = original;
    }
  });
});

describe('bytesToBase64', () => {
  it.each([0, 1, 2, 3, 4, 5, 97, 256])('matches Node for %d bytes', (n) => {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 73 + 11) % 256);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});

describe('fetchImageDataUri (bytes)', () => {
  it('hands back a data URI of the served type without touching Blob', async () => {
    const original = global.fetch;
    const bytes = Uint8Array.from([255, 216, 255, 224]);
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'image/jpeg; charset=binary' },
      arrayBuffer: async () => bytes.buffer,
      blob: () => {
        throw new Error("Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported");
      },
    })) as unknown as typeof fetch;
    try {
      await expect(fetchImageDataUri({ uri: 'https://x/y', headers: {} })).resolves.toBe(
        `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`,
      );
    } finally {
      global.fetch = original;
    }
  });
});

describe('the review card', () => {
  const source = readFileSync(join(__dirname, '../screens/address/AddressReviewStep.tsx'), 'utf8');

  it('fetches both server pictures through the authed loader', () => {
    expect(source.match(/useAuthedImage\(/g)?.length).toBe(2);
  });

  it('never hands an api source straight to an <Image>', () => {
    expect(source).not.toMatch(/source=\{api\./);
    expect(source).not.toMatch(/const (frameSource|staticMap) = .*api\.\w+Source\(/);
  });
});
