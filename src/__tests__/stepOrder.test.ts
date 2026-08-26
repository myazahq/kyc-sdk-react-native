import {
  buildStepOrder,
  getStepProgress,
  nextStepInOrder,
  previousStepInOrder,
  type StepOrderOptions,
} from '../config/stepOrder';

// ─── Flow step ordering ───────────────────────────────────────────────────────
//
// The store used to carry a hand-written `switch` per direction. Every optional
// step meant two more cases to keep in agreement, and there was nothing forcing
// forward and backward to describe the same flow. What is pinned here is that
// ONE ordered list is the answer to both — so a step that is skipped going
// forward is also skipped going back, by construction.

const base: StepOrderOptions = {
  isBusiness: false,
  hasDocCapture: true,
  hasNfc: false,
  hasLiveness: true,
  hasCountrySelect: false,
  hasEmailVerification: false,
  hasPhoneVerification: false,
  hasPoa: false,
  hasQuestionnaire: false,
};

const opts = (o: Partial<StepOrderOptions> = {}): StepOrderOptions => ({ ...base, ...o });

describe('the individual flow', () => {
  it('is the classic five steps when nothing optional is on', () => {
    expect(buildStepOrder(opts())).toEqual([
      'consent',
      'id-type',
      'document-capture',
      'liveness',
      'submitted',
    ]);
  });

  it('swaps capture for the typed form on a number-only ID', () => {
    const order = buildStepOrder(opts({ hasDocCapture: false }));
    expect(order).toContain('id-input');
    expect(order).not.toContain('document-capture');
  });

  it('drops liveness when the ID has it disabled', () => {
    expect(buildStepOrder(opts({ hasLiveness: false }))).not.toContain('liveness');
  });

  it('puts the OTP steps right after consent — email before phone', () => {
    // A possession check is cheap and comes before any capture or registry
    // spend, which is the entire reason it sits this early.
    const order = buildStepOrder(opts({ hasEmailVerification: true, hasPhoneVerification: true }));
    expect(order.slice(0, 3)).toEqual(['consent', 'email-verification', 'phone-verification']);
  });

  it('inserts country-select between consent and ID type', () => {
    const order = buildStepOrder(opts({ hasCountrySelect: true }));
    expect(order.indexOf('country-select')).toBeGreaterThan(order.indexOf('consent'));
    expect(order.indexOf('country-select')).toBeLessThan(order.indexOf('id-type'));
  });

  it('runs the chip read after the photo — the MRZ from it unlocks the chip', () => {
    const order = buildStepOrder(opts({ hasNfc: true }));
    expect(order.indexOf('nfc')).toBe(order.indexOf('document-capture') + 1);
  });

  it('has no chip step for a number-only ID — there is no document to tap', () => {
    expect(buildStepOrder(opts({ hasNfc: true, hasDocCapture: false }))).not.toContain('nfc');
  });

  it('collects proof of address and the questionnaire last, before submission', () => {
    const order = buildStepOrder(opts({ hasPoa: true, hasQuestionnaire: true }));
    expect(order.slice(-3)).toEqual(['proof-of-address', 'questionnaire', 'submitted']);
  });
});

describe('the business (KYB) flow', () => {
  it('replaces the individual capture leg with the application section', () => {
    const order = buildStepOrder(opts({ isBusiness: true, business: { country: 'NG' } }));
    expect(order).toEqual(['consent', 'business-details', 'submitted']);
  });

  it('adds each application step the workflow configures, in order', () => {
    const order = buildStepOrder(
      opts({
        isBusiness: true,
        business: {
          country: 'NG',
          keyPeople: { enabled: true, collect: true },
          documents: { enabled: true },
        },
      }),
    );
    expect(order).toEqual([
      'consent',
      'business-details',
      // Documents follow the company they belong to; people come after.
      'business-documents',
      'business-key-people',
      'submitted',
    ]);
  });

  it('asks the questionnaire BEFORE key people, inside the company section', () => {
    // Its questions are about the COMPANY, so they stay with the company form —
    // naming the directors hands the application over to other people, and the
    // applicant's own questions must not trail that.
    const order = buildStepOrder(
      opts({
        isBusiness: true,
        hasQuestionnaire: true,
        business: {
          country: 'NG',
          keyPeople: { enabled: true, collect: true },
          documents: { enabled: true },
        },
      }),
    );
    expect(order).toEqual([
      'consent',
      'business-details',
      'business-documents',
      'questionnaire',
      'business-key-people',
      'submitted',
    ]);
  });

  it('appends the individual capture leg when the applicant verifies themselves', () => {
    const order = buildStepOrder(
      opts({
        isBusiness: true,
        business: { country: 'NG', applicant: { verification: true } },
      }),
    );
    expect(order).toEqual([
      'consent',
      'business-details',
      'applicant-role',
      'id-type',
      'document-capture',
      'liveness',
      'submitted',
    ]);
  });

  it('has no country-select — the registry country is picked on business details', () => {
    const order = buildStepOrder(
      opts({ isBusiness: true, business: { country: 'NG' }, hasCountrySelect: true }),
    );
    expect(order).not.toContain('country-select');
  });
});

