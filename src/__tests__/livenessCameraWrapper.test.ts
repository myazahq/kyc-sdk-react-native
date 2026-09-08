import { readFileSync } from 'fs';
import { join } from 'path';

// ─── The liveness Camera never sits directly inside a bordered view ─────────
//
// VisionCamera's Android hierarchy fitter re-lays out its PreviewView with
// `layout(0, 0, w, h)` when CameraX adds the SurfaceView, keeping the size
// React Native gave it and dropping the position. A Camera mounted straight
// inside the 4dp-bordered circle therefore snapped to the box's outer corner,
// and the preview stopped one border-width short of the right-hand ring
// (Galaxy S24, 2026-09-07). The borderless wrapper in LivenessCamera is the
// fix; this pins it.

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

describe('the liveness camera and its Android wrapper', () => {
  it('mounts the Camera inside a plain flex wrapper with no border', () => {
    const source = read('screens/liveness/LivenessCamera.tsx');
    // collapsable={false} is part of the fix: a layout-only View is flattened on
    // Android, which re-parents the Camera to the bordered box.
    expect(source).toMatch(/<View style=\{\{ flex: 1 \}\} collapsable=\{false\}>\s*\{device \? \(\s*<Camera\b/);
    // The style key, not the word: the header comment names borderWidth on purpose.
    expect(source).not.toMatch(/borderWidth\s*:/);
  });

  it('the step mounts LivenessCamera rather than a bare Camera in its bordered circle', () => {
    const source = read('screens/LivenessStep.tsx');
    expect(source).toContain('<LivenessCamera');
    // A JSX <Camera on its own line is a mount; the prose mention in a comment
    // is followed by other words on the same line.
    expect(source).not.toMatch(/^\s*<Camera\s*$/m);
  });
});
