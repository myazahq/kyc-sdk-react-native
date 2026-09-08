import { createKYCApi } from '../services/api';

// ─── Autocomplete ranks like a ride-hailing app ──────────────────────────────
//
// The device fix rides the autocomplete call as `lat`/`lng`, a RANKING bias so
// nearby streets come first: without it "Awolowo Road" in Calabar ranks
// against every Awolowo Road in the country. The server treats it as a bias
// and never a filter, so the only thing to pin here is that the coordinates
// reach the query string exactly when a fix exists. Mirrors the web SDK's
// api.addressAutocomplete and Flutter's addressAutocomplete(near:).

describe('addressAutocomplete', () => {
  const urls: string[] = [];
  const realFetch = (globalThis as { fetch?: unknown }).fetch;

  beforeEach(() => {
    urls.length = 0;
    (globalThis as { fetch: unknown }).fetch = jest.fn(async (input: string) => {
      urls.push(String(input));
      return { ok: true, status: 200, text: async () => JSON.stringify({ suggestions: [] }) };
    });
  });

  afterEach(() => {
    (globalThis as { fetch?: unknown }).fetch = realFetch;
  });

  const api = createKYCApi('https://api.example', 'pk_test_x');

  it('sends the fix as lat/lng beside the query, session and country', async () => {
    await api.addressAutocomplete('awolowo', 'sess-1', 'NG', { lat: 4.9757, lng: 8.3417 });
    const url = new URL(urls[0]!);
    expect(url.pathname).toBe('/api/kyc/address/autocomplete');
    expect(url.searchParams.get('q')).toBe('awolowo');
    expect(url.searchParams.get('session')).toBe('sess-1');
    expect(url.searchParams.get('country')).toBe('NG');
    expect(url.searchParams.get('lat')).toBe('4.9757');
    expect(url.searchParams.get('lng')).toBe('8.3417');
  });

  it('sends no coordinates when there is no fix', async () => {
    await api.addressAutocomplete('awolowo', 'sess-1', null, null);
    const url = new URL(urls[0]!);
    expect(url.searchParams.has('lat')).toBe(false);
    expect(url.searchParams.has('lng')).toBe(false);
    expect(url.searchParams.has('country')).toBe(false);
  });

  it('the search step passes the current fix through', () => {
    // Wiring, not maths: a `near` the step never sends is a bias that never
    // applies, and nothing at runtime would say so.
    const { readFileSync } = require('fs') as typeof import('fs');
    const { join } = require('path') as typeof import('path');
    const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
    expect(read('screens/address/AddressSearchStep.tsx')).toMatch(/near=\{flow\.currentFix/);
    expect(read('screens/address/SearchScreen.tsx')).toMatch(/near \?\? null/);
  });
});