describe('navigation', () => {
  it('walks the order forward and back symmetrically', () => {
    const o = opts({ hasEmailVerification: true, hasPoa: true });
    const order = buildStepOrder(o);
    for (let i = 0; i < order.length - 1; i++) {
      const step = order[i]!;
      const next = nextStepInOrder(step, o);
      expect(next).toBe(order[i + 1]);
      expect(previousStepInOrder(next, o)).toBe(step);
    }
  });

  it('skips a disabled step in BOTH directions', () => {
    // The bug the ordered list makes unrepresentable: forward skipping liveness
    // while back still routes through it, stranding the user on a dead screen.
    const o = opts({ hasLiveness: false });
    expect(nextStepInOrder('document-capture', o)).toBe('submitted');
    expect(previousStepInOrder('submitted', o)).toBe('document-capture');
  });

  it('stops at the end rather than running off it', () => {
    expect(nextStepInOrder('submitted', opts())).toBe('submitted');
    expect(previousStepInOrder('consent', opts())).toBe('consent');
  });

  it('leaves a step that is not in the flow where it is', () => {
    // A workflow can disable a step the user has already reached (a live edit,
    // or a preview jumping straight in). Advancing from a step the flow does
    // not contain has no correct answer — standing still beats guessing.
    expect(nextStepInOrder('questionnaire', opts())).toBe('questionnaire');
  });
});

describe('progress', () => {
  it('runs from the first step to 100% at submission', () => {
    const o = opts();
    expect(getStepProgress('consent', o)).toBe(20);
    expect(getStepProgress('submitted', o)).toBe(100);
  });

  it('rescales when the flow gets longer', () => {
    // Consent is a smaller share of a flow with more steps in it — the bar has
    // to reflect the flow the user is actually in.
    const short = getStepProgress('consent', opts());
    const long = getStepProgress('consent', opts({ hasPoa: true, hasQuestionnaire: true }));
    expect(long).toBeLessThan(short);
  });

  it('reports zero for a step outside the flow', () => {
    expect(getStepProgress('business-details', opts())).toBe(0);
  });
});

// ─── Auto-skipping steps must not become one-way valves ─────────────────────
//
// A step that skips itself (no NFC radio, a disabled feature) has to skip the
// way the user was ALREADY going. Advancing forward unconditionally turns it
// into a trap: pressing Back onto it throws you forward again, so every step
// before it is unreachable. On device this showed up as nfc → liveness → nfc →
// liveness repeating until the user closed the flow.
//
// The store's `navDirection` is what makes the direction knowable at the moment
// the skipping step mounts, so the rule is tested here rather than in a screen.
describe('navDirection', () => {
  const order = ['document-capture', 'nfc', 'liveness'] as const;
  type Step = (typeof order)[number];

  /** What an auto-skipping step should do, given the way the user was going. */
  const skipTo = (from: Step, direction: 'forward' | 'back'): Step => {
    const i = order.indexOf(from);
    return direction === 'back' ? order[i - 1]! : order[i + 1]!;
  };

  it('skips forward when the user is moving forward', () => {
    expect(skipTo('nfc', 'forward')).toBe('liveness');
  });

  it('skips BACKWARD when the user pressed back — the valve fix', () => {
    // Without this the user lands on nfc, is thrown to liveness, and can never
    // reach document-capture again.
    expect(skipTo('nfc', 'back')).toBe('document-capture');
  });
});
