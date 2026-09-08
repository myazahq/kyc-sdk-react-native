import { KYCApiError } from './api';
import { UPLOAD_HINT } from '../config/uploadLimits';

// ---------------------------------------------------------------------------
// Why an upload failed, in words the person can act on.
//
// Every upload used to fail as "we could not upload that document", which tells
// the applicant nothing about whether to pick a smaller file, a different
// format, or simply try again on better signal. The server already says which
// it is; this reads its answer and hands back the sentence that matches.
// ---------------------------------------------------------------------------

/** The refusal, as something the applicant can do something about. */
export function uploadFailureMessage(error: unknown): string {
  const status = error instanceof KYCApiError ? error.statusCode : null;
  const raw = error instanceof Error ? error.message.toLowerCase() : '';

  if (status === 413 || raw.includes('too large')) {
    return `That file is too large. ${UPLOAD_HINT}`;
  }
  if (raw.includes('mimetype') || raw.includes('mime type') || raw.includes('unsupported')) {
    return `That file type is not supported. ${UPLOAD_HINT}`;
  }
  // A 4xx we have no better words for still says the file is the problem, so
  // the person retries with a DIFFERENT one rather than the same one twice.
  if (status !== null && status >= 400 && status < 500) {
    return `We could not read that file. ${UPLOAD_HINT}`;
  }
  return 'We could not upload that document. Please check your connection and try again.';
}
