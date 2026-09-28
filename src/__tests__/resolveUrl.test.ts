import { detectEnvironment, resolveBaseUrl, normalizeAppearanceUrls, normalizeDevAssetUrl } from '../services/resolveUrl';

describe('detectEnvironment', () => {
  it('maps each prefix (pk_ and sk_) to its environment', () => {
    expect(detectEnvironment('pk_dev_abc')).toBe('development');
    expect(detectEnvironment('sk_dev_abc')).toBe('development');
    expect(detectEnvironment('pk_test_abc')).toBe('sandbox');
    expect(detectEnvironment('sk_test_abc')).toBe('sandbox');
    expect(detectEnvironment('pk_live_abc')).toBe('production');
    expect(detectEnvironment('sk_live_abc')).toBe('production');
  });

  it('throws on an unrecognized / malformed key', () => {
    expect(() => detectEnvironment('nope')).toThrow(/Invalid Myaza API key/);
    expect(() => detectEnvironment('pk_prod_abc')).toThrow();
    expect(() => detectEnvironment('')).toThrow();
  });
});

describe('resolveBaseUrl', () => {
  it('uses the hardcoded sandbox/production URLs and ignores devUrl', () => {
    expect(resolveBaseUrl('pk_test_abc')).toBe('https://trust.myaza.app');
    expect(resolveBaseUrl('pk_test_abc', 'http://example.test')).toBe('https://trust.myaza.app');
    expect(resolveBaseUrl('pk_live_abc')).toBe('https://trust.myaza.app');
  });

  it('uses devUrl for development keys, defaulting to localhost', () => {
    expect(resolveBaseUrl('pk_dev_abc', 'http://192.168.1.5:3001')).toBe('http://192.168.1.5:3001');
    // Under the Node test runner Platform falls back to iOS → localhost.
    expect(resolveBaseUrl('pk_dev_abc')).toBe('http://localhost:3001');
  });
});

describe('normalizeDevAssetUrl', () => {
  it('rewrites a localhost-family asset origin to the dev base origin', () => {
    expect(normalizeDevAssetUrl('http://localhost:3001/api/kyc/branding/logo/x', 'http://10.0.2.2:3001')).toBe(
      'http://10.0.2.2:3001/api/kyc/branding/logo/x',
    );
    expect(normalizeDevAssetUrl('http://127.0.0.1:3001/logo.png', 'http://10.0.2.2:3001')).toBe(
      'http://10.0.2.2:3001/logo.png',
    );
  });

  it('is a no-op when the base origin already matches', () => {
    expect(normalizeDevAssetUrl('http://localhost:3001/logo.png', 'http://localhost:3001')).toBe(
      'http://localhost:3001/logo.png',
    );
  });

  it('never touches production/CDN URLs or an https base', () => {
    // Public CDN asset, dev base → left alone (not a localhost host).
    expect(normalizeDevAssetUrl('https://cdn.myaza.app/logo.png', 'http://10.0.2.2:3001')).toBe(
      'https://cdn.myaza.app/logo.png',
    );
    // https base (sandbox/prod) → never rewrites, even a localhost asset.
    expect(normalizeDevAssetUrl('http://localhost:3001/logo.png', 'https://trust.myaza.app')).toBe(
      'http://localhost:3001/logo.png',
    );
  });

  it('passes through undefined', () => {
    expect(normalizeDevAssetUrl(undefined, 'http://10.0.2.2:3001')).toBeUndefined();
  });
});

// Regression (2026-09-28): over a USB tunnel, or after the Mac rejoined a
// network, the server's branding images carried a LAN host the phone could not
// reach, and only localhost-family hosts were rewritten.
describe('server branding images in local development', () => {
  const base = 'http://localhost:3001';

  it('moves a branding URL on any host onto the dev base', () => {
    expect(normalizeDevAssetUrl('http://172.20.10.3:3001/api/kyc/branding/logo/abc', base)).toBe(
      'http://localhost:3001/api/kyc/branding/logo/abc',
    );
  });

  it('leaves another host\'s non-branding image alone', () => {
    expect(normalizeDevAssetUrl('http://172.20.10.3:3001/uploads/x.png', base)).toBe('http://172.20.10.3:3001/uploads/x.png');
  });

  it('never rewrites against a production (https) base', () => {
    expect(normalizeDevAssetUrl('http://172.20.10.3:3001/api/kyc/branding/logo/abc', 'https://trust.myaza.app')).toBe(
      'http://172.20.10.3:3001/api/kyc/branding/logo/abc',
    );
  });

  it('rewrites a workflow\'s logo and its dark theme logo, and nothing else', () => {
    const out = normalizeAppearanceUrls(
      {
        country: 'NG',
        appearance: {
          theme: 'dark',
          logo: 'http://172.20.10.3:3001/api/kyc/branding/logo/wf',
          dark: { logo: 'http://172.20.10.3:3001/api/kyc/branding/logo/wf-dark' },
        },
      },
      base,
    );
    expect(out).toEqual({
      country: 'NG',
      appearance: {
        theme: 'dark',
        logo: 'http://localhost:3001/api/kyc/branding/logo/wf',
        dark: { logo: 'http://localhost:3001/api/kyc/branding/logo/wf-dark' },
      },
    });
  });

  it('passes a config without appearance through', () => {
    expect(normalizeAppearanceUrls({ country: 'NG' }, base)).toEqual({ country: 'NG' });
  });
});
