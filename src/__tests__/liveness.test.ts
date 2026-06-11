// expo-speech is an ESM native module; the pure-logic tests here don't exercise
// TTS, so stub it (matches jest.config's "native modules tested later" note).
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

import { resolveVoiceGuidance } from '../liveness/speech';
import { evaluateChallenge } from '../liveness/gestureDetector';
import { pickChallenges, ChallengeTracker } from '../liveness/challengeManager';
import type { LivenessFaceData } from '../liveness/types';

// Pure-logic tests for the liveness machine's building blocks. The stateful hook
// (useLiveness) and the native frame-processor bridge are exercised on-device;
// here we lock down the ML-free pieces that drive them.

function face(partial: Partial<LivenessFaceData> = {}): LivenessFaceData {
  return {
    headEulerAngleX: 0,
    headEulerAngleY: 0,
    headEulerAngleZ: 0,
    smilingProbability: 0,
    leftEyeOpenProbability: 1,
    rightEyeOpenProbability: 1,
    faceSizeRatio: 0.4,
    faceCount: 1,
    brightness: 128,
    ...partial,
  };
}

describe('resolveVoiceGuidance', () => {
  it('treats undefined / true as enabled en-US', () => {
    expect(resolveVoiceGuidance(undefined)).toEqual({ enabled: true, language: 'en-US' });
    expect(resolveVoiceGuidance(true)).toEqual({ enabled: true, language: 'en-US' });
  });

  it('treats false as disabled', () => {
    expect(resolveVoiceGuidance(false)).toEqual({ enabled: false, language: 'en-US' });
  });

  it('honours an object with enabled + language', () => {
    expect(resolveVoiceGuidance({ enabled: true, language: 'fr-FR' })).toEqual({
      enabled: true,
      language: 'fr-FR',
    });
    // enabled defaults to true when omitted
    expect(resolveVoiceGuidance({ language: 'en-GB' })).toEqual({ enabled: true, language: 'en-GB' });
    expect(resolveVoiceGuidance({ enabled: false })).toEqual({ enabled: false, language: 'en-US' });
  });
});

describe('evaluateChallenge (drives the state machine gesture switch)', () => {
  it('nod reads the pitch history', () => {
    expect(evaluateChallenge('nod', face(), [0, -12, -3], [])).toBe(true);
    expect(evaluateChallenge('nod', face(), [0, -6], [])).toBe(false);
  });

  it('turn reads the latest yaw', () => {
    expect(evaluateChallenge('turn', face({ headEulerAngleY: 30 }), [], [])).toBe(true);
    expect(evaluateChallenge('turn', face({ headEulerAngleY: 10 }), [], [])).toBe(false);
  });

  it('blink reads the eye-open history', () => {
    expect(evaluateChallenge('blink', face(), [], [0.9, 0.1, 0.8])).toBe(true);
    expect(evaluateChallenge('blink', face(), [], [0.9, 0.3, 0.8])).toBe(false);
  });

  it('smile reads the latest smile probability', () => {
    expect(evaluateChallenge('smile', face({ smilingProbability: 0.6 }), [], [])).toBe(true);
    expect(evaluateChallenge('smile', face({ smilingProbability: 0.4 }), [], [])).toBe(false);
  });
});

describe('pickChallenges (session selection)', () => {
  it('picks the configured count of distinct challenges', () => {
    const picked = pickChallenges({ challengeCount: 2 });
    expect(picked).toHaveLength(2);
    const types = picked.map((c) => c.type);
    expect(new Set(types).size).toBe(2);
  });

  it('never pairs nod with turn (similarity group)', () => {
    for (let i = 0; i < 50; i++) {
      const types = pickChallenges({ challengeCount: 2 }).map((c) => c.type);
      const hasNod = types.includes('nod');
      const hasTurn = types.includes('turn');
      expect(hasNod && hasTurn).toBe(false);
    }
  });

  it('respects a restricted challengePool', () => {
    const picked = pickChallenges({ challengeCount: 2, challengePool: ['blink', 'smile'] });
    expect(picked.every((c) => c.type === 'blink' || c.type === 'smile')).toBe(true);
  });

  it('applies the per-challenge timeout override', () => {
    const picked = pickChallenges({ challengeCount: 2, timeoutPerChallenge: 5 });
    expect(picked.every((c) => c.timeoutSeconds === 5)).toBe(true);
  });
});

describe('ChallengeTracker (progress)', () => {
  it('advances through challenges and reports completion', () => {
    const tracker = new ChallengeTracker(pickChallenges({ challengeCount: 2 }));
    expect(tracker.totalCount).toBe(2);
    expect(tracker.isComplete).toBe(false);

    tracker.markCurrentPassed();
    expect(tracker.advance()).toBe(true); // a second challenge exists
    tracker.markCurrentPassed();
    expect(tracker.advance()).toBe(false); // none left
    expect(tracker.isComplete).toBe(true);
  });
});
