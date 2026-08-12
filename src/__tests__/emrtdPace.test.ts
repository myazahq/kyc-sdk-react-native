import { concat, fromHex, toHex } from '../emrtd/bytes';
import { encodeTlv } from '../emrtd/der';
import { curveForParameterId } from '../emrtd/ec-curves';
import {
  decodePoint,
  encodePoint,
  generator,
  pointAdd,
  pointMultiply,
  randomScalar,
} from '../emrtd/ec';
import { keySeed, paceKeySeed } from '../emrtd/crypto';
import {
  describeProtocol,
  isSupportedProtocol,
  paceGapFor,
  paceProtocolFromOid,
  parseCardAccess,
  selectPaceOffer,
} from '../emrtd/pace-params';
import { runPaceEcdhGm, PaceError } from '../emrtd/pace';
import { DES_EDE2_SUITE, aesSuite } from '../emrtd/suites';
import { nodePrimitives } from './helpers/nodeEmrtdPrimitives';

// ─── PACE: protocol negotiation, cipher suites, and the handshake ─────────────
//
// The handshake is exercised against a SIMULATED CHIP that runs the other half
// of the protocol honestly (below). That is the only way to test PACE without a
// passport, and it is meaningful because the simulated side is written from the
// standard's description rather than from this implementation: both sides
// independently derive the session keys, and the mutual-authentication step
// only passes if they agree.
//
// What it cannot prove is that a real chip agrees — that needs a document. What
// it does prove is that the protocol logic, the key derivation, the token
// construction and the TLV framing are self-consistent and correct against the
// standard's shapes.

const p = nodePrimitives();

describe('AES-CMAC, against RFC 4493', () => {
  // The test primitives implement CMAC from the RFC (Node has none), so the
  // RFC's own vectors are asserted here before anything depends on them.
  const key = fromHex('2b7e151628aed2a6abf7158809cf4f3c');

  it('macs the empty message', () => {
    expect(toHex(p.aesCmac(key, new Uint8Array(0)))).toBe('bb1d6929e95937287fa37d129b756746');
  });

  it('macs a 16-byte message (the block-aligned branch)', () => {
    expect(toHex(p.aesCmac(key, fromHex('6bc1bee22e409f96e93d7e117393172a')))).toBe(
      '070a16b46b4d4144f79bdd9dd04a287c',
    );
  });

  it('macs a 40-byte message (the padded branch)', () => {
    const message = fromHex(
      '6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411',
    );
    expect(toHex(p.aesCmac(key, message))).toBe('dfa66747de9ae63030ca32611497c827');
  });
});

describe('PACE protocol identifiers', () => {
  // 0.4.0.127.0.7.2.2.4.2.4 — Generic Mapping, ECDH, AES-256.
  const GM_ECDH_AES256 = fromHex('04007f00070202040204');
  const GM_DH_3DES = fromHex('04007f00070202040101');
  const IM_ECDH_AES128 = fromHex('04007f00070202040402');

  it('decodes generic mapping over ECDH with its cipher suite', () => {
    const protocol = paceProtocolFromOid(GM_ECDH_AES256)!;
    expect(protocol.mapping).toBe('generic');
    expect(protocol.keyAgreement).toBe('ecdh');
    expect(protocol.suite.keyLength).toBe(32);
    expect(isSupportedProtocol(protocol)).toBe(true);
    expect(describeProtocol(protocol)).toContain('AES-256');
  });

  it('decodes variants this build cannot run, without claiming support', () => {
    // Recognising them is what lets the gap be REPORTED rather than looking
    // like a chip that offers no PACE at all.
    expect(isSupportedProtocol(paceProtocolFromOid(GM_DH_3DES)!)).toBe(false);
    expect(isSupportedProtocol(paceProtocolFromOid(IM_ECDH_AES128)!)).toBe(false);
  });

  it('returns null for OIDs that are not PACE at all', () => {
    // EF.CardAccess also carries chip- and terminal-authentication entries.
    // Those are skipped, not treated as errors.
    expect(paceProtocolFromOid(fromHex('04007f000702020301'))).toBeNull();
    expect(paceProtocolFromOid(fromHex('2a864886f70d010101'))).toBeNull();
    // A PACE arc with an unknown branch or cipher is still not runnable.
    expect(paceProtocolFromOid(fromHex('04007f00070202040709'))).toBeNull();
  });

  it('preserves the OID bytes exactly', () => {
    // They are re-sent to the chip and folded into the authentication tokens,
    // so a normalised or re-encoded copy would fail the handshake at the last
    // step.
    expect(toHex(paceProtocolFromOid(GM_ECDH_AES256)!.oid)).toBe(toHex(GM_ECDH_AES256));
  });
});

