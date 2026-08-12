import { concat, timingSafeEqual, unpadFromBlock } from './bytes';
import { encodeTlv, findTlv, readTlv } from './der';
import type { EcCurve } from './ec-curves';
import {
  bigIntToBytes,
  bytesToBigInt,
  decodePoint,
  encodePoint,
  generator,
  pointAdd,
  pointMultiply,
  randomScalar,
  type EcPoint,
} from './ec';
import type { EmrtdPrimitives } from './crypto';
import { SecureMessagingSession } from './secureMessaging';
import type { PaceProtocol } from './pace-params';

// ---------------------------------------------------------------------------
// PACE, Generic Mapping over elliptic curves (ICAO 9303 Part 11 §4.4).
//
// The newer way into a chip. BAC derives its keys straight from the MRZ, so an
// attacker who photographs the passport page can decrypt a recorded session
// forever. PACE uses the MRZ only to unlock a fresh random nonce, then runs a
// Diffie-Hellman exchange over a generator derived from it — so the session
// keys are new every time and the MRZ alone never reveals them.
//
// The handshake is four exchanges after a setup command:
//
//   0. MSE:Set AT      name the protocol and which password we hold
//   1. get nonce       chip sends a nonce encrypted under the password key
//   2. map nonce       both sides contribute a key; the nonce and the shared
//                      secret combine into a fresh generator
//   3. key agreement   a second exchange over THAT generator gives the session
//                      secret, and the session keys derive from it
//   4. mutual auth     each side proves it derived the same keys, by MACing
//                      the other's public key
//
// Steps 1-3 are sent with the command-chaining class byte; step 4 closes the
// chain. Getting that wrong makes a chip abandon the handshake midway.
//
// Mirrors the Flutter SDK's emrtd_pace.dart step for step, so a chip that reads
// on one platform reads on the other.
// ---------------------------------------------------------------------------

export class PaceError extends Error {
  constructor(
    message: string,
    /**
     * `auth_failed` when the chip refuses the password, which in practice
     * always means a wrong MRZ. Anything else is a protocol or transport fault.
     */
    readonly code: 'auth_failed' | 'read_failed',
  ) {
    super(message);
    this.name = 'PaceError';
    Object.setPrototypeOf(this, PaceError.prototype);
  }
}

/** Data objects inside the dynamic authentication template, by step. */
const DO = {
  template: 0x7c,
  encryptedNonce: 0x80,
  mappingCommand: 0x81,
  mappingResponse: 0x82,
  keyCommand: 0x83,
  keyResponse: 0x84,
  tokenCommand: 0x85,
  tokenResponse: 0x86,
  publicKey: 0x7f49,
  objectIdentifier: 0x06,
  ecPoint: 0x86,
} as const;

const SW_OK = 0x9000;

/** Sends one raw APDU and returns the response data with its status word. */
export type PaceTransceive = (
  command: Uint8Array,
) => Promise<{ data: Uint8Array; statusWord: number }>;

/**
 * Run PACE-GM over an elliptic curve and return the secured session.
 *
 * `passwordKey` is the MRZ-derived password key (counter 3), NOT a session key
 * — PACE uses the MRZ only to unlock the chip's nonce.
 */
