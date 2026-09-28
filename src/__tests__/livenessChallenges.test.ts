import { livenessPrompts, pickChallenges, pickFallbackGestures } from '../liveness/challengeManager';
import { buildLivenessIntegrity } from '../liveness/integritySignals';
import { HOLD_MS, HoldTimer, faceCentred } from '../liveness/holdDetector';
import { CHALLENGE_TEXT_KEYS, challengeInstruction, type LivenessMode } from '../liveness/types';

// ---------------------------------------------------------------------------
// Which prompts a liveness run asks for, mirroring the web SDK's
// challenge-manager.test.ts. 3D Active Motion always includes a head turn,
// because the server's shape-from-movement test needs one; Passive Liveness
// asks only for a hold. The flash is a phase of its own in this SDK (not a
// tracker entry), so the flash half of each assertion goes through
// livenessPrompts, which is what the claim reports.
// ---------------------------------------------------------------------------

const types = (mode?: LivenessMode) =>
  pickChallenges({ mode }).map((c) => c.type);

describe('pickChallenges: 3D Active Motion', () => {
  it('always includes a head turn, never beside a nod, with no duplicates', () => {
    for (let i = 0; i < 200; i += 1) {
      const picked = types('gestures');
      expect(picked).toContain('turn');
      expect(picked).not.toContain('nod');
      expect(new Set(picked).size).toBe(picked.length);
      expect(picked).toHaveLength(2);
    }
  });

  it('keeps the order random: the turn is not always first', () => {
    const firsts = new Set(Array.from({ length: 200 }, () => types('gestures')[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('includes the turn in a three-prompt run too', () => {
    for (let i = 0; i < 50; i += 1) {
      const picked = pickChallenges({ challengeCount: 3 }).map((c) => c.type);
      expect(picked).toContain('turn');
      expect(new Set(picked).size).toBe(3);
    }
  });

  it('forces no turn when the pool excludes it', () => {
    const picked = pickChallenges({ challengePool: ['blink', 'smile'] }).map((c) => c.type);
    expect(picked).not.toContain('turn');
  });
});

describe('the prompts each mode runs', () => {
  it('runs the gestures then the flash in Dual Check', () => {
    const picked = types('both');
    expect(picked).toContain('turn');
    const prompts = livenessPrompts('both', picked);
    expect(prompts.at(-1)).toBe('flash');
    expect(prompts).toHaveLength(picked.length + 1);
  });

  it('asks only for the flash in 3D Flash Check', () => {
    expect(livenessPrompts('flash', types('flash'))).toEqual(['flash']);
  });

  it('asks only for a hold in Passive Liveness', () => {
    expect(types('passive')).toEqual(['hold']);
    expect(livenessPrompts('passive', types('passive'))).toEqual(['hold']);
  });

  it('lists the flash and then the fallback gestures when a flash-only run fell back', () => {
    const fallback = pickFallbackGestures({ mode: 'flash' }).map((c) => c.type);
    expect(fallback).toContain('turn');
    expect(livenessPrompts('flash', fallback, true)).toEqual(['flash', ...fallback]);
  });

  it('carries the prompts on the liveness claim', () => {
    const claim = buildLivenessIntegrity('passive', 0, null, ['hold']);
    expect(claim).toEqual({ mode: 'passive', challenges: ['hold'], faceGlitches: 0 });
  });
});

describe('the hold prompt', () => {
  it('has its own customisable instruction', () => {
    expect(CHALLENGE_TEXT_KEYS.hold).toBe('presence.challenge.hold');
    expect(challengeInstruction('hold')).toBe('Hold still and look at the camera');
  });

  it('passes after about two seconds of an unbroken, in-position face', () => {
    const hold = new HoldTimer();
    expect(hold.update(true, 0)).toBe(false);
    expect(hold.update(true, HOLD_MS - 1)).toBe(false);
    expect(hold.update(true, HOLD_MS)).toBe(true);
  });

  it('restarts whenever the face leaves position', () => {
    const hold = new HoldTimer();
    hold.update(true, 0);
    hold.update(false, 1500);
    expect(hold.update(true, 1600)).toBe(false);
    expect(hold.update(true, 1600 + HOLD_MS - 1)).toBe(false);
    expect(hold.update(true, 1600 + HOLD_MS)).toBe(true);
    hold.reset();
    expect(hold.update(true, 10_000)).toBe(false);
  });

  it('counts a face as centred within 20% of the middle, and trusts distance without a centre', () => {
    expect(faceCentred({ faceCenterX: 0.5, faceCenterY: 0.55 })).toBe(true);
    expect(faceCentred({ faceCenterX: 0.8, faceCenterY: 0.5 })).toBe(false);
    expect(faceCentred({})).toBe(true);
  });
});