describe('EF.CardAccess', () => {
  /** A PACEInfo SEQUENCE: OID, version, parameterId. */
  const paceInfo = (oid: string, parameterId: number): Uint8Array =>
    encodeTlv(
      0x30,
      concat(
        encodeTlv(0x06, fromHex(oid)),
        encodeTlv(0x02, new Uint8Array([0x02])),
        encodeTlv(0x02, new Uint8Array([parameterId])),
      ),
    );

  it('reads the offerings out of a SET', () => {
    const file = encodeTlv(0x31, paceInfo('04007f00070202040204', 13));
    const offers = parseCardAccess(file);
    expect(offers).toHaveLength(1);
    expect(offers[0]!.parameterId).toBe(13);
  });

  it('reads a bare run of SEQUENCEs too', () => {
    // Some chips do not wrap the file in a SET; both shapes are accepted.
    const file = concat(
      paceInfo('04007f00070202040204', 13),
      paceInfo('04007f00070202040202', 12),
    );
    expect(parseCardAccess(file)).toHaveLength(2);
  });

  it('skips security info for other protocols', () => {
    const file = encodeTlv(
      0x31,
      concat(
        // A chip-authentication entry, which this SDK does not run.
        encodeTlv(0x30, encodeTlv(0x06, fromHex('04007f000702020301'))),
        paceInfo('04007f00070202040204', 13),
      ),
    );
    expect(parseCardAccess(file)).toHaveLength(1);
  });

  it('returns nothing for a file that does not parse', () => {
    // Absent, unreadable and unparseable all mean the same thing: use BAC.
    expect(parseCardAccess(fromHex('ffffffff'))).toEqual([]);
    expect(parseCardAccess(new Uint8Array(0))).toEqual([]);
  });

  it('picks the strongest cipher among supported variants', () => {
    const file = encodeTlv(
      0x31,
      concat(
        paceInfo('04007f00070202040201', 13), // GM/ECDH/3DES
        paceInfo('04007f00070202040204', 13), // GM/ECDH/AES-256
        paceInfo('04007f00070202040202', 13), // GM/ECDH/AES-128
      ),
    );
    const selected = selectPaceOffer(parseCardAccess(file))!;
    expect(selected.offer.protocol.suite.keyLength).toBe(32);
    expect(selected.curve.name).toBe('brainpoolP256r1');
  });

  it('selects nothing when the curve is not one this build runs', () => {
    // parameterId 9 is brainpoolP192r1, deliberately unmapped: the read falls
    // back to BAC rather than guessing a curve.
    const file = encodeTlv(0x31, paceInfo('04007f00070202040204', 9));
    expect(selectPaceOffer(parseCardAccess(file))).toBeNull();
    expect(paceGapFor(parseCardAccess(file))).toBe('domainParameters');
  });

  it('names the gap when only unsupported variants are offered', () => {
    const dh = encodeTlv(0x31, paceInfo('04007f00070202040101', 0));
    expect(paceGapFor(parseCardAccess(dh))).toBe('keyAgreement');
    const im = encodeTlv(0x31, paceInfo('04007f00070202040402', 13));
    expect(paceGapFor(parseCardAccess(im))).toBe('mapping');
    // No offerings at all is not a gap — the chip simply does not speak PACE.
    expect(paceGapFor([])).toBeNull();
  });
});

