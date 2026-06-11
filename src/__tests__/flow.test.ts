import { nextStepAfter, previousStepBefore, livenessEnabled, type KycState } from '../store/kycStore';
import { INITIAL_SERVER_CONFIG } from '../store/serverConfig';
import type { MyazaKYCConfig } from '../types/config';

// Build a minimal KycState for exercising the pure navigation helpers. The
// helpers only read currentStep/selectedIdType/serverConfig/config, so we cast a
// partial object (the unused action fields are never touched).
function makeState(over: Partial<KycState>): KycState {
  const config = { apiKey: 'pk_test_x', country: 'NG', ...(over.config ?? {}) } as MyazaKYCConfig;
  return {
    config,
    selectedIdType: null,
    serverConfig: INITIAL_SERVER_CONFIG,
    currentStep: 'consent',
    ...over,
  } as KycState;
}

describe('flow navigation', () => {
  it('number-only IDs skip document capture (id-type → id-input)', () => {
    const s = makeState({ selectedIdType: 'bvn' });
    expect(nextStepAfter('id-type', s)).toBe('id-input');
  });

  it('document IDs go to document capture (id-type → document-capture)', () => {
    const s = makeState({ selectedIdType: 'passport' });
    expect(nextStepAfter('id-type', s)).toBe('document-capture');
  });

  it('reaches liveness when enabled, else jumps to submitted', () => {
    const enabled = makeState({ selectedIdType: 'bvn', config: { apiKey: 'pk_test_x', country: 'NG', enableLiveness: true } as MyazaKYCConfig });
    expect(nextStepAfter('id-input', enabled)).toBe('liveness');

    const disabled = makeState({ selectedIdType: 'bvn', config: { apiKey: 'pk_test_x', country: 'NG', enableLiveness: false } as MyazaKYCConfig });
    expect(nextStepAfter('id-input', disabled)).toBe('submitted');
    expect(livenessEnabled(disabled)).toBe(false);
  });

  it('server livenessCheck=false wins over the consumer baseline', () => {
    const s = makeState({
      selectedIdType: 'bvn',
      config: { apiKey: 'pk_test_x', country: 'NG', enableLiveness: true } as MyazaKYCConfig,
      serverConfig: {
        status: 'ready',
        fatal: false,
        idTypes: [{ country: 'NG', idType: 'bvn', features: { documentVerification: true, livenessCheck: false, govDbCheck: true } }],
      },
    });
    expect(livenessEnabled(s)).toBe(false);
    expect(nextStepAfter('id-input', s)).toBe('submitted');
  });

  it('back navigation mirrors the forward path', () => {
    const doc = makeState({ selectedIdType: 'passport' });
    expect(previousStepBefore('document-capture', doc)).toBe('id-type');
    expect(previousStepBefore('liveness', doc)).toBe('document-capture');

    const num = makeState({ selectedIdType: 'bvn' });
    expect(previousStepBefore('liveness', num)).toBe('id-input');
  });
});
