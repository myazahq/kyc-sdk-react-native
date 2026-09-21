// ---------------------------------------------------------------------------
// How the applicant may put a document in front of us.
//
// Two workflow switches, each on unless set to `false`: `allowDocumentScan`
// (photograph it with the live camera) and `allowDocumentUpload` (choose a
// photo of it from the device). The server refuses to publish a workflow with
// both off, but a stored or prop-supplied config can still carry that, and a
// document step with no way in is a dead end. So the camera comes back on in
// that case: it is the method the step was built around.
//
// Screens read the pair through here and never the raw keys, so the fallback
// is one rule rather than a check every screen has to remember. Mirrors the
// web and Flutter SDKs.
// ---------------------------------------------------------------------------

export interface DocumentCaptureMethods {
  /** Photograph the document with the live camera. */
  scan: boolean;
  /** Choose a photo of the document from the device. */
  upload: boolean;
}

export function documentCaptureMethods(config: {
  allowDocumentScan?: boolean;
  allowDocumentUpload?: boolean;
}): DocumentCaptureMethods {
  const upload = config.allowDocumentUpload !== false;
  // With upload off the camera is the only way left, whatever its flag says.
  const scan = upload ? config.allowDocumentScan !== false : true;
  return { scan, upload };
}
