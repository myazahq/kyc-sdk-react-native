import { WORKFLOW_KEYS, mergeWorkflowConfig } from '../config/workflowMerge';

// ─── Workflow over props ──────────────────────────────────────────────────────
//
// A published flow is the org's authored template; the props are the
// developer's code. The flow wins on every key it DEFINES, and props fill the
// gaps — that split is what lets an org change the flow in the builder without
// the developer redeploying, while keeping runtime data (who is being verified,
// what happens on submit) firmly in code.

describe('what the flow may override', () => {
  it('wins on a key it defines', () => {
    const merged = mergeWorkflowConfig({ enableLiveness: false }, { enableLiveness: true });
    expect(merged.enableLiveness).toBe(false);
  });

  it('leaves a key it omits alone', () => {
    const merged = mergeWorkflowConfig({ country: 'GH' }, { country: 'NG', enableSelfie: true });
    expect(merged).toEqual({ country: 'GH', enableSelfie: true });
  });

  it('treats an explicit false as a value, not an absence', () => {
    // The distinction the whole merge turns on: `undefined` means "the flow has
    // no opinion", but `false` is an opinion — a flow that switches liveness
    // off must not be overridden by a prop that leaves it on.
    const merged = mergeWorkflowConfig({ deviceIntelligence: false }, { deviceIntelligence: true });
    expect(merged.deviceIntelligence).toBe(false);
  });

  it('never touches runtime data', () => {
    // A flow is a shared template — it cannot carry one person's identity, and
    // must not be able to redirect where results go.
    const onSubmit = () => {};
    const merged = mergeWorkflowConfig(
      { apiKey: 'pk_attacker', userId: 'someone-else', metadata: { a: '1' }, onSubmit: () => {} },
      { apiKey: 'pk_mine', userId: 'me', metadata: { b: '2' }, onSubmit },
    );
    expect(merged.apiKey).toBe('pk_mine');
    expect(merged.userId).toBe('me');
    expect(merged.metadata).toEqual({ b: '2' });
    expect(merged.onSubmit).toBe(onSubmit);
  });

  it('lists no runtime keys at all', () => {
    for (const key of ['apiKey', 'devUrl', 'userId', 'userData', 'metadata', 'onSubmit', 'onError']) {
      expect(WORKFLOW_KEYS as readonly string[]).not.toContain(key);
    }
  });
});

describe('appearance', () => {
  it('merges per field so a partial flow theme keeps the prop logo', () => {
    const merged = mergeWorkflowConfig(
      { appearance: { primaryColor: '#000' } },
      { appearance: { logo: 'https://example.com/logo.png', primaryColor: '#FFF' } },
    );
    expect(merged.appearance).toEqual({
      logo: 'https://example.com/logo.png',
      primaryColor: '#000',
    });
  });

  it('survives a prop appearance that is not an object', () => {
    const merged = mergeWorkflowConfig({ appearance: { primaryColor: '#000' } }, { appearance: null });
    expect(merged.appearance).toEqual({ primaryColor: '#000' });
  });

  it('merges the biometric block per field, so a flow switching the review on keeps a prop-hidden Done', () => {
    const merged = mergeWorkflowConfig(
      { scope: 'biometric-authentication', biometric: { selfieReview: true } },
      { biometric: { doneButton: false } },
    );
    expect(merged.biometric).toEqual({ selfieReview: true, doneButton: false });
    // A flow key still wins over the prop's value of the same key.
    expect(
      mergeWorkflowConfig({ biometric: { doneButton: true } }, { biometric: { doneButton: false } }).biometric,
    ).toEqual({ doneButton: true });
  });
});

describe('business (KYB) flows', () => {
  it('falls back to the registry country when the flow has no top-level one', () => {
    // A KYB workflow carries its country inside the business block; downstream
    // code that expects a top-level `country` must not see undefined.
    const merged = mergeWorkflowConfig<Record<string, unknown>>(
      { subjectType: 'business', business: { country: 'GH' } },
      {},
    );
    expect(merged.country).toBe('GH');
  });

  it('does not overwrite a country the props already set', () => {
    const merged = mergeWorkflowConfig(
      { subjectType: 'business', business: { country: 'GH' } },
      { country: 'NG' },
    );
    expect(merged.country).toBe('NG');
  });

  it("leaves an individual flow's missing country missing", () => {
    const merged = mergeWorkflowConfig<Record<string, unknown>>({ subjectType: 'individual' }, {});
    expect(merged.country).toBeUndefined();
  });
});

describe('purity', () => {
  it('does not mutate its inputs', () => {
    const props = { country: 'NG', appearance: { logo: 'x' } };
    const flow = { country: 'GH', appearance: { primaryColor: '#000' } };
    mergeWorkflowConfig(flow, props);
    expect(props).toEqual({ country: 'NG', appearance: { logo: 'x' } });
    expect(flow).toEqual({ country: 'GH', appearance: { primaryColor: '#000' } });
  });

  // A multi-region flow declares its ID offering inside countries[]; keeping
  // the consumer's prop there narrows every country the flow offers.
  it('a multi-region flow drops the consumer idTypes prop', () => {
    const merged = mergeWorkflowConfig(
      { countries: [{ country: 'NG' }, { country: 'GH' }] },
      { country: 'NG', idTypes: ['bvn', 'nin', 'passport'] },
    );
    expect(merged.idTypes).toBeUndefined();
  });

  it("a flow's own top-level idTypes still wins on a multi-region flow", () => {
    const merged = mergeWorkflowConfig(
      { countries: [{ country: 'NG' }], idTypes: ['passport'] },
      { country: 'NG', idTypes: ['bvn', 'nin'] },
    );
    expect(merged.idTypes).toEqual(['passport']);
  });

  it('a single-country flow keeps the consumer idTypes prop, as before', () => {
    const merged = mergeWorkflowConfig(
      { country: 'NG' },
      { country: 'NG', idTypes: ['bvn', 'nin', 'passport'] },
    );
    expect(merged.idTypes).toEqual(['bvn', 'nin', 'passport']);
  });
});
