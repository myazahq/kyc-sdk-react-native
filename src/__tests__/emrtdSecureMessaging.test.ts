import { fromHex, toHex } from '../emrtd/bytes';
import { SecureMessagingError, SecureMessagingSession } from '../emrtd/secureMessaging';
import { nodePrimitives } from './helpers/nodeEmrtdPrimitives';

// ─── Secure messaging, against ICAO 9303 Part 11 Appendix D.4 ─────────────────
//
// After BAC every command and response is wrapped. The standard's worked
// example carries the exact bytes for a SELECT and a READ BINARY, which is what
// makes this checkable without a chip.
//
// The send-sequence counter is the part that goes subtly wrong: it advances
// BEFORE the command and again BEFORE the response, so one exchange consumes
// two values. An off-by-one there does not fail on the first command — it fails
// on the SECOND, where it looks like a wrong key rather than a counter bug.

const p = nodePrimitives();

// Appendix D.4's session, established by the BAC example.
const KS_ENC = fromHex('979ec13b1cbfe9dcd01ab0fed307eae5');
const KS_MAC = fromHex('f1cb1f1fb5adf208806b89dc579dc1f8');
const SSC = fromHex('887022120c06c226');

const session = (): SecureMessagingSession =>
  new SecureMessagingSession(p, { ksEnc: KS_ENC, ksMac: KS_MAC }, SSC);

describe('protecting a command', () => {
  it('wraps SELECT EF.COM as the standard does', () => {
    // Appendix D.4: SELECT FILE with EF.COM's identifier.
    const wrapped = session().protect({
      cla: 0x00,
      ins: 0xa4,
      p1: 0x02,
      p2: 0x0c,
      data: fromHex('011e'),
    });
    expect(toHex(wrapped)).toBe(
      '0ca4020c158709016375432908c044f68e08bf8b92d635ff24f800',
    );
  });

  it('wraps READ BINARY as the standard does', () => {
    // Appendix D.4's second exchange, whose counter has already advanced twice.
    const s = session();
    s.protect({ cla: 0x00, ins: 0xa4, p1: 0x02, p2: 0x0c, data: fromHex('011e') });
    s.unprotect(fromHex('990290008e08fa855a5d4c50a8ed9000'));
    const wrapped = s.protect({ cla: 0x00, ins: 0xb0, p1: 0x00, p2: 0x00, le: 4 });
    expect(toHex(wrapped)).toBe('0cb000000d9701048e08ed6705417e96ba5500');
  });

  it('sets the secure-messaging bits on the class byte', () => {
    const wrapped = session().protect({ cla: 0x00, ins: 0xb0, p1: 0, p2: 0, le: 4 });
    expect(wrapped[0]! & 0x0c).toBe(0x0c);
  });

  it('always asks for the maximum response length', () => {
    // The wrapped response is longer than the wrapped command; a short Le
    // silently truncates it, and the truncation surfaces as a MAC failure.
    const wrapped = session().protect({ cla: 0x00, ins: 0xb0, p1: 0, p2: 0, le: 4 });
    expect(wrapped[wrapped.length - 1]).toBe(0x00);
  });
});

describe('unprotecting a response', () => {
  it('reads the status from DO99, not the outer status word', () => {
    // A chip can return 0x9000 on the wrapper while reporting a failure inside.
    // Reading the outer word would treat that as success.
    const s = session();
    s.protect({ cla: 0x00, ins: 0xa4, p1: 0x02, p2: 0x0c, data: fromHex('011e') });
    const { statusWord, data } = s.unprotect(fromHex('990290008e08fa855a5d4c50a8ed9000'));
    expect(statusWord).toBe(0x9000);
    expect(data).toHaveLength(0);
  });

  it('decrypts the standard’s READ BINARY response', () => {
    const s = session();
    s.protect({ cla: 0x00, ins: 0xa4, p1: 0x02, p2: 0x0c, data: fromHex('011e') });
    s.unprotect(fromHex('990290008e08fa855a5d4c50a8ed9000'));
    s.protect({ cla: 0x00, ins: 0xb0, p1: 0x00, p2: 0x00, le: 4 });
    const { data, statusWord } = s.unprotect(
      fromHex('8709019ff0ec34f9922651990290008e08ad55cc17140b2ded9000'),
    );
    expect(toHex(data)).toBe('60145f01');
    expect(statusWord).toBe(0x9000);
  });

  it('refuses a response with no checksum', () => {
    // An unauthenticated response is not data — it is whatever the channel
    // decided to hand back.
    const s = session();
    s.protect({ cla: 0x00, ins: 0xb0, p1: 0, p2: 0, le: 4 });
    expect(() => s.unprotect(fromHex('99029000'))).toThrow(SecureMessagingError);
  });

  it('refuses a response whose checksum does not verify', () => {
    const s = session();
    s.protect({ cla: 0x00, ins: 0xa4, p1: 0x02, p2: 0x0c, data: fromHex('011e') });
    // Flip the last MAC byte.
    expect(() => s.unprotect(fromHex('990290008e08fa855a5d4c50a8ee9000'))).toThrow(
      /integrity/i,
    );
  });
});

describe('the send-sequence counter', () => {
  it('advances once per command and once per response', () => {
    const s = session();
    expect(toHex(s.sendSequenceCounter)).toBe('887022120c06c226');
    s.protect({ cla: 0x00, ins: 0xa4, p1: 0x02, p2: 0x0c, data: fromHex('011e') });
    expect(toHex(s.sendSequenceCounter)).toBe('887022120c06c227');
    s.unprotect(fromHex('990290008e08fa855a5d4c50a8ed9000'));
    expect(toHex(s.sendSequenceCounter)).toBe('887022120c06c228');
  });

  it('carries across a byte boundary', () => {
    // A naive increment of the last byte alone would wrap to 00 and desync the
    // session, on a chip that had done nothing wrong.
    const s = new SecureMessagingSession(
      p,
      { ksEnc: KS_ENC, ksMac: KS_MAC },
      fromHex('00000000000000ff'),
    );
    s.protect({ cla: 0x00, ins: 0xb0, p1: 0, p2: 0, le: 4 });
    expect(toHex(s.sendSequenceCounter)).toBe('0000000000000100');
  });

  it('produces DIFFERENT bytes for the same command twice', () => {
    // The whole point of the counter: without it, a captured command could be
    // replayed verbatim. Two protects in a row is enough to show it — the
    // counter advances on each, so the MACs cannot match.
    const s = session();
    const first = s.protect({ cla: 0x00, ins: 0xb0, p1: 0, p2: 0, le: 4 });
    const second = s.protect({ cla: 0x00, ins: 0xb0, p1: 0, p2: 0, le: 4 });
    expect(toHex(first)).not.toBe(toHex(second));
  });
});
