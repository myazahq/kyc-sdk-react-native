import { settleVerdict } from '../screens/nfc/availability';

// ---------------------------------------------------------------------------
// "No NFC radio" vs "the native module hasn't loaded yet".
//
// These are indistinguishable at the first render and mean opposite things.
// Nitro populates its registry asynchronously, so a phone that reads chips fine
// can report unavailable for a moment — observed on a real device where three
// consecutive reloads said available and the fourth said not, with no code
// change in between.
//
// The consequence is severe out of proportion to the cause: the chip step skips
// itself when NFC is unavailable, so one unlucky sample deletes the entire NFC
// screen silently. That is how it first surfaced — reported as the screen
// simply not existing.
// ---------------------------------------------------------------------------

describe('settleVerdict', () => {
  it('trusts a positive answer immediately', () => {
    // No reason to wait: the read still has to succeed on its own merits, so a
    // premature "available" costs nothing worse than an extra screen.
    expect(settleVerdict(true, 0)).toBe('available');
  });

  it('refuses to conclude "unavailable" from an early sample', () => {
    // The regression this exists to prevent.
    expect(settleVerdict(false, 0)).toBe('checking');
    expect(settleVerdict(false, 500)).toBe('checking');
    expect(settleVerdict(false, 1500)).toBe('checking'); // the probe was still false here on real launches
  });

  it('concludes "unavailable" only once it has stayed false for the window', () => {
    expect(settleVerdict(false, 3000, 'device_unsupported')).toBe('unsupported');
    expect(settleVerdict(false, 5000, 'device_unsupported')).toBe('unsupported');
  });

  it('does NOT call it unsupported when the module simply never registered', () => {
    // Our wiring failing is not the phone saying no. Conflating them rendered
    // the chip screen and then yanked it away seconds later, mid-read.
    expect(settleVerdict(false, 5000, 'module_not_registered')).toBe('module_missing');
    expect(settleVerdict(false, 5000, null)).toBe('module_missing');
  });

  it('still reports available on a late arrival', () => {
    // A slow registry must not be permanently mistaken for absent hardware.
    expect(settleVerdict(true, 2999)).toBe('available');
  });
});
