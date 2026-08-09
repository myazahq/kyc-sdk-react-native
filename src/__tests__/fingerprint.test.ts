import { collectFingerprint } from '../services/fingerprint';

// ─── Device Intelligence fingerprint ──────────────────────────────────────────
//
// Two properties matter more than any individual component.
//
// It must never THROW: it runs at submit, and a fingerprint that fails to
// collect is a missing fraud signal, not a failed verification. Under this test
// runner none of the native modules resolve at all — which is precisely the
// degraded case a host app missing a module would hit.
//
// And it must send RAW components, never a self-computed id: the server
// canonicalises and hashes them, so a client that could post its own hash could
// mint a fresh device identity at will.

describe('collecting', () => {
  it('resolves even when nothing native is available', async () => {
    await expect(collectFingerprint()).resolves.toBeDefined();
  });

  it('returns a components object rather than nothing', async () => {
    const fp = await collectFingerprint();
    expect(fp.components).toBeDefined();
    expect(typeof fp.components).toBe('object');
  });

  it('always reports the platform, which needs no native module', async () => {
    const fp = await collectFingerprint();
    expect(fp.components.platform).toBeTruthy();
  });

  it('omits what it could not read instead of sending nulls', async () => {
    // A null is a value the server would canonicalise and hash; an absent key
    // is honestly absent. Two installs that differ only in which modules were
    // present must not therefore look like two different devices.
    const fp = await collectFingerprint();
    for (const value of Object.values(fp.components)) {
      expect(value).not.toBeNull();
      expect(value).not.toBeUndefined();
    }
  });

  it('never sends a client-computed device id', async () => {
    // The server derives the hash. A `deviceHash` coming from the client would
    // let anyone rotate their device identity by changing one field.
    const fp = await collectFingerprint();
    expect(fp).not.toHaveProperty('deviceHash');
    expect(fp.components).not.toHaveProperty('deviceHash');
  });

  it('is stable across calls in the same install', async () => {
    // The whole point is recognising a repeat device; a fingerprint that
    // differed between two submissions from one phone would signal nothing.
    const [a, b] = await Promise.all([collectFingerprint(), collectFingerprint()]);
    expect(a.components).toEqual(b.components);
  });
});
