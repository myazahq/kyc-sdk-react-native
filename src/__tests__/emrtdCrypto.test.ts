import { fromHex, toHex, padToBlock, unpadFromBlock, timingSafeEqual, fromBase64, toBase64 } from '../emrtd/bytes';
import {
  adjustParity,
  deriveKey,
  keySeed,
  macWithPadding,
  mrzKeySeedInput,
  retailMac,
} from '../emrtd/crypto';
import { buildBacChallenge, completeBac, BacError } from '../emrtd/bac';
import { nodePrimitives } from './helpers/nodeEmrtdPrimitives';

// ─── eMRTD crypto, against ICAO 9303 Part 11 Appendix D ───────────────────────
//
// Every value below is from the standard's own worked example. That is the
// whole point: a passport-authentication path cannot be verified by agreeing
// with itself, and there is no way to test it against a real chip in CI.
//
// The primitives here come from Node's crypto rather than the device's, so
// what is under test is the CONSTRUCTIONS — the retail MAC, the key
// derivation, the BAC exchange — which is exactly the part this SDK
// implements. The native side supplies the same primitives on device.

const p = nodePrimitives();

// Appendix D.2 — the MRZ of the specimen document.
const MRZ = {
  documentNumber: 'L898902C',
  dateOfBirth: '690806',
  dateOfExpiry: '940623',
};

describe('the MRZ key seed', () => {
  it('builds the input the standard specifies', () => {
    // Document number filler-padded to nine FIRST, then its check digit —
    // computing the digit over the unpadded number yields a key the chip
    // rejects with no explanation of why.
    // L898902C< + 3 | 690806 + 1 | 940623 + 6. The Kseed assertion below is
    // the independent confirmation: it is SHA-1 of exactly this string, and it
    // matches the standard's published value.
    expect(mrzKeySeedInput(MRZ)).toBe('L898902C<3690806194062 36'.replace(' ', ''));
  });

  it('produces the Appendix D.2 seed', () => {
    expect(toHex(keySeed(p, MRZ))).toBe('239ab9cb282daf66231dc5a4df6bfbae');
  });
});

describe('key derivation', () => {
  it('produces the Appendix D.2 encryption key', () => {
    expect(toHex(deriveKey(p, keySeed(p, MRZ), 1))).toBe('ab94fdecf2674fdfb9b391f85d7f76f2');
  });

  it('produces the Appendix D.2 MAC key', () => {
    expect(toHex(deriveKey(p, keySeed(p, MRZ), 2))).toBe('7962d9ece03d1acd4c76089dce131543');
  });

  it('sets odd parity in the low bit of every byte', () => {
    // DES discards these bits, so this changes nothing cryptographically — but
    // the standard's examples carry adjusted keys, and matching them is how the
    // derivation is checked at all.
    const adjusted = adjustParity(fromHex('0000000000000000'));
    for (const byte of adjusted) {
      let ones = 0;
      for (let bit = 0; bit < 8; bit++) if (byte & (1 << bit)) ones++;
      expect(ones % 2).toBe(1);
    }
  });
});

describe('the retail MAC', () => {
  it('produces the Appendix D.3 value for the mutual-authenticate command', () => {
    const kMac = fromHex('7962d9ece03d1acd4c76089dce131543');
    const eIfd = fromHex(
      '72c29c2371cc9bdb65b779b8e8d37b29ecc154aa56a8799fae2f498f76ed92f2',
    );
    expect(toHex(macWithPadding(p, kMac, eIfd))).toBe('5f1448eea8ad90a7');
  });

  it('operates on ALREADY-padded input', () => {
    // The distinction matters: secure messaging MACs data that is padded as
    // part of a larger structure, so the MAC must not pad again.
    const key = fromHex('7962d9ece03d1acd4c76089dce131543');
    const data = fromHex('0011223344556677');
    expect(toHex(retailMac(p, key, padToBlock(data)))).toBe(
      toHex(macWithPadding(p, key, data)),
    );
  });
});

describe('padding', () => {
  it('always appends 0x80, even to aligned input', () => {
    // Without this an input ending in 0x80 would be indistinguishable from
    // padding, and unpadding would silently truncate real data.
    expect(toHex(padToBlock(fromHex('0011223344556677')))).toBe(
      '00112233445566778000000000000000',
    );
  });

  it('pads a partial block to the edge', () => {
    expect(toHex(padToBlock(fromHex('001122')))).toBe('0011228000000000');
  });

  it('round-trips', () => {
    const data = fromHex('00112233445566778899');
    expect(toHex(unpadFromBlock(padToBlock(data)))).toBe(toHex(data));
  });

  it('leaves unpadded data alone rather than truncating it', () => {
    // A chip that pads differently should cost us nothing.
    const odd = fromHex('0011223344556677');
    expect(toHex(unpadFromBlock(odd))).toBe(toHex(odd));
  });
});

