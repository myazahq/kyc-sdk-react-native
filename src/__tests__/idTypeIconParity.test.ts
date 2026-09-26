import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describeInMonorepo, readPackageFile as read } from './helpers/monorepo';

// ─── One ID type, one icon, on every SDK ─────────────────────────────────────
//
// The ID picker is the screen an applicant scans to find their document, and
// the three SDKs each keep their own idType → icon table. They drifted:
// 26a68a3 deliberately moved the driver's licence from a car to an ID card on
// all three ("identical across all three SDKs"), and 37b40b6 - a Global
// Documents change touching only the web picker - put the car back on web
// alone. It survived months of releases because nothing compared the tables.
//
// The icon-boundary guard beside this one does not catch it: that compares the
// glyph SETS, and both a car and an ID card are legitimately in the set. Only a
// per-ID comparison sees that one type resolves differently.
//
// Each SDK is resolved through to the Hugeicons module it actually draws, so
// the comparison survives the three naming conventions: web names components
// (`IdCard`), this SDK names roles (`'id-card'`), Flutter names members
// (`MyazaIcons.idCard`).

function packExports(): Map<string, string> {
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

/** The body of a named table, up to its closing brace. */
function tableBody(source: string, marker: string): string {
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start);
  return rest.slice(0, rest.indexOf('};'));
}

function webIcons(pack: Map<string, string>): Record<string, string> {
  const body = tableBody(read('kyc-sdk-react/src/steps/IdTypeStep.tsx'), 'ID_TYPE_ICONS');
  const barrel = read('kyc-sdk-react/src/components/icons/index.ts');
  const alias = new Map([...barrel.matchAll(/(\w+) as (\w+),/g)].map(([, h, l]) => [l!, h!]));
  const component = new Map(
    [...barrel.matchAll(/export const (\w+) = createAppIcon\((\w+)/g)].map(([, name, local]) => [
      name!,
      alias.get(local!) ?? '',
    ]),
  );
  const out: Record<string, string> = {};
  for (const [, id, comp] of body.matchAll(/'?([a-z0-9-]+)'?:\s*(\w+),/g)) {
    const file = pack.get(component.get(comp!) ?? '');
    if (file) out[id!] = file;
  }
  return out;
}

function reactNativeIcons(): Record<string, string> {
  const body = tableBody(read('kyc-sdk-react-native/src/screens/IdTypeStep.tsx'), 'const ICON_FOR');
  const map = read('kyc-sdk-react-native/src/components/icons/map.ts');
  const mapBody = map.slice(map.indexOf('export const ICONS'));
  const role = new Map(
    [...mapBody.matchAll(/^ {2}'?([a-z0-9-]+)'?:\s*(\w+),/gm)].map(([, r, glyph]) => [r!, glyph!]),
  );
  const out: Record<string, string> = {};
  for (const [, id, r] of body.matchAll(/'?([a-z0-9-]+)'?:\s*'([a-z0-9-]+)',/g)) {
    const glyph = role.get(r!);
    if (glyph) out[id!] = glyph;
  }
  return out;
}

function flutterIcons(pack: Map<string, string>): Record<string, string> {
  const body = tableBody(read('kyc-sdk-flutter/lib/src/screens/id_type_screen.dart'), '_iconFor');
  const icons = read('kyc-sdk-flutter/lib/src/widgets/icons/icons.dart');
  const member = new Map(
    [
      ...icons.matchAll(
        /static const MyazaIconData (\w+)\s*=\s*\n?\s*HugeIcons\.strokeRounded(\w+);/g,
      ),
    ].map(([, name, huge]) => [name!, `${huge!}Icon`]),
  );
  const out: Record<string, string> = {};
  // `'a' || 'b' => MyazaIcons.x` — one arm can name several ID types.
  for (const [, keys, name] of body.matchAll(
    /((?:'[a-z0-9-]+'(?:\s*\|\|\s*)?)+)\s*=>\s*MyazaIcons\.(\w+)/g,
  )) {
    const file = pack.get(member.get(name!) ?? '');
    if (!file) continue;
    for (const [, id] of keys!.matchAll(/'([a-z0-9-]+)'/g)) out[id!] = file;
  }
  return out;
}

describeInMonorepo('an ID type draws the same icon on every SDK', () => {
  // Lazy: `describe.skip` still runs this body on the public mirror.
  const tables = () => {
    const pack = packExports();
    return { web: webIcons(pack), rn: reactNativeIcons(), flutter: flutterIcons(pack) };
  };

  it('reads a recognisable table from each SDK', () => {
    const { web, rn, flutter } = tables();
    expect(Object.keys(web).length).toBeGreaterThan(8);
    expect(Object.keys(rn).length).toBeGreaterThan(8);
    expect(Object.keys(flutter).length).toBeGreaterThan(4);
    // Resolution really reached the pack rather than leaving raw names behind.
    expect(web['bvn']).toMatch(/Icon$/);
    expect(rn['bvn']).toMatch(/Icon$/);
    expect(flutter['bvn']).toMatch(/Icon$/);
  });

  it('no ID type resolves to two different glyphs', () => {
    const { web, rn, flutter } = tables();
    const ids = new Set([...Object.keys(web), ...Object.keys(rn), ...Object.keys(flutter)]);
    const diverging: Record<string, unknown> = {};
    for (const id of ids) {
      const drawn = [web[id], rn[id], flutter[id]].filter(Boolean);
      if (new Set(drawn).size > 1) diverging[id] = { web: web[id], rn: rn[id], flutter: flutter[id] };
    }
    expect(diverging).toEqual({});
  });

  it("the driver's licence is an ID card on all three, as 26a68a3 decided", () => {
    const { web, rn, flutter } = tables();
    for (const table of [web, rn, flutter]) {
      expect(table['drivers-license']).toBe('IdentityCardIcon');
    }
  });
});
