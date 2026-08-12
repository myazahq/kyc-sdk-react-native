import * as crypto from 'node:crypto';

import type { EmrtdPrimitives } from '../../emrtd/crypto';

// ---------------------------------------------------------------------------
// The eMRTD block ciphers, backed by Node's crypto — for TESTS ONLY.
//
// On device these come from CommonCrypto / javax.crypto through the Nitro
// module. Here they come from OpenSSL, which lets the CONSTRUCTIONS built on
// top of them (retail MAC, key derivation, the BAC exchange) be checked against
// ICAO 9303's worked examples in CI, with no device and no passport.
//
// That split is the point: if these tests pass, the part this SDK actually
// implements is right, and the only thing left to trust is the platform's own
// DES and SHA.
//
// NOTE: OpenSSL 3 moved DES to its legacy provider, so these tests run with
// `NODE_OPTIONS=--openssl-legacy-provider` (see package.json). That is a Node
// packaging decision, not a comment on the algorithm's suitability here — BAC
// is defined on 3DES, and both CommonCrypto and javax.crypto still supply it.
// ---------------------------------------------------------------------------

function noPadCipher(
  algorithm: string,
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
  encrypt: boolean,
): Uint8Array {
  const cipher = encrypt
    ? crypto.createCipheriv(algorithm, key, iv.length ? iv : Buffer.alloc(0))
    : crypto.createDecipheriv(algorithm, key, iv.length ? iv : Buffer.alloc(0));
  // The protocol does its own ISO 9797-1 padding, so the cipher must not add or
  // strip any of its own.
  cipher.setAutoPadding(false);
  return new Uint8Array(Buffer.concat([cipher.update(data), cipher.final()]));
}

export function nodePrimitives(): EmrtdPrimitives {
  return {
    sha1: (d) => new Uint8Array(crypto.createHash('sha1').update(d).digest()),
    sha256: (d) => new Uint8Array(crypto.createHash('sha256').update(d).digest()),

    desEde2Cbc: (key16, data, iv, encrypt) =>
      // Node names two-key 3DES `des-ede-cbc` and takes the 16-byte key
      // directly; the K1|K2|K1 expansion is internal.
      noPadCipher('des-ede-cbc', key16, iv, data, encrypt),

    desBlock: (key8, block, encrypt) =>
      noPadCipher('des-ecb', key8, new Uint8Array(0), block, encrypt),

    aesCbc: (key, data, iv, encrypt) =>
      noPadCipher(`aes-${key.length * 8}-cbc`, key, iv, data, encrypt),

    // RFC 4493. Node exposes no CMAC, so the test side implements it from the
    // spec — which is fine here because the RFC's own vectors are asserted in
    // emrtdPace.test.ts, and on device this comes from the platform.
    aesCmac: (key, data) => aesCmac(key, data),

    randomBytes: (n) => new Uint8Array(crypto.randomBytes(n)),
  };
}

// ── AES-CMAC (RFC 4493) ─────────────────────────────────────────────────────
//
// Test-side only. The subkey generation is the fiddly part: the block cipher is
// applied to a zero block, then left-shifted with a conditional XOR of 0x87 —
// and a message that is an exact block multiple takes K1 with NO padding while
// anything else takes K2 with 0x80 padding. Getting that branch wrong produces
// a MAC that is right for most inputs and wrong for the aligned ones.

function shiftLeft(block: Uint8Array): Uint8Array {
  const out = new Uint8Array(block.length);
  let carry = 0;
  for (let i = block.length - 1; i >= 0; i--) {
    const value = block[i]!;
    out[i] = ((value << 1) & 0xff) | carry;
    carry = (value & 0x80) !== 0 ? 1 : 0;
  }
  return out;
}

function subkey(previous: Uint8Array): Uint8Array {
  const shifted = shiftLeft(previous);
  if ((previous[0]! & 0x80) !== 0) shifted[15] = shifted[15]! ^ 0x87;
  return shifted;
}

function aesEcbBlock(key: Uint8Array, block: Uint8Array): Uint8Array {
  return noPadCipher(`aes-${key.length * 8}-ecb`, key, new Uint8Array(0), block, true);
}

function aesCmac(key: Uint8Array, message: Uint8Array): Uint8Array {
  const k0 = aesEcbBlock(key, new Uint8Array(16));
  const k1 = subkey(k0);
  const k2 = subkey(k1);

  const complete = message.length > 0 && message.length % 16 === 0;
  const blockCount = complete ? message.length / 16 : Math.floor(message.length / 16) + 1;

  // The last block is XORed with K1 when the message is block-aligned, and with
  // K2 (after 0x80 padding) when it is not.
  const last = new Uint8Array(16);
  if (complete) {
    last.set(message.subarray((blockCount - 1) * 16));
    for (let i = 0; i < 16; i++) last[i] = last[i]! ^ k1[i]!;
  } else {
    const tail = message.subarray((blockCount - 1) * 16);
    last.set(tail);
    last[tail.length] = 0x80;
    for (let i = 0; i < 16; i++) last[i] = last[i]! ^ k2[i]!;
  }

  let x: Uint8Array = new Uint8Array(16);
  for (let i = 0; i < blockCount - 1; i++) {
    const block = message.subarray(i * 16, i * 16 + 16);
    const input = new Uint8Array(16);
    for (let j = 0; j < 16; j++) input[j] = x[j]! ^ block[j]!;
    x = aesEcbBlock(key, input);
  }
  const input = new Uint8Array(16);
  for (let j = 0; j < 16; j++) input[j] = x[j]! ^ last[j]!;
  return aesEcbBlock(key, input);
}
