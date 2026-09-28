// A resumed session restores the selfie's mediaId (and here, the recording's,
// which is uploaded during capture), but never the liveness claim that says
// how the selfie was taken: that lives in memory and is gone after a restart.
// A selfie with no claim behind it is not proof of a live person, and the
// server refuses a face re-authentication without one. So on restore the
// selfie and its recording are dropped and, when the saved step comes after
// liveness, the person is sent back to take it again.
//
// Same rule as the web SDK's lib/liveness-resume.ts and the Flutter SDK's
// config/liveness_resume.dart. Change all three together.

import type { KYCStep } from '../types/config';

/** Steps that, once a selfie exists, can only be reached after liveness. */
const AFTER_LIVENESS: ReadonlySet<string> = new Set<KYCStep>([
  'supporting-documents',
  'proof-of-address',
  'address-search',
  'address-collection',
  'address-entrance',
  'address-review',
  'questionnaire',
  'submitted',
]);

export interface RestoredCapture {
  step: string | undefined;
  mediaIds: Record<string, string> | undefined;
}

/** PURE. The restored step and media, with the selfie left to be taken again. */
export function withoutRestoredSelfie(restored: RestoredCapture): RestoredCapture {
  const media = restored.mediaIds;
  if (!media?.selfie) return restored;
  const { selfie: _selfie, livenessVideo: _video, ...rest } = media;
  const step = restored.step && AFTER_LIVENESS.has(restored.step) ? 'liveness' : restored.step;
  return { step, mediaIds: rest };
}
