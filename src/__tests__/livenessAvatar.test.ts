// ---------------------------------------------------------------------------
// The gesture animations are FETCHED, not bundled — 5.5 MB of GIF used to ship
// in every integrator's app for a badge the liveness step shows for seconds.
//
// What is pinned here is the half that has no visible failure: the URL the SDK
// asks for has to match the route the server actually serves, and neither the
// URL builder nor the prefetch may ever throw. A thrown prefetch would take
// down the flow open that calls it, to save a cartoon.
// ---------------------------------------------------------------------------

const prefetch = jest.fn((_url: string) => Promise.resolve(true));

jest.mock(
  'react-native',
  () => ({ Platform: { OS: 'ios' }, Image: { prefetch } }),
  { virtual: true },
);

import { livenessAvatarUrl, primeLivenessAvatars } from '../liveness/avatarSource';

const LIVE = 'pk_live_0123456789abcdef0123456789abcdef';

beforeEach(() => prefetch.mockClear());

describe('livenessAvatarUrl', () => {
  it('points at the served route, per gesture', () => {
    // The path here and the route in kyc-core's routes/sdk/assets.ts are one
    // contract; the server validates the gesture against a closed list, so a
    // drift on either side is a 404 and a missing avatar, never an error.
    expect(livenessAvatarUrl('nod', LIVE)).toBe(
      'https://trust.myaza.app/api/kyc/assets/liveness/nod.gif',
    );
    expect(livenessAvatarUrl('smile', LIVE)).toBe(
      'https://trust.myaza.app/api/kyc/assets/liveness/smile.gif',
    );
  });

  it('asks for GIF, not WebP', () => {
    // Deliberate on both platforms: RN decodes only GIF animation on iOS, and
    // animated WebP on Android depends on a Fresco module the host app enables
    // or does not. The server keeps WebP for the day an SDK can take it.
    expect(livenessAvatarUrl('turn', LIVE)!.endsWith('.gif')).toBe(true);
  });

  it('honours devUrl on a development key', () => {
    expect(livenessAvatarUrl('blink', 'pk_dev_abc', 'http://192.168.1.5:3001')).toBe(
      'http://192.168.1.5:3001/api/kyc/assets/liveness/blink.gif',
    );
  });

  it('returns null rather than throwing on a malformed key', () => {
    // resolveBaseUrl throws by design — a bad key is a real error at every
    // other call site. Here it costs a cartoon, so it must not reach a render.
    expect(livenessAvatarUrl('nod', 'not-a-key')).toBeNull();
  });
});

describe('primeLivenessAvatars', () => {
  it('warms all four gestures, because the session picks them at random', () => {
    primeLivenessAvatars(LIVE);
    expect(prefetch).toHaveBeenCalledTimes(4);
    expect(prefetch.mock.calls.map((c) => c[0])).toEqual([
      'https://trust.myaza.app/api/kyc/assets/liveness/nod.gif',
      'https://trust.myaza.app/api/kyc/assets/liveness/turn.gif',
      'https://trust.myaza.app/api/kyc/assets/liveness/blink.gif',
      'https://trust.myaza.app/api/kyc/assets/liveness/smile.gif',
    ]);
  });

  it('swallows a rejected prefetch', async () => {
    prefetch.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    expect(() => primeLivenessAvatars(LIVE)).not.toThrow();
    await Promise.resolve();
  });

  it('does nothing on a malformed key', () => {
    expect(() => primeLivenessAvatars('not-a-key')).not.toThrow();
    expect(prefetch).not.toHaveBeenCalled();
  });
});
