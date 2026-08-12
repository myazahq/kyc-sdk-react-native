import { readTlv, readTlvSequence } from './der';
import { curveForParameterId, type EcCurve } from './ec-curves';
import { DES_EDE2_SUITE, aesSuite, type CipherSuite } from './suites';

// ---------------------------------------------------------------------------
// PACE protocols, domain parameters, and EF.CardAccess (ICAO 9303 Part 11 §9.2).
//
// A chip advertises which PACE variants it supports as object identifiers in
// EF.CardAccess — a small file at the Master File level, readable with NO
// session at all, which is how a terminal discovers whether the chip speaks
// PACE and with which parameters.
//
// Only Generic Mapping over elliptic curves is implemented. Integrated Mapping
// and Chip Authentication Mapping are distinct protocols rather than
// variations, and PACE over finite-field Diffie-Hellman needs the RFC 5114
// modular groups embedded as constants, where a subtly wrong 2048-bit prime
// fails in a way that looks like a bad document. Virtually every issued
// passport offers the elliptic-curve variants, and anything reaching those gaps
// still reads over BAC.
// ---------------------------------------------------------------------------

/** How the chip's nonce is mapped onto a fresh generator. */
export type PaceMapping = 'generic' | 'integrated' | 'chipAuthentication';

/** Which key-agreement primitive the mapping runs over. */
export type PaceKeyAgreement = 'dh' | 'ecdh';

/** A PACE variant the chip advertised. */
export interface PaceProtocol {
  /**
   * The raw OID bytes. Re-sent to the chip and folded into the authentication
   * tokens, so they must be preserved exactly as received.
   */
  readonly oid: Uint8Array;
  readonly mapping: PaceMapping;
  readonly keyAgreement: PaceKeyAgreement;
  readonly suite: CipherSuite;
}

/** Whether this build can actually run the variant. */
export function isSupportedProtocol(protocol: PaceProtocol): boolean {
  return protocol.mapping === 'generic' && protocol.keyAgreement === 'ecdh';
}

export function describeProtocol(protocol: PaceProtocol): string {
  return `PACE-${protocol.keyAgreement.toUpperCase()}-${protocol.mapping} ${protocol.suite.name}`;
}

/** `0.4.0.127.0.7.2.2.4` — the arc every PACE protocol identifier sits under. */
const PACE_ARC = [0x04, 0x00, 0x7f, 0x00, 0x07, 0x02, 0x02, 0x04];

/** The last-but-one arc component selects mapping + key agreement. */
const BRANCHES: Record<number, [PaceMapping, PaceKeyAgreement]> = {
  1: ['generic', 'dh'],
  2: ['generic', 'ecdh'],
  3: ['integrated', 'dh'],
  4: ['integrated', 'ecdh'],
  6: ['chipAuthentication', 'ecdh'],
};

/** The final component selects the cipher suite. */
const CIPHERS: Record<number, CipherSuite> = {
  1: DES_EDE2_SUITE,
  2: aesSuite(16),
  3: aesSuite(24),
  4: aesSuite(32),
};

/**
 * Decode a PACE protocol OID, or null when it is not one.
 *
 * An unknown OID in EF.CardAccess is NORMAL, not an error: the file also
 * carries security information for chip authentication and terminal
 * authentication, which this SDK does not run.
 */
export function paceProtocolFromOid(oid: Uint8Array): PaceProtocol | null {
  if (oid.length !== PACE_ARC.length + 2) return null;
  for (let i = 0; i < PACE_ARC.length; i++) {
    if (oid[i] !== PACE_ARC[i]) return null;
  }
  const branch = BRANCHES[oid[PACE_ARC.length]!];
  const suite = CIPHERS[oid[PACE_ARC.length + 1]!];
  if (!branch || !suite) return null;
  return { oid: new Uint8Array(oid), mapping: branch[0], keyAgreement: branch[1], suite };
}

/** One PACE offering from the chip. */
export interface PaceOffer {
  readonly protocol: PaceProtocol;
  /** The standardised domain-parameter id, naming a curve or DH group. */
  readonly parameterId: number | null;
}

/**
 * The PACE offerings advertised in EF.CardAccess, in file order.
 *
 * Returns empty for a chip that advertises no PACE, for a file that cannot be
 * parsed, and for one that is simply absent — all of which mean the same thing
 * to the caller: use BAC.
 */
export function parseCardAccess(file: Uint8Array): PaceOffer[] {
  const offers: PaceOffer[] = [];
  // The file is a SET (0x31) of SEQUENCEs. Some chips wrap it differently, so
  // accept the SET's contents or a bare run of SEQUENCEs.
  const outer = readTlv(file);
  const body = outer && outer.tag === 0x31 ? outer.value : file;

  for (const info of readTlvSequence(body)) {
    if (info.tag !== 0x30) continue; // not a SecurityInfo
    const fields = readTlvSequence(info.value);
    const first = fields[0];
    if (!first || first.tag !== 0x06) continue;

    const protocol = paceProtocolFromOid(first.value);
    if (!protocol) continue; // some other protocol's security info

    // PACEInfo ::= SEQUENCE { protocol OID, version INTEGER,
    //                         parameterId INTEGER OPTIONAL }
    const ints = fields.slice(1).filter((f) => f.tag === 0x02);
    const parameterId = ints.length > 1 ? intFromBytes(ints[1]!.value) : null;
    offers.push({ protocol, parameterId });
  }
  return offers;
}

/** A small DER INTEGER as a number. */
function intFromBytes(bytes: Uint8Array): number {
  let n = 0;
  for (const b of bytes) n = n * 256 + b;
  return n;
}

/** A usable offering plus its resolved curve. */
export interface SelectedPaceOffer {
  readonly offer: PaceOffer;
  readonly curve: EcCurve;
}

/**
 * The offering to actually attempt, or null when none is usable.
 *
 * Prefers the strongest cipher the chip offers among the variants this build
 * supports, so a chip advertising both AES-256 and 3DES is run at AES-256.
 */
export function selectPaceOffer(offers: PaceOffer[]): SelectedPaceOffer | null {
  let best: SelectedPaceOffer | null = null;
  for (const offer of offers) {
    if (!isSupportedProtocol(offer.protocol)) continue;
    if (offer.parameterId === null) continue;
    const curve = curveForParameterId(offer.parameterId);
    if (!curve) continue;
    if (!best || offer.protocol.suite.keyLength > best.offer.protocol.suite.keyLength) {
      best = { offer, curve };
    }
  }
  return best;
}

/** Why no offering was usable. Diagnostics only — the read falls back to BAC. */
export type PaceGap = 'mapping' | 'keyAgreement' | 'domainParameters';

export function paceGapFor(offers: PaceOffer[]): PaceGap | null {
  if (offers.length === 0) return null;
  for (const offer of offers) {
    if (offer.protocol.keyAgreement !== 'ecdh') return 'keyAgreement';
    if (offer.protocol.mapping !== 'generic') return 'mapping';
  }
  return 'domainParameters';
}
