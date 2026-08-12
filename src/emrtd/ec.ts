import type { EcCurve } from './ec-curves';

// ---------------------------------------------------------------------------
// Elliptic-curve point arithmetic over a prime field, in BigInt.
//
// WHY THIS IS IN TYPESCRIPT while the block ciphers are native. The native side
// exposes 3DES/AES/SHA/CMAC because those are audited, constant-time, hardware
// -accelerated platform primitives. It exposes no EC point arithmetic, and
// adding it would mean writing and shipping matching Swift and Kotlin — two
// more implementations of the same maths, on the path that authenticates a
// passport. One implementation, checked against the curve's own published
// generator and order (ec.test.ts), is the smaller risk.
//
// The scalar multiply is a fixed-sequence Montgomery ladder: every bit of the
// scalar performs the same add-then-double regardless of its value, so the
// operation sequence does not depend on the secret. That is as far as constant
// time goes here — BigInt itself is variable-time, so this is not hardened
// against a local timing attacker. It does not need to be: the private scalar
// is ephemeral, used for exactly one handshake with a chip held against the
// phone, and discarded.
// ---------------------------------------------------------------------------

/** An affine point, or the point at infinity (`inf`). */
export interface EcPoint {
  readonly x: bigint;
  readonly y: bigint;
  readonly inf: boolean;
}

export const INFINITY: EcPoint = { x: 0n, y: 0n, inf: true };

export function point(x: bigint, y: bigint): EcPoint {
  return { x, y, inf: false };
}

/** Least non-negative residue — `%` alone keeps the sign of the dividend. */
function mod(a: bigint, p: bigint): bigint {
  const r = a % p;
  return r < 0n ? r + p : r;
}

/**
 * Modular inverse by the extended Euclidean algorithm.
 *
 * Throws when the value is not invertible, which for a prime field means it was
 * congruent to zero. Callers reach this only through point arithmetic that has
 * already excluded the cases where that happens.
 */
export function modInverse(value: bigint, p: bigint): bigint {
  let [old_r, r] = [mod(value, p), p];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1n) throw new Error('value is not invertible');
  return mod(old_s, p);
}

/** Whether the point satisfies y² = x³ + ax + b over the curve's field. */
export function isOnCurve(c: EcCurve, pt: EcPoint): boolean {
  if (pt.inf) return false;
  if (pt.x < 0n || pt.x >= c.p || pt.y < 0n || pt.y >= c.p) return false;
  const lhs = mod(pt.y * pt.y, c.p);
  const rhs = mod(pt.x * pt.x * pt.x + c.a * pt.x + c.b, c.p);
  return lhs === rhs;
}

export function pointDouble(c: EcCurve, pt: EcPoint): EcPoint {
  if (pt.inf) return INFINITY;
  // A point with y = 0 is its own inverse, so doubling it lands on infinity.
  if (pt.y === 0n) return INFINITY;
  const lambda = mod(
    (3n * pt.x * pt.x + c.a) * modInverse(2n * pt.y, c.p),
    c.p,
  );
  const x = mod(lambda * lambda - 2n * pt.x, c.p);
  return point(x, mod(lambda * (pt.x - x) - pt.y, c.p));
}

export function pointAdd(c: EcCurve, a: EcPoint, b: EcPoint): EcPoint {
  if (a.inf) return b;
  if (b.inf) return a;
  if (a.x === b.x) {
    // Same x: either the same point (double) or inverses (sum is infinity).
    return mod(a.y + b.y, c.p) === 0n ? INFINITY : pointDouble(c, a);
  }
  const lambda = mod((b.y - a.y) * modInverse(b.x - a.x, c.p), c.p);
  const x = mod(lambda * lambda - a.x - b.x, c.p);
  return point(x, mod(lambda * (a.x - x) - a.y, c.p));
}

