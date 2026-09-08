import { readFileSync } from 'fs';
import { join } from 'path';
import { foldSpanIntoDays } from '../presence/background-math';

// The canonical fold vectors live in the Flutter package because its NATIVE
// sides (Kotlin + Swift) must fold too — three implementations, one contract.
// This test pins the TypeScript one; PresenceFoldTest.kt and
// PresenceFoldTests.swift pin the other two against the same file.
const VECTORS = join(__dirname, '../../../kyc-sdk-flutter/test/presence_fold_vectors.json');

interface Vector {
  name: string;
  enterMs: number;
  exitMs: number;
  offsetMinutes: number;
  expected: Array<{ day: string; dwellMinutes: number; nightPresent: boolean }>;
}

describe('presence fold vectors (cross-language contract)', () => {
  const { vectors } = JSON.parse(readFileSync(VECTORS, 'utf8')) as { vectors: Vector[] };

  it('has a meaningful case set', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(10);
  });

  for (const v of JSON.parse(readFileSync(VECTORS, 'utf8')).vectors as Vector[]) {
    it(v.name, () => {
      expect(foldSpanIntoDays(v.enterMs, v.exitMs, v.offsetMinutes)).toEqual(v.expected);
    });
  }
});
