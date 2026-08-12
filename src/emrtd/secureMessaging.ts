import { concat, padToBlock, timingSafeEqual, unpadFromBlock } from './bytes';
import { encodeTlv, readTlvSequence } from './der';
import type { EmrtdPrimitives, SessionKeys } from './crypto';
import { DES_EDE2_SUITE, type CipherSuite } from './suites';

// ---------------------------------------------------------------------------
// Secure messaging (ICAO 9303 Part 11 §9.8).
//
// After BAC every command and response is wrapped: the data encrypted under
// KSenc, the whole thing MACed under KSmac, and a send-sequence counter mixed
// in so neither side can replay a message from earlier in the session.
//
// The SSC is the part that is easy to get subtly wrong. It is incremented
// BEFORE each command and again BEFORE checking the response, so one command
// consumes two values. Getting that out of step produces a MAC failure on the
// second command of a session — which looks like a wrong key rather than an
// off-by-one, and is why it is centralised here in one small object.
// ---------------------------------------------------------------------------

const DO87 = 0x87; // Encrypted data, with a padding-content indicator
const DO85 = 0x85; // Encrypted data, no indicator (some chips use this)
const DO97 = 0x97; // Expected response length
const DO99 = 0x99; // Processing status (SW1 SW2)
const DO8E = 0x8e; // Cryptographic checksum

export class SecureMessagingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecureMessagingError';
    Object.setPrototypeOf(this, SecureMessagingError.prototype);
  }
}

/** An APDU, before wrapping. */
export interface CommandApdu {
  cla: number;
  ins: number;
  p1: number;
  p2: number;
  data?: Uint8Array;
  /** Expected response length. Undefined means the command expects none. */
  le?: number;
}

/**
 * A secure-messaging session: the keys plus the counter.
 *
 * Stateful ON PURPOSE — the SSC has to advance in lockstep with the exchange,
 * and threading it through every call site is how it drifts.
 */
export class SecureMessagingSession {
  private ssc: Uint8Array;

  constructor(
    private readonly p: EmrtdPrimitives,
    private readonly keys: SessionKeys,
    initialSsc: Uint8Array,
    /**
     * Which cipher the session runs on. BAC is always 3DES (the default, so
     * every existing call site is unchanged); a PACE session may have
     * negotiated AES, which changes the block size, the padding unit, the
     * counter width and how the IV is derived.
     */
    private readonly suite: CipherSuite = DES_EDE2_SUITE,
  ) {
    this.ssc = new Uint8Array(initialSsc);
  }

  /** Increment the counter as a big-endian integer, with wraparound. */
  private incrementSsc(): void {
    for (let i = this.ssc.length - 1; i >= 0; i--) {
      this.ssc[i] = (this.ssc[i]! + 1) & 0xff;
      if (this.ssc[i] !== 0) break;
    }
  }

  /** Wrap a command for transmission. Consumes one SSC value. */
  protect(apdu: CommandApdu): Uint8Array {
    this.incrementSsc();

    // The class byte gains the secure-messaging bits, and the MAC is computed
    // over the PADDED header — a detail the standard is easy to misread.
    const cla = apdu.cla | 0x0c;
    const block = this.suite.blockSize;
    const header = padToBlock(
      new Uint8Array([cla, apdu.ins, apdu.p1, apdu.p2]),
      block,
    );

    const parts: Uint8Array[] = [];

    if (apdu.data && apdu.data.length > 0) {
      const encrypted = this.suite.encrypt(
        this.p,
        this.keys.ksEnc,
        padToBlock(apdu.data, block),
        this.ssc,
      );
      // The leading 0x01 is the padding-content indicator: "ISO 9797-1 method
      // 2 was used". Omitting it is a common source of chips rejecting DO'87'.
      parts.push(encodeTlv(DO87, concat(new Uint8Array([0x01]), encrypted)));
    }

    if (apdu.le !== undefined) {
      const le =
        apdu.le > 0xff
          ? new Uint8Array([(apdu.le >> 8) & 0xff, apdu.le & 0xff])
          : new Uint8Array([apdu.le & 0xff]);
      parts.push(encodeTlv(DO97, le));
    }

    const body = concat(...parts);
    const mac = this.suite.mac(
      this.p,
      this.keys.ksMac,
      padToBlock(concat(this.ssc, header, body), block),
    );
    const checksum = encodeTlv(DO8E, mac);

    const payload = concat(body, checksum);
    // Le of 0x00 asks for the maximum: the wrapped response is longer than the
    // wrapped command, and a short Le silently truncates it.
    return concat(
      new Uint8Array([cla, apdu.ins, apdu.p1, apdu.p2, payload.length]),
      payload,
      new Uint8Array([0x00]),
    );
  }

  /**
   * Unwrap a response. Consumes one SSC value.
   *
   * Throws when the checksum is absent or does not verify — an unauthenticated
   * response is not data, it is whatever the channel decided to hand back.
   */
  unprotect(response: Uint8Array): { data: Uint8Array; statusWord: number } {
    this.incrementSsc();

    const parsed = readTlvSequence(response);
    const checksumIndex = parsed.findIndex((o) => o.tag === DO8E);
    if (checksumIndex < 0) throw new SecureMessagingError('The response carried no checksum.');
    const checksum = parsed[checksumIndex]!;

    // The MAC covers the objects BEFORE DO'8E' — everything after it is outside
    // the protected data. Taking a prefix rather than filtering matters: a
    // response that still carries its outer status word parses `9000` as a
    // perfectly valid empty TLV, and folding that into the MAC fails every
    // verification for a reason nothing about the message reveals.
    const objects = parsed.slice(0, checksumIndex);
    const macInput = concat(
      this.ssc,
      ...objects.map((o) => encodeTlv(o.tag, o.value)),
    );
    const expected = this.suite.mac(
      this.p,
      this.keys.ksMac,
      padToBlock(macInput, this.suite.blockSize),
    );
    if (!timingSafeEqual(expected, checksum.value)) {
      throw new SecureMessagingError('The response failed its integrity check.');
    }

    const statusObject = objects.find((o) => o.tag === DO99);
    // The status comes from DO'99', NOT from the outer status word. A chip can
    // return 0x9000 on the wrapper while reporting a failure inside — reading
    // the outer word treats that as success.
    const statusWord =
      statusObject && statusObject.value.length >= 2
        ? (statusObject.value[0]! << 8) | statusObject.value[1]!
        : 0x0000;

    const encrypted = objects.find((o) => o.tag === DO87 || o.tag === DO85);
    if (!encrypted) return { data: new Uint8Array(0), statusWord };

    // DO'87' carries the padding-content indicator as its first byte; DO'85'
    // does not.
    const body =
      encrypted.tag === DO87 ? encrypted.value.subarray(1) : encrypted.value;
    if (body.length === 0 || body.length % this.suite.blockSize !== 0) {
      throw new SecureMessagingError('The response ciphertext was misaligned.');
    }

    return {
      data: unpadFromBlock(
        this.suite.decrypt(this.p, this.keys.ksEnc, body, this.ssc),
        this.suite.blockSize,
      ),
      statusWord,
    };
  }

  /** The current counter — for diagnostics and tests only. */
  get sendSequenceCounter(): Uint8Array {
    return new Uint8Array(this.ssc);
  }
}
