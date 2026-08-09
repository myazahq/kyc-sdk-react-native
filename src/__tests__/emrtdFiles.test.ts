import { concat, fromHex, toHex } from '../emrtd/bytes';
import { encodeTlv, readTlv } from '../emrtd/der';
import { EF, EmrtdFileError, readFile } from '../emrtd/files';
import { SecureMessagingSession } from '../emrtd/secureMessaging';
import { FakeChipSession } from './helpers/fakeChip';
import { nodePrimitives } from './helpers/nodeEmrtdPrimitives';

// ─── Reading files off the chip ───────────────────────────────────────────────
//
// A simulated chip, so the awkward behaviours real passports actually exhibit
// can be exercised in CI: refusing a read length and naming its own, stopping
// early, and holding a file too large for the short READ BINARY form.
//
// The last one matters most. DG2 routinely exceeds 32KB, and past that the
// offset no longer fits the command header. Masking it in anyway does not fail
// — it reads the WRONG BYTES and returns a corrupt portrait that looks fine.

const p = nodePrimitives();
const KEYS = {
  ksEnc: fromHex('979ec13b1cbfe9dcd01ab0fed307eae5'),
  ksMac: fromHex('f1cb1f1fb5adf208806b89dc579dc1f8'),
};
const SSC = fromHex('887022120c06c226');

/**
 * A chip that speaks secure messaging.
 *
 * It runs its own SecureMessagingSession as the counterpart, which is what
 * makes the exchange realistic: both sides advance the counter, so a bug in
 * either direction shows up as a MAC failure exactly as it would on hardware.
 */
function fakeChip(
  file: Uint8Array,
  opts: { maxRead?: number; refuseAbove?: number; selectStatus?: number } = {},
) {
  const chip = new FakeChipSession(p, KEYS, SSC);
  const terminal = new SecureMessagingSession(p, KEYS, SSC);
  const reads: Array<{ offset: number; length: number; extended: boolean }> = [];

  const transceive = async (command: Uint8Array): Promise<Uint8Array> => {
    // The chip unwraps with its own session, mirroring the terminal's counter.
    const inner = chip.unprotectCommand(command);
    const { ins, p1, p2, data, le } = inner;

    if (ins === 0xa4) {
      return chip.protectResponse(new Uint8Array(0), opts.selectStatus ?? 0x9000);
    }

    const extended = ins === 0xb1;
    const offset = extended
      ? ((data![2]! << 8) | data![3]!)
      : ((p1 & 0x7f) << 8) | p2;
    const want = le ?? 0;
    reads.push({ offset, length: want, extended });

    if (opts.refuseAbove !== undefined && want > opts.refuseAbove) {
      // "Wrong length — use this one." Exactly what a real chip answers.
      return chip.protectResponse(new Uint8Array(0), 0x6c00 | opts.refuseAbove);
    }

    const limit = Math.min(want, opts.maxRead ?? want);
    const slice = file.subarray(offset, offset + limit);
    return chip.protectResponse(slice, 0x9000);
  };

  return { transceive, terminal, reads };
}

/** A file with a well-formed TLV header, so the reader can learn its length. */
const buildFile = (size: number): Uint8Array => {
  const body = new Uint8Array(size);
  for (let i = 0; i < size; i++) body[i] = i % 251; // Not 256: see below.
  return encodeTlv(0x61, body);
};

describe('reading a file', () => {
  it('reads a small file whole', async () => {
    const file = buildFile(64);
    const { transceive, terminal } = fakeChip(file);
    expect(toHex(await readFile(terminal, transceive, EF.DG1))).toBe(toHex(file));
  });

  it('reads a file that needs many chunks', async () => {
    const file = buildFile(2000);
    const { transceive, terminal } = fakeChip(file, { maxRead: 64 });
    expect(toHex(await readFile(terminal, transceive, EF.DG1))).toBe(toHex(file));
  });

  it('honours a chip that names its own maximum read length', async () => {
    const file = buildFile(500);
    const { transceive, terminal, reads } = fakeChip(file, { refuseAbove: 32 });
    expect(toHex(await readFile(terminal, transceive, EF.DG1))).toBe(toHex(file));
    // Once told, it should not keep asking for more than the chip allows.
    const afterFirstRefusal = reads.slice(2);
    expect(afterFirstRefusal.every((r) => r.length <= 32)).toBe(true);
  });

  it('uses the EXTENDED command form past 32KB', async () => {
    // The bytes are a repeating pattern of period 251, deliberately coprime
    // with any power of two: a masked offset would land on a multiple of 32768
    // and, with a period of 256, return bytes IDENTICAL to the correct ones —
    // a test that passes against broken code.
    const file = buildFile(40_000);
    const { transceive, terminal, reads } = fakeChip(file, { maxRead: 224 });
    const read = await readFile(terminal, transceive, EF.DG2);
    expect(toHex(read)).toBe(toHex(file));
    expect(reads.some((r) => r.extended)).toBe(true);
  });

  it('stops when the chip returns nothing more', async () => {
    // Some chips stop early rather than reporting end-of-file.
    const file = buildFile(100);
    const truncated = file.subarray(0, 50);
    const { transceive, terminal } = fakeChip(truncated);
    const read = await readFile(terminal, transceive, EF.DG1);
    expect(read.length).toBeLessThanOrEqual(file.length);
  });

  it('reports a chip that refuses the select', async () => {
    // 0x6A82 — "file not found". The chip is authentic and the session is
    // sound; it simply does not hold this file, and that has to surface as a
    // FILE error rather than a secure-messaging one, or the UI blames the tap.
    const { transceive, terminal } = fakeChip(buildFile(64), { selectStatus: 0x6a82 });
    await expect(readFile(terminal, transceive, EF.DG1)).rejects.toThrow(EmrtdFileError);
  });
});

describe('the file it produced', () => {
  it('parses as the TLV the chip stored', async () => {
    const file = buildFile(300);
    const { transceive, terminal } = fakeChip(file, { maxRead: 96 });
    const read = await readFile(terminal, transceive, EF.DG1);
    const tlv = readTlv(read)!;
    expect(tlv.tag).toBe(0x61);
    expect(tlv.value.length).toBe(300);
  });

  it('carries no trailing padding from the last chunk', async () => {
    // Reading blind until the chip stops returns whatever it pads with; using
    // the header's declared length is what keeps the file exact.
    const file = buildFile(130);
    const { transceive, terminal } = fakeChip(file, { maxRead: 64 });
    expect((await readFile(terminal, transceive, EF.DG1)).length).toBe(file.length);
  });
});

describe('the simulated chip itself', () => {
  it('and the terminal stay in counter lockstep', async () => {
    // If they did not, every test above would fail on the SECOND command —
    // which is precisely the bug this whole harness exists to catch.
    const file = buildFile(400);
    const { transceive, terminal } = fakeChip(file, { maxRead: 64 });
    await expect(readFile(terminal, transceive, EF.DG1)).resolves.toBeDefined();
  });
});

/** Keeps `concat` referenced for the shared-helper import. */
void concat;
