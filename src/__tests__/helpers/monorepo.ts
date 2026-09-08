import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// ─── Reading across the monorepo, and skipping outside it ────────────────────
//
// Some suites here read a SIBLING package: the shared vector files under
// kyc-sdk-flutter/test (one rule written down as data for all three SDKs), and
// the web or Flutter source a mirror test diffs this SDK against. The public
// repo (myazahq/kyc-sdk-react-native) carries this package alone, so those
// files do not exist there, and every such suite failed with ENOENT on the
// 2.6.0 publish, which refused the release. Outside the monorepo the
// cross-package suites SKIP: the monorepo's own CI still runs all of them, so
// nothing is lost, and the public run stays what it is for, a check that the
// package typechecks, tests and publishes on its own.
//
// Every read of another package goes through here (crossPackageGuard.test.ts
// pins that), so a new mirror test cannot reintroduce the failure.

const PACKAGE_ROOT = join(__dirname, '../../..');
const PACKAGES = join(PACKAGE_ROOT, '..');
const OWN = 'kyc-sdk-react-native/';

export const IN_MONOREPO =
  existsSync(join(PACKAGES, 'kyc-sdk-flutter')) && existsSync(join(PACKAGES, 'kyc-sdk-react'));

/** `describe` in the monorepo, `describe.skip` on the public mirror. */
export const describeInMonorepo = IN_MONOREPO ? describe : describe.skip;

/** Reads a file by its packages-relative path. This package's own files
 *  resolve from its root, so the same table of paths works wherever the
 *  package happens to sit. */
export function readPackageFile(rel: string): string {
  const path = rel.startsWith(OWN) ? join(PACKAGE_ROOT, rel.slice(OWN.length)) : join(PACKAGES, rel);
  return readFileSync(path, 'utf8');
}

/** A shared vector file, or `empty` outside the monorepo. `describe.skip`
 *  still runs its callback to register the skipped tests, so a read at
 *  collection time has to answer with something. */
export function sharedVectors<T>(rel: string, empty: T): T {
  return IN_MONOREPO ? (JSON.parse(readPackageFile(rel)) as T) : empty;
}
