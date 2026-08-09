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

    aesCmac: () => {
      // Not needed by the BAC tests; PACE's AES suites are the caller.
      throw new Error('aesCmac is not implemented in the Node test primitives');
    },

    randomBytes: (n) => new Uint8Array(crypto.randomBytes(n)),
  };
}
