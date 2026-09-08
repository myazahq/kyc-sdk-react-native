import { KYCApiError } from '../services/api';
import { uploadFailureMessage } from '../services/uploadErrors';
import { UPLOAD_HINT } from '../config/uploadLimits';

// ─── An upload refusal has to say which refusal it was ───────────────────────
//
// Every failure used to read "we could not upload that document", which leaves
// the applicant with nothing to change: a file that is too big, one in a format
// we cannot read, and a dropped connection all want different responses. The
// server already distinguishes them; these are the sentences it maps to.

describe('uploadFailureMessage', () => {
  it('names a size refusal and repeats the limits', () => {
    const message = uploadFailureMessage(new KYCApiError('File too large (30.2MB > 25MB)', 413, 'file_too_large'));
    expect(message).toContain('too large');
    expect(message).toContain(UPLOAD_HINT);
  });

  it('names an unsupported format', () => {
    const message = uploadFailureMessage(
      new KYCApiError('mimeType one of image/jpeg, image/png, image/webp, application/pdf', 400),
    );
    expect(message).toContain('not supported');
    expect(message).toContain(UPLOAD_HINT);
  });

  it('still blames the FILE on a 4xx it has no better words for', () => {
    // The applicant should try a different file rather than the same one twice.
    expect(uploadFailureMessage(new KYCApiError('file is required', 400))).toContain('could not read');
  });

  it('blames the CONNECTION on anything else', () => {
    // A 5xx or a thrown network error is not the file's fault, and telling
    // somebody to pick another photo would send them round a pointless loop.
    const server = uploadFailureMessage(new KYCApiError('upstream unavailable', 502));
    const offline = uploadFailureMessage(new TypeError('Network request failed'));
    for (const message of [server, offline]) {
      expect(message).toContain('connection');
      expect(message).not.toContain(UPLOAD_HINT);
    }
  });

  it('says something useful for a value that is not an Error at all', () => {
    expect(uploadFailureMessage('boom')).toContain('connection');
  });
});
