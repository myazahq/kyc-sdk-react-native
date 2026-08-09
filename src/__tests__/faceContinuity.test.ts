import { FaceContinuityGuard } from '../liveness/faceContinuity';
import type { LivenessFaceData } from '../liveness/types';

// ─── Face continuity ──────────────────────────────────────────────────────────
//
// The hole this closes: liveness proved a live human performed the challenges,
// but nothing tied that human to the one being photographed. One person could
// nod and blink while the camera panned to another, and every check passed.
//
// Reported on a real device against the Flutter SDK — "I start with a face and
// move the camera to another face, it never detects that" — and the RN SDK had
// the same gap. Same thresholds as the Flutter port, so the two behave alike.

const face = (
  over: Partial<LivenessFaceData> = {},
): LivenessFaceData => ({
  headEulerAngleX: 0,
  headEulerAngleY: 0,
  headEulerAngleZ: 0,
  smilingProbability: 0,
  leftEyeOpenProbability: 1,
  rightEyeOpenProbability: 1,
  faceSizeRatio: 0.4,
  faceCount: 1,
  brightness: 140,
  faceCenterX: 0.5,
  faceCenterY: 0.5,
  ...over,
});

describe('the same face', () => {
  it('treats ordinary head movement as continuous', () => {
    const guard = new FaceContinuityGuard();
    expect(guard.update(face(), 0)).toBe('same');
    for (let i = 1; i <= 6; i++) {
      expect(guard.update(face({ faceCenterX: 0.5 + i * 0.04 }), i * 60)).toBe('same');
    }
  });

  it('treats leaning in and out as continuous', () => {
    const guard = new FaceContinuityGuard();
    guard.update(face({ faceSizeRatio: 0.35 }), 0);
    expect(guard.update(face({ faceSizeRatio: 0.45 }), 60)).toBe('same');
    expect(guard.update(face({ faceSizeRatio: 0.38 }), 120)).toBe('same');
  });

  it('tolerates a brief dropout', () => {
    // A colour flash can hide the face for a few frames. That must not end the
    // session.
    const guard = new FaceContinuityGuard();
    guard.update(face(), 0);
    guard.reportNoFace();
    expect(guard.update(face(), 400)).toBe('same');
  });
});

describe('a different face', () => {
  it('catches a jump across the frame', () => {
    const guard = new FaceContinuityGuard();
    guard.update(face({ faceCenterX: 0.25 }), 0);
    expect(guard.update(face({ faceCenterX: 0.75 }), 60)).toBe('substituted');
  });

  it('catches an abrupt size change', () => {
    const guard = new FaceContinuityGuard();
    guard.update(face({ faceSizeRatio: 0.25 }), 0);
    expect(guard.update(face({ faceSizeRatio: 0.55 }), 60)).toBe('substituted');
  });

  it('catches a changed tracking id even when the face looks alike', () => {
    // Android's ML Kit says outright that this is a different face. Geometry
    // would have missed it — same place, same size.
    const guard = new FaceContinuityGuard();
    guard.update(face({ trackingId: 7 }), 0);
    expect(guard.update(face({ trackingId: 8 }), 60)).toBe('substituted');
  });

  it('catches a camera pan between two people via the gap', () => {
    const guard = new FaceContinuityGuard();
    guard.update(face(), 0);
    guard.reportNoFace();
    expect(guard.update(face(), 1500)).toBe('reacquired');
  });
});

describe('startup and reset', () => {
  it('takes the first face as the reference rather than a substitution', () => {
    const guard = new FaceContinuityGuard();
    expect(guard.update(face({ faceCenterX: 0.9, faceSizeRatio: 0.7 }), 0)).toBe('same');
  });

  it('makes the next face the new reference after a reset', () => {
    const guard = new FaceContinuityGuard();
    guard.update(face({ faceCenterX: 0.2 }), 0);
    guard.reset();
    expect(guard.update(face({ faceCenterX: 0.8 }), 60)).toBe('same');
  });

  it('still works on iOS, which reports no tracking id', () => {
    // Apple Vision has no cross-frame identifier, so geometry has to carry the
    // check on that platform.
    const guard = new FaceContinuityGuard();
    guard.update(face({ faceCenterX: 0.25, trackingId: undefined }), 0);
    expect(guard.update(face({ faceCenterX: 0.8, trackingId: undefined }), 60)).toBe(
      'substituted',
    );
  });
});
