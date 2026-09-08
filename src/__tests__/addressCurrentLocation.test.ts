import {
  claimAutoLocate,
  currentFix,
  currentFixFailure,
  locating,
  prefetchCurrentFix,
  resetAutoLocate,
  resetCurrentFix,
  type FixSource,
} from '../lib/address-current-location';
import { createKycStore } from '../store/kycStore';
import type { ResolvedKYCConfig } from '../types/config';

// ─── The shared current-fix cache ────────────────────────────────────────────
//
// Every address step calls the prefetch on mount, so the two properties that
// matter are: concurrent callers JOIN one attempt (the OS prompt fires once),
// and a FAILED attempt never re-arms itself (a step mount re-starting it left
// the location row spinning forever and re-prompted on every screen).

function source(over: Partial<FixSource> = {}): FixSource {
  return {
    takeFix: async () => ({ fix: { lat: 4.9, lng: 8.3, accuracy: 12 } }),
    addressReverse: async () => ({ line: '11 Bassey Street', parts: null }),
    ...over,
  };
}

// The scope test below builds a real store, which wires a debounced progress
// watcher; fake timers keep its 800ms timeout from holding jest open after the
// assertions are done. Promise resolution is unaffected, so the prefetch tests
// still await normally.
jest.useFakeTimers();

beforeEach(() => {
  resetCurrentFix();
  resetAutoLocate();
});

it('resolves a fix with its reverse-geocoded line', async () => {
  const fix = await prefetchCurrentFix(source());
  expect(fix).toEqual({
    lat: 4.9,
    lng: 8.3,
    accuracy: 12,
    label: '11 Bassey Street',
    parts: null,
  });
  expect(currentFix()).toBe(fix);
  expect(locating()).toBe(false);
});

it('keeps the coordinates when the reverse geocode fails', async () => {
  const fix = await prefetchCurrentFix(
    source({ addressReverse: async () => Promise.reject(new Error('offline')) }),
  );
  expect(fix?.lat).toBe(4.9);
  expect(fix?.label).toBeNull();
});

it('joins one attempt rather than starting a second', async () => {
  let calls = 0;
  const s = source({
    takeFix: async () => {
      calls += 1;
      return { fix: { lat: 1, lng: 2, accuracy: null } };
    },
  });
  const [a, b] = await Promise.all([prefetchCurrentFix(s), prefetchCurrentFix(s)]);
  expect(calls).toBe(1);
  expect(a).toBe(b);
});

it('serves the resolved fix forever without re-reading the GPS', async () => {
  let calls = 0;
  const s = source({
    takeFix: async () => {
      calls += 1;
      return { fix: { lat: 1, lng: 2, accuracy: null } };
    },
  });
  await prefetchCurrentFix(s);
  await prefetchCurrentFix(s);
  expect(calls).toBe(1);
});

describe('after a failure', () => {
  const denied = source({ takeFix: async () => ({ failure: 'denied' }) });

  it('does not retry automatically', async () => {
    let calls = 0;
    const s = source({
      takeFix: async () => {
        calls += 1;
        return { failure: 'timeout' };
      },
    });
    expect(await prefetchCurrentFix(s)).toBeNull();
    expect(await prefetchCurrentFix(s)).toBeNull();
    expect(calls).toBe(1);
  });

  it('retries when a tap asks it to', async () => {
    expect(await prefetchCurrentFix(denied)).toBeNull();
    const fix = await prefetchCurrentFix(source(), { retry: true });
    expect(fix?.lat).toBe(4.9);
  });

  it('treats a throwing reader as a failure, not a crash', async () => {
    const s = source({ takeFix: async () => Promise.reject(new Error('no permission')) });
    await expect(prefetchCurrentFix(s)).resolves.toBeNull();
    expect(currentFixFailure()).toBe('unsupported');
  });

  it('remembers WHY, so the message can say something true', async () => {
    expect(await prefetchCurrentFix(denied)).toBeNull();
    expect(currentFixFailure()).toBe('denied');
    // A later success clears it; a reset does too.
    await prefetchCurrentFix(source(), { retry: true });
    expect(currentFixFailure()).toBeNull();
    await prefetchCurrentFix(denied, { retry: true });
    resetCurrentFix();
    expect(currentFixFailure()).toBeNull();
  });
});

describe('the automatic first locate', () => {
  it('is claimed exactly once per verification', () => {
    expect(claimAutoLocate()).toBe(true);
    expect(claimAutoLocate()).toBe(false);
    resetAutoLocate();
    expect(claimAutoLocate()).toBe(true);
  });
});

describe('the scope of "one verification"', () => {
  // Both pieces of state are module-level, so what ends a verification is
  // store CREATION: the runtime provider builds one store per modal launch and
  // reset() is a consumer-facing restart, not part of the open path. Clearing
  // them only from reset() left a second verification dropping its pin
  // wherever the phone had been on the first, and skipping the automatic
  // locate because the latch was already spent.
  it('a new store clears the cached fix and re-arms the auto-locate', async () => {
    await prefetchCurrentFix(source());
    expect(currentFix()).not.toBeNull();
    expect(claimAutoLocate()).toBe(true);

    createKycStore({
      apiKey: 'pk_test_x',
      country: 'NG',
      metadata: {},
    } as unknown as ResolvedKYCConfig);

    expect(currentFix()).toBeNull();
    expect(claimAutoLocate()).toBe(true);
  });
});
