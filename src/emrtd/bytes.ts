// ---------------------------------------------------------------------------
// Byte helpers.
//
// React Native has no Buffer and no Node crypto, and the native bridge speaks
// base64, so these are the conversions everything else in the eMRTD code sits
// on. Kept dependency-free and exact: a subtle bug here would surface as a
// failed MAC three layers up, where it looks like a wrong key.
// ---------------------------------------------------------------------------

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Bytes → base64. */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : B64_CHARS[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : B64_CHARS[b2 & 0x3f];
  }
  return out;
}

/** base64 → bytes. Ignores whitespace and padding. */
export function fromBase64(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_CHARS.indexOf(clean[i]!);
    const c1 = B64_CHARS.indexOf(clean[i + 1] ?? 'A');
    const c2 = clean[i + 2] === undefined ? -1 : B64_CHARS.indexOf(clean[i + 2]!);
    const c3 = clean[i + 3] === undefined ? -1 : B64_CHARS.indexOf(clean[i + 3]!);
    out[o++] = (c0 << 2) | (c1 >> 4);
    if (c2 >= 0) out[o++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
    if (c3 >= 0) out[o++] = ((c2 & 0x03) << 6) | c3;
  }
  return out.subarray(0, o);
}

/** Bytes → lowercase hex. For logs and test vectors. */
export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Hex → bytes. Whitespace is ignored so spec vectors can be pasted as-is. */
export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** ASCII → bytes. The MRZ alphabet is ASCII by definition. */
export function fromAscii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.min(a.length, b.length));
  for (let i = 0; i < out.length; i++) out[i] = a[i]! ^ b[i]!;
  return out;
}

/**
 * Constant-time equality.
 *
 * Used for MAC comparison. A short-circuiting `===` over a MAC leaks, through
 * timing, how many leading bytes were right — which is enough to forge one byte
 * at a time. The cost of doing it properly is nothing.
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * ISO/IEC 9797-1 padding method 2: append 0x80, then zeros to a block edge.
 * Applied to plaintext before encryption AND to data before MACing.
 */
export function padToBlock(data: Uint8Array, blockSize = 8): Uint8Array {
  // The 0x80 is ALWAYS appended, so already-aligned input grows by a whole
  // block. That is the standard's rule and it is what makes the padding
  // unambiguously strippable — without it, data ending in 0x80 would be
  // indistinguishable from padding.
  const size = Math.ceil((data.length + 1) / blockSize) * blockSize;
  const out = new Uint8Array(size);
  out.set(data);
  out[data.length] = 0x80;
  return out;
}

/**
 * Strip ISO 9797-1 method 2 padding.
 *
 * Returns the input unchanged when it does not end in a valid padding run — a
 * chip that pads differently should cost us nothing.
 */
export function unpadFromBlock(data: Uint8Array, blockSize = 8): Uint8Array {
  for (let i = data.length - 1; i >= 0 && data.length - i <= blockSize; i--) {
    if (data[i] === 0x80) return data.subarray(0, i);
    if (data[i] !== 0x00) break;
  }
  return data;
}
