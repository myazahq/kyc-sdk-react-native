/**
 * Step-1 unit tests are pure-logic (no React Native / native modules), so we use
 * a lightweight ts-jest + node environment. Camera/liveness component tests in
 * later steps will move to `jest-expo`.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