describe('the PACE password seed', () => {
  // REGRESSION. PACE originally reused BAC's Kseed and every real passport
  // refused the handshake at its last step with 0x6300 — indistinguishable from
  // a mistyped MRZ, while the same document opened over BAC seconds later.
  const MRZ = { documentNumber: 'L898902C', dateOfBirth: '690806', dateOfExpiry: '940623' };

  it('is the FULL SHA-1 digest, where BAC truncates to 16 bytes', () => {
    expect(paceKeySeed(p, MRZ).length).toBe(20);
    expect(keySeed(p, MRZ).length).toBe(16);
  });

  it('agrees with BAC on the leading bytes', () => {
    // Same hash of the same MRZ information: BAC just stops at 16. Appendix
    // D.2's published Kseed is the independent anchor for both.
    expect(toHex(keySeed(p, MRZ))).toBe('239ab9cb282daf66231dc5a4df6bfbae');
    expect(toHex(paceKeySeed(p, MRZ)).startsWith(toHex(keySeed(p, MRZ)))).toBe(true);
  });

  it('produces a DIFFERENT password key from the truncated seed', () => {
    // The whole failure mode: both seeds derive a valid-looking key, so nothing
    // complains until the chip does.
    const suite = aesSuite(16);
    expect(toHex(suite.deriveKey(p, paceKeySeed(p, MRZ), 3))).not.toBe(
      toHex(suite.deriveKey(p, keySeed(p, MRZ), 3)),
    );
  });
});

describe('cipher suites', () => {
  it('derives 3DES keys with parity adjustment', () => {
    // The parity bits are cryptographically ignored, but the standard's worked
    // examples carry adjusted keys and matching them is how this is verified.
    const key = DES_EDE2_SUITE.deriveKey(p, fromHex('0102030405060708090a0b0c0d0e0f10'), 1);
    expect(key.length).toBe(16);
    for (const byte of key) {
      const ones = byte.toString(2).split('1').length - 1;
      expect(ones % 2).toBe(1); // odd parity per byte
    }
  });

  it('derives AES keys WITHOUT parity adjustment', () => {
    // Applying the DES convention to an AES key silently produces a different
    // key, and a session that handshakes and then fails.
    const secret = fromHex('0102030405060708090a0b0c0d0e0f10');
    const aes128 = aesSuite(16).deriveKey(p, secret, 1);
    const sha1 = p.sha1(concat(secret, new Uint8Array([0, 0, 0, 1]))).subarray(0, 16);
    expect(toHex(aes128)).toBe(toHex(sha1));
  });

  it('moves to SHA-256 for the longer AES keys', () => {
    const secret = fromHex('0102030405060708090a0b0c0d0e0f10');
    // SHA-1 has only 20 bytes of output, which is not enough for AES-192/256.
    expect(aesSuite(24).deriveKey(p, secret, 1).length).toBe(24);
    expect(aesSuite(32).deriveKey(p, secret, 1).length).toBe(32);
    const sha256 = p.sha256(concat(secret, new Uint8Array([0, 0, 0, 1])));
    expect(toHex(aesSuite(32).deriveKey(p, secret, 1))).toBe(toHex(sha256));
  });

  it('gives AES a per-message IV derived from the counter', () => {
    // A zero IV (the 3DES convention) would make two identical commands
    // produce identical ciphertext, leaking that they were the same.
    const suite = aesSuite(16);
    const key = fromHex('000102030405060708090a0b0c0d0e0f');
    const data = fromHex('00112233445566778899aabbccddeeff');
    const one = suite.encrypt(p, key, data, fromHex('00000000000000000000000000000001'));
    const two = suite.encrypt(p, key, data, fromHex('00000000000000000000000000000002'));
    expect(toHex(one)).not.toBe(toHex(two));
    // And it round-trips under the same counter.
    expect(toHex(suite.decrypt(p, key, one, fromHex('00000000000000000000000000000001')))).toBe(
      toHex(data),
    );
  });

  it('truncates the CMAC to eight bytes, as ICAO specifies', () => {
    expect(aesSuite(16).mac(p, fromHex('2b7e151628aed2a6abf7158809cf4f3c'), new Uint8Array(0)).length).toBe(8);
  });

  it('pads the retail-MAC token but not the CMAC token', () => {
    // CMAC pads internally and takes a DIFFERENT branch for exact block
    // multiples, so pre-padding it changes the result. Feeding one suite's
    // convention to the other produces a token the chip rejects at the last
    // step of the handshake.
    const key16 = fromHex('000102030405060708090a0b0c0d0e0f');
    const aligned = fromHex('00112233445566778899aabbccddeeff');
    const aes = aesSuite(16);
    expect(toHex(aes.token(p, key16, aligned))).toBe(toHex(aes.mac(p, key16, aligned)));
    // The 3DES token pads first, so it differs from a raw MAC of the same input.
    expect(toHex(DES_EDE2_SUITE.token(p, key16, aligned))).not.toBe(
      toHex(DES_EDE2_SUITE.mac(p, key16, aligned)),
    );
  });
});

