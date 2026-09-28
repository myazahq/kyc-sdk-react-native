import { readFileSync } from 'fs';
import { join } from 'path';

import {
  FLASH_BASELINE_FILL,
  THEME_FADE_IN_MS,
  THEME_FADE_OUT_MS,
  brightScreenEnabled,
  effectiveThemeMode,
  flashOverlayPaint,
  latchBrightScreen,
  livenessCameraOnScreen,
  shouldBoostBrightness,
  themeFadeMs,
} from '../lib/bright-screen';
import { WORKFLOW_KEYS, mergeWorkflowConfig, overlayApplicantWorkflow } from '../config/workflowMerge';

// ─── The bright screen during liveness ───────────────────────────────────────
//
// Light theme + full brightness while the camera is on; a BLACK pause between
// flash colours whatever the theme (each colour must ADD light to it).

describe('the flash overlay between colours', () => {
  it('paints black when no colour is showing, so the baseline stays dark', () => {
    // An EMPTY overlay let a white interface be the neutral moment.
    expect(flashOverlayPaint(null).fill).toBe(FLASH_BASELINE_FILL);
    expect(FLASH_BASELINE_FILL).toBe('#000000');
  });

  it('paints the colour itself while one is showing', () => {
    expect(flashOverlayPaint('#ff0000').fill).toBe('#ff0000');
  });

  it('keeps the instruction readable on both: light on black, dark on the colours', () => {
    expect(flashOverlayPaint(null).text).toMatch(/^rgba\(255,255,255/);
    expect(flashOverlayPaint('#00ffff').text).toMatch(/^rgba\(0,0,0/);
  });

  it('the overlay draws on every paint of the sequence, not only on a colour', () => {
    // The old `color && size` gate drew nothing between colours.
    const source = readFileSync(join(__dirname, '../components/FlashOverlay.tsx'), 'utf8');
    expect(source).toContain('flashOverlayPaint(paint.color)');
    expect(source).not.toMatch(/\{color && size \?/);
  });
});

describe('the switch', () => {
  it('is on unless a workflow or the host says false', () => {
    expect(brightScreenEnabled({})).toBe(true);
    expect(brightScreenEnabled({ livenessBrightScreen: undefined })).toBe(true);
    expect(brightScreenEnabled({ livenessBrightScreen: null })).toBe(true);
    expect(brightScreenEnabled({ livenessBrightScreen: true })).toBe(true);
    expect(brightScreenEnabled({ livenessBrightScreen: false })).toBe(false);
  });

  it('rides the workflow keys, so a published flow can turn it off', () => {
    expect(WORKFLOW_KEYS as readonly string[]).toContain('livenessBrightScreen');
    const merged = mergeWorkflowConfig({ livenessBrightScreen: false }, { livenessBrightScreen: true });
    expect(merged.livenessBrightScreen).toBe(false);
    // Absent on the flow leaves the host's prop alone.
    expect(mergeWorkflowConfig({}, { livenessBrightScreen: false }).livenessBrightScreen).toBe(false);
  });

  it("follows a mapped applicant workflow's own setting on the KYB applicant leg", () => {
    const out = overlayApplicantWorkflow(
      { id: 'wf_applicant', config: { livenessBrightScreen: false } },
      { livenessBrightScreen: true } as Record<string, unknown>,
    );
    expect(out.livenessBrightScreen).toBe(false);
  });
});

describe('the theme', () => {
  it('a forced mode outranks the person and the device, and hands both back', () => {
    expect(effectiveThemeMode('light', 'dark', 'dark')).toBe('light');
    expect(effectiveThemeMode(null, 'dark', 'light')).toBe('dark');
    expect(effectiveThemeMode(null, null, 'dark')).toBe('dark');
    expect(effectiveThemeMode(null, null, 'unspecified')).toBe('light');
    expect(effectiveThemeMode(null, null, null)).toBe('light');
  });

  it('fades in over 300ms, out quicker, and not at all with reduced motion', () => {
    expect(themeFadeMs(true, false)).toBe(THEME_FADE_IN_MS);
    expect(THEME_FADE_IN_MS).toBe(300);
    expect(themeFadeMs(false, false)).toBe(THEME_FADE_OUT_MS);
    expect(THEME_FADE_OUT_MS).toBeLessThan(THEME_FADE_IN_MS);
    expect(themeFadeMs(true, true)).toBe(0);
    expect(themeFadeMs(false, true)).toBe(0);
  });
});

// ─── It starts at the CAMERA, not at the step ────────────────────────────────
//
// User decision 2026-09-28: the primers keep the org's normal theme and
// brightness; the camera and the review after it (latched) go light and bright.

type Screen = Parameters<typeof livenessCameraOnScreen>[0];
const CAMERA: Screen = {
  hasDevice: true,
  permission: 'granted',
  ready: true,
  modelState: 'ready',
  phase: 'positioning',
  onReview: false,
};

/** Walks a visit to the step through its screens, returning the latch each time. */
function walk(screens: Screen[]): boolean[] {
  let latched = false;
  return screens.map((screen) => {
    latched = latchBrightScreen(latched, livenessCameraOnScreen(screen));
    return latched;
  });
}

describe('which liveness screens are lit', () => {
  it('the "I\'m ready" primer is not', () => {
    expect(livenessCameraOnScreen({ ...CAMERA, ready: false })).toBe(false);
  });

  it('the camera-permission primer, the OS prompt and a denial are not', () => {
    expect(livenessCameraOnScreen({ ...CAMERA, permission: 'priming' })).toBe(false);
    expect(livenessCameraOnScreen({ ...CAMERA, permission: 'requesting' })).toBe(false);
    expect(livenessCameraOnScreen({ ...CAMERA, permission: 'denied' })).toBe(false);
  });

  it('the face model still downloading, or no camera at all, is not', () => {
    expect(livenessCameraOnScreen({ ...CAMERA, modelState: 'preparing' })).toBe(false);
    expect(livenessCameraOnScreen({ ...CAMERA, hasDevice: false })).toBe(false);
  });

  it('the live camera is, in every phase it shows', () => {
    for (const phase of ['loading', 'positioning', 'challenge', 'flash', 'capturing', 'complete']) {
      expect(livenessCameraOnScreen({ ...CAMERA, phase })).toBe(true);
    }
  });

  it('a visit: primers stay normal, the camera lights, the review after it stays lit', () => {
    expect(
      walk([
        { ...CAMERA, ready: false }, // "I'm ready"
        { ...CAMERA, permission: 'priming' }, // camera-access primer
        { ...CAMERA, permission: 'requesting' }, // the OS prompt
        CAMERA, // the camera
        { ...CAMERA, phase: 'complete' },
        { ...CAMERA, onReview: true }, // the review right after it
      ]),
    ).toEqual([false, false, false, true, true, true]);
  });

  it('a failure after the camera stays lit until the step is left', () => {
    expect(walk([CAMERA, { ...CAMERA, phase: 'failed' }])).toEqual([true, true]);
  });

  it('a review reopened from an earlier visit, with no camera, stays normal', () => {
    expect(walk([{ ...CAMERA, onReview: true }])).toEqual([false]);
  });
});

describe('when the screen is brightened', () => {
  it('only while wanted and the app is in front', () => {
    expect(shouldBoostBrightness({ wanted: true, appState: 'active' })).toBe(true);
    expect(shouldBoostBrightness({ wanted: true, appState: 'background' })).toBe(false);
    // iOS Control Centre / app switcher: the brightness is system-wide there.
    expect(shouldBoostBrightness({ wanted: true, appState: 'inactive' })).toBe(false);
    expect(shouldBoostBrightness({ wanted: false, appState: 'active' })).toBe(false);
  });
});

describe('the wiring', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

  it('the liveness step publishes its camera, cleared on unmount', () => {
    expect(src('screens/LivenessStep.tsx')).toContain('useLivenessCameraOn(cameraOnScreen)');
    expect(src('screens/LivenessStep.tsx')).toContain('livenessCameraOnScreen({');
    expect(src('screens/useLivenessCameraOn.ts')).toContain('latchBrightScreen(latched.current, cameraOnScreen)');
    expect(src('screens/useLivenessCameraOn.ts')).toMatch(/\(\) => \(\) => setOn\(false\)/);
  });

  it('the sheet root lights the screen, beneath the flash', () => {
    const sheet = src('components/KycSheet.tsx');
    expect(sheet.indexOf('<BrightScreen />')).toBeGreaterThan(-1);
    expect(sheet.indexOf('<BrightScreen />')).toBeLessThan(sheet.indexOf('<FlashOverlay />'));
    // The toggle is disabled, not hidden, while the theme is held.
    expect(sheet).toContain('disabled={themeForced}');
  });

  it('the Android window override never touches the host activity or the system', () => {
    const kotlin = readFileSync(
      join(__dirname, '../../android/src/main/java/co/myazahq/kyc/rn/MyazaStatusBarModule.kt'),
      'utf8',
    );
    const method = kotlin.slice(kotlin.indexOf('fun setWindowBrightness'), kotlin.indexOf('companion object'));
    expect(method).toContain('screenBrightness');
    expect(method).not.toContain('currentActivity');
    expect(method).not.toContain('Settings.System');
  });
});