describe('BAC', () => {
  // Appendix D.3's fixed values, which is what makes the exchange reproducible.
  const RND_IC = fromHex('4608f91988702212');
  const RND_IFD = fromHex('781723860c06c226');
  const K_IFD = fromHex('0b795240cb7049b01c19b33e32804f0b');

  it('builds the Appendix D.3 mutual-authenticate command', () => {
    const challenge = buildBacChallenge(p, MRZ, RND_IC, { rndIfd: RND_IFD, kIfd: K_IFD });
    expect(toHex(challenge.command)).toBe(
      '72c29c2371cc9bdb65b779b8e8d37b29ecc154aa56a8799fae2f498f76ed92f2' +
        '5f1448eea8ad90a7',
    );
  });

  it('derives the Appendix D.3 session keys from the chip’s reply', () => {
    const challenge = buildBacChallenge(p, MRZ, RND_IC, { rndIfd: RND_IFD, kIfd: K_IFD });
    const response = fromHex(
      '46b9342a41396cd7386bf5803104d7cedc122b9132139baf2eedc94ee178534f' +
        '2f2d235d074d7449',
    );
    const { keys, ssc } = completeBac(p, challenge, response);
    expect(toHex(keys.ksEnc)).toBe('979ec13b1cbfe9dcd01ab0fed307eae5');
    expect(toHex(keys.ksMac)).toBe('f1cb1f1fb5adf208806b89dc579dc1f8');
    // The send-sequence counter is the low half of each nonce, chip first.
    expect(toHex(ssc)).toBe('887022120c06c226');
  });

  it('rejects a reply whose MAC does not verify', () => {
    // Without this check, everything decrypted afterwards is attacker-chosen.
    const challenge = buildBacChallenge(p, MRZ, RND_IC, { rndIfd: RND_IFD, kIfd: K_IFD });
    const tampered = fromHex(
      '46b9342a41396cd7386bf5803104d7cedc122b9132139baf2eedc94ee178534f' +
        '2f2d235d074d7448',
    );
    expect(() => completeBac(p, challenge, tampered)).toThrow(BacError);
  });

  it('rejects a replayed reply from a different session', () => {
    // The MAC would verify against the same document; only the nonce echo
    // catches it. This is why checking the MAC alone is not enough.
    const challenge = buildBacChallenge(p, MRZ, fromHex('0000000000000000'), {
      rndIfd: RND_IFD,
      kIfd: K_IFD,
    });
    const replayed = fromHex(
      '46b9342a41396cd7386bf5803104d7cedc122b9132139baf2eedc94ee178534f' +
        '2f2d235d074d7449',
    );
    expect(() => completeBac(p, challenge, replayed)).toThrow(/challenge|integrity/i);
  });

  it('rejects a reply of the wrong length', () => {
    const challenge = buildBacChallenge(p, MRZ, RND_IC, { rndIfd: RND_IFD, kIfd: K_IFD });
    expect(() => completeBac(p, challenge, fromHex('0011'))).toThrow(BacError);
  });

  it('uses fresh randomness when none is supplied', () => {
    // A fixed RND.IFD would make the whole exchange replayable.
    const a = buildBacChallenge(p, MRZ, RND_IC);
    const b = buildBacChallenge(p, MRZ, RND_IC);
    expect(toHex(a.rndIfd)).not.toBe(toHex(b.rndIfd));
  });
});

describe('byte helpers', () => {
  it('round-trips base64', () => {
    for (const hex of ['', '00', '0011', '001122', '00112233445566778899aabbccddeeff']) {
      expect(toHex(fromBase64(toBase64(fromHex(hex))))).toBe(hex);
    }
  });

  it('compares in constant time without short-circuiting', () => {
    expect(timingSafeEqual(fromHex('0011'), fromHex('0011'))).toBe(true);
    expect(timingSafeEqual(fromHex('0011'), fromHex('0012'))).toBe(false);
    expect(timingSafeEqual(fromHex('0011'), fromHex('001122'))).toBe(false);
  });
});
