// ─── Will the server be able to read these document photos? ──────────────────
//
// The React Native mirror of the web SDK's document capture check and the
// Flutter SDK's. Keep the three in lockstep: the problem order and every
// string below are word for word the same on each platform.
//
// Right after a document side uploads, the server runs the SAME detectors it
// later decides the verification with: a face on the photo printed on the
// front (only when the workflow will compare the selfie with that photo), and
// a readable barcode (only for documents whose details are read from one, such
// as a Nigerian voter's card or driver's licence). Asking here turns a decline
// that arrives by webhook into a retake that costs a few seconds.
//
// A NOTICE, NEVER A GATE. A detector can miss, so the applicant can always
// continue with the photos they have. And the check itself must never block
// the flow: a timeout, a network error or any answer we cannot read counts as
// "no problem", exactly like a check that found nothing wrong.
//
// Pure apart from the runner's timer, so the rules are pinned by a test
// without mounting React Native.

import type {
  DocumentCaptureCheckRequest,
  DocumentCaptureCheckResponse,
  DocumentCaptureSide,
} from '../services/api-types';

export type DocumentCaptureCheckResult = DocumentCaptureCheckResponse;

export type CaptureProblemKind = 'no_face' | 'no_barcode';

export interface CaptureProblem {
  side: DocumentCaptureSide;
  kind: CaptureProblemKind;
}

/** How long Continue waits for each side's check before treating it as fine. */
export const CAPTURE_CHECK_TIMEOUT_MS = 8000;

export const CAPTURE_CHECK_TITLE = 'Check your photos';

export const CAPTURE_CHECK_CONTINUE_ANYWAY = 'Continue anyway';

const SIDE_ORDER: readonly DocumentCaptureSide[] = ['front', 'back'];

/**
 * The problems worth a retake, front before back and, within a side, the face
 * before the barcode. Only an explicit `false` is a problem: `true` is fine and
 * `null` means the check did not apply or could not look.
 */
export function captureCheckProblems(results: readonly DocumentCaptureCheckResult[]): CaptureProblem[] {
  const problems: CaptureProblem[] = [];
  for (const side of SIDE_ORDER) {
    const forSide = results.filter((r) => r.side === side);
    if (forSide.some((r) => r.face === false)) problems.push({ side, kind: 'no_face' });
    if (forSide.some((r) => r.barcode === false)) problems.push({ side, kind: 'no_barcode' });
  }
  return problems;
}

/** The sides a retake button is offered for, once each and in problem order. */
export function captureRetakeSides(problems: readonly CaptureProblem[]): DocumentCaptureSide[] {
  const sides: DocumentCaptureSide[] = [];
  for (const p of problems) if (!sides.includes(p.side)) sides.push(p.side);
  return sides;
}

export function captureProblemMessage(kind: CaptureProblemKind): string {
  switch (kind) {
    case 'no_face':
      return "We couldn't see the face in the photo on the front of your ID. Retake it in good light, with the ID out of any plastic cover and no glare over the photo.";
    case 'no_barcode':
      return "We couldn't read the barcode on the back of your ID. Retake it with the ID out of any plastic cover, flat, filling the frame and with no glare over the barcode.";
  }
}

/**
 * The retake button's words. A side picked from the device (upload-only mode)
 * was never taken with the camera, so it is replaced rather than retaken,
 * matching the review screen's own wording.
 */
export function captureRetakeLabel(side: DocumentCaptureSide, uploadOnly: boolean): string {
  const verb = uploadOnly ? 'Replace' : 'Retake';
  return `${verb} ${side}`;
}

/**
 * Check every uploaded side at once and return what came back in time.
 *
 * Never throws and never waits longer than `timeoutMs` per side: a side whose
 * call rejects or runs out of time is simply left out, which reads as "no
 * problem". The side each result describes is the side we ASKED about, and a
 * field that is not a boolean is read as `null`, so a malformed answer cannot
 * invent a problem.
 */
export async function runCaptureChecks(
  requests: readonly DocumentCaptureCheckRequest[],
  check: (body: DocumentCaptureCheckRequest, signal: AbortSignal) => Promise<DocumentCaptureCheckResponse>,
  timeoutMs: number = CAPTURE_CHECK_TIMEOUT_MS,
): Promise<DocumentCaptureCheckResult[]> {
  const settled = await Promise.all(requests.map((body) => checkOneSide(body, check, timeoutMs)));
  return settled.filter((r): r is DocumentCaptureCheckResult => r !== null);
}

async function checkOneSide(
  body: DocumentCaptureCheckRequest,
  check: (body: DocumentCaptureCheckRequest, signal: AbortSignal) => Promise<DocumentCaptureCheckResponse>,
  timeoutMs: number,
): Promise<DocumentCaptureCheckResult | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    const answered = check(body, controller.signal).then(
      (res): DocumentCaptureCheckResult => ({
        side: body.side,
        face: readVerdict(res?.face),
        barcode: readVerdict(res?.barcode),
      }),
    );
    return await Promise.race([answered, timedOut]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readVerdict(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
