// Imported from the MODULES, not the `../capture` barrel: the barrel also
// exports `useAutoCapture`, which pulls react-native-vision-camera into the
// graph and cannot be parsed here. The decision logic is deliberately free of
// any RN dependency — that is what lets these thresholds be tested in CI with
// no device, and importing it directly is what keeps it honest.
import { DocumentTextGate } from '../capture/documentTextGate';
import { verifyDocumentIdentity } from '../capture/documentIdentity';
import { detectDocumentType, hasDocumentSignals, hasMrzLines } from '../capture/documentSignals';
// `rectGate` is the PURE half of edge detection; `rectDetector` binds the
// native module and would drag nitro-modules into this file.
import { rectFramingProblem } from '../capture/rectGate';

// A real TD3 pair (ICAO 9303 Appendix B specimen), 44 chars each.
const MRZ_L1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<';
const MRZ_L2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';

describe('document type signals', () => {
  it('detects a passport from an MRZ in a country with no curated list', () => {
    // Global Documents: most countries have no keyword list, and the MRZ is the
    // one signal that works everywhere.
    const m = detectDocumentType([MRZ_L1, MRZ_L2], 'AD');
    expect(m.type).toBe('passport');
  });

  it('does not let a short acronym match inside another word', () => {
    // 'VIN' sits inside "driVINg" — a licence must not score a voter-card hit.
    const m = detectDocumentType(['FEDERAL ROAD SAFETY', 'DRIVING LICENCE'], 'NG');
    expect(m.type).toBe('drivers-license');
  });

  it('needs two MRZ-shaped lines, not one', () => {
    expect(hasMrzLines([MRZ_L1])).toBe(false);
    expect(hasMrzLines([MRZ_L1, MRZ_L2])).toBe(true);
  });

  it('knows where it has no signals to judge with', () => {
    expect(hasDocumentSignals('NG', 'pvc')).toBe(true);
    // A passport identifies itself anywhere.
    expect(hasDocumentSignals('AD', 'passport')).toBe(true);
    expect(hasDocumentSignals('AD', 'national-id')).toBe(false);
  });
});

describe('document identity', () => {
  it('refuses a passport whose MRZ is not in frame', () => {
    // The exact failure that let a laptop screen full of KYC text fire.
    const r = verifyDocumentIdentity(['NIGERIAN PASSPORT', 'TRAVEL DOCUMENT'], {
      country: 'NG',
      idType: 'passport',
    });
    expect(r.identified).toBe(false);
    // It LOOKS right, so the hint must say "show the strip", not "wrong document"
    // — otherwise the user goes hunting for a different passport.
    expect(r.hint).toBe('showMrz');
  });

  it('says wrong-document when the text identifies as something else', () => {
    const r = verifyDocumentIdentity(['FRSC', 'FEDERAL ROAD SAFETY', 'DRIVER'], {
      country: 'NG',
      idType: 'pvc',
    });
    expect(r.identified).toBe(false);
    expect(r.hint).toBe('wrongDocument');
  });

  it('accepts a passport once the MRZ is in frame', () => {
    const r = verifyDocumentIdentity([MRZ_L1, MRZ_L2, 'PASSPORT'], {
      country: 'NG',
      idType: 'passport',
    });
    expect(r.identified).toBe(true);
  });

  it('does not block a country it has no signals for', () => {
    // Blocking on a check we cannot perform would make Global Documents
    // uncapturable.
    const r = verifyDocumentIdentity(['SOME TEXT', 'MORE TEXT'], {
      country: 'AD',
      idType: 'national-id',
    });
    expect(r.identified).toBe(true);
  });

  it('holds out for the chip key when the MRZ is required', () => {
    const r = verifyDocumentIdentity(['CARTE NATIONALE', 'IDENTITE'], {
      country: 'CI',
      idType: 'cni',
      requireValidMrz: true,
    });
    expect(r.identified).toBe(false);
    expect(r.hint).toBe('showMrz');
  });

  it('accepts a stored MRZ as satisfying the chip-key requirement', () => {
    const r = verifyDocumentIdentity(['CARTE NATIONALE', 'IDENTITE'], {
      country: 'CI',
      idType: 'cni',
      requireValidMrz: true,
      mrzAlreadyCaptured: true,
    });
    expect(r.identified).toBe(true);
  });
});

