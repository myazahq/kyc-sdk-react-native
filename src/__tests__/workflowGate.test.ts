import {
  WORKFLOW_RESOLVE_TIMEOUT_MS,
  requireCountry,
  resolveWorkflow,
} from '../services/workflowGate';
import { KYCApiError } from '../services/api';
import { KYCError } from '../types/verification';
import type { MyazaKYCConfig } from '../types/config';

// ─── Resolve-before-mount ─────────────────────────────────────────────────────
//
// A `workflowId` mount cannot render until the flow is known — it supplies the
// country and the step toggles, so mounting first would show one flow and then
// rearrange it under the user.
//
// The two behaviours pinned hardest here are the ones the Flutter SDK's gate
// does NOT have: a DEADLINE (its barrier is undismissible with no timeout, so a
// silent socket hangs the user forever) and CANCELLATION (leaving mid-resolve
// must stop the request, not merely ignore it).

const config = (over: Partial<MyazaKYCConfig> = {}): MyazaKYCConfig =>
  ({ apiKey: 'pk_test_abc', workflowId: 'wf_abc', ...over }) as MyazaKYCConfig;

/** Installs a fetch that resolves however the test says. */
function mockFetch(impl: (url: string, init?: RequestInit) => Promise<unknown>): jest.Mock {
  const fn = jest.fn(impl as never);
  (globalThis as { fetch?: unknown }).fetch = fn;
  return fn as unknown as jest.Mock;
}

const jsonOk = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });

const RESOLUTION = {
  workflow: { id: 'wf_abc', name: 'Onboarding', version: 3 },
  config: { country: 'GH', enableLiveness: false },
  environment: 'SANDBOX',
  idTypes: [
    {
      country: 'GH',
      idType: 'passport',
      supportsNfc: true,
      features: { documentVerification: true, livenessCheck: true, govDbCheck: true },
    },
  ],
  branding: { companyName: 'Acme' },
};

afterEach(() => {
  jest.useRealTimers();
  delete (globalThis as { fetch?: unknown }).fetch;
});

describe('a successful resolve', () => {
  it('merges the flow over the props and preloads the server config', async () => {
    mockFetch(() => jsonOk(RESOLUTION));
    const result = await resolveWorkflow(config({ country: 'NG', enableLiveness: true }));

    // Flow wins on both keys it defines.
    expect(result.config.country).toBe('GH');
    expect(result.config.enableLiveness).toBe(false);
    // …and the props' own key survives.
    expect(result.config.apiKey).toBe('pk_test_abc');

    // One round trip hydrates everything, so no separate /config call is needed.
    expect(result.serverConfig.status).toBe('ready');
    expect(result.serverConfig.idTypes).toHaveLength(1);
    expect(result.serverConfig.branding?.companyName).toBe('Acme');
  });

  it('asks for the workflow by id', async () => {
    const fetchMock = mockFetch(() => jsonOk(RESOLUTION));
    await resolveWorkflow(config({ workflowId: 'wf_needs/encoding' }));
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/workflows/wf_needs%2Fencoding');
  });
});

describe('failures', () => {
  it('reports a bad key as invalid_api_key, not a generic workflow failure', async () => {
    // The distinction matters to the integrator: one is their key, the other is
    // their workflow, and the fixes are different.
    mockFetch(() => Promise.reject(new KYCApiError('nope', 401)));
    await expect(resolveWorkflow(config())).rejects.toMatchObject({
      code: 'invalid_api_key',
    });
  });

  it('reports an unknown or unpublished flow as invalid_workflow', async () => {
    mockFetch(() => Promise.reject(new KYCApiError('not found', 404)));
    await expect(resolveWorkflow(config())).rejects.toMatchObject({
      code: 'invalid_workflow',
    });
  });

  it('turns anything unrecognised into a KYCError rather than leaking it', async () => {
    mockFetch(() => Promise.reject(new TypeError('Network request failed')));
    const err = await resolveWorkflow(config()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KYCError);
  });
});

describe('the deadline', () => {
  it('gives up on a request that never settles', async () => {
    jest.useFakeTimers();
    // A socket that is open but silent: RN's fetch has no default timeout, so
    // without our own this promise never settles and the user waits forever.
    mockFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const pending = resolveWorkflow(config());
    const assertion = expect(pending).rejects.toMatchObject({ code: 'network_error' });
    jest.advanceTimersByTime(WORKFLOW_RESOLVE_TIMEOUT_MS + 1);
    await assertion;
  });

  it('aborts the request it gave up on', async () => {
    jest.useFakeTimers();
    let aborted = false;
    mockFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('aborted'));
          });
        }),
    );

    const pending = resolveWorkflow(config()).catch(() => undefined);
    jest.advanceTimersByTime(WORKFLOW_RESOLVE_TIMEOUT_MS + 1);
    await pending;
    expect(aborted).toBe(true);
  });

  it('clears its timer once the request lands', async () => {
    jest.useFakeTimers();
    mockFetch(() => jsonOk(RESOLUTION));
    await resolveWorkflow(config());
    // A stray timer would fire against a component that has already moved on.
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('cancellation', () => {
  it("stops the request when the caller's signal aborts", async () => {
    let aborted = false;
    mockFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('aborted'));
          });
        }),
    );

    const controller = new AbortController();
    const pending = resolveWorkflow(config(), controller.signal).catch((e: unknown) => e);
    controller.abort();
    const err = await pending;

    expect(aborted).toBe(true);
    // A cancellation is NOT translated into a KYCError: the caller has to be
    // able to tell "the user left" from "this failed", or closing the sheet
    // would fire onError and show an error screen on the way out.
    expect(err).not.toBeInstanceOf(KYCError);
  });
});

describe('mounting without a workflow', () => {
  it('passes the props straight through when a country is given', () => {
    expect(requireCountry(config({ workflowId: undefined, country: 'NG' })).country).toBe('NG');
  });

  it('refuses a config with neither country nor workflow', () => {
    // Mounting anyway would give an empty ID-type list and no explanation.
    expect(() => requireCountry(config({ workflowId: undefined, country: undefined }))).toThrow(
      KYCError,
    );
  });
});
