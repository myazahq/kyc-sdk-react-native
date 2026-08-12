import { fromHex, toHex } from '../emrtd/bytes';
import { ALL_CURVES, curveForParameterId } from '../emrtd/ec-curves';
import {
  bigIntToBytes,
  bytesToBigInt,
  decodePoint,
  encodePoint,
  generator,
  INFINITY,
  isOnCurve,
  modInverse,
  point,
  pointAdd,
  pointDouble,
  pointMultiply,
  randomScalar,
} from '../emrtd/ec';

// ─── Elliptic-curve arithmetic and the standardised curve table ───────────────
//
// This is transcription-risk territory: six curves, six large constants each,
// typed from FIPS 186-4 and RFC 5639. A single wrong hex digit yields maths
// that works perfectly on its own terms and fails only against a real chip,
// where it looks like a bad passport.
//
// The two assertions that make a typo impossible to miss are per-curve:
//
//   • G lies on the curve (catches a wrong p, a, b, gx or gy)
//   • n·G is the point at infinity (catches a wrong n, and independently
//     re-confirms the rest, since it exercises the full ladder)
//
// Beyond that, the group laws are checked for their own edge cases, and the
// point decoder is checked for the validation that stops a hostile chip from
// learning our private scalar.

describe('the standardised curve table', () => {
  for (const curve of ALL_CURVES) {
    describe(curve.name, () => {
      it('has a generator that lies on the curve', () => {
        expect(isOnCurve(curve, generator(curve))).toBe(true);
      });

      it('has n as the generator’s order', () => {
        // n·G = O is the definition of the group order. It cannot hold by
        // accident with a mistyped constant anywhere in the curve.
        expect(pointMultiply(curve, curve.n, generator(curve)).inf).toBe(true);
      });

      it('has a field width that fits the prime', () => {
        const bits = curve.p.toString(2).length;
        expect(curve.byteLen).toBe(Math.ceil(bits / 8));
      });
    });
  }

  it('maps the ICAO parameter ids this build supports', () => {
    expect(curveForParameterId(12)?.name).toBe('secp256r1');
    expect(curveForParameterId(13)?.name).toBe('brainpoolP256r1');
    expect(curveForParameterId(18)?.name).toBe('secp521r1');
  });

  it('returns null for DH groups and unknown ids', () => {
    // Ids 0-2 are DH groups; PACE over finite-field DH is not implemented, and
    // an unmapped id must fall back to BAC rather than guess a curve.
    expect(curveForParameterId(0)).toBeNull();
    expect(curveForParameterId(9)).toBeNull();
    expect(curveForParameterId(99)).toBeNull();
  });
});

describe('point arithmetic', () => {
  const curve = curveForParameterId(12)!; // secp256r1
  const g = generator(curve);

  it('treats infinity as the identity', () => {
    expect(pointAdd(curve, g, INFINITY)).toEqual(g);
    expect(pointAdd(curve, INFINITY, g)).toEqual(g);
    expect(pointDouble(curve, INFINITY).inf).toBe(true);
  });

  it('adds a point to its inverse and lands on infinity', () => {
    const negG = point(g.x, curve.p - g.y);
    expect(pointAdd(curve, g, negG).inf).toBe(true);
  });

  it('doubles through the add path when both points are equal', () => {
    expect(pointAdd(curve, g, g)).toEqual(pointDouble(curve, g));
  });

  it('multiplies consistently with repeated addition', () => {
    // 5·G computed two independent ways: the ladder, and four additions.
    const byLadder = pointMultiply(curve, 5n, g);
    let byAddition = g;
    for (let i = 0; i < 4; i++) byAddition = pointAdd(curve, byAddition, g);
    expect(byLadder).toEqual(byAddition);
  });

  it('agrees on a Diffie-Hellman shared secret', () => {
    // The property PACE depends on: a·(b·G) = b·(a·G).
    const a = 0x1234567890abcdefn;
    const b = 0xfedcba0987654321n;
    const ab = pointMultiply(curve, a, pointMultiply(curve, b, g));
    const ba = pointMultiply(curve, b, pointMultiply(curve, a, g));
    expect(ab).toEqual(ba);
    expect(ab.inf).toBe(false);
  });

  it('produces points that stay on the curve', () => {
    for (const k of [2n, 3n, 7n, 0xdeadbeefn]) {
      expect(isOnCurve(curve, pointMultiply(curve, k, g))).toBe(true);
    }
  });

  it('returns infinity for a zero or negative scalar', () => {
    expect(pointMultiply(curve, 0n, g).inf).toBe(true);
    expect(pointMultiply(curve, -1n, g).inf).toBe(true);
  });
});

