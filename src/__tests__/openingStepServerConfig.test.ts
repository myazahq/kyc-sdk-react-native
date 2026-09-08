// ─── The opening step reads the server's facts ───────────────────────────────
//
// Which steps EXIST depends on what the server serves: the address search
// step is in the order only when a search backend answers. A store seeded
// from a resolved workflow already holds those facts, so it opens on the
// right step; the /config path learns them a moment later, and an applicant
// still standing on the placeholder's opening step, having done nothing, is
// moved to the real one. Anyone who has moved is left alone. Mirrors the
// Flutter provider's _loadServerConfig (user report 2026-09-08).
import { createKycStore } from '../store/kycStore';
import type { ResolvedKYCConfig } from '../types/config';
import type { ServerConfigState } from '../store/serverConfig';

jest.useFakeTimers();

// The store closes over the api it builds at creation, so the /config answer
// is stubbed at the module seam rather than on the state.
const mockConfig = jest.fn();
jest.mock('../services/api', () => ({
  createKYCApi: () => ({ config: (...args: unknown[]) => mockConfig(...args) }),
}));

const CONFIG = {
  apiKey: 'pk_test_x',
  country: 'NG',
  consentStep: false,
  scope: 'address',
  addressCollection: { enabled: true },
  metadata: {},
} as unknown as ResolvedKYCConfig;

const READY: ServerConfigState = {
  status: 'ready',
  idTypes: [],
  branding: null,
  geoCountry: null,
  addressSearch: true,
  addressSearchMode: 'autocomplete',
  mapsFrameUrl: null,
  environment: 'DEVELOPMENT',
  fatal: false,
} as unknown as ServerConfigState;

function withConfigAnswer(): void {
  mockConfig.mockResolvedValue({
    idTypes: [],
    environment: 'DEVELOPMENT',
    addressSearch: true,
    addressSearchMode: 'autocomplete',
  });
}

describe('opening step and the server config', () => {
  it('opens on the search step when the facts are preloaded', () => {
    expect(createKycStore(CONFIG, READY).getState().currentStep).toBe('address-search');
  });

  it('opens on the pin off the placeholder and moves to the search step once /config lands', async () => {
    const store = createKycStore(CONFIG);
    expect(store.getState().currentStep).toBe('address-collection');
    withConfigAnswer();
    await store.getState().loadServerConfig();
    expect(store.getState().serverConfig.addressSearch).toBe(true);
    expect(store.getState().currentStep).toBe('address-search');
  });

  it('leaves an applicant who has already moved where they are', async () => {
    const store = createKycStore(CONFIG);
    store.setState({ currentStep: 'address-review' });
    withConfigAnswer();
    await store.getState().loadServerConfig();
    expect(store.getState().currentStep).toBe('address-review');
  });
});
