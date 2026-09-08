import { createKYCApi } from '../services/api';

// ─── The two review-card pictures come through OUR server ────────────────────
//
// Google's key lives on the server and in the framed page, never in this SDK,
// so both images are fetched from our own origin with the SDK's bearer. The
// source is a URL plus headers; lib/authed-image turns it into a data URI,
// because an <Image> handed `source.headers` drops them on Android (the
// server answered 401 to every thumbnail; Galaxy S24, 2026-09-07).

const api = createKYCApi('https://trust.myaza.app', 'pk_test_abc123');

describe('staticMapSource', () => {
  it('points at our own server and carries the bearer', () => {
    const source = api.staticMapSource({ lat: 4.9331, lng: 8.3258 });
    expect(source.uri.startsWith('https://trust.myaza.app/api/kyc/address/static-map?')).toBe(true);
    expect(source.headers.Authorization).toBe('Bearer pk_test_abc123');
    // Never Google directly: a browser key in this SDK is the thing the framed
    // page exists to avoid.
    expect(source.uri).not.toContain('googleapis.com');
  });

  it('sends the pin, and defaults the view the review card asks for', () => {
    const params = new URLSearchParams(api.staticMapSource({ lat: 4.9331, lng: 8.3258 }).uri.split('?')[1]);
    expect(params.get('lat')).toBe('4.9331');
    expect(params.get('lng')).toBe('8.3258');
    expect(params.get('zoom')).toBe('16');
    expect(params.get('width')).toBe('640');
    expect(params.get('height')).toBe('360');
  });

  it('rounds a fractional size, which the server would refuse', () => {
    const params = new URLSearchParams(
      api.staticMapSource({ lat: 1, lng: 2, width: 320.6, height: 200.2 }).uri.split('?')[1],
    );
    expect(params.get('width')).toBe('321');
    expect(params.get('height')).toBe('200');
  });
});

describe('streetViewPreviewSource', () => {
  it('sends the frame the applicant themselves composed', () => {
    const source = api.streetViewPreviewSource({
      panoId: '2upafFBbqcZP-du1e0DxYw',
      heading: 85.5,
      pitch: -15,
      fov: 60,
    });
    expect(source.uri.startsWith('https://trust.myaza.app/api/kyc/address/street-view-preview?')).toBe(true);
    expect(source.headers.Authorization).toBe('Bearer pk_test_abc123');
    const params = new URLSearchParams(source.uri.split('?')[1]);
    expect(params.get('panoId')).toBe('2upafFBbqcZP-du1e0DxYw');
    expect(params.get('heading')).toBe('85.5');
    expect(params.get('pitch')).toBe('-15');
    expect(params.get('fov')).toBe('60');
  });
});
