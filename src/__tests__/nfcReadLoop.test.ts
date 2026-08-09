// ---------------------------------------------------------------------------
// The session/retry loop around a chip read.
//
// The regression this pins down: a drop mid-read was retried by reopening the
// session 700ms later, iOS refused the reopen with an immediate Code=202
// (previous sheet still dismissing), and that refusal was thrown as-is instead
// of retried — so the user saw "the connection to the chip dropped" for a blip
// the loop existed to recover from.
// ---------------------------------------------------------------------------

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }), { virtual: true });

jest.mock('react-native-nitro-modules', () => {
  const native = {
    isAvailable: jest.fn(() => true),
    startSession: jest.fn(),
    stopSession: jest.fn(async () => undefined),
    updateSessionMessage: jest.fn(async () => undefined),
    transceive: jest.fn(),
    decodeImage: jest.fn(),
  };
  return {
    NitroModules: {
      hasHybridObject: jest.fn(() => true),
      createHybridObject: jest.fn(() => native),
    },
    __native: native,
  };
});

jest.mock('../emrtd/session', () => {
  const actual = jest.requireActual('../emrtd/session');
  return { ...actual, readChip: jest.fn() };
});

import { readPassportChip, cancelChipRead } from '../emrtd/read';
import { EmrtdSessionError, readChip } from '../emrtd/session';

const { __native: native } = jest.requireMock('react-native-nitro-modules') as {
  __native: {
    startSession: jest.Mock;
    stopSession: jest.Mock;
  };
};
const readChipMock = readChip as jest.Mock;

const MRZ = { documentNumber: 'X123', dateOfBirth: '900101', dateOfExpiry: '300101' };
// A COMPLETE read carries the SOD; without it the loop deliberately retries.
const RESULT = { dg1: 'ZGcx', sod: 'c29k', chipAuth: 'bac' };
const PARTIAL = { dg1: 'ZGcx', chipAuth: 'bac' };
const tagInfo = { connected: true, uid: 'dWlk' };
const dropped = (): EmrtdSessionError =>
  new EmrtdSessionError('The chip stopped responding.', 'read_failed');

beforeEach(() => {
  jest.clearAllMocks();
  native.startSession.mockResolvedValue(tagInfo);
  native.stopSession.mockResolvedValue(undefined);
});

describe('readPassportChip', () => {
  it('recovers from a drop with a fresh session', async () => {
    readChipMock.mockRejectedValueOnce(dropped()).mockResolvedValueOnce(RESULT);

    await expect(readPassportChip(MRZ)).resolves.toEqual(RESULT);
    expect(native.startSession).toHaveBeenCalledTimes(2);
    // The intermediate dismissal is QUIET — no error painted on a sheet the
    // next attempt is about to replace. The success message ends the read.
    expect(native.stopSession.mock.calls.map(([m]) => m)).toEqual(['', 'Passport read']);
  }, 10_000);

  it('retries a session refused while the previous sheet dismisses', async () => {
    // Attempt 1 drops mid-read; the reopen is refused with iOS's immediate 202.
    // That refusal must be retried, not surfaced — it IS the recovery path.
    readChipMock.mockRejectedValueOnce(dropped()).mockResolvedValueOnce(RESULT);
    native.startSession
      .mockResolvedValueOnce(tagInfo)
      .mockRejectedValueOnce(
        new Error('Error Domain=NFCError Code=202 "Session invalidated unexpectedly"'),
      )
      .mockResolvedValueOnce(tagInfo);

    await expect(readPassportChip(MRZ)).resolves.toEqual(RESULT);
    expect(native.startSession).toHaveBeenCalledTimes(3);
  }, 10_000);

  it('leaves a cancelled sheet alone', async () => {
    native.startSession.mockRejectedValue(
      new Error('Error Domain=NFCError Code=200 "Session invalidated by user"'),
    );

    await expect(readPassportChip(MRZ)).rejects.toThrow('Code=200');
    expect(native.startSession).toHaveBeenCalledTimes(1);
  });

  it('gives up after the attempt budget, surfacing the last error', async () => {
    readChipMock.mockRejectedValue(dropped());

    await expect(readPassportChip(MRZ)).rejects.toThrow('stopped responding');
    expect(native.startSession).toHaveBeenCalledTimes(3);
    // Only the terminal failure carries a message; the two before it are quiet.
    expect(native.stopSession.mock.calls.map(([m]) => m)).toEqual([
      '',
      '',
      'The chip stopped responding.',
    ]);
  }, 10_000);

  it('retries a read that came back without the security file', async () => {
    // Without EF.SOD the server cannot verify the chip and the photo is never
    // fetched — a partial like this is worth another session while the budget
    // lasts. The second attempt completes and wins.
    readChipMock.mockResolvedValueOnce(PARTIAL).mockResolvedValueOnce(RESULT);

    await expect(readPassportChip(MRZ)).resolves.toEqual(RESULT);
    expect(native.startSession).toHaveBeenCalledTimes(2);
    // The incomplete attempt dismisses quietly; only the full read announces.
    expect(native.stopSession.mock.calls.map(([m]) => m)).toEqual(['', 'Passport read']);
  }, 10_000);

  it('settles for the partial when no attempt produces the security file', async () => {
    readChipMock.mockResolvedValue(PARTIAL);

    await expect(readPassportChip(MRZ)).resolves.toEqual(PARTIAL);
    expect(native.startSession).toHaveBeenCalledTimes(3);
  }, 10_000);

  it('returns the banked partial when the completeness retry then fails outright', async () => {
    // Attempt 1: DG1 but no SOD. Attempt 2: the chip drops and never comes
    // back. The user already saw a working read — surface that, not an error.
    readChipMock.mockResolvedValueOnce(PARTIAL).mockRejectedValue(dropped());

    await expect(readPassportChip(MRZ)).resolves.toEqual(PARTIAL);
  }, 15_000);

  it('never reopens a session after the read is abandoned', async () => {
    // The loop is asleep between attempts when the user leaves the step. On
    // waking it must stop — reopening would put a session over the next screen.
    readChipMock.mockRejectedValue(dropped());
    const read = readPassportChip(MRZ);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await cancelChipRead();

    await expect(read).rejects.toThrow(/cancelled/i);
    expect(native.startSession).toHaveBeenCalledTimes(1);
  }, 10_000);
});
