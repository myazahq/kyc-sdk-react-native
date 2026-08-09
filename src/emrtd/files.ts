import { concat } from './bytes';
import { readTlvHeader } from './der';
import type { SecureMessagingSession } from './secureMessaging';

// ---------------------------------------------------------------------------
// Reading elementary files off the chip.
//
// SELECT the file, read its TLV header to learn the length, then READ BINARY in
// chunks. Three details make the difference between this working on one
// passport and working on all of them:
//
//   • The READ LENGTH IS ADAPTIVE. Chips disagree about how much they will
//     return in one go, and one that is asked for too much answers 0x6CXX with
//     the length it WILL accept. Starting optimistic and stepping down on
//     refusal reads a 30KB DG2 in a fraction of the round trips a conservative
//     fixed size would need.
//   • Offsets past 0x7FFF do not fit the short READ BINARY form, so DG2 —
//     which routinely exceeds 32KB — needs the extended form with the offset in
//     the command data. Masking it into the short form instead reads the WRONG
//     BYTES and silently returns a corrupt portrait.
//   • The status comes from inside secure messaging, not the outer word.
// ---------------------------------------------------------------------------

/** Elementary file identifiers. */
export const EF = {
  COM: 0x011e,
  DG1: 0x0101,
  DG2: 0x0102,
  SOD: 0x011d,
} as const;

const SW_OK = 0x9000;
/** "Wrong length — use this one instead", with the acceptable length in SW2. */
const SW_WRONG_LE = 0x6c00;
/** Some chips report end-of-file this way rather than returning fewer bytes. */
const SW_EOF = 0x6282;
/** "Part of the returned data may be corrupted" — a warning that carries data. */
const SW_CORRUPT_WARNING = 0x6281;

/**
 * Status words whose response still carries usable data. `61XX` ("more bytes
 * available") and the corruption warning were being ladder-stepped like hard
 * errors, discarding data the chip HAD returned — the Flutter reader accepts
 * both, and chips that answer this way exist.
 */
function carriesData(statusWord: number): boolean {
  return (
    statusWord === SW_OK ||
    statusWord === SW_EOF ||
    statusWord === SW_CORRUPT_WARNING ||
    (statusWord & 0xff00) === 0x6100
  );
}

/**
 * Chunk sizes to try, largest first.
 *
 * The ladder exists because chips do not agree and do not advertise: the only
 * way to find the limit is to ask and be told no.
 */
const READ_LADDER = [224, 160, 128, 96, 64, 32, 16, 8, 1];
const DEFAULT_READ = 112;

export class EmrtdFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmrtdFileError';
    Object.setPrototypeOf(this, EmrtdFileError.prototype);
  }
}

/** Sends one wrapped APDU and returns the unwrapped answer. */
export type Transceive = (command: Uint8Array) => Promise<Uint8Array>;

async function send(
  sm: SecureMessagingSession,
  transceive: Transceive,
  apdu: Parameters<SecureMessagingSession['protect']>[0],
): Promise<{ data: Uint8Array; statusWord: number }> {
  return sm.unprotect(await transceive(sm.protect(apdu)));
}

/** SELECT an elementary file by identifier. */
export async function selectFile(
  sm: SecureMessagingSession,
  transceive: Transceive,
  fileId: number,
): Promise<void> {
  const { statusWord } = await send(sm, transceive, {
    cla: 0x00,
    ins: 0xa4,
    p1: 0x02,
    p2: 0x0c,
    data: new Uint8Array([(fileId >> 8) & 0xff, fileId & 0xff]),
  });
  if (statusWord !== SW_OK) {
    throw new EmrtdFileError(
      `The chip refused to select file ${fileId.toString(16)} (0x${statusWord.toString(16)}).`,
    );
  }
}

/** One READ BINARY at an offset, using whichever command form the offset needs. */
async function readAt(
  sm: SecureMessagingSession,
  transceive: Transceive,
  offset: number,
  length: number,
): Promise<{ data: Uint8Array; statusWord: number }> {
  if (offset < 0x8000) {
    return send(sm, transceive, {
      cla: 0x00,
      ins: 0xb0,
      p1: (offset >> 8) & 0x7f,
      p2: offset & 0xff,
      le: length,
    });
  }

  // Beyond 32KB the offset no longer fits the header, so it moves into the
  // command data as a DO'54' — the extended form. Masking it into the short
  // form would read from the wrong place and return a corrupt file.
  return send(sm, transceive, {
    cla: 0x00,
    ins: 0xb1,
    p1: 0x00,
    p2: 0x00,
    data: new Uint8Array([0x54, 0x02, (offset >> 8) & 0xff, offset & 0xff]),
    le: length,
  });
}

/**
 * Read the currently-selected file in full.
 *
 * `expectedLength` comes from the file's own TLV header, read first.
 */
async function readSelected(
  sm: SecureMessagingSession,
  transceive: Transceive,
  expectedLength: number,
  alreadyRead: Uint8Array,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [alreadyRead];
  let offset = alreadyRead.length;
  let chunkSize = DEFAULT_READ;

  while (offset < expectedLength) {
    const want = Math.min(chunkSize, expectedLength - offset);
    const { data, statusWord } = await readAt(sm, transceive, offset, want);

    if (statusWord === SW_WRONG_LE || (statusWord & 0xff00) === SW_WRONG_LE) {
      // The chip named the length it will accept. Honour it exactly rather
      // than guessing again.
      const allowed = statusWord & 0x00ff;
      if (allowed > 0) {
        chunkSize = allowed;
        continue;
      }
    }

    if (!carriesData(statusWord)) {
      // Step down the ladder and retry; a chip that will not answer at ANY
      // size is a real failure, which the exhausted ladder reports below.
      const next = READ_LADDER.find((n) => n < chunkSize);
      if (next === undefined) {
        throw new EmrtdFileError(
          `The chip stopped responding at offset ${offset} (0x${statusWord.toString(16)}).`,
        );
      }
      chunkSize = next;
      continue;
    }

    if (data.length === 0) break; // End of file.
    chunks.push(data);
    offset += data.length;
  }

  return concat(...chunks);
}

/**
 * Select and read an elementary file.
 *
 * The first read is small and deliberate: it fetches the TLV header, which
 * carries the file's real length. Reading blind until the chip stops is slower
 * and, on chips that pad, returns trailing rubbish.
 */
export async function readFile(
  sm: SecureMessagingSession,
  transceive: Transceive,
  fileId: number,
): Promise<Uint8Array> {
  await selectFile(sm, transceive, fileId);

  // Four bytes is enough for a tag plus a long-form length of up to 0xFFFF.
  const head = await readAt(sm, transceive, 0, 4);
  if (!carriesData(head.statusWord)) {
    throw new EmrtdFileError(
      `The chip refused to read file ${fileId.toString(16)} (0x${head.statusWord.toString(16)}).`,
    );
  }
  if (head.data.length === 0) return new Uint8Array(0);

  // The header names the file's true size. A header that does not parse from
  // four bytes is not a failure — the length field can extend past them — so
  // the fallback reads until the chip stops, which is slower but never wrong.
  const header = readTlvHeader(head.data);
  const expected = header
    ? header.headerLength + header.valueLength
    : Number.MAX_SAFE_INTEGER;

  return readSelected(sm, transceive, expected, head.data);
}
