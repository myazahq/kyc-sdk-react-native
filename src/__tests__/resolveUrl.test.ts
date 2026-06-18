import { detectEnvironment, resolveBaseUrl, normalizeDevAssetUrl } from '../services/resolveUrl';

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
    expect(resolveBaseUrl('pk_test_abc')).toBe('https://identity.myaza.app');
    expect(resolveBaseUrl('pk_test_abc', 'http://example.test')).toBe('https://identity.myaza.app');
    expect(resolveBaseUrl('pk_live_abc')).toBe('https://identity.myaza.app');
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
    expect(normalizeDevAssetUrl('http://localhost:3001/logo.png', 'https://identity.myaza.app')).toBe(
      'http://localhost:3001/logo.png',
    );
  });

  it('passes through undefined', () => {
    expect(normalizeDevAssetUrl(undefined, 'http://10.0.2.2:3001')).toBeUndefined();
  });
});
