// ─── The review screen's words, per capture mode ──────────────────────────────
//
// The document review is shared by both ways a document gets in. "Retake" and
// "captured" describe a camera, which an upload-only workflow
// (`allowDocumentScan: false`) never shows the applicant, so that mode says
// "Replace" and "added" instead, matching the web SDK. Scan mode (scan-only and
// both-on) keeps its words exactly.
//
// Pure, so the wording is pinned by a test without mounting React Native.

export type DocumentCaptureMode = 'scan' | 'upload';

export interface DocumentReviewCopy {
  /** The line above the thumbnails saying the capture is complete. */
  status: string;
  /** The labelled action under each thumbnail. */
  redo: string;
  /** The screen reader label for that action, naming the side. */
  redoAccessibility: (sideLabel: string) => string;
  /** The enlarged view's button, naming the side. */
  redoSide: (sideLabel: string) => string;
}

export function documentReviewCopy(mode: DocumentCaptureMode, twoSided: boolean): DocumentReviewCopy {
  if (mode === 'upload') {
    return {
      status: twoSided ? 'Both sides added' : 'Photo added',
      redo: 'Replace',
      redoAccessibility: (side) => `Replace the ${side.toLowerCase()} photo`,
      redoSide: (side) => `Replace ${side.toLowerCase()}`,
    };
  }
  return {
    status: twoSided ? 'Both sides captured' : 'Photo captured',
    redo: 'Retake',
    redoAccessibility: (side) => `Retake ${side.toLowerCase()}`,
    redoSide: (side) => `Retake ${side.toLowerCase()}`,
  };
}
