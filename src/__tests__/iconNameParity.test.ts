import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describeInMonorepo, readPackageFile as read } from './helpers/monorepo';

// ─── The three SDKs draw ONE icon set ────────────────────────────────────────
//
// Web, Flutter and React Native all render Hugeicons now, so they can be held
// to the GLYPH and not merely to a shared vocabulary. Each names icons its own
// way - web exports Lucide-style names, Flutter exposes `MyazaIcons.x`, this
// SDK maps semantic roles - so the comparison is done on the glyph each one
// actually resolves to.
//
// Two things drifted before this existed. Lucide renamed five icons and the web
// barrel stayed on the old spellings while the mobile SDKs moved, so one icon
// had two names for months. And an earlier version of this check read this
// SDK's Lucide import block; when that block stopped existing the extractor
// silently matched most of the file instead, and every assertion passed on
// eighty fragments of prose. Each extractor below is therefore asserted to
// return something recognisable before anything is compared with it.

/**
 * The pack's own export-name → module-file table, which is authoritative.
 *
 * Resolved through the package rather than by path: this SDK depends on it
 * directly, so it is found wherever the package sits, and a version bump does
 * not silently break the lookup the way a pinned store path would.
 */
function exportToFile(): Map<string, string> {
  const index = join(
    dirname(require.resolve('@hugeicons/core-free-icons/package.json')),
    'dist/esm/index.js',
  );
  const map = new Map<string, string>();
  for (const [, names, file] of readFileSync(index, 'utf8').matchAll(
    /export \{([^}]*)\} from '\.\/([A-Za-z0-9_]+)\.js';/g,
  )) {
    for (const [, name] of names!.matchAll(/default as (\w+)/g)) map.set(name!, file!);
  }
  return map;
}

/** Web: the Hugeicons export each barrel entry is built from. */
function webGlyphs(files: Map<string, string>): Set<string> {
  const source = read('kyc-sdk-react/src/components/icons/index.ts');
  const alias = new Map(
    [...source.matchAll(/(\w+) as (\w+),/g)].map(([, huge, local]) => [local!, huge!]),
  );
  const out = new Set<string>();
  for (const [, , local] of source.matchAll(/export const (\w+) = createAppIcon\((\w+)/g)) {
    const huge = alias.get(local!);
    const file = huge && files.get(huge);
    if (file) out.add(file);
  }
  return out;
}

/** Flutter: `HugeIcons.strokeRoundedX` → the same module file. */
function flutterGlyphs(files: Map<string, string>): Set<string> {
  const source = read('kyc-sdk-flutter/lib/src/widgets/icons/icons.dart');
  const out = new Set<string>();
  for (const [, name] of source.matchAll(
    /static const MyazaIconData \w+\s*=\s*\n?\s*HugeIcons\.strokeRounded(\w+);/g,
  )) {
    const file = files.get(`${name!}Icon`);
    if (file) out.add(file);
  }
  return out;
}

/** This SDK: the per-icon modules the map deep-imports. */
function reactNativeGlyphs(): Set<string> {
  const source = read('kyc-sdk-react-native/src/components/icons/map.ts');
  return new Set(
    [...source.matchAll(/from '@hugeicons\/core-free-icons\/([A-Za-z0-9_]+)'/g)].map((m) => m[1]!),
  );
}

// Glyphs this SDK needs that neither of the others draws. Each is a real
// absence, not a naming difference - check the other two boundaries before
// adding to this list.
const RN_ONLY = new Set([
  'VoteIcon', // the voter's-card ID type; web and Flutter have no ID picker
  'BubbleChatIcon', // the WhatsApp OTP channel
]);

describeInMonorepo('the three SDKs draw one icon set', () => {
  // Lazy on purpose: `describe.skip` still runs this callback, so anything read
  // at collection time would throw on the public mirror where the sibling
  // packages do not exist.
  const shared = () => {
    const files = exportToFile();
    return { files, both: new Set([...webGlyphs(files), ...flutterGlyphs(files)]) };
  };

  it('reads the pack, and a recognisable set from each boundary', () => {
    const files = exportToFile();
    expect(files.size).toBeGreaterThan(5000);
    expect(webGlyphs(files).size).toBeGreaterThan(50);
    expect(flutterGlyphs(files).size).toBeGreaterThan(50);
    expect(reactNativeGlyphs().size).toBeGreaterThan(50);
  });

  it('every glyph looks like a module in the pack', () => {
    const known = new Set(shared().files.values());
    const strays = [...reactNativeGlyphs()].filter((g) => !known.has(g));
    expect(strays).toEqual([]);
  });

  it('draws nothing the other two SDKs do not, beyond the documented few', () => {
    const { both } = shared();
    const extra = [...reactNativeGlyphs()].filter((g) => !both.has(g) && !RN_ONLY.has(g));
    expect(extra).toEqual([]);
  });

  it('the RN-only list names glyphs that really are RN-only', () => {
    const { both } = shared();
    for (const glyph of RN_ONLY) expect({ glyph, drawn: both.has(glyph) }).toEqual({ glyph, drawn: false });
  });

  it('shares the overwhelming majority of its glyphs, so the check is not vacuous', () => {
    const { both } = shared();
    const rn = [...reactNativeGlyphs()];
    const overlap = rn.filter((g) => both.has(g)).length;
    expect(overlap / rn.length).toBeGreaterThan(0.85);
  });
});