// ─── The handshake, against a simulated chip ─────────────────────────────────

const DO_TEMPLATE = 0x7c;

/**
 * The chip's half of PACE-GM, written from the standard's description.
 *
 * It runs the protocol honestly: it decrypts nothing it should not, derives the
 * session keys independently, and computes its authentication token over OUR
 * public key. So a passing handshake means both halves agreed on a secret
 * without either being written in terms of the other.
 */
function simulatedChip(options: {
  parameterId: number;
  oid: Uint8Array;
  passwordKey: Uint8Array;
  suite: typeof DES_EDE2_SUITE;
  /** Set to break the chip's token, standing in for a wrong MRZ. */
  wrongPassword?: boolean;
}) {
  const curve = curveForParameterId(options.parameterId)!;
  const suite = options.suite;
  const nonce = new Uint8Array(suite.blockSize).fill(0x5a);
  const mapPrivate = 0x1234_5678_9abcn;
  const sessionPrivate = 0xfedc_ba98_7654n;

  let mappedGenerator = generator(curve);
  let terminalSessionPublic = generator(curve);
  let ksMac: Uint8Array = new Uint8Array(0);

  const reply = (tag: number, value: Uint8Array) => ({
    data: encodeTlv(DO_TEMPLATE, encodeTlv(tag, value)),
    statusWord: 0x9000,
  });

  return async (command: Uint8Array): Promise<{ data: Uint8Array; statusWord: number }> => {
    // MSE:Set AT — accept and return nothing.
    if (command[1] === 0x22) return { data: new Uint8Array(0), statusWord: 0x9000 };

    // GENERAL AUTHENTICATE. The body is Lc || DO'7C'{...} || Le.
    const body = command.subarray(5, 5 + command[4]!);
    const inner = body.length > 2 ? body.subarray(2) : new Uint8Array(0);

    if (inner.length === 0) {
      // Step 1 — the encrypted nonce.
      return reply(0x80, suite.encrypt(p, options.passwordKey, nonce));
    }

    const tag = inner[0]!;
    const value = inner.subarray(2, 2 + inner[1]!);

    if (tag === 0x81) {
      // Step 2 — mapping. The chip combines the nonce with the shared point to
      // reach the same fresh generator the terminal computes.
      const terminalMapPoint = decodePoint(curve, value)!;
      const shared = pointMultiply(curve, mapPrivate, terminalMapPoint);
      const nonceScalar = BigInt(`0x${toHex(nonce)}`) % curve.n;
      mappedGenerator = pointAdd(
        curve,
        pointMultiply(curve, nonceScalar, generator(curve)),
        shared,
      );
      return reply(0x82, encodePoint(curve, pointMultiply(curve, mapPrivate, generator(curve))));
    }

    if (tag === 0x83) {
      // Step 3 — key agreement over the mapped generator.
      terminalSessionPublic = decodePoint(curve, value)!;
      const chipPublic = pointMultiply(curve, sessionPrivate, mappedGenerator);
      const agreed = pointMultiply(curve, sessionPrivate, terminalSessionPublic);
      const secret = bigToBytes(agreed.x, curve.byteLen);
      ksMac = suite.deriveKey(p, secret, 2);
      return reply(0x84, encodePoint(curve, chipPublic));
    }

    if (tag === 0x85) {
      // Step 4 — the chip's token, over the TERMINAL's public key.
      const key = options.wrongPassword ? new Uint8Array(ksMac.length) : ksMac;
      const token = suite.token(
        p,
        key,
        encodeTlv(
          0x7f49,
          concat(
            encodeTlv(0x06, options.oid),
            encodeTlv(0x86, encodePoint(curve, terminalSessionPublic)),
          ),
        ),
      );
      return reply(0x86, token);
    }

    return { data: new Uint8Array(0), statusWord: 0x6a80 };
  };
}

