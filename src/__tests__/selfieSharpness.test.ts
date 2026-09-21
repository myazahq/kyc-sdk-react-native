import { readFileSync } from 'fs';
import { join } from 'path';

import {
  SELFIE_CROP_FRACTION,
  SELFIE_MEASURE_SIZE,
  SELFIE_SHARPNESS_FLOOR,
  centreCrop,
  fileUriToPath,
  grayFromPixels,
  isSelfieBlurry,
  laplacianVariance,
  measureSelfieSharpness,
} from '../lib/selfie-sharpness';

// ─── The selfie focus check ─────────────────────────────────────────────────
//
// A port of the web SDK's selfie-sharpness tests, plus the native half: Nitro
// Image hands back raw pixels in a platform byte order, and the crop takes END
// coordinates. Both are easy to get quietly wrong, and a wrong answer here only
// ever shows up as a notice nobody sees.

const W = 64;
const H = 48;

const plane = (f: (x: number, y: number) => number): Uint8Array => {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) out[y * W + x] = Math.max(0, Math.min(255, Math.round(f(x, y))));
  }
  return out;
};

/** A square BGRA image where every channel carries `f`. */
const bgra = (size: number, f: (x: number, y: number) => number): ArrayBuffer => {
  const bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const v = f(x, y);
      bytes[i] = v;
      bytes[i + 1] = v;
      bytes[i + 2] = v;
      bytes[i + 3] = 255;
    }
  }
  return bytes.buffer;
};

const checker = (x: number, y: number) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? 0 : 255);

describe('the shared constants', () => {
  it('match the web and Flutter mirrors', () => {
    // Change one and the same score means something different per platform.
    expect(SELFIE_SHARPNESS_FLOOR).toBe(18);
    expect(SELFIE_CROP_FRACTION).toBe(0.5);
    expect(SELFIE_MEASURE_SIZE).toBe(160);
  });
});

describe('laplacianVariance', () => {
  it('is zero on a flat plane, whatever its brightness', () => {
    expect(laplacianVariance(plane(() => 0), W, H)).toBe(0);
    expect(laplacianVariance(plane(() => 200), W, H)).toBe(0);
  });

  it('is zero on a linear gradient, which has no second derivative', () => {
    expect(laplacianVariance(plane((x) => x * 3), W, H)).toBe(0);
  });

  it('scores hard edges far above the same pattern softened', () => {
    const sharp = laplacianVariance(plane((x) => (Math.floor(x / 4) % 2 === 0 ? 0 : 255)), W, H);
    const soft = laplacianVariance(plane((x) => 127.5 + 127.5 * Math.sin((2 * Math.PI * x) / 8)), W, H);
    expect(sharp).toBeGreaterThan(soft * 10);
  });

  it('refuses a plane too small for the kernel, or a truncated buffer', () => {
    expect(laplacianVariance(new Uint8Array(4), 2, 2)).toBe(0);
    expect(laplacianVariance(new Uint8Array(W * 4), W, H)).toBe(0);
  });
});

describe('centreCrop', () => {
  it('takes a centred square of half the shorter side', () => {
    expect(centreCrop(640, 480)).toEqual({ sx: 200, sy: 120, sw: 240, sh: 240 });
    expect(centreCrop(480, 640)).toEqual({ sx: 120, sy: 200, sw: 240, sh: 240 });
  });

  it('stays inside the image', () => {
    const c = centreCrop(100, 100, 1);
    expect(c.sx + c.sw).toBeLessThanOrEqual(100);
    expect(c.sy + c.sh).toBeLessThanOrEqual(100);
  });
});

describe('isSelfieBlurry', () => {
  it('shows the notice only below the floor', () => {
    expect(isSelfieBlurry(SELFIE_SHARPNESS_FLOOR - 1)).toBe(true);
    expect(isSelfieBlurry(SELFIE_SHARPNESS_FLOOR)).toBe(false);
    expect(isSelfieBlurry(150)).toBe(false);
  });

  it('never calls an unmeasured selfie blurry', () => {
    expect(isSelfieBlurry(null)).toBe(false);
  });
});

