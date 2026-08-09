import { readErrorMessage } from '../screens/nfc/readErrorMessage';
import { EmrtdSessionError } from '../emrtd/session';

// ---------------------------------------------------------------------------
// What a failed chip read says to the user.
//
// The platform's own string was being rendered verbatim:
//   Error Domain=NFCError Code=202 "Session invalidated unexpectedly"
// which names nothing the user can change and reads as a crash rather than a
// retryable hiccup. Every message here names the thing they can act on.
// ---------------------------------------------------------------------------

describe('readErrorMessage', () => {
  it('never leaks the raw platform error', () => {
    const raw = 'Error Domain=NFCError Code=202 "Session invalidated unexpectedly"';
    const msg = readErrorMessage(new Error(raw));
    expect(msg).not.toContain('NFCError');
    expect(msg).not.toContain('Code=202');
  });

  it('tells the user to hold the document still when the session drops', () => {
    // 202 is overwhelmingly the document shifting out of range mid-read.
    const msg = readErrorMessage(new Error('Error Domain=NFCError Code=202 "..."'));
    expect(msg).toMatch(/still/i);
  });

  it("a 202 before any chip contact is the reader failing, not the user's grip", () => {
    // Same code, opposite meaning: while still 'waiting' no chip was ever
    // detected, so there is no connection to have dropped. A wedged NFC daemon
    // (or an unsigned entitlement) is cleared by restarting the phone —
    // repositioning the document cannot help and must not be suggested.
    const err = new Error('Error Domain=NFCError Code=202 "Session invalidated unexpectedly"');
    const msg = readErrorMessage(err, 'waiting');
    expect(msg).toMatch(/restart your phone/i);
    expect(msg).not.toMatch(/hold the document/i);
    // After contact, the positioning guidance stands even at stage-aware calls.
    expect(readErrorMessage(err, 'readingData')).toMatch(/still/i);
  });

  it('does not apologise when the user cancelled', () => {
    const msg = readErrorMessage(new Error('Error Domain=NFCError Code=200 "..."'));
    expect(msg).toMatch(/cancelled/i);
  });

  it('explains a BAC failure as the wrong document, not a typo', () => {
    // The MRZ is check-digit validated before it is used as the key, so this
    // cannot be a mistyped number — it is a different document.
    const msg = readErrorMessage(new EmrtdSessionError('bac', 'bac_failed'));
    expect(msg).toMatch(/same document/i);
  });

  it('treats a transceive-level drop like a session drop: hold it still', () => {
    // Codes 100–104 are how the document shifting surfaces while a command is
    // in flight — same physical cause as 202, same remedy.
    for (const code of [100, 102, 104]) {
      const msg = readErrorMessage(new Error(`Error Domain=NFCError Code=${code} "..."`));
      expect(msg).toMatch(/still/i);
      expect(msg).not.toContain('NFCError');
    }
  });

  it("maps Android's TagLostException to the same guidance", () => {
    const msg = readErrorMessage(new Error('android.nfc.TagLostException: Tag was lost.'));
    expect(msg).toMatch(/still/i);
    expect(msg).not.toContain('TagLostException');
  });

  it('falls back to something actionable for anything unrecognised', () => {
    expect(readErrorMessage(new Error('something odd'))).toMatch(/try again/i);
    expect(readErrorMessage(null)).toMatch(/try again/i);
  });
});