export async function runPaceEcdhGm(options: {
  p: EmrtdPrimitives;
  transceive: PaceTransceive;
  protocol: PaceProtocol;
  curve: EcCurve;
  passwordKey: Uint8Array;
  /** Injectable for tests; production draws real randomness. */
  fixed?: { mapPrivate?: bigint; sessionPrivate?: bigint };
}): Promise<SecureMessagingSession> {
  const { p, transceive, protocol, curve, passwordKey } = options;
  const suite = protocol.suite;

  // Step 0 — announce the protocol and which password we are using. No Le:
  // MSE:Set AT returns no data, and appending one makes it a case-4 command
  // the chip answers 0x6700 "wrong length" to.
  await exchange(
    transceive,
    concat(
      new Uint8Array([0x00, 0x22, 0xc1, 0xa4]),
      body(
        [encodeTlv(0x80, protocol.oid), encodeTlv(0x83, new Uint8Array([0x01]))],
        false,
      ),
    ),
    'select',
  );

  // Step 1 — the chip's nonce, encrypted under the password key. A chip that
  // refuses here has decided the password is wrong.
  const nonceReply = await generalAuthenticate(
    transceive,
    encodeTlv(DO.template, new Uint8Array(0)),
    false,
    'nonce',
  );
  // No unpadding: the nonce is whole blocks of random, not a padded message.
  const nonce = suite.decrypt(p, passwordKey, expect(nonceReply, DO.encryptedNonce, 'nonce'));

  // Step 2 — map the nonce onto a fresh generator. Each side sends an ephemeral
  // public key; the shared point plus the nonce give a generator neither side
  // chose alone.
  const mapPrivate = options.fixed?.mapPrivate ?? randomScalar(curve, p.randomBytes);
  const mapPublic = pointMultiply(curve, mapPrivate, generator(curve));
  const mapReply = await generalAuthenticate(
    transceive,
    encodeTlv(DO.template, encodeTlv(DO.mappingCommand, encodePoint(curve, mapPublic))),
    false,
    'mapping',
  );
  const chipMapPoint = decodeChipPoint(curve, expect(mapReply, DO.mappingResponse, 'mapping'));

  const shared = pointMultiply(curve, mapPrivate, chipMapPoint);
  const mappedGenerator = pointAdd(
    curve,
    pointMultiply(curve, bytesToBigInt(nonce) % curve.n, generator(curve)),
    shared,
  );
  if (mappedGenerator.inf) {
    throw new PaceError('The mapped generator was degenerate.', 'read_failed');
  }

  // Step 3 — the real key agreement, over the mapped generator.
  const sessionPrivate = options.fixed?.sessionPrivate ?? randomScalar(curve, p.randomBytes);
  const sessionPublic = pointMultiply(curve, sessionPrivate, mappedGenerator);
  const keyReply = await generalAuthenticate(
    transceive,
    encodeTlv(DO.template, encodeTlv(DO.keyCommand, encodePoint(curve, sessionPublic))),
    false,
    'key agreement',
  );
  const chipSessionPoint = decodeChipPoint(
    curve,
    expect(keyReply, DO.keyResponse, 'key agreement'),
  );

  // Identical public keys mean the exchange contributed nothing.
  if (chipSessionPoint.x === sessionPublic.x && chipSessionPoint.y === sessionPublic.y) {
    throw new PaceError('The chip echoed our public key.', 'read_failed');
  }

  const agreed = pointMultiply(curve, sessionPrivate, chipSessionPoint);
  if (agreed.inf) {
    throw new PaceError('Key agreement produced no secret.', 'read_failed');
  }
  // The shared secret is the agreed point's x coordinate, left-padded to the
  // curve's field width: a short value must not shorten the key derivation.
  const secret = bigIntToBytes(agreed.x, curve.byteLen);

  const ksEnc = suite.deriveKey(p, secret, 1);
  const ksMac = suite.deriveKey(p, secret, 2);

  // Step 4 — each side MACs the OTHER side's public key. Matching tokens prove
  // both derived the same session keys without either revealing them.
  const ourToken = suite.token(p, ksMac, tokenInput(curve, protocol.oid, chipSessionPoint));
  const tokenReply = await generalAuthenticate(
    transceive,
    encodeTlv(DO.template, encodeTlv(DO.tokenCommand, ourToken)),
    true,
    'authentication',
  );
  const chipToken = expect(tokenReply, DO.tokenResponse, 'authentication');
  const expected = suite.token(p, ksMac, tokenInput(curve, protocol.oid, sessionPublic));
  if (!timingSafeEqual(chipToken, expected)) {
    throw new PaceError(
      'The chip proved a different key. The document details do not match.',
      'auth_failed',
    );
  }

  // A PACE session starts its counter at zero, unlike BAC's nonce-derived one.
  return new SecureMessagingSession(p, { ksEnc, ksMac }, new Uint8Array(suite.blockSize), suite);
}

