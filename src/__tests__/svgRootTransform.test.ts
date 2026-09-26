import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─── A transform on a root <Svg> is silently dropped ─────────────────────────
//
// react-native-svg's Svg.render applies a transform only `if (transform)`:
//
//     if (transform) { ... props.transform = extractTransformSvgView(props); }
//
// so the discrete triple `rotation` / `originX` / `originY` leaves `transform`
// undefined and the branch never runs. The inner <G> it wraps children in is
// built from style/fill/stroke props alone, so nothing forwards them there
// either. And `SvgProps extends GProps`, so the compiler accepts all of it.
//
// The result is a silent no-op: it renders, nothing warns, and the drawing is
// simply rotated wrongly. It shipped on the liveness capture ring, which drew
// from three o'clock for weeks while its own comment said twelve (user report
// 2026-09-25). Put the transform on a <G> or a shape, where it is honoured.

const SRC = join(__dirname, '..');

/** The DROPPED props. `transform` itself is honoured on the root, so it is not here. */
const DROPPED = ['rotation', 'originX', 'originY', 'origin', 'scale', 'translate'];

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * The opening `<Svg …>` tags in a source file. The tag ends at the first `>`
 * outside a JSX expression, so `style={{ … }}` and arithmetic in braces are
 * stepped over rather than cutting the tag short.
 */
function svgOpeningTags(source: string): string[] {
  const tags: string[] = [];
  for (let i = source.indexOf('<Svg'); i !== -1; i = source.indexOf('<Svg', i + 1)) {
    let depth = 0;
    for (let j = i; j < source.length; j++) {
      const c = source[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) {
        tags.push(source.slice(i, j + 1));
        break;
      }
    }
  }
  return tags;
}

describe('no SDK component puts a transform on a root <Svg>', () => {
  const files = tsxFiles(SRC);

  it('finds components to check at all', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(DROPPED)('no root <Svg> carries %s', (prop) => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const tag of svgOpeningTags(readFileSync(file, 'utf8'))) {
        if (tag.includes(`${prop}=`)) offenders.push(file.slice(SRC.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the capture ring starts and closes at twelve o’clock', () => {
  const source = readFileSync(join(SRC, 'screens/liveness/CaptureRing.tsx'), 'utf8');

  it('rotates a <G>, which react-native-svg honours', () => {
    expect(source).toMatch(/<G\s+rotation=\{-90\}/);
  });

  it('turns about the circle’s own centre, so the ring does not swing off-frame', () => {
    expect(source).toContain('originX={size / 2}');
    expect(source).toContain('originY={size / 2}');
  });

  it('wraps the animated circle rather than transforming it', () => {
    const g = source.slice(source.indexOf('<G '), source.indexOf('</G>'));
    expect(g).toContain('<Circle');
    // The per-frame setNativeProps write must not share a node with the
    // transform.
    expect(g).not.toMatch(/<Circle[^>]*rotation=/);
  });
});
