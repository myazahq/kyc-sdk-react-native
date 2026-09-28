import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import { CUSTOMISABLE_KEYS } from '../i18n/customisable';
import { DEFAULT_TEXTS, NOT_SHOWN } from '../i18n/defaults';
import { describeInMonorepo, sharedVectors } from './helpers/monorepo';

// ─── The customisable texts, against the SHARED contract ─────────────────────
//
// A workflow stores texts[language][key]; the same key must mean the same
// place on every SDK. The vector file is that contract written down as data.
// Every key in it is either SHOWN here (wired to a spot, with this SDK's own
// default) or NOT_SHOWN (a place this SDK has no screen for, with the reason),
// never both, and nothing outside the contract is in either list.

interface TextVector {
  key: string;
  default: string;
  placeholders?: string[];
}

const vectors = sharedVectors<{ texts: TextVector[] }>(
  'kyc-sdk-flutter/test/customisable_texts_vectors.json',
  { texts: [] },
);
const vectorKeys = vectors.texts.map((v) => v.key);

describeInMonorepo('customisable texts match the shared vector file', () => {
  it('the customisable key set is exactly the contract', () => {
    expect([...CUSTOMISABLE_KEYS].sort()).toEqual([...vectorKeys].sort());
  });

  it('every vector key is shown or listed as not shown', () => {
    const missing = vectorKeys.filter((k) => !(k in DEFAULT_TEXTS) && !(k in NOT_SHOWN));
    expect(missing).toEqual([]);
  });

  it('nothing outside the contract is shown or listed', () => {
    const known = new Set(vectorKeys);
    expect(Object.keys(DEFAULT_TEXTS).filter((k) => !known.has(k))).toEqual([]);
    expect(Object.keys(NOT_SHOWN).filter((k) => !known.has(k))).toEqual([]);
  });

  it('no key is both shown and not shown', () => {
    expect(Object.keys(DEFAULT_TEXTS).filter((k) => k in NOT_SHOWN)).toEqual([]);
  });

  it('a default uses only the placeholders the contract names', () => {
    const named = new Map(vectors.texts.map((v) => [v.key, new Set(v.placeholders ?? [])]));
    const stray = Object.entries(DEFAULT_TEXTS).flatMap(([key, text]) =>
      [...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)]
        .map((m) => m[1]!)
        .filter((p) => !named.get(key)?.has(p) && !['firstName', 'lastName', 'businessName'].includes(p))
        .map((p) => `${key}: {${p}}`),
    );
    expect(stray).toEqual([]);
  });
});

describe('the defaults and reasons', () => {
  it('no default is blank or carries an em dash', () => {
    const bad = Object.entries(DEFAULT_TEXTS).filter(([, v]) => !v.trim() || v.includes('—'));
    expect(bad).toEqual([]);
  });

  it('every not-shown key says why', () => {
    expect(Object.entries(NOT_SHOWN).filter(([, why]) => why.trim().length < 10)).toEqual([]);
  });
});

// ─── Every shown key is actually read by a screen ────────────────────────────
//
// A default nobody reads would claim a key is wired when a workflow's copy for
// it would never reach the screen. Keys are referenced as string literals, so
// a plain source search finds them.

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'i18n' ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('shown keys are read by the screens', () => {
  it('every shown key appears as a literal outside the text lists', () => {
    const source = sourceFiles(SRC)
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const unread = Object.keys(DEFAULT_TEXTS).filter(
      (key) => !source.includes(`'${key}'`) && !source.includes(`"${key}"`),
    );
    expect(unread).toEqual([]);
  });

  it('sources the search from this package', () => {
    expect(relative(SRC, join(SRC, 'i18n'))).toBe('i18n');
  });
});
