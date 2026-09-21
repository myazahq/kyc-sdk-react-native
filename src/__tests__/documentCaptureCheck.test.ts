import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CAPTURE_CHECK_CONTINUE_ANYWAY,
  CAPTURE_CHECK_TITLE,
  captureCheckProblems,
  captureProblemMessage,
  captureRetakeLabel,
  captureRetakeSides,
  runCaptureChecks,
  type DocumentCaptureCheckResult,
} from '../lib/documentCaptureCheck';
import type { DocumentCaptureCheckRequest } from '../services/api-types';

// ─── The document capture check ──────────────────────────────────────────────
//
// After a document side uploads, the server says whether it could see the face
// on the printed photo and read the barcode. Only an explicit `false` asks for
// a retake, and nothing about the check may ever stop the applicant going on.

const result = (
  side: 'front' | 'back',
  face: boolean | null,
  barcode: boolean | null,
): DocumentCaptureCheckResult => ({ side, face, barcode });

describe('captureCheckProblems', () => {
  it('finds nothing when every check passed or did not apply', () => {
    expect(captureCheckProblems([result('front', true, null), result('back', null, true)])).toEqual([]);
    expect(captureCheckProblems([result('front', null, null), result('back', null, null)])).toEqual([]);
    expect(captureCheckProblems([])).toEqual([]);
  });

  it('asks for the front when the printed photo shows no face', () => {
    expect(captureCheckProblems([result('front', false, null)])).toEqual([{ side: 'front', kind: 'no_face' }]);
  });

  it('asks for the back when its barcode does not read', () => {
    expect(captureCheckProblems([result('back', null, false)])).toEqual([{ side: 'back', kind: 'no_barcode' }]);
  });

  it('puts the front before the back whatever order the answers came in', () => {
    expect(captureCheckProblems([result('back', null, false), result('front', false, null)])).toEqual([
      { side: 'front', kind: 'no_face' },
      { side: 'back', kind: 'no_barcode' },
    ]);
  });

  it('puts the face before the barcode on the same side', () => {
    expect(captureCheckProblems([result('front', false, false)])).toEqual([
      { side: 'front', kind: 'no_face' },
      { side: 'front', kind: 'no_barcode' },
    ]);
  });
});

describe('captureRetakeSides', () => {
  it('offers each side once, in problem order', () => {
    const problems = captureCheckProblems([result('back', null, false), result('front', false, false)]);
    expect(captureRetakeSides(problems)).toEqual(['front', 'back']);
    expect(captureRetakeSides([])).toEqual([]);
  });
});

describe('the words', () => {
  it('matches the web and Flutter SDKs word for word', () => {
    expect(captureProblemMessage('no_face')).toBe(
      "We couldn't see the face in the photo on the front of your ID. Retake it in good light, with the ID out of any plastic cover and no glare over the photo.",
    );
    expect(captureProblemMessage('no_barcode')).toBe(
      "We couldn't read the barcode on the back of your ID. Retake it with the ID out of any plastic cover, flat, filling the frame and with no glare over the barcode.",
    );
    expect(CAPTURE_CHECK_TITLE).toBe('Check your photos');
    expect(CAPTURE_CHECK_CONTINUE_ANYWAY).toBe('Continue anyway');
  });

  it('retakes a camera capture and replaces a photo picked from the device', () => {
    expect(captureRetakeLabel('front', false)).toBe('Retake front');
    expect(captureRetakeLabel('back', false)).toBe('Retake back');
    expect(captureRetakeLabel('front', true)).toBe('Replace front');
    expect(captureRetakeLabel('back', true)).toBe('Replace back');
  });

  it('writes none of it with an em dash', () => {
    const words = [
      captureProblemMessage('no_face'),
      captureProblemMessage('no_barcode'),
      CAPTURE_CHECK_TITLE,
      CAPTURE_CHECK_CONTINUE_ANYWAY,
      captureRetakeLabel('front', false),
      captureRetakeLabel('back', true),
    ];
    for (const text of words) expect(text).not.toMatch(/—/);
    // The notice's own screen reader words live in the component.
    const notice = readFileSync(join(__dirname, '..', 'screens', 'document', 'CaptureCheckNotice.tsx'), 'utf8');
    expect(notice).not.toMatch(/—/);
  });
});

describe('runCaptureChecks never blocks the flow', () => {
  const request = (side: 'front' | 'back'): DocumentCaptureCheckRequest => ({
    mediaId: `med_${side}`,
    side,
    country: 'NG',
    idType: 'pvc',
  });

  it('checks every side at once and keeps the side it asked about', async () => {
    const calls: string[] = [];
    const results = await runCaptureChecks([request('front'), request('back')], async (body) => {
      calls.push(body.side);
      // A server answer naming the wrong side must not move the problem.
      return { side: 'front', face: body.side === 'front' ? false : null, barcode: body.side === 'back' ? false : null };
    });
    expect(calls).toEqual(['front', 'back']);
    expect(results).toEqual([result('front', false, null), result('back', null, false)]);
  });

  it('leaves out a side whose call fails', async () => {
    const results = await runCaptureChecks([request('front'), request('back')], async (body) => {
      if (body.side === 'front') throw new Error('network');
      return { side: 'back', face: null, barcode: false };
    });
    expect(results).toEqual([result('back', null, false)]);
  });

  it('leaves out a side that runs out of time, and aborts its request', async () => {
    let aborted = false;
    const results = await runCaptureChecks(
      [request('front')],
      (_body, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('aborted'));
          });
        }),
      10,
    );
    expect(results).toEqual([]);
    expect(aborted).toBe(true);
  });

  it('reads anything that is not a boolean as not applicable', async () => {
    const results = await runCaptureChecks([request('front')], async () => {
      return { side: 'front', face: 'no' as unknown as boolean, barcode: undefined as unknown as null };
    });
    expect(results).toEqual([result('front', null, null)]);
    expect(captureCheckProblems(results)).toEqual([]);
  });
});
