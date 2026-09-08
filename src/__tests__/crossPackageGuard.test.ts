import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// ─── A test that reads another package goes through the monorepo helper ──────
//
// The public mirror carries this package alone. A suite that reaches into
// kyc-sdk-flutter or kyc-sdk-react by a relative path passes here and fails
// there with ENOENT, which is how seven suites refused the 2.6.0 publish.
// helpers/monorepo.ts skips such suites outside the monorepo; this pins that
// every cross-package read uses it, so the failure cannot come back one new
// mirror test at a time.

const DIR = __dirname;
const SIBLING = /kyc-sdk-(flutter|react)\//;

describe('cross-package reads go through helpers/monorepo', () => {
  const suites = readdirSync(DIR).filter((name) => name.endsWith('.test.ts') && name !== 'crossPackageGuard.test.ts');

  it.each(suites)('%s', (name) => {
    const source = readFileSync(join(DIR, name), 'utf8');
    if (!SIBLING.test(source)) return;
    expect(source).toMatch(/from '\.\/helpers\/monorepo'/);
    expect(source).not.toMatch(/\.\.\/\.\.\/\.\.\/kyc-sdk-/);
    expect(source).toMatch(/describeInMonorepo\(/);
  });
});
