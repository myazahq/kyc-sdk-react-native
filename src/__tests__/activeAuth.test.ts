// Active Authentication — the chip proving it is the original, not a copy.
//
// The signature check itself is the server's job (a client that verified its
// own chip could be patched to say yes), so what matters here is the SHAPE of
// what we ask for: the right APDU, the server's challenge and nobody else's,
// and a chip that cannot do any of it losing the check rather than the read.
import { readActiveAuth } from '../emrtd/activeAuth';
import { readOptionalFile } from '../emrtd/optionalRead';

jest.mock('../emrtd/optionalRead', () => ({ readOptionalFile: jest.fn() }));
const mockRead = readOptionalFile as jest.MockedFunction<typeof readOptionalFile>;

const DG15 = new Uint8Array([0x6f, 0x03, 0x30, 0x01, 0x00]);
const CHALLENGE = { id: 'chal_1', bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) };

/** A chip that answers INTERNAL AUTHENTICATE with `signature`, or refuses. */
function fakeSession(signature: Uint8Array | null) {
  const sent: Array<{ ins: number; data?: Uint8Array; le?: number }> = [];
  const sm = {
    protect: (apdu: { ins: number; data?: Uint8Array; le?: number }) => {
      sent.push(apdu);
      return new Uint8Array([0]);
    },
    unprotect: () =>
      signature ? { data: signature, statusWord: 0x9000 } : { data: new Uint8Array(), statusWord: 0x6a88 },
  };
  return { sm: sm as never, transceive: async () => new Uint8Array(), sent };
}

beforeEach(() => mockRead.mockReset());

describe('readActiveAuth', () => {
  it('does nothing at all without a server challenge', async () => {
    // Not a degraded read — a SKIPPED one. Reading DG15 for a key nothing can
    // be checked against costs a round trip on a document the user is holding.
    const { sm, transceive } = fakeSession(new Uint8Array([9]));
    expect(await readActiveAuth(sm, transceive, undefined)).toEqual({});
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('refuses a challenge that is not 8 bytes — 9303-11 fixes the length', async () => {
    const { sm, transceive } = fakeSession(new Uint8Array([9]));
    const short = { id: 'c', bytes: new Uint8Array([1, 2, 3]) };
    expect(await readActiveAuth(sm, transceive, short)).toEqual({});
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('sends INTERNAL AUTHENTICATE with the SERVER challenge as its data', async () => {
    mockRead.mockResolvedValue(DG15);
    const { sm, transceive, sent } = fakeSession(new Uint8Array([0xaa, 0xbb]));
    const result = await readActiveAuth(sm, transceive, CHALLENGE);

    // INS 0x88 is INTERNAL AUTHENTICATE; Le 0 because the answer's length
    // varies by document and naming one would truncate the rest.
    expect(sent).toHaveLength(1);
    expect(sent[0]!.ins).toBe(0x88);
    expect(sent[0]!.le).toBe(0);
    expect(Array.from(sent[0]!.data!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.dg15).toBeTruthy();
    expect(result.signature).toBeTruthy();
  });

  it('a chip with no DG15 simply has no AA — never an error', async () => {
    // The overwhelming majority of chips in the field.
    mockRead.mockResolvedValue(null);
    const { sm, transceive } = fakeSession(new Uint8Array([9]));
    expect(await readActiveAuth(sm, transceive, CHALLENGE)).toEqual({});
  });

  it('keeps DG15 when the chip carries the key but will not sign', async () => {
    // Unusual, and worth reporting honestly: the server can then say "read the
    // key, got no answer" rather than "this chip has no AA".
    mockRead.mockResolvedValue(DG15);
    const { sm, transceive } = fakeSession(null);
    const result = await readActiveAuth(sm, transceive, CHALLENGE);
    expect(result.dg15).toBeTruthy();
    expect(result.signature).toBeUndefined();
  });
});
