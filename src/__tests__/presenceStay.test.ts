import { CHECKPOINT_MS, FIRST_CHECKPOINT_MS } from '../presence/background-math';
import { stayFromStored } from '../presence/stay';

jest.mock('../presence/background-store', () => ({ loadStay: jest.fn() }));

describe('stayFromStored', () => {
  it('is null with no stay open', () => {
    expect(stayFromStored({ enterAt: null, stayStart: null })).toBeNull();
  });

  it('a new stay is due its first report after 35 minutes', () => {
    expect(stayFromStored({ enterAt: 1_000, stayStart: 1_000 })).toEqual({
      since: 1_000,
      nextReportAt: 1_000 + FIRST_CHECKPOINT_MS,
    });
  });

  it('a stay already recorded keeps its arrival time and waits three hours', () => {
    expect(stayFromStored({ enterAt: 9_000, stayStart: 1_000 })).toEqual({
      since: 1_000,
      nextReportAt: 9_000 + CHECKPOINT_MS,
    });
  });

  it('a stay from an older install has no start on file: the stay itself', () => {
    expect(stayFromStored({ enterAt: 5_000, stayStart: null })).toEqual({
      since: 5_000,
      nextReportAt: 5_000 + FIRST_CHECKPOINT_MS,
    });
  });
});
