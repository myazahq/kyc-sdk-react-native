import { reviewMapSurface } from '../lib/review-map-surface';

describe('reviewMapSurface', () => {
  const surface = (over: Partial<Parameters<typeof reviewMapSurface>[0]> = {}) =>
    reviewMapSurface({ vendorsStubbed: false, hasStaticMap: true, staticMapFailed: false, hasFrame: true, ...over });

  it('draws the picture once its bytes land', () => {
    expect(surface()).toBe('picture');
    expect(surface({ hasFrame: false })).toBe('picture');
  });

  it('holds the space while the picture is still coming', () => {
    expect(surface({ hasStaticMap: false })).toBe('pending');
  });

  it('a refused picture falls back to the framed map before the built-in one', () => {
    expect(surface({ hasStaticMap: false, staticMapFailed: true })).toBe('framed');
    expect(surface({ hasStaticMap: false, staticMapFailed: true, hasFrame: false })).toBe('builtIn');
  });

  it('SANDBOX shows the stand-in whatever else is on offer', () => {
    expect(surface({ vendorsStubbed: true })).toBe('stub');
    expect(surface({ vendorsStubbed: true, hasStaticMap: false, hasFrame: false })).toBe('stub');
  });
});