describe('grayFromPixels', () => {
  it('reads the same luminance whatever the byte order', () => {
    // One red pixel, written three ways.
    const rgba = new Uint8Array([200, 10, 30, 255]).buffer;
    const bgraPx = new Uint8Array([30, 10, 200, 255]).buffer;
    const argb = new Uint8Array([255, 200, 10, 30]).buffer;
    const expected = Math.round(0.299 * 200 + 0.587 * 10 + 0.114 * 30);
    expect(grayFromPixels(rgba, 1, 1, 'RGBA')![0]).toBe(expected);
    expect(grayFromPixels(bgraPx, 1, 1, 'BGRA')![0]).toBe(expected);
    expect(grayFromPixels(argb, 1, 1, 'ARGB')![0]).toBe(expected);
  });

  it('follows the stride when rows are padded', () => {
    // 2x2 RGB with one byte of padding per row: stride 7, not 6.
    const bytes = new Uint8Array([10, 10, 10, 20, 20, 20, 0, 30, 30, 30, 40, 40, 40, 0]);
    expect(Array.from(grayFromPixels(bytes.buffer, 2, 2, 'RGB')!)).toEqual([10, 20, 30, 40]);
  });

  it('refuses a layout it cannot read rather than guessing', () => {
    expect(grayFromPixels(new Uint8Array(4).buffer, 1, 1, 'unknown')).toBeNull();
    expect(grayFromPixels(new Uint8Array(4).buffer, 1, 1, 'toString')).toBeNull();
    expect(grayFromPixels(new Uint8Array(3).buffer, 2, 1, 'RGBA')).toBeNull();
  });
});

describe('fileUriToPath', () => {
  it('strips the scheme and decodes the path', () => {
    expect(fileUriToPath('file:///var/mobile/Caches/a%20b.jpg')).toBe('/var/mobile/Caches/a b.jpg');
    expect(fileUriToPath('/data/user/0/x.jpg')).toBe('/data/user/0/x.jpg');
  });
});

describe('measureSelfieSharpness', () => {
  type Images = Parameters<typeof measureSelfieSharpness>[1];

  const fakeNitro = (pixels: (x: number, y: number) => number) => {
    const calls: { path?: string; crop?: number[]; resize?: number[] } = {};
    const measured = {
      width: SELFIE_MEASURE_SIZE,
      height: SELFIE_MEASURE_SIZE,
      toRawPixelDataAsync: async () => ({
        buffer: bgra(SELFIE_MEASURE_SIZE, pixels),
        width: SELFIE_MEASURE_SIZE,
        height: SELFIE_MEASURE_SIZE,
        pixelFormat: 'BGRA',
      }),
    };
    const face = {
      width: 480,
      height: 480,
      resizeAsync: async (w: number, h: number) => {
        calls.resize = [w, h];
        return measured;
      },
    };
    const still = {
      width: 1280,
      height: 960,
      cropAsync: async (...args: number[]) => {
        calls.crop = args;
        return face;
      },
    };
    const images = {
      loadFromFileAsync: async (path: string) => {
        calls.path = path;
        return still;
      },
    } as unknown as Images;
    return { calls, images };
  };

  it('crops the centre by end coordinates, resizes, and scores it', async () => {
    const nitro = fakeNitro(checker);
    const score = await measureSelfieSharpness('file:///tmp/selfie.jpg', nitro.images);
    expect(nitro.calls.path).toBe('/tmp/selfie.jpg');
    // 1280x960: a 480 square starting at (400, 240), so it ENDS at (880, 720).
    expect(nitro.calls.crop).toEqual([400, 240, 880, 720]);
    expect(nitro.calls.resize).toEqual([160, 160]);
    expect(isSelfieBlurry(score)).toBe(false);
  });

  it('flags a featureless centre as soft', async () => {
    const score = await measureSelfieSharpness('file:///tmp/selfie.jpg', fakeNitro(() => 128).images);
    expect(score).toBe(0);
    expect(isSelfieBlurry(score)).toBe(true);
  });

  it('answers null where Nitro Image is not available', async () => {
    await expect(measureSelfieSharpness('file:///tmp/selfie.jpg', null)).resolves.toBeNull();
  });

  it('answers null, never throws, where the native module cannot load', async () => {
    // Plain node cannot load the real package. That must read as "no notice".
    await expect(measureSelfieSharpness('file:///tmp/selfie.jpg')).resolves.toBeNull();
  });

  it('answers null when the still will not decode', async () => {
    const images = {
      loadFromFileAsync: async () => Promise.reject(new Error('not an image')),
    } as unknown as Images;
    await expect(measureSelfieSharpness('file:///tmp/selfie.jpg', images)).resolves.toBeNull();
  });
});

describe('wiring', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

  it('the liveness step measures the still it shows and hands the verdict to the review', () => {
    const step = read('screens/LivenessStep.tsx');
    expect(step).toContain('measureSelfieSharpness(compressed)');
    expect(step).toContain('soft={!!selfieUri && softSelfieUri === selfieUri}');
    expect(read('screens/liveness/LivenessOutcome.tsx')).toContain('soft={soft}');
  });

  it('the notice never gates Continue', () => {
    expect(read('screens/liveness/LivenessOutcome.tsx')).not.toMatch(/disabled=\{[^}]*soft/);
  });

  it('the copy says what to do, in house style', () => {
    const preview = read('screens/liveness/SelfiePreview.tsx');
    const title = 'This photo looks blurry';
    const body = 'For the best chance of a match, retake it holding the phone steady until your face is sharp.';
    expect(preview).toContain(title);
    expect(preview).toContain(body);
    expect(`${title} ${body}`).not.toContain('—');
  });
});
