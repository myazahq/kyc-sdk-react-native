import { createBrightnessBooster, type BrightnessBackend } from '../lib/brightness-booster';

// ─── Raising the screen brightness during liveness, and putting it back ──────
//
// The platform part is a backend (components/brightness-backend.ts); these pin
// the part that must hold on every platform: read once, restore once, in
// order, and never throw.

function fakeBackend(start = 0.4) {
  let level = start;
  const calls: string[] = [];
  const backend: BrightnessBackend & { level: () => number } = {
    read: async () => {
      calls.push('read');
      return level;
    },
    apply: async () => {
      calls.push('apply');
      level = 1;
    },
    revert: async (previous) => {
      calls.push(`revert:${previous}`);
      if (previous != null) level = previous;
    },
    level: () => level,
  };
  return { backend, calls };
}

describe('the brightness booster', () => {
  it('raises to full and puts the previous value back', async () => {
    const { backend, calls } = fakeBackend(0.4);
    const booster = createBrightnessBooster(backend);
    await booster.boost();
    expect(backend.level()).toBe(1);
    expect(booster.isBoosted()).toBe(true);
    await booster.restore();
    expect(backend.level()).toBe(0.4);
    expect(calls).toEqual(['read', 'apply', 'revert:0.4']);
  });

  it('reads once however many times it is asked to raise', async () => {
    const { backend, calls } = fakeBackend(0.2);
    const booster = createBrightnessBooster(backend);
    await booster.boost();
    await booster.boost();
    await booster.restore();
    await booster.restore();
    expect(calls).toEqual(['read', 'apply', 'revert:0.2']);
  });

  it('a restore issued mid-raise lands after it, never before', async () => {
    // Otherwise the late raise wins and the screen stays at full after the
    // step has gone.
    const { backend } = fakeBackend(0.3);
    const booster = createBrightnessBooster(backend);
    void booster.boost();
    await booster.restore();
    expect(backend.level()).toBe(0.3);
    expect(booster.isBoosted()).toBe(false);
  });

  it('raises again from the CURRENT value after coming back to the app', async () => {
    const { backend, calls } = fakeBackend(0.5);
    const booster = createBrightnessBooster(backend);
    await booster.boost();
    await booster.restore();
    await booster.boost();
    await booster.restore();
    expect(calls).toEqual(['read', 'apply', 'revert:0.5', 'read', 'apply', 'revert:0.5']);
  });

  it('never throws, and a failed raise does not block the restore behind it', async () => {
    const booster = createBrightnessBooster({
      read: async () => {
        throw new Error('no screen');
      },
      apply: async () => {},
      revert: async () => {
        throw new Error('never reached');
      },
    });
    await expect(booster.boost()).resolves.toBeUndefined();
    expect(booster.isBoosted()).toBe(false);
    await expect(booster.restore()).resolves.toBeUndefined();
  });

  it('a backend without a read (the Android window override) restores with null', async () => {
    const calls: string[] = [];
    const booster = createBrightnessBooster({
      apply: async () => void calls.push('apply'),
      revert: async (previous) => void calls.push(`revert:${previous}`),
    });
    await booster.boost();
    await booster.restore();
    expect(calls).toEqual(['apply', 'revert:null']);
  });

  it('does nothing, and never throws, with no backend on the install', async () => {
    const booster = createBrightnessBooster(null);
    await expect(booster.boost()).resolves.toBeUndefined();
    await expect(booster.restore()).resolves.toBeUndefined();
    expect(booster.isBoosted()).toBe(false);
  });
});
