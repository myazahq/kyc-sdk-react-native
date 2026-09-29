import { CHECKPOINT_MS, checkpointStay, foldSpanIntoDays } from '../presence/background-math';
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
  atMs: number;
  offsetMinutes: number;
  expected: { enterAt: number; days: Vector['expected'] };
}

const checkpointDoc = sharedVectors<{ checkpointMs: number; checkpoints: CheckpointVector[] }>(
  VECTORS,
  { checkpointMs: CHECKPOINT_MS, checkpoints: [] },
);

describeInMonorepo('presence check-in vectors (cross-language contract)', () => {
  it('agrees on the check-in interval', () => {
    expect(checkpointDoc.checkpointMs).toBe(CHECKPOINT_MS);
  });

  it('has a meaningful case set', () => {
    expect(checkpointDoc.checkpoints.length).toBeGreaterThanOrEqual(6);
  });

  for (const v of checkpointDoc.checkpoints) {
    it(v.name, () => {
      expect(checkpointStay(v.enterAt, v.atMs, v.offsetMinutes)).toEqual(v.expected);
    });
  }
});
