import {
  buildStepOrder,
  getStepProgress,
  nextStepInOrder,
  previousStepInOrder,
  type StepOrderOptions,
} from '../config/stepOrder';
import { addressFlowFor } from '../config/addressCollection';
import { isAddressStep } from '../lib/address-flow';
import { addressExitStep, recoverAddressStep } from '../lib/address-step-recovery';
import type { KYCStep } from '../types/config';

// ─── The address flow inside the SDK's ONE ordered step list ──────────────────
//
// `lib/address-flow` pins the pure rules; what is pinned HERE is that the flow
// is spliced into the real order, so entering it lands on its first screen,
// backing into it lands on its last, and the progress bar counts every screen.
// The step-order builder and the address screens both read one `addressFlowFor`
// call, and these assert the two agree.

const base: StepOrderOptions = {
  isBusiness: false,
  hasDocCapture: true,
  hasNfc: false,
  hasLiveness: true,
  hasCountrySelect: false,
  hasEmailVerification: false,
  hasPhoneVerification: false,
  hasPoa: false,
  hasSupportingDocuments: false,
  hasAddressCollection: false,
  hasQuestionnaire: false,
};

/**
 * A flow with address collection on, as the store derives it — including the
 * `subjectType` a real KYB config carries, without which `addressFlowFor` reads
 * the flow as an individual one and hands back the wrong shape.
 */
function withAddress(
  addressCollection: Record<string, unknown>,
  serverSearch: boolean,
  extra: Partial<StepOrderOptions> = {},
): StepOrderOptions {
  const config = {
    addressCollection,
    ...(extra.isBusiness ? { subjectType: 'business', business: extra.business } : {}),
  };
  return {
    ...base,
    hasAddressCollection: true,
    addressFlow: addressFlowFor(config as never, serverSearch),
    ...extra,
  };
}

describe('the address flow in the individual order', () => {
  const o = withAddress({ enabled: true }, true, { hasPoa: true, hasQuestionnaire: true });

  it('splices all four screens between proof of address and the questionnaire', () => {
    expect(buildStepOrder(o)).toEqual([
      'consent',
      'id-type',
      'document-capture',
      'liveness',
      'proof-of-address',
      'address-search',
      'address-collection',
      'address-entrance',
      'address-review',
      'questionnaire',
      'submitted',
    ]);
  });

  it('is entered at its FIRST screen, never straight at the pin', () => {
    // Routing forwards to the pin step would skip the search screen entirely.
    expect(nextStepInOrder('proof-of-address', o)).toBe('address-search');
  });

  it('is backed into at its LAST screen, never at the pin', () => {
    expect(previousStepInOrder('questionnaire', o)).toBe('address-review');
  });

  it('counts every screen towards progress', () => {
    const seen = new Set(
      (['address-search', 'address-collection', 'address-entrance', 'address-review'] as KYCStep[]).map(
        (s) => getStepProgress(s, o),
      ),
    );
    // Four distinct, strictly increasing readings — a step the bar does not
    // count is one the applicant walks with the progress frozen.
    expect(seen.size).toBe(4);
    expect([...seen]).toEqual([...seen].sort((a, b) => a - b));
  });

  it('starts at the pin when the server offers no search backend', () => {
    const noSearch = withAddress({ enabled: true }, false);
    expect(buildStepOrder(noSearch)).not.toContain('address-search');
    expect(nextStepInOrder('liveness', noSearch)).toBe('address-collection');
  });

  it('drops the entrance screen when no photo is asked for', () => {
    const noPhoto = withAddress({ enabled: true, photo: 'off' }, true);
    expect(buildStepOrder(noPhoto)).not.toContain('address-entrance');
    expect(nextStepInOrder('address-collection', noPhoto)).toBe('address-review');
  });
});

describe('the business (KYB) flow', () => {
  const o = withAddress({ enabled: true, photo: 'required' }, true, {
    isBusiness: true,
    business: { country: 'NG' },
  });

  it('collapses to the single premises step, with no search and no photo', () => {
    // The premises pin plus its directions ARE the capture, and it follows the
    // company details it is about.
    expect(buildStepOrder(o)).toEqual([
      'consent',
      'business-details',
      'address-collection',
      'submitted',
    ]);
  });

  it('offers neither search nor a photo, whatever the workflow asked for', () => {
    expect(o.addressFlow).toEqual({
      searchAvailable: false,
      photoMode: 'off',
      streetViewOffered: false,
    });
  });
});

describe('an attempt resumed onto a step this flow no longer has', () => {
  // Session progress restores the step it was saved on before the flow's shape
  // is known: `searchAvailable` is a SERVER flag that lands after the restore,
  // and a republish can drop the entrance photo.
  const recover = (o: StepOrderOptions, current: KYCStep): KYCStep | null => {
    const order = buildStepOrder(o);
    const exit = addressExitStep(buildStepOrder({ ...o, hasAddressCollection: true }));
    return recoverAddressStep(current, order.filter(isAddressStep), exit);
  };

  it('does not throw the applicant back to consent on a back-press', () => {
    // This is what `previousStepInOrder` used to do with a step it could not
    // find, discarding everything they had done.
    const o = withAddress({ enabled: true }, false);
    expect(previousStepInOrder('address-search', o)).toBe('address-search');
    // A step it CAN find still walks back normally.
    expect(previousStepInOrder('address-review', o)).toBe('address-entrance');
    expect(previousStepInOrder('consent', o)).toBe('consent');
  });

  it('carries on to the pin when the search flag had not arrived yet', () => {
    expect(recover(withAddress({ enabled: true }, false), 'address-search')).toBe(
      'address-collection',
    );
  });

  it('carries FORWARD past a screen the workflow dropped, never back', () => {
    // Their pin is already placed; sending them back to redo it would be the
    // flow forgetting work it still holds.
    expect(recover(withAddress({ enabled: true, photo: 'off' }, true), 'address-entrance')).toBe(
      'address-review',
    );
  });

  it('lands a KYB attempt on its premises pin', () => {
    const o = withAddress({ enabled: true }, true, {
      isBusiness: true,
      business: { country: 'NG' },
    });
    expect(recover(o, 'address-review')).toBe('address-collection');
  });

  it('leaves the address flow entirely when the workflow dropped it', () => {
    const o = { ...withAddress({ enabled: false }, true), hasAddressCollection: false, hasQuestionnaire: true };
    // The exit is computed from an order that CONTAINS the flow, so it is the
    // step they would have reached had they finished, not a guess.
    expect(recover(o, 'address-review')).toBe('questionnaire');
  });

  it('leaves a step the flow does have alone', () => {
    const o = withAddress({ enabled: true }, true);
    expect(recover(o, 'address-collection')).toBeNull();
    expect(recoverAddressStep('liveness', ['address-collection'], null)).toBeNull();
  });
});
