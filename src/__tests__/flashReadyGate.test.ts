import { FlashReadyGate, FLASH_READY_DWELL_MS } from '../liveness/flashReadyGate';

// ---------------------------------------------------------------------------
// When a flash-only sequence is allowed to start.
//
// Without this gate, flash-only flashed the instant a face hit the right
// distance — off a SINGLE frame, before lighting had been measured. Gestures
// don't need a gate because they take seconds and re-check framing throughout;
// nothing follows the flash, so it has none of that buffer. The observed
// behaviour was a screen that lit up before the user had settled, and before
// any "come closer / more light" guidance could show.
//
// The clock is injected so the timing is tested rather than tuned on a device.
// ---------------------------------------------------------------------------

const framedAndLit = { framed: true, lit: true, lightingConfirmed: true };

describe('FlashReadyGate', () => {
  it('does not fire on a single good frame', () => {
    // The actual regression: one frame at the right distance was enough.
    const gate = new FlashReadyGate();
    expect(gate.update({ ...framedAndLit, now: 0 }).ready).toBe(false);
  });

  it('fires once framed+lit has held for the dwell', () => {
    const gate = new FlashReadyGate();
    gate.update({ ...framedAndLit, now: 0 });
    expect(gate.update({ ...framedAndLit, now: FLASH_READY_DWELL_MS - 1 }).ready).toBe(false);
    expect(gate.update({ ...framedAndLit, now: FLASH_READY_DWELL_MS }).ready).toBe(true);
  });

  it('requires a CONTINUOUS hold, not a cumulative one', () => {
    // A face crossing through the right distance repeatedly must never add up
    // to a pass — the point is one steady moment.
    const gate = new FlashReadyGate();
    gate.update({ ...framedAndLit, now: 0 });
    gate.update({ ...framedAndLit, now: 1000 });
    gate.update({ framed: false, lit: true, lightingConfirmed: true, now: 1100 });
    expect(gate.update({ ...framedAndLit, now: 1200 }).ready).toBe(false);
    // The hold restarted at 1200, so it completes a full dwell later.
    expect(gate.update({ ...framedAndLit, now: 1200 + FLASH_READY_DWELL_MS }).ready).toBe(true);
  });

  it('waits for lighting to be MEASURED, not merely un-warned', () => {
    // During the sampler's warm-up there is no warning because nothing has been
    // read yet. Treating that as good is how a dim room flashed with no "more
    // light" prompt.
    const gate = new FlashReadyGate();
    const unconfirmed = { framed: true, lit: true, lightingConfirmed: false };
    gate.update({ ...unconfirmed, now: 0 });
    expect(gate.update({ ...unconfirmed, now: FLASH_READY_DWELL_MS }).ready).toBe(false);
  });

  it('proceeds anyway if the sampler never reports', () => {
    // Safety valve: a device whose brightness sampling is unsupported or broken
    // must not strand the user on a permanent "hold still".
    const gate = new FlashReadyGate();
    const unconfirmed = { framed: true, lit: true, lightingConfirmed: false };
    gate.update({ ...unconfirmed, now: 0 });
    expect(gate.update({ ...unconfirmed, now: 3000 }).ready).toBe(true);
  });

  it('restarts the hold after a reset, so a retry re-earns it', () => {
    const gate = new FlashReadyGate();
    gate.update({ ...framedAndLit, now: 0 });
    gate.reset();
    expect(gate.update({ ...framedAndLit, now: FLASH_READY_DWELL_MS }).ready).toBe(false);
  });

  it('reports progress across the dwell for a "getting ready" cue', () => {
    const gate = new FlashReadyGate();
    gate.update({ ...framedAndLit, now: 0 });
    const half = gate.update({ ...framedAndLit, now: FLASH_READY_DWELL_MS / 2 });
    expect(half.progress).toBeCloseTo(0.5, 2);
    expect(gate.update({ framed: false, lit: true, lightingConfirmed: true, now: 700 }).progress).toBe(0);
  });
});