describe('document identity — the back of a card', () => {
  // What a PVC back actually shows: no branding, no document name — an address
  // block, a date, small print. The front's keyword demand can never be met
  // here, which is exactly why the side matters.
  const PVC_BACK = ['NO 12 ADEOLA STREET', 'IKEJA LAGOS', 'POLLING UNIT 004', 'ISSUED 2023'];

  it('accepts an unbranded back once the front established identity', () => {
    const r = verifyDocumentIdentity(PVC_BACK, { country: 'NG', idType: 'pvc', side: 'back' });
    expect(r.identified).toBe(true);
  });

  it('still demands keywords on the FRONT — the back rule must not leak', () => {
    const r = verifyDocumentIdentity(PVC_BACK, { country: 'NG', idType: 'pvc', side: 'front' });
    expect(r.identified).toBe(false);
  });

  it("rejects a different document's front swapped in as the 'back'", () => {
    const r = verifyDocumentIdentity(['FRSC', 'FEDERAL ROAD SAFETY', 'DRIVER'], {
      country: 'NG',
      idType: 'pvc',
      side: 'back',
    });
    expect(r.identified).toBe(false);
    expect(r.hint).toBe('wrongDocument');
  });

  it('never asks the back for an MRZ', () => {
    // A hypothetical two-sided MRZ document: the strip lives on the front, so
    // the back must not be held hostage to it.
    const r = verifyDocumentIdentity(PVC_BACK, {
      country: 'NG',
      idType: 'pvc',
      side: 'back',
      requireValidMrz: true,
    });
    expect(r.identified).toBe(true);
  });
});

describe('DocumentTextGate', () => {
  const NG_PVC = ['INEC', 'PERMANENT VOTER', 'INDEPENDENT NATIONAL ELECTORAL'];
  const framed = { x: 0.2, y: 0.3, width: 0.6, height: 0.4 };

  it('waits out the dwell before firing', () => {
    const gate = new DocumentTextGate({ dwellMs: 700 });
    const opts = { country: 'NG', idType: 'pvc', bounds: framed };

    expect(gate.update(NG_PVC, { ...opts, now: 1000 }).framing).toBe('holding');
    expect(gate.update(NG_PVC, { ...opts, now: 1400 }).framing).toBe('holding');
    expect(gate.update(NG_PVC, { ...opts, now: 1700 }).framing).toBe('ready');
    expect(gate.hasFired).toBe(true);
  });

  it('restarts the dwell when framing breaks — no mid-move capture', () => {
    const gate = new DocumentTextGate({ dwellMs: 700 });
    const opts = { country: 'NG', idType: 'pvc' };

    gate.update(NG_PVC, { ...opts, bounds: framed, now: 1000 });
    // Document yanked too close: area over the max.
    gate.update(NG_PVC, { ...opts, bounds: { x: 0, y: 0, width: 1, height: 0.95 }, now: 1200 });
    // Back in frame — the clock must start again, not resume.
    expect(gate.update(NG_PVC, { ...opts, bounds: framed, now: 1400 }).framing).toBe('holding');
    expect(gate.update(NG_PVC, { ...opts, bounds: framed, now: 1900 }).framing).toBe('holding');
    expect(gate.hasFired).toBe(false);
  });

  it('fires immediately on a check-digit-valid MRZ', () => {
    // Conclusive on its own: only a travel document carries one and it only
    // validates when legible, so there is nothing left for a dwell to prove.
    const gate = new DocumentTextGate();
    const r = gate.update([MRZ_L1, MRZ_L2], {
      country: 'NG',
      idType: 'passport',
      hasValidMrz: true,
      now: 1000,
    });
    expect(r.framing).toBe('ready');
  });

  it('does NOT fire instantly on a merely stored MRZ', () => {
    // Otherwise every retake fires on its first frame, before the user has
    // re-aimed at anything.
    const gate = new DocumentTextGate({ dwellMs: 700 });
    const r = gate.update([MRZ_L1, MRZ_L2], {
      country: 'NG',
      idType: 'passport',
      mrzAlreadyCaptured: true,
      bounds: framed,
      now: 1000,
    });
    expect(r.framing).toBe('holding');
  });

  it('tells a too-far user to move closer and a too-close user to move back', () => {
    const gate = new DocumentTextGate();
    const opts = { country: 'NG', idType: 'pvc', now: 1000 };
    expect(
      gate.update(NG_PVC, { ...opts, bounds: { x: 0.45, y: 0.45, width: 0.1, height: 0.1 } }).hint,
    ).toBe('moveCloser');
    expect(
      gate.update(NG_PVC, { ...opts, bounds: { x: 0, y: 0, width: 1, height: 0.9 } }).hint,
    ).toBe('moveBack');
  });

  it('reports dwell progress for the scan ring', () => {
    const gate = new DocumentTextGate({ dwellMs: 1000 });
    expect(gate.progress(1000)).toBe(0);
    gate.update(NG_PVC, { country: 'NG', idType: 'pvc', bounds: framed, now: 1000 });
    expect(gate.progress(1500)).toBeCloseTo(0.5, 2);
    expect(gate.progress(9000)).toBe(1);
  });

  it('stays latched after firing until reset — the bug the side key exists for', () => {
    // A fired gate refuses everything. That is correct within one side, and it
    // is exactly why the hook must reset when the side changes: front and back
    // share an idType and the viewfinder does not remount, so without a
    // changing reset key the back would never auto-capture at all.
    const gate = new DocumentTextGate({ dwellMs: 0 });
    gate.update(NG_PVC, { country: 'NG', idType: 'pvc', bounds: framed, now: 1000 });
    expect(gate.hasFired).toBe(true);

    const after = gate.update(NG_PVC, { country: 'NG', idType: 'pvc', bounds: framed, now: 5000 });
    expect(after.hint).toBe('captured');
    expect(after.framing).toBe('ready');
    expect(gate.hasFired).toBe(true);
  });

  it('fires on a sparse PVC back that the front thresholds would hold forever', () => {
    // The regression: the back is barcode-and-small-print — few lines, little
    // text area, zero identity keywords — and auto-capture never fired there.
    const gate = new DocumentTextGate({ dwellMs: 700 });
    const back = ['NO 12 ADEOLA STREET', 'IKEJA LAGOS', 'POLLING UNIT 004'];
    const sparse = { x: 0.3, y: 0.4, width: 0.35, height: 0.12 }; // ~4% of frame
    const opts = { country: 'NG', idType: 'pvc', side: 'back' as const, bounds: sparse };

    expect(gate.update(back, { ...opts, now: 1000 }).framing).toBe('holding');
    expect(gate.update(back, { ...opts, now: 1800 }).framing).toBe('ready');
    expect(gate.hasFired).toBe(true);
  });

  it('reset clears the latch so the next side starts fresh', () => {
    const gate = new DocumentTextGate({ dwellMs: 0 });
    gate.update(NG_PVC, { country: 'NG', idType: 'pvc', bounds: framed, now: 1000 });
    expect(gate.hasFired).toBe(true);
    gate.reset();
    expect(gate.hasFired).toBe(false);
    expect(gate.progress(2000)).toBe(0);
  });
});

