import { concat, padToBlock, timingSafeEqual, unpadFromBlock } from '../../emrtd/bytes';
import { encodeTlv, readTlvSequence } from '../../emrtd/der';
import {
  BLOCK_SIZE,
  decrypt3Des,
  encrypt3Des,
  macWithPadding,
  type EmrtdPrimitives,
  type SessionKeys,
} from '../../emrtd/crypto';

// ---------------------------------------------------------------------------
// The CHIP half of secure messaging — a simulator, for tests.
//
// The terminal half lives in src/emrtd/secureMessaging.ts. This is its
// counterpart, written independently against the same section of the standard,
// which is what makes the file-reading tests meaningful: both sides advance
// their own counter and verify each other's MACs, so a bug in either direction
// surfaces exactly as it would against real hardware — as a MAC failure on the
// second command, not the first.
//
// It deliberately lives in the test tree. Production code has no business
// carrying the chip's side of the protocol, and test-only methods bolted onto
// the real session would be a door into it.
// ---------------------------------------------------------------------------

const DO87 = 0x87;
const DO97 = 0x97;
const DO99 = 0x99;
const DO8E = 0x8e;

export interface DecodedCommand {
  cla: number;
  ins: number;
  p1: number;
  p2: number;
  data?: Uint8Array;
  /** Expected response length, from DO'97'. */
  le?: number;
}

export class FakeChipSession {
  private ssc: Uint8Array;

  constructor(
    private readonly p: EmrtdPrimitives,
    private readonly keys: SessionKeys,
    initialSsc: Uint8Array,
  ) {
    this.ssc = new Uint8Array(initialSsc);
  }

  private incrementSsc(): void {
    for (let i = this.ssc.length - 1; i >= 0; i--) {
      this.ssc[i] = (this.ssc[i]! + 1) & 0xff;
      if (this.ssc[i] !== 0) break;
    }
  }

  /** Unwrap a command the terminal sent. Consumes one counter value. */
  unprotectCommand(command: Uint8Array): DecodedCommand {
    this.incrementSsc();

    const [cla, ins, p1, p2, lc] = command;
    const body = command.subarray(5, 5 + (lc ?? 0));

    const parsed = readTlvSequence(body);
    const checksumIndex = parsed.findIndex((o) => o.tag === DO8E);
    if (checksumIndex < 0) throw new Error('command carried no checksum');
    const checksum = parsed[checksumIndex]!;
    const covered = parsed.slice(0, checksumIndex);

    const header = padToBlock(new Uint8Array([cla!, ins!, p1!, p2!]), BLOCK_SIZE);
    const macInput = concat(
      this.ssc,
      header,
      ...covered.map((o) => encodeTlv(o.tag, o.value)),
    );
    if (!timingSafeEqual(macWithPadding(this.p, this.keys.ksMac, macInput), checksum.value)) {
      throw new Error('command failed its integrity check');
    }

    const encrypted = covered.find((o) => o.tag === DO87);
    const le = covered.find((o) => o.tag === DO97);

    return {
      cla: cla!,
      ins: ins!,
      p1: p1!,
      p2: p2!,
      ...(encrypted
        ? {
            data: unpadFromBlock(
              decrypt3Des(this.p, this.keys.ksEnc, encrypted.value.subarray(1)),
              BLOCK_SIZE,
            ),
          }
        : {}),
      ...(le
        ? { le: le.value.length === 2 ? (le.value[0]! << 8) | le.value[1]! : le.value[0]! }
        : {}),
    };
  }

  /** Wrap a response for the terminal. Consumes one counter value. */
  protectResponse(data: Uint8Array, statusWord: number): Uint8Array {
    this.incrementSsc();

    const parts: Uint8Array[] = [];
    if (data.length > 0) {
      const encrypted = encrypt3Des(this.p, this.keys.ksEnc, padToBlock(data, BLOCK_SIZE));
      parts.push(encodeTlv(DO87, concat(new Uint8Array([0x01]), encrypted)));
    }
    parts.push(
      encodeTlv(DO99, new Uint8Array([(statusWord >> 8) & 0xff, statusWord & 0xff])),
    );

    const body = concat(...parts);
    const mac = macWithPadding(this.p, this.keys.ksMac, concat(this.ssc, body));
    // The trailing 0x9000 is the OUTER status word, which the transport carries
    // and the MAC does not cover — including it in the protected data is a
    // mistake the terminal's own tests pin.
    return concat(body, encodeTlv(DO8E, mac), new Uint8Array([0x90, 0x00]));
  }
}
