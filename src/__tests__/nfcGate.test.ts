import { nfcDecision } from '../store/derive';
import { buildStepOrder } from '../config/stepOrder';

// ---------------------------------------------------------------------------
// Whether the chip step appears at all.
//
// FOUR independent conditions can each delete it, and a missing step looks
// identical however it went missing — the flow simply walks from the document
// capture to the liveness check with nothing logged. That is the same silent
// shape as the native-module race that once removed the whole NFC screen, so
// the decision returns a REASON rather than a bare boolean, and the reasons are
// pinned here.
//
// The passing case mirrors a real published workflow: nfc enabled, no idTypes
// restriction, NG/passport reported chip-capable by the server.
// ---------------------------------------------------------------------------

const base = {
  config: { nfc: { enabled: true }, country: 'NG' },
  selectedCountry: 'NG',
  selectedIdType: 'passport',
  serverConfig: { idTypes: [{ country: 'NG', idType: 'passport', supportsNfc: true }] },
};
const state = (over: Record<string, unknown> = {}) => ({ ...base, ...over }) as never;

describe('nfcDecision', () => {
  it('enables the chip step for a chip-capable ID with no idTypes restriction', () => {
    // Absent `idTypes` means "every chip-capable ID", the usual unset-is-all rule.
    expect(nfcDecision(state())).toEqual({ enabled: true });
  });

  it('names the workflow toggle when the step is off', () => {
    expect(nfcDecision(state({ config: { nfc: { enabled: false }, country: 'NG' } })).reason).toBe(
      'workflow_nfc_disabled',
    );
  });

  it('names the ID when the workflow lists chip IDs and this is not one', () => {
    const s = state({ config: { nfc: { enabled: true, idTypes: ['GH/ghana-card'] }, country: 'NG' } });
    expect(nfcDecision(s).reason).toBe('id_not_selected_in_workflow:NG/passport');
  });

  it("names the ID when the server says the document has no chip", () => {
    // The server's per-row answer is authoritative — it covers documents the
    // local fallback list has never heard of, and its `false` wins outright.
    const s = state({
      serverConfig: { idTypes: [{ country: 'NG', idType: 'passport', supportsNfc: false }] },
    });
    expect(nfcDecision(s).reason).toBe('id_not_chip_capable:NG/passport');
  });

  it('places the chip read AFTER the document capture', () => {
    // Not cosmetic ordering: the MRZ from that capture is the key that unlocks
    // the chip, so there is nothing to read before it.
    const order = buildStepOrder({
      isBusiness: false,
      hasDocCapture: true,
      hasNfc: true,
      hasLiveness: true,
      hasCountrySelect: false,
      hasEmailVerification: false,
      hasPhoneVerification: false,
      hasPoa: false,
      hasQuestionnaire: false,
    } as never);
    expect(order.indexOf('nfc')).toBeGreaterThan(order.indexOf('document-capture'));
    expect(order.indexOf('nfc')).toBeLessThan(order.indexOf('liveness'));
  });
});
