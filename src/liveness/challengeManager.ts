// ---------------------------------------------------------------------------
// Challenge manager — randomly picks 2–3 challenges and tracks progress.
// Port of the web SDK's `challenge-manager.ts`, adapted to the RN/Flutter
// `ChallengeConfig` shape.
// ---------------------------------------------------------------------------

import {
  CHALLENGE_POOL,
  DEFAULT_LIVENESS_CONFIG,
  type ChallengeConfig,
  type LivenessChallenge,
  type LivenessConfig,
  type LivenessMode,
} from './types';

// Gestures within a similarity group should never appear together — one can
// accidentally satisfy the other (head motion overlaps).
const SIMILARITY_GROUPS: LivenessChallenge[][] = [['nod', 'turn']];

function areSimilar(a: LivenessChallenge, b: LivenessChallenge): boolean {
  return SIMILARITY_GROUPS.some((group) => group.includes(a) && group.includes(b));
}

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Whether the workflow's liveness mode runs gesture challenges at all.
 *
 * `flash` means the screen-reflection sequence IS the check, so gestures are
 * skipped entirely — only `both` runs gestures and then flash. Kept in step
 * with the Flutter SDK's `runsGestures` and the web SDK.
 */
export function modeRunsGestures(mode: LivenessMode | undefined): boolean {
  return mode !== 'flash';
}

/**
 * Picks `challengeCount` non-similar challenges from the pool, in random order.
 *
 * Returns NOTHING in flash-only mode. This is gated here, at the single place
 * challenges are chosen, rather than at the call sites: `useLiveness` rebuilds
 * the tracker in three separate places (mount, retry, face-change reset), and a
 * check in one of them would leave the others silently running gestures a
 * flash-only workflow explicitly turned off.
 *
 * Deliberately keyed on the mode rather than `challengeCount: 0` — the count is
 * clamped to at least one on purpose, so that a stray zero in a consumer's
 * config can never quietly disable gesture liveness. Skipping gestures has to
 * be asked for.
 */
export function pickChallenges(config: Partial<LivenessConfig> = {}): ChallengeConfig[] {
  const merged = { ...DEFAULT_LIVENESS_CONFIG, ...config };
  if (!modeRunsGestures(merged.mode)) return [];

  let pool = CHALLENGE_POOL;
  if (merged.challengePool && merged.challengePool.length > 0) {
    const allowed = new Set<LivenessChallenge>(merged.challengePool);
    pool = CHALLENGE_POOL.filter((c) => allowed.has(c.type));
  }

  const count = Math.min(merged.challengeCount, pool.length);
  const shuffled = shuffle(pool);

  // Greedily pick challenges that aren't similar to already-picked ones.
  const picked: ChallengeConfig[] = [];
  for (const candidate of shuffled) {
    if (picked.length >= count) break;
    if (!picked.some((p) => areSimilar(p.type, candidate.type))) {
      picked.push({ ...candidate, timeoutSeconds: merged.timeoutPerChallenge });
    }
  }

  // Fallback: if similarity rules were too strict, fill remaining slots.
  if (picked.length < count) {
    for (const candidate of shuffled) {
      if (picked.length >= count) break;
      if (!picked.some((p) => p.type === candidate.type)) {
        picked.push({ ...candidate, timeoutSeconds: merged.timeoutPerChallenge });
      }
    }
  }

  return picked;
}

// ---------------------------------------------------------------------------
// Progress tracker
// ---------------------------------------------------------------------------

export type ChallengeProgress = 'pending' | 'active' | 'passed' | 'failed';

export interface ChallengeEntry {
  config: ChallengeConfig;
  progress: ChallengeProgress;
}

export class ChallengeTracker {
  private entries: ChallengeEntry[];
  private _currentIndex: number;

  constructor(challenges: ChallengeConfig[]) {
    this.entries = challenges.map((config, i) => ({
      config,
      progress: i === 0 ? 'active' : 'pending',
    }));
    this._currentIndex = 0;
  }

  get current(): ChallengeEntry | null {
    return this.entries[this._currentIndex] ?? null;
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  get all(): readonly ChallengeEntry[] {
    return this.entries;
  }

  get isComplete(): boolean {
    return this.entries.every((e) => e.progress === 'passed');
  }

  get totalCount(): number {
    return this.entries.length;
  }

  markCurrentPassed(): void {
    const entry = this.entries[this._currentIndex];
    if (entry) entry.progress = 'passed';
  }

  markCurrentFailed(): void {
    const entry = this.entries[this._currentIndex];
    if (entry) entry.progress = 'failed';
  }

  /** Advances to the next challenge; returns true if more remain. */
  advance(): boolean {
    this._currentIndex++;
    const next = this.entries[this._currentIndex];
    if (next) {
      next.progress = 'active';
      return true;
    }
    return false;
  }
}
