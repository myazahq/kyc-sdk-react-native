import { fromHex, toHex } from '../emrtd/bytes';
import {
  encodeTlv,
  findTlv,
  findTlvDeep,
  readTlv,
  readTlvHeader,
  readTlvSequence,
} from '../emrtd/der';

// ─── BER-TLV reading ──────────────────────────────────────────────────────────
//
// Everything the chip returns is BER-TLV, and everything the chip returns is
// UNTRUSTED — a malformed or hostile file must produce null, never a read past
// the end of the buffer. That is what most of these cases are about.

describe('reading one element', () => {
  it('reads a short-form element', () => {
    const tlv = readTlv(fromHex('5F1F03AABBCC'.toLowerCase()))!;
    expect(tlv.tag).toBe(0x5f1f);
    expect(toHex(tlv.value)).toBe('aabbcc');
    expect(tlv.end).toBe(6);
  });

  it('reads a one-byte tag', () => {
    const tlv = readTlv(fromHex('99029000'))!;
    expect(tlv.tag).toBe(0x99);
    expect(toHex(tlv.value)).toBe('9000');
  });

  it('reads the long form length', () => {
    // 0x81 means "one length byte follows" — how a 200-byte value is expressed.
    const data = fromHex('5c81c8' + '00'.repeat(200));
    const tlv = readTlv(data)!;
    expect(tlv.value.length).toBe(200);
  });

  it('reads a two-byte length', () => {
    const data = fromHex('758201f4' + '00'.repeat(500));
    expect(readTlv(data)!.value.length).toBe(500);
  });
});

describe('refusing malformed input', () => {
  it('returns null when the value runs past the buffer', () => {
    // The single most important case: a length that lies. Trusting it would
    // read whatever memory follows.
    expect(readTlv(fromHex('5c0aaabb'))).toBeNull();
  });

  it('returns null when the length bytes run past the buffer', () => {
    expect(readTlv(fromHex('5c82'))).toBeNull();
  });

  it('returns null for the indefinite length form, which DER forbids', () => {
    expect(readTlv(fromHex('5c80aabb'))).toBeNull();
  });

  it('returns null for an unterminated multi-byte tag', () => {
    // Every continuation byte sets its top bit; a run of them with no end
    // would spin an unbounded loop.
    expect(readTlv(fromHex('5fffffff'))).toBeNull();
  });

  it('returns null past the end of the buffer', () => {
    expect(readTlv(fromHex('5c02aabb'), 99)).toBeNull();
    expect(readTlv(new Uint8Array(0))).toBeNull();
  });
});

describe('reading a sequence', () => {
  it('reads siblings in order', () => {
    const tags = readTlvSequence(fromHex('99029000' + '8e08aabbccddeeff0011')).map(
      (t) => t.tag,
    );
    expect(tags).toEqual([0x99, 0x8e]);
  });

  it('stops at the first malformed element rather than looping', () => {
    const tlvs = readTlvSequence(fromHex('99029000' + '8e40aabb'));
    expect(tlvs).toHaveLength(1);
  });

  it('stops rather than spinning on a zero-length element', () => {
    expect(readTlvSequence(fromHex('9000900090009000')).length).toBeLessThanOrEqual(4);
  });
});

describe('finding a tag', () => {
  it('finds one at the top level', () => {
    expect(findTlv(fromHex('99029000' + '8e02aabb'), 0x8e)).not.toBeNull();
  });

  it('finds one nested inside a constructed element', () => {
    // 0x75 is constructed (bit 6 set), so the search descends into it.
    const nested = fromHex('7506' + '5f1f03aabbcc');
    expect(toHex(findTlvDeep(nested, 0x5f1f)!.value)).toBe('aabbcc');
  });

  it('does not descend into a primitive element', () => {
    // 0x5c is primitive; its bytes are data, not structure. Reading them as
    // TLVs would find tags that are not there.
    expect(findTlvDeep(fromHex('5c06' + '5f1f03aabbcc'), 0x5f1f)).toBeNull();
  });

  it('bounds its own recursion', () => {
    // A crafted file could otherwise nest deeply enough to exhaust the stack.
    let data = fromHex('5f1f01aa');
    for (let i = 0; i < 40; i++) data = encodeTlv(0x75, data);
    expect(() => findTlvDeep(data, 0x5f1f)).not.toThrow();
  });

  it('returns null when the tag is absent', () => {
    expect(findTlv(fromHex('99029000'), 0x8e)).toBeNull();
  });
});

describe('the header-only reader', () => {
  it('reads a length whose value is not present yet', () => {
    // Which is exactly the case when probing a chip file's size: the point of
    // the probe is to LEARN the size, so `readTlv` cannot help.
    const header = readTlvHeader(fromHex('758201f4'))!;
    expect(header.tag).toBe(0x75);
    expect(header.headerLength).toBe(4);
    expect(header.valueLength).toBe(500);
  });

  it('agrees with the full reader when the value IS present', () => {
    const data = fromHex('5f1f03aabbcc');
    const header = readTlvHeader(data)!;
    const full = readTlv(data)!;
    expect(header.headerLength + header.valueLength).toBe(full.end);
  });

  it('still refuses input too short to hold a length', () => {
    expect(readTlvHeader(fromHex('5c82'))).toBeNull();
  });
});

describe('encoding', () => {
  it('round-trips through the reader', () => {
    for (const size of [0, 1, 127, 128, 255, 256, 5000]) {
      const value = new Uint8Array(size).fill(0xab);
      const encoded = encodeTlv(0x5f1f, value);
      const decoded = readTlv(encoded)!;
      expect(decoded.tag).toBe(0x5f1f);
      expect(decoded.value.length).toBe(size);
    }
  });

  it('uses the short form below 128 bytes', () => {
    expect(toHex(encodeTlv(0x99, fromHex('9000')))).toBe('99029000');
  });

  it('uses one length byte up to 255', () => {
    expect(toHex(encodeTlv(0x5c, new Uint8Array(200))).slice(0, 6)).toBe('5c81c8');
  });

  it('uses two length bytes beyond that', () => {
    expect(toHex(encodeTlv(0x75, new Uint8Array(500))).slice(0, 8)).toBe('758201f4');
  });
});
