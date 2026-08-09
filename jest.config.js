/**
 * Step-1 unit tests are pure-logic (no React Native / native modules), so we use
 * a lightweight ts-jest + node environment. Camera/liveness component tests in
 * later steps will move to `jest-expo`.
 */
module.exports = {
  preset: 'ts-jest',
  // Watchman hangs indefinitely on this repo — `jest --listTests` never returns,
  // so every run looks like an infinite compile rather than a crawl that never
  // finishes. Jest's own file crawler is fine for a source tree this size.
  watchman: false,
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
