import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// ─── Every hook is declared BEFORE the screen's first gate ───────────────────
//
// A hook called after a conditional early return renders "Rendered more hooks
// than during the previous render" the moment that gate dismisses — React
// counts hooks by call order, so a gate that skipped four of them on one
// render and runs them on the next tears the whole tree down.
//
// This shipped in LivenessStep: the ring's two refs and its target callback sat
// below the ready-primer / permission / model gates, so the step rendered fine
// behind the primer and crashed the app the instant somebody tapped through it.
// The web SDK records the same class of bug in AddressCollectionStep.
//
// A source scan, because nothing about it fails at build time and the crash
// only reproduces on the second render of a screen most tests never mount. It
// walks each component block on its own, so a helper below a gated screen is
// judged separately rather than inheriting the screen's gate.

const SRC = join(__dirname, '..');

const COMPONENT = /^(export\s+)?(default\s+)?function\s+[A-Z]\w*|^(export\s+)?const\s+[A-Z]\w*\s*[:=]/;
const HOOK = /^ {2}(?:const\s+.*?=\s*)?use[A-Z]\w*\s*[<(]/;
const GATE_INLINE = /^ {2}if\s*\(.*\)\s*return\b/;
const GATE_OPEN = /^ {2}if\s*\(/;
const GATE_RETURN = /^ {4}return\b/;
const BLOCK_CLOSE = /^ {2}\}/;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : tsxFiles(path);
    return name.endsWith('.tsx') ? [path] : [];
  });
}

/** The line of the first top-level early return in a component block, if any. */
function gateLine(block: string[]): number | null {
  for (let i = 0; i < block.length; i += 1) {
    if (GATE_INLINE.test(block[i]!)) return i;
    if (!GATE_OPEN.test(block[i]!)) continue;
    for (let k = i + 1; k < Math.min(i + 14, block.length); k += 1) {
      if (GATE_RETURN.test(block[k]!)) return i;
      if (BLOCK_CLOSE.test(block[k]!)) break;
    }
  }
  return null;
}

describe('hooks are declared above every early return', () => {
  it('finds no hook below a gate in any screen or component', () => {
    const offenders: string[] = [];

    for (const path of tsxFiles(SRC)) {
      const lines = readFileSync(path, 'utf8').split('\n');
      const starts = lines.flatMap((line, i) => (COMPONENT.test(line) ? [i] : []));
      if (starts.length === 0) starts.push(0);
      starts.push(lines.length);

      for (let s = 0; s < starts.length - 1; s += 1) {
        const from = starts[s]!;
        const block = lines.slice(from, starts[s + 1]!);
        const gate = gateLine(block);
        if (gate === null) continue;
        const after = block
          .map((line, i) => (i > gate && HOOK.test(line) ? from + i + 1 : 0))
          .filter(Boolean);
        if (after.length > 0) {
          const rel = path.slice(SRC.length + 1);
          offenders.push(`${rel}: gate at line ${from + gate + 1}, hooks at ${after.join(', ')}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
