import {
  KEEP_PICKED_LABEL_RADIUS_M,
  LABEL_PROMPT_MIN_MOVE_M,
  PIN_EPSILON,
  displayAddressLine,
  metersBetween,
  shouldAskLabelDecision,
} from '../lib/address-flow';
import { pickedAddressState } from '../lib/address-helpers';

// What the address is CALLED: the distance rules that decide whether a picked
// label still names the pin, and the line the applicant is shown. Split from
// addressFlow.test.ts (200-line rule), which covers the flow's shape.
//
// A MIRROR of the web SDK's equivalents — the same cases with the same
// expected answers, because a rule that drifts between platforms shows two
// applicants two different addresses for one pin.

describe('metersBetween', () => {
  it('measures a small nudge in metres', () => {
    // ~111m per 0.001 degrees of latitude.
    const d = metersBetween({ lat: 4.932, lng: 8.325 }, { lat: 4.933, lng: 8.325 });
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(125);
  });

  it('a same-compound nudge stays inside the keep radius; a district hop does not', () => {
    const pick = { lat: 4.9323964, lng: 8.3254216 };
    const nudge = { lat: 4.9331, lng: 8.326 }; // ~110m
    const far = { lat: 4.95, lng: 8.34 }; // ~2.5km
    expect(metersBetween(pick, nudge)).toBeLessThanOrEqual(KEEP_PICKED_LABEL_RADIUS_M);
    expect(metersBetween(pick, far)).toBeGreaterThan(KEEP_PICKED_LABEL_RADIUS_M);
  });
});

describe('the cross-SDK constants', () => {
  it('holds the values web and Flutter hold', () => {
    expect(PIN_EPSILON).toBe(1e-5);
    expect(KEEP_PICKED_LABEL_RADIUS_M).toBe(250);
    expect(LABEL_PROMPT_MIN_MOVE_M).toBe(25);
  });
});

describe('shouldAskLabelDecision', () => {
  const picked = {
    lat: 4.9323964,
    lng: 8.3254216,
    label: '11 Bassey Street, Idim Ita, Calabar',
    pickedAt: { lat: 4.9323964, lng: 8.3254216 },
  };

  it('stays silent while the move is roof-refinement', () => {
    // ~11m nudge: keep the picked label without asking.
    expect(shouldAskLabelDecision({ ...picked, lat: picked.lat + 0.0001 })).toBe(false);
  });

  it('asks once the pin has genuinely moved', () => {
    expect(shouldAskLabelDecision({ ...picked, lat: picked.lat + 0.0005 })).toBe(true);
  });

  it('respects an answered "keep"', () => {
    expect(shouldAskLabelDecision({ ...picked, lat: picked.lat + 0.0005, labelKept: true })).toBe(
      false,
    );
  });

  it('never asks about a derived label', () => {
    // No pickedAt anchor: reverse-geocoded labels re-derive freely instead.
    const { pickedAt: _anchor, ...derived } = picked;
    expect(shouldAskLabelDecision({ ...derived, lat: picked.lat + 0.0005 })).toBe(false);
  });
});

describe('displayAddressLine', () => {
  const base = { lat: 4.9324, lng: 8.3254 };

  it('replaces a contradictory picked number with the typed one', () => {
    expect(
      displayAddressLine({
        ...base,
        label: '11 Bassey Street, Idim Ita, Calabar',
        propertyNumber: '8',
      }),
    ).toBe('8 Bassey Street, Idim Ita, Calabar');
  });

  it('never doubles a number the label already leads with', () => {
    expect(
      displayAddressLine({ ...base, label: '11 Bassey Street, Idim Ita', propertyNumber: '11' }),
    ).toBe('11 Bassey Street, Idim Ita');
  });

  it('prefixes a number the label never carried', () => {
    expect(
      displayAddressLine({ ...base, label: 'Bassey Street, Calabar', propertyNumber: '8' }),
    ).toBe('8, Bassey Street, Calabar');
  });

  it('leads with a typed street the label does not know', () => {
    expect(
      displayAddressLine({
        ...base,
        label: 'Idim Ita, Calabar',
        propertyNumber: '8',
        street: 'Wisdom Close',
      }),
    ).toBe('8 Wisdom Close, Idim Ita, Calabar');
  });

  it('falls back to coordinates only when there is nothing typed either', () => {
    expect(displayAddressLine({ ...base, street: 'Wisdom Close', propertyNumber: '8' })).toBe(
      '8 Wisdom Close',
    );
    // NEVER coordinates: an unlabelled pin has NO line, and the caller shows
    // that one is on its way.
    expect(displayAddressLine(base)).toBe('');
  });
});

describe('pickedAddressState', () => {
  const hit = { lat: 4.9324, lng: 8.3254, houseNumber: '11' };

  it('carries the typed fields across a pick', () => {
    const out = pickedAddressState(
      { directions: 'black gate', propertyNumber: '', street: 'Wisdom Close' },
      hit,
    );
    expect(out).toMatchObject({ lat: 4.9324, lng: 8.3254, accuracy: null });
    expect(out.directions).toBe('black gate');
    expect(out.street).toBe('Wisdom Close');
  });

  it('prefills the house number only when the applicant typed none', () => {
    expect(pickedAddressState(null, hit).propertyNumber).toBe('11');
    expect(pickedAddressState({ propertyNumber: '8' }, hit).propertyNumber).toBe('8');
  });

  it('drops the label anchors, so a stale pick cannot follow the pin', () => {
    // The shape is fixed on purpose: a caller that wants a label to survive
    // has to re-add it, rather than carrying one to a different building.
    const out = pickedAddressState({ propertyNumber: '' }, hit) as Record<string, unknown>;
    expect(out['label']).toBeUndefined();
    expect(out['pickedAt']).toBeUndefined();
    expect(out['labelKept']).toBeUndefined();
    expect(out['streetView']).toBeUndefined();
  });
});
