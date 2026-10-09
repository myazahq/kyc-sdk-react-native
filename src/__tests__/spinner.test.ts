import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import {
  loaderSpinnerSize,
  SPINNER_PATH,
  SPINNER_STROKE,
  SPINNER_TURN_MS,
  spinnerSize,
} from '../components/spinnerShape';

// One loading spinner across the SDK: the web SDK's and the dashboard's own
// (their `Loader2`, Hugeicons' Loading02). The platform indicator is a
// different drawing on iOS and on Android and is not used anywhere.

const SRC = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('the spinner', () => {
  it('is the web icon: the same path, stroke and turn', () => {
    expect(SPINNER_PATH.startsWith('M18.001 20C16.3295 21.2558')).toBe(true);
    expect(SPINNER_PATH.endsWith('15.6076 18')).toBe(true);
    expect(SPINNER_STROKE).toBe(1.6);
    expect(SPINNER_TURN_MS).toBe(1000);
  });

  it('takes the sizes the platform indicator took', () => {
    expect(spinnerSize(undefined)).toBe(20);
    expect(spinnerSize('small')).toBe(20);
    expect(spinnerSize('large')).toBe(32);
    expect(spinnerSize(48)).toBe(48);
  });

  it('fills a small loader box and half of a large one', () => {
    expect(loaderSpinnerSize(20)).toBe(20);
    expect(loaderSpinnerSize(64)).toBe(32);
    expect(loaderSpinnerSize(80)).toBe(40);
  });

  it('is the only spinner: no screen mounts the platform indicator', () => {
    const offenders = sources(SRC).filter((path) => /\bActivityIndicator\b/.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