/**
 * GENERAL AUTHENTICATE. Steps before the last are sent with the chaining class
 * byte, which tells the chip more of the same command is coming.
 */
async function generalAuthenticate(
  transceive: PaceTransceive,
  data: Uint8Array,
  last: boolean,
  step: string,
): Promise<Uint8Array> {
  const command = concat(
    new Uint8Array([last ? 0x00 : 0x10, 0x86, 0x00, 0x00]),
    body([data], true),
  );
  const response = await exchange(transceive, command, step);
  const template = readTlv(response);
  if (!template || template.tag !== DO.template) {
    throw new PaceError(`The ${step} reply was not authentication data.`, 'read_failed');
  }
  return template.value;
}

async function exchange(
  transceive: PaceTransceive,
  command: Uint8Array,
  step: string,
): Promise<Uint8Array> {
  const { data, statusWord } = await transceive(command);
  if (statusWord !== SW_OK) {
    // 0x6300 and 0x63CX are how chips say the password was wrong; some older
    // ones use the latter specifically for bad session data.
    const wrongPassword = statusWord === 0x6300 || (statusWord & 0xfff0) === 0x63c0;
    throw new PaceError(
      // The STEP is in both messages on purpose. A refusal at 'authentication'
      // means our token did not match, which points at the password key
      // derivation; one at 'nonce' means the chip would not even start. Without
      // the step both read as "wrong MRZ" and send debugging the wrong way —
      // which is exactly what happened the first time this ran against a real
      // passport.
      wrongPassword
        ? `The chip rejected the document details at the ${step} step.`
        : `The chip returned ${statusWord.toString(16).padStart(4, '0')} at the ${step} step.`,
      wrongPassword ? 'auth_failed' : 'read_failed',
    );
  }
  return data;
}

function expect(template: Uint8Array, tag: number, step: string): Uint8Array {
  const found = findTlv(template, tag);
  if (!found) {
    throw new PaceError(`The ${step} reply was missing its data.`, 'read_failed');
  }
  return found.value;
}

/** A chip-supplied point, validated before any arithmetic touches it. */
function decodeChipPoint(curve: EcCurve, bytes: Uint8Array): EcPoint {
  const pt = decodePoint(curve, bytes);
  // A point off the curve or at infinity would leak our private scalar to a
  // chip that chose it deliberately, so it is refused rather than used.
  if (!pt) throw new PaceError('The chip sent an invalid key.', 'read_failed');
  return pt;
}

/**
 * The object each side MACs to prove it holds the session keys: the protocol
 * identifier and the other party's public point.
 */
function tokenInput(curve: EcCurve, oid: Uint8Array, pt: EcPoint): Uint8Array {
  return encodeTlv(
    DO.publicKey,
    concat(encodeTlv(DO.objectIdentifier, oid), encodeTlv(DO.ecPoint, encodePoint(curve, pt))),
  );
}

/**
 * Lc, body, and Le only when the command actually returns data.
 *
 * ISO 7816 distinguishes a command that sends data (case 3) from one that
 * sends and receives (case 4) by the presence of that trailing byte, and a
 * chip asked for a response it has none of replies 0x6700.
 */
function body(parts: Uint8Array[], expectsResponse: boolean): Uint8Array {
  const joined = concat(...parts);
  return concat(
    new Uint8Array([joined.length]),
    joined,
    expectsResponse ? new Uint8Array([0x00]) : new Uint8Array(0),
  );
}

/** Re-exported so the session can strip padding from a PACE-decrypted body. */
export { unpadFromBlock };
