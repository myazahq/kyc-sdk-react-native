import {
  CHECKPOINT_MS,
  FIRST_CHECKPOINT_MS,
  checkpointStay,
  foldSpanIntoDays,
  nextCheckpointAt,
} from '../presence/background-math';
import { describeInMonorepo, sharedVectors } from './helpers/monorepo';

// The canonical fold vectors live in the Flutter package because its NATIVE
// sides (Kotlin + Swift) must fold too — three implementations, one contract.
// This test pins the TypeScript one; PresenceFoldTest.kt and
// PresenceFoldTests.swift pin the other two against the same file.
const VECTORS = 'kyc-sdk-flutter/test/presence_fold_vectors.json';

interface Vector {
  name: string;
  enterMs: number;
  exitMs: number;
  offsetMinutes: number;
  expected: Array<{ day: string; dwellMinutes: number; nightPresent: boolean }>;
}

const { vectors } = sharedVectors<{ vectors: Vector[] }>(VECTORS, { vectors: [] });

describeInMonorepo('presence fold vectors (cross-language contract)', () => {

  it('has a meaningful case set', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(10);
  });

  for (const v of vectors) {
    it(v.name, () => {
      expect(foldSpanIntoDays(v.enterMs, v.exitMs, v.offsetMinutes)).toEqual(v.expected);
    });
  }
});

interface CheckpointVector {
  name: string;
  enterAt: number | null;
  stayStart: number | null;
  atMs: number;
  offsetMinutes: number;
  expected: { enterAt: number; stayStart: number; days: Vector['expected'] };
}

const checkpointDoc = sharedVectors<{
  checkpointMs: number;
  firstCheckpointMs: number;
  checkpoints: CheckpointVector[];
}>(VECTORS, {
  checkpointMs: CHECKPOINT_MS,
  firstCheckpointMs: FIRST_CHECKPOINT_MS,
  checkpoints: [],
}
);

describeInMonorepo('presence check-in vectors (cross-language contract)', () => {
  it('agrees on the check-in interval', () => {
    expect(checkpointDoc.checkpointMs).toBe(CHECKPOINT_MS);
    expect(checkpointDoc.firstCheckpointMs).toBe(FIRST_CHECKPOINT_MS);
  });

  it('has a meaningful case set', () => {
    expect(checkpointDoc.checkpoints.length).toBeGreaterThanOrEqual(6);
  });

  for (const v of checkpointDoc.checkpoints) {
    it(v.name, () => {
      expect(checkpointStay(v.enterAt, v.atMs, v.offsetMinutes, v.stayStart)).toEqual(v.expected);
    });
  }
});

describe('nextCheckpointAt', () => {
  it('is null with no stay open', () => {
    expect(nextCheckpointAt(null, null)).toBeNull();
  });
  it('waits the short interval for a stay nothing has recorded', () => {
    expect(nextCheckpointAt(1000, 1000)).toBe(1000 + FIRST_CHECKPOINT_MS);
    expect(nextCheckpointAt(1000, null)).toBe(1000 + FIRST_CHECKPOINT_MS);
  });
  it('waits three hours once the stay has been recorded', () => {
    expect(nextCheckpointAt(5000, 1000)).toBe(5000 + CHECKPOINT_MS);
  });
});
