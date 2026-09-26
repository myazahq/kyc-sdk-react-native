import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─── Icons are imported one module at a time, never from the index ───────────
//
// `@hugeicons/core-free-icons` ships 6,025 icons as per-icon modules behind a
// re-export index. Metro does not tree-shake that index: importing a single
// icon from it pulls the whole pack into the bundle.
//
// Measured on this app, minified production bundles, same Metro instance:
//
//     no icons                      4,227,793 bytes
//     5 icons via the index        12,965,883 bytes   (+8.33 MB)
//     5 icons via per-icon modules  4,234,957 bytes   (+7.0 KB)
//
// That is ~1.4 KB per icon the deep way against ~1.7 MB per icon the shallow
// way. The pack declares a `./*` export for exactly this purpose, so the deep
// path is supported rather than a trick.
//
// This SDK previously ejected @expo/vector-icons over 1.35 MB of fonts
// reaching integrators' apps. A barrel import here would be six times worse,
// and nothing about it is visible in review - it compiles, it renders, and only
// a release build shows the cost.

const SRC = join(__dirname, '..');
const PACK = '@hugeicons/core-free-icons';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('the icon pack is only ever imported one module at a time', () => {
  const files = sourceFiles(SRC);

  it('scans real source files', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no file imports from the pack index', () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      // `from '@hugeicons/core-free-icons'` with nothing after it.
      return new RegExp(`from '${PACK}'`).test(source);
    });
    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it('every pack import names a single icon module', () => {
    const bad: string[] = [];
    for (const file of files) {
      for (const [, spec] of readFileSync(file, 'utf8').matchAll(
        new RegExp(`from '(${PACK}[^']*)'`, 'g'),
      )) {
        const rest = spec!.slice(PACK.length);
        if (!/^\/[A-Za-z0-9_]+$/.test(rest)) bad.push(`${file.slice(SRC.length + 1)}: ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the map really does import icons this way, so the check is not vacuous', () => {
    const map = readFileSync(join(SRC, 'components/icons/map.ts'), 'utf8');
    const deep = [...map.matchAll(new RegExp(`from '${PACK}/[A-Za-z0-9_]+'`, 'g'))];
    expect(deep.length).toBeGreaterThan(60);
  });

  it('no file imports Lucide any more', () => {
    const offenders = files.filter((file) => /from 'lucide-react-native'/.test(readFileSync(file, 'utf8')));
    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});