describe('modular inverse', () => {
  const curve = curveForParameterId(12)!;

  it('inverts to one', () => {
    for (const v of [1n, 2n, 12345n, curve.p - 1n]) {
      expect((modInverse(v, curve.p) * v) % curve.p).toBe(1n);
    }
  });
});

describe('point encoding', () => {
  const curve = curveForParameterId(13)!; // brainpoolP256r1
  const g = generator(curve);

  it('round-trips through the uncompressed form', () => {
    const encoded = encodePoint(curve, g);
    expect(encoded.length).toBe(1 + curve.byteLen * 2);
    expect(encoded[0]).toBe(0x04);
    expect(decodePoint(curve, encoded)).toEqual(g);
  });

  it('rejects a point that is not on the curve', () => {
    // A chip that picks an off-curve point can learn our private scalar from
    // how we respond to it, so this must be refused rather than used.
    const bad = encodePoint(curve, g);
    bad[bad.length - 1] = bad[bad.length - 1]! ^ 0x01;
    expect(decodePoint(curve, bad)).toBeNull();
  });

  it('rejects compressed and malformed encodings', () => {
    const encoded = encodePoint(curve, g);
    expect(decodePoint(curve, encoded.subarray(0, encoded.length - 1))).toBeNull();
    const compressed = new Uint8Array(encoded);
    compressed[0] = 0x02;
    expect(decodePoint(curve, compressed)).toBeNull();
  });

  it('rejects coordinates at or beyond the field prime', () => {
    const outOfRange = new Uint8Array(1 + curve.byteLen * 2);
    outOfRange[0] = 0x04;
    outOfRange.set(bigIntToBytes(curve.p, curve.byteLen), 1);
    outOfRange.set(bigIntToBytes(curve.p, curve.byteLen), 1 + curve.byteLen);
    expect(decodePoint(curve, outOfRange)).toBeNull();
  });
});

describe('integer encoding', () => {
  it('round-trips big-endian bytes', () => {
    const bytes = fromHex('0123456789abcdef');
    expect(toHex(bigIntToBytes(bytesToBigInt(bytes), 8))).toBe('0123456789abcdef');
  });

  it('pads a short value to the full field width', () => {
    // The shared secret is the agreed point's x coordinate at the curve's field
    // width. A variable-length encoding would derive different session keys on
    // roughly one handshake in 256 — the ones whose x starts with a zero byte.
    expect(toHex(bigIntToBytes(1n, 4))).toBe('00000001');
  });
});

describe('private scalars', () => {
  const curve = curveForParameterId(12)!;

  it('draws in range', () => {
    let calls = 0;
    const bytes = (n: number): Uint8Array => {
      calls++;
      // First draw is all-0xFF, which exceeds n for every curve here and must
      // be rejected rather than reduced — a modulo would bias the result.
      return new Uint8Array(n).fill(calls === 1 ? 0xff : 0x42);
    };
    const scalar = randomScalar(curve, bytes);
    expect(calls).toBe(2);
    expect(scalar > 0n && scalar < curve.n).toBe(true);
  });

  it('rejects a generator that never produces a valid scalar', () => {
    expect(() => randomScalar(curve, (n) => new Uint8Array(n))).toThrow();
  });
});