describe('rectFramingProblem', () => {
  const CARD = { expectedAspect: 1.586 };
  const rect = (o: Partial<{ x: number; y: number; width: number; height: number; aspect: number }>) => ({
    found: true, x: 0.2, y: 0.3, width: 0.6, height: 0.38, aspect: 1.586, confidence: 0.9, ...o,
  });

  it('has NO opinion when the platform cannot detect', () => {
    // The decisive one: Android reports found:false, and "no geometry" must not
    // read as "badly framed" or auto-capture would never fire there.
    expect(rectFramingProblem({ found: false, x: 0, y: 0, width: 0, height: 0, aspect: 0, confidence: 0 }, CARD)).toBeNull();
    expect(rectFramingProblem(null, CARD)).toBeNull();
  });

  it('accepts a well-framed card', () => {
    expect(rectFramingProblem(rect({}), CARD)).toBeNull();
  });

  it('accepts the document rotated 90°', () => {
    // Same document, held the other way up. Rejecting it would refuse a
    // perfectly good frame because the detector reported what it saw.
    expect(rectFramingProblem(rect({ aspect: 1 / 1.586 }), CARD)).toBeNull();
  });

  it('rejects a shape that is not the document', () => {
    expect(rectFramingProblem(rect({ aspect: 4.2 }), CARD)).toBe('wrongDocument');
  });

  it('asks a too-far user to move closer', () => {
    expect(rectFramingProblem(rect({ width: 0.2, height: 0.126 }), CARD)).toBe('moveCloser');
  });

  it('applies maxArea when the shape can actually reach it', () => {
    // Worth stating plainly: at a CARD aspect (1.586) maxArea is unreachable
    // inside a 0..1 frame — w·h > 0.92 with w = 1.586h needs w > 1.2. So for a
    // card it is the MARGIN rule below, not this one, that catches a document
    // held too close. maxArea earns its place for squarer documents.
    expect(
      rectFramingProblem(rect({ x: 0.01, y: 0.01, width: 0.97, height: 0.96, aspect: 1.01 }), {
        expectedAspect: 1.0,
      }),
    ).toBe('moveBack');
  });

  it('rejects a document flush to the frame edge — corners get cut', () => {
    expect(rectFramingProblem(rect({ x: 0, y: 0.3, width: 0.6, height: 0.38 }), CARD)).toBe('moveBack');
  });
});
