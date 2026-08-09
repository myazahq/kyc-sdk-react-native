// ---------------------------------------------------------------------------
// A minimal BER-TLV / DER reader.
//
// Every structure the chip returns is BER-TLV: the elementary files, the
// security object, the secure-messaging response objects. This reads exactly
// what those need and nothing more — a general ASN.1 library would be a large
// dependency for a handful of shapes, and the parsing surface here is exposed
// to whatever a chip (or something impersonating one) sends.
//
// Which is why it is DEFENSIVE throughout: every length is checked against the
// remaining buffer before it is used. A malformed tag returns null rather than
// reading past the end.
// ---------------------------------------------------------------------------

export interface Tlv {
  /** The tag, as an integer — 0x5F1F for a two-byte tag, and so on. */
  tag: number;
  /** The value, as a view into the source buffer (no copy). */
  value: Uint8Array;
  /** Offset just past this element, for iterating siblings. */
  end: number;
}

/**
 * Read one TLV at `offset`, or null when the buffer does not hold a complete,
 * well-formed element there.
 */
export function readTlv(data: Uint8Array, offset = 0): Tlv | null {
  if (offset >= data.length) return null;

  // Tag: low five bits all set means the tag number continues into further
  // bytes, each of which carries a continuation flag in its top bit.
  let tag = data[offset]!;
  let i = offset + 1;
  if ((tag & 0x1f) === 0x1f) {
    // Multi-byte tag: each subsequent byte continues the number while its top
    // bit is set. Bounded at four bytes — nothing a passport emits is longer,
    // and an unbounded loop here is exactly what a crafted file would exploit.
    for (let n = 0; ; n++) {
      if (i >= data.length || n >= 3) return null;
      const byte = data[i]!;
      tag = tag * 256 + byte;
      i++;
      if ((byte & 0x80) === 0) break;
    }
  }

  if (i >= data.length) return null;

  // Length: short form is one byte under 0x80; long form's low bits give the
  // number of length bytes that follow.
  let length = data[i]!;
  i++;
  if ((length & 0x80) !== 0) {
    const count = length & 0x7f;
    // 0x80 alone is the indefinite form, which DER forbids and a chip will not
    // send; more than four length bytes exceeds anything addressable here.
    if (count === 0 || count > 4 || i + count > data.length) return null;
    length = 0;
    for (let n = 0; n < count; n++) {
      length = length * 256 + data[i]!;
      i++;
    }
  }

  if (i + length > data.length) return null;
  return { tag, value: data.subarray(i, i + length), end: i + length };
}

/** Just the tag and length, without needing the value to be present. */
export interface TlvHeader {
  tag: number;
  /** Bytes the tag and length occupy. */
  headerLength: number;
  /** Bytes of value that FOLLOW the header. */
  valueLength: number;
}

/**
 * Read a TLV header from a prefix of the element.
 *
 * `readTlv` requires the whole value to be present, which is exactly what the
 * caller does not have when probing a chip file's size — the point of the probe
 * is to LEARN that size. This reads only as far as the length field.
 */
export function readTlvHeader(data: Uint8Array, offset = 0): TlvHeader | null {
  if (offset >= data.length) return null;

  let tag = data[offset]!;
  let i = offset + 1;
  if ((tag & 0x1f) === 0x1f) {
    for (let n = 0; ; n++) {
      if (i >= data.length || n >= 3) return null;
      const byte = data[i]!;
      tag = tag * 256 + byte;
      i++;
      if ((byte & 0x80) === 0) break;
    }
  }

  if (i >= data.length) return null;
  let valueLength = data[i]!;
  i++;
  if ((valueLength & 0x80) !== 0) {
    const count = valueLength & 0x7f;
    if (count === 0 || count > 4 || i + count > data.length) return null;
    valueLength = 0;
    for (let n = 0; n < count; n++) {
      valueLength = valueLength * 256 + data[i]!;
      i++;
    }
  }

  return { tag, headerLength: i - offset, valueLength };
}

/** Every TLV at this level, in order. Stops at the first malformed element. */
export function readTlvSequence(data: Uint8Array, offset = 0): Tlv[] {
  const out: Tlv[] = [];
  let i = offset;
  while (i < data.length) {
    const tlv = readTlv(data, i);
    if (!tlv) break;
    out.push(tlv);
    // A zero-length element at the same offset would loop forever.
    if (tlv.end <= i) break;
    i = tlv.end;
  }
  return out;
}

/** The first TLV with this tag at the top level, or null. */
export function findTlv(data: Uint8Array, tag: number): Tlv | null {
  return readTlvSequence(data).find((t) => t.tag === tag) ?? null;
}

/**
 * Depth-first search for a tag at any nesting level.
 *
 * Constructed elements (bit 6 of the first tag byte) are descended into. The
 * depth is bounded because a crafted file could otherwise nest deeply enough to
 * exhaust the stack.
 */
export function findTlvDeep(data: Uint8Array, tag: number, maxDepth = 12): Tlv | null {
  if (maxDepth <= 0) return null;
  for (const tlv of readTlvSequence(data)) {
    if (tlv.tag === tag) return tlv;
    const firstTagByte = tagFirstByte(tlv.tag);
    if ((firstTagByte & 0x20) !== 0) {
      const nested = findTlvDeep(tlv.value, tag, maxDepth - 1);
      if (nested) return nested;
    }
  }
  return null;
}

/** The leading byte of a (possibly multi-byte) tag. */
function tagFirstByte(tag: number): number {
  let t = tag;
  while (t > 0xff) t >>= 8;
  return t;
}

/**
 * Encode a TLV.
 *
 * Only the short and two-byte long forms are emitted, which covers every
 * command this SDK builds — the longest is a DG2 read, and command data never
 * approaches 64KB.
 */
export function encodeTlv(tag: number, value: Uint8Array): Uint8Array {
  const tagBytes: number[] = [];
  let t = tag;
  while (t > 0) {
    tagBytes.unshift(t & 0xff);
    t >>= 8;
  }
  if (tagBytes.length === 0) tagBytes.push(0);

  const lengthBytes: number[] =
    value.length < 0x80
      ? [value.length]
      : value.length <= 0xff
        ? [0x81, value.length]
        : [0x82, (value.length >> 8) & 0xff, value.length & 0xff];

  const out = new Uint8Array(tagBytes.length + lengthBytes.length + value.length);
  out.set(tagBytes, 0);
  out.set(lengthBytes, tagBytes.length);
  out.set(value, tagBytes.length + lengthBytes.length);
  return out;
}