/**
 * Scalar multiplication by a Montgomery ladder.
 *
 * Both branches of every bit do the same work, so the sequence of field
 * operations is independent of the scalar's bits (see the header note on how
 * far that guarantee goes). The ladder starts at the scalar's own bit width
 * rather than the curve's, which is safe here because the scalar is uniformly
 * random in [1, n-1] and never a low-entropy value whose bit length would leak
 * something meaningful.
 */
export function pointMultiply(c: EcCurve, k: bigint, pt: EcPoint): EcPoint {
  if (k <= 0n || pt.inf) return INFINITY;
  let r0: EcPoint = INFINITY;
  let r1: EcPoint = pt;
  for (let i = BigInt(k.toString(2).length) - 1n; i >= 0n; i--) {
    if (((k >> i) & 1n) === 0n) {
      r1 = pointAdd(c, r0, r1);
      r0 = pointDouble(c, r0);
    } else {
      r0 = pointAdd(c, r0, r1);
      r1 = pointDouble(c, r1);
    }
  }
  return r0;
}

/** The curve's generator as a point. */
export function generator(c: EcCurve): EcPoint {
  return point(c.gx, c.gy);
}

// ── Encoding ────────────────────────────────────────────────────────────────

/** Big-endian bytes → integer. */
export function bytesToBigInt(bytes: Uint8Array): bigint {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n;
}

/**
 * Integer → fixed-width big-endian bytes.
 *
 * The width is fixed on purpose: a shared secret whose x coordinate happens to
 * start with a zero byte must still derive the same-length key material, and a
 * variable-length encoding there silently produces the wrong session keys on
 * roughly one handshake in 256.
 */
export function bigIntToBytes(value: bigint, width: number): Uint8Array {
  const out = new Uint8Array(width);
  let v = value;
  for (let i = width - 1; i >= 0 && v > 0n; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/** Uncompressed point encoding: 0x04 || X || Y, each coordinate field-width. */
export function encodePoint(c: EcCurve, pt: EcPoint): Uint8Array {
  if (pt.inf) throw new Error('cannot encode the point at infinity');
  const out = new Uint8Array(1 + c.byteLen * 2);
  out[0] = 0x04;
  out.set(bigIntToBytes(pt.x, c.byteLen), 1);
  out.set(bigIntToBytes(pt.y, c.byteLen), 1 + c.byteLen);
  return out;
}

/**
 * Decode an uncompressed point, returning null when the bytes are not a valid
 * point on the curve.
 *
 * Validation is the security-critical part, not a formality: a chip that picks
 * a point off the curve (or a small-order point on a related curve) can learn
 * our private scalar from how we respond, so anything that does not verify is
 * refused rather than used. Compressed encodings are rejected too, since PACE
 * mandates the uncompressed form and accepting more would only widen what an
 * attacker can hand us.
 */
export function decodePoint(c: EcCurve, bytes: Uint8Array): EcPoint | null {
  if (bytes.length !== 1 + c.byteLen * 2 || bytes[0] !== 0x04) return null;
  const pt = point(
    bytesToBigInt(bytes.subarray(1, 1 + c.byteLen)),
    bytesToBigInt(bytes.subarray(1 + c.byteLen)),
  );
  return isOnCurve(c, pt) ? pt : null;
}

/**
 * A uniformly random private scalar in [1, n-1].
 *
 * Rejection sampling rather than a modulo: reducing a random integer mod n
 * biases the result toward small values, and biased nonces are how ECDSA keys
 * have historically been recovered. The loop is bounded because each draw
 * succeeds with probability very close to 1 for every curve here.
 */
export function randomScalar(c: EcCurve, randomBytes: (n: number) => Uint8Array): bigint {
  for (let attempt = 0; attempt < 64; attempt++) {
    const candidate = bytesToBigInt(randomBytes(c.byteLen));
    if (candidate > 0n && candidate < c.n) return candidate;
  }
  throw new Error('could not draw a private scalar');
}