function bigToBytes(value: bigint, width: number): Uint8Array {
  const out = new Uint8Array(width);
  let v = value;
  for (let i = width - 1; i >= 0 && v > 0n; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

describe('the PACE-GM handshake', () => {
  const MRZ = { documentNumber: 'L898902C', dateOfBirth: '690806', dateOfExpiry: '940623' };

  for (const [label, parameterId, oidHex, suite] of [
    ['AES-128 over secp256r1', 12, '04007f00070202040202', aesSuite(16)],
    ['AES-256 over brainpoolP256r1', 13, '04007f00070202040204', aesSuite(32)],
    ['3DES over secp256r1', 12, '04007f00070202040201', DES_EDE2_SUITE],
  ] as const) {
    it(`agrees a session using ${label}`, async () => {
      const protocol = paceProtocolFromOid(fromHex(oidHex))!;
      const passwordKey = suite.deriveKey(p, keySeed(p, MRZ), 3);
      const sm = await runPaceEcdhGm({
        p,
        transceive: simulatedChip({ parameterId, oid: protocol.oid, passwordKey, suite }),
        protocol,
        curve: curveForParameterId(parameterId)!,
        passwordKey,
      });
      // A PACE session starts its counter at zero, one cipher block wide.
      expect(toHex(sm.sendSequenceCounter)).toBe(toHex(new Uint8Array(suite.blockSize)));
    });
  }

  it('refuses a chip that proves a different key', async () => {
    // What a wrong MRZ looks like from here: every step succeeds and the final
    // token does not match. It must be reported as auth_failed, not read_failed
    // — the user needs to be told to rescan the document.
    const protocol = paceProtocolFromOid(fromHex('04007f00070202040202'))!;
    const suite = aesSuite(16);
    const passwordKey = suite.deriveKey(p, keySeed(p, MRZ), 3);
    await expect(
      runPaceEcdhGm({
        p,
        transceive: simulatedChip({
          parameterId: 12,
          oid: protocol.oid,
          passwordKey,
          suite,
          wrongPassword: true,
        }),
        protocol,
        curve: curveForParameterId(12)!,
        passwordKey,
      }),
    ).rejects.toMatchObject({ code: 'auth_failed' });
  });

  it('reports a chip that refuses the password at the nonce step', async () => {
    const protocol = paceProtocolFromOid(fromHex('04007f00070202040202'))!;
    const transceive = async (command: Uint8Array) =>
      command[1] === 0x22
        ? { data: new Uint8Array(0), statusWord: 0x9000 }
        : { data: new Uint8Array(0), statusWord: 0x6300 };
    await expect(
      runPaceEcdhGm({
        p,
        transceive,
        protocol,
        curve: curveForParameterId(12)!,
        passwordKey: new Uint8Array(16),
      }),
    ).rejects.toMatchObject({ code: 'auth_failed' });
  });

  it('refuses a point that is not on the curve', async () => {
    // A chip choosing an off-curve point could otherwise learn our private
    // scalar from how we respond to it.
    const protocol = paceProtocolFromOid(fromHex('04007f00070202040202'))!;
    const curve = curveForParameterId(12)!;
    const suite = aesSuite(16);
    const passwordKey = suite.deriveKey(p, keySeed(p, MRZ), 3);
    const honest = simulatedChip({ parameterId: 12, oid: protocol.oid, passwordKey, suite });
    const transceive = async (command: Uint8Array) => {
      const res = await honest(command);
      // Corrupt the mapping reply's point.
      if (res.data.length > 4 && res.data[2] === 0x82) {
        const tampered = new Uint8Array(res.data);
        tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;
        return { data: tampered, statusWord: res.statusWord };
      }
      return res;
    };
    await expect(
      runPaceEcdhGm({ p, transceive, protocol, curve, passwordKey }),
    ).rejects.toBeInstanceOf(PaceError);
  });

  it('draws a fresh key pair for every handshake', () => {
    // PACE's whole advantage over BAC is that the session keys are new each
    // time; a fixed scalar would throw that away.
    const curve = curveForParameterId(12)!;
    const first = randomScalar(curve, p.randomBytes);
    const second = randomScalar(curve, p.randomBytes);
    expect(first).not.toBe(second);
  });
});
