import { readPackageFile as read } from './helpers/monorepo';

// ─── Both ML Kit models are fetched, and both can say so ─────────────────────
//
// The models are the largest thing this SDK puts in a host's APK — 18.5 MB per
// device bundled, ~0.4 MB of shims unbundled — so the default fetches them
// through Play Services. That trade buys size at the cost of a window where a
// detector cannot run, and the failure in that window is SILENT by construction:
// a face detector with no model reports `faceCount: 0`, exactly what an empty
// frame reports, and a text recogniser with no model reports no lines, exactly
// what a blank page reports. Nothing throws, nothing logs, and the user simply
// waits.
//
// So the dependency swap and the readiness contract are ONE change, and these
// pin that they stay one. Every assertion here is about a line that would
// compile, run, pass every other test, and fail only as a real person aiming a
// phone at a passport that never reads.

const GRADLE = 'kyc-sdk-react-native/android/build.gradle';

describe('the ML Kit artifacts are chosen together', () => {
  const gradle = read(GRADLE);

  it('one resolved flag drives the choice, not two independent reads', () => {
    // A second `safeExtGet('myazaKycBundledMlKit', …)` is how one model ends up
    // bundled and the other fetched — a build that is neither size nor offline.
    expect((gradle.match(/safeExtGet\('myazaKycBundledMlKit'/g) ?? []).length).toBe(1);
    expect(gradle).toMatch(/def bundledMlKit = /);
  });

  it('the bundled branch takes BOTH bundled artifacts', () => {
    const branch = gradle.slice(gradle.indexOf('if (bundledMlKit)'), gradle.indexOf('} else {'));
    expect(branch).toContain('com.google.mlkit:face-detection');
    expect(branch).toContain('com.google.mlkit:text-recognition');
  });

  it('the default branch takes BOTH unbundled artifacts', () => {
    const branch = gradle.slice(gradle.indexOf('} else {'));
    expect(branch).toContain('com.google.android.gms:play-services-mlkit-face-detection');
    expect(branch).toContain('com.google.android.gms:play-services-mlkit-text-recognition');
  });

  it('the flag reaches native code, so a bundled build never waits on Play Services', () => {
    // Without this, a bundled build asks Play Services about a model sitting in
    // its own APK, is told "not available", and strands a flow that works
    // perfectly offline — the exact case the bundled flag exists to serve.
    expect(gradle).toMatch(/buildConfigField "boolean", "BUNDLED_ML_KIT"/);
    const readiness = read(
      'kyc-sdk-react-native/android/src/main/java/com/margelo/nitro/myazakyc/MlKitModelReadiness.kt',
    );
    expect(readiness).toMatch(/BuildConfig\.BUNDLED_ML_KIT/);
  });
});

describe('both detectors carry the readiness contract', () => {
  it.each(['MyazaFaceDetector', 'MyazaTextRecognizer'])(
    '%s declares isModelReady and prepareModel',
    (name) => {
      const spec = read(`kyc-sdk-react-native/src/specs/${name}.nitro.ts`);
      expect(spec).toMatch(/isModelReady\(\): boolean;/);
      expect(spec).toMatch(/prepareModel\(\): Promise<boolean>;/);
    },
  );

  it.each(['HybridMyazaFaceDetector', 'HybridMyazaTextRecognizer'])(
    '%s.kt answers through the shared gate rather than its own copy',
    (cls) => {
      const source = read(
        `kyc-sdk-react-native/android/src/main/java/com/margelo/nitro/myazakyc/${cls}.kt`,
      );
      expect(source).toMatch(/MlKitModelReadiness\(/);
      expect(source).toMatch(/override fun isModelReady\(\): Boolean = readiness\.isReady\(\)/);
      expect(source).toMatch(/readiness\.prepare\(\)/);
    },
  );

  it.each(['HybridMyazaFaceDetector', 'HybridMyazaTextRecognizer'])(
    '%s.swift answers ready unconditionally — Apple Vision ships with the OS',
    (cls) => {
      const source = read(`kyc-sdk-react-native/ios/${cls}.swift`);
      expect(source).toMatch(/func isModelReady\(\) throws -> Bool \{ true \}/);
      expect(source).toMatch(/Promise\.resolved\(withResult: true\)/);
    },
  );
});

describe('the flow primes both models before either camera opens', () => {
  it('MyazaKYC primes the face model and the text model at open', () => {
    // Asserted through the shared hook rather than by finding the calls in
    // MyazaKYC.tsx. That older form passed for months while the hook entry
    // point primed NOTHING: the calls were present in the file, inside the
    // trigger component, and a file-level match cannot tell the two callers
    // apart. See "the head start reaches BOTH entry points" below.
    const shared = read('kyc-sdk-react-native/src/lib/prime-models.ts');
    expect(shared).toMatch(/primeFaceModel\(\);/);
    expect(shared).toMatch(/primeTextModel\(\);/);
    expect(read('kyc-sdk-react-native/src/MyazaKYC.tsx')).toMatch(/usePrimeModels\(/);
  });

  it('the MRZ scanner GATES on readiness — there a missing model is a dead end', () => {
    // Auto-capture deliberately does not gate: the manual shutter is live, so an
    // absent model costs convenience. The live MRZ scan has no such fallback —
    // the printed strip IS the chip key — so it must say what happened.
    const source = read('kyc-sdk-react-native/src/screens/MrzScanView.tsx');
    expect(source).toMatch(/useTextModelReady\(\)/);
    expect(source).toMatch(/modelState === 'unavailable'/);
    expect(source).toMatch(/modelState === 'preparing'/);
  });

  it('both readiness hooks share one gate, so the rule cannot drift', () => {
    for (const rel of [
      'kyc-sdk-react-native/src/liveness/useModelReady.ts',
      'kyc-sdk-react-native/src/mrz/useTextModelReady.ts',
    ]) {
      expect(read(rel)).toMatch(/useNativeModelReady/);
    }
  });
});

describe('the shared gate actually settles', () => {
  // Both of these shipped wrong once, and neither fails a build or a test: the
  // gate simply gave up on a model that was on its way.
  const readiness = read(
    'kyc-sdk-react-native/android/src/main/java/com/margelo/nitro/myazakyc/MlKitModelReadiness.kt',
  );

  it('requests an URGENT install, never a deferred one', () => {
    // A deferred install lets Play Services pick the moment, which can be an
    // idle, charging phone. The person on the liveness step is waiting now.
    expect(readiness).toMatch(/client\.installModules\(/);
    expect(readiness).not.toMatch(/deferredInstall\(/);
  });

  it('re-checks while not ready, so a download that lands later is noticed', () => {
    // isModelReady is the only thing the TS poll calls. A cached flag that is
    // never refreshed stays false until the wait runs out.
    expect(readiness).toMatch(/fun isReady\(\): Boolean \{\s*if \(!ready\) refresh\(\)/);
  });
});

describe('the head start reaches BOTH entry points', () => {
  // Found on a freshly wiped emulator, 2026-09-20. The priming effect lived
  // inside MyazaKYCTrigger, so a consumer using useMyazaKYC() — the hook this
  // SDK's own example uses, and the one documented for programmatic control —
  // primed nothing at all. The face model was first requested when the liveness
  // step mounted, in front of a camera the user was already looking at.
  //
  // Measured cold on fast wifi: the face model took ~9s to arrive. Opening the
  // flow is what buys that time back by overlapping it with consent, ID type
  // and the document step.
  //
  // A warm device cannot show this: isModelReady() answers true on the first
  // call and every path looks correct, which is exactly how it survived.
  const entry = read('kyc-sdk-react-native/src/MyazaKYC.tsx');

  it('both the trigger component and the hook prime', () => {
    expect((entry.match(/usePrimeModels\(/g) ?? []).length).toBe(2);
  });

  it('priming lives in the shared hook, not copied into either caller', () => {
    // A copy is how the two drift back apart — one gains a model the other
    // never learns about.
    expect(entry).not.toMatch(/primeFaceModel\(\)/);
    expect(entry).not.toMatch(/primeLivenessAvatars\(/);
    const shared = read('kyc-sdk-react-native/src/lib/prime-models.ts');
    for (const fn of ['primeFaceModel()', 'primeTextModel()', 'primeLivenessAvatars(']) {
      expect(shared).toContain(fn);
    }
  });
});

describe('every screen behind a model gate can say it is waiting', () => {
  // The gate returns three states and a screen that reads only two leaves the
  // third rendering something wrong. LivenessStep handled 'unavailable' and not
  // 'preparing', so while the model downloaded it opened the camera anyway and
  // told the user to position a face that could never register — the precise
  // failure model-ready.ts says the gate exists to prevent.
  it.each([
    ['screens/LivenessStep.tsx', 'useFaceModelReady'],
    ['screens/MrzScanView.tsx', 'useTextModelReady'],
  ])('%s branches on preparing as well as unavailable', (file) => {
    const source = read(`kyc-sdk-react-native/src/${file}`);
    expect(source).toMatch(/modelState === 'unavailable'/);
    expect(source).toMatch(/modelState === 'preparing'/);
  });
});

describe('nothing touches the camera Image after the detector goes async', () => {
  // Crash found on a TECNO KM5 (Android 15), 2026-09-20: the app died every
  // time liveness actually FOUND a face.
  //
  //   java.lang.IllegalStateException: Image is already closed
  //     at android.media.ImageReader$SurfaceImage.getWidth
  //     at HybridMyazaFaceDetector.detectFace$lambda$2
  //
  // detectFace waits on a latch with a timeout. When ML Kit answers after that
  // wait expires, detectFace has already returned and VisionCamera has closed
  // the frame's android.media.Image — so a listener reading `mediaImage.width`
  // touches freed state. Only the SUCCESS path read it, which is why it
  // crashed on detection rather than on an empty frame.
  //
  // Unbundling is what exposed it: play-services-mlkit answers over Play
  // Services IPC, slower than the in-process artifact, so the callback
  // overruns the wait routinely on real mid-range hardware. A bundled build
  // almost never did, and no emulator run reproduced it.
  //
  // The fix is ordering, so nothing here would fail to compile: capture the
  // dimensions synchronously and hand the callback ints.
  it.each(['HybridMyazaFaceDetector', 'HybridMyazaTextRecognizer'])(
    '%s reads frame dimensions before the first async listener',
    (cls) => {
      const source = read(
        `kyc-sdk-react-native/android/src/main/java/com/margelo/nitro/myazakyc/${cls}.kt`,
      );
      const firstListener = source.indexOf('.addOnSuccessListener');
      expect(firstListener).toBeGreaterThan(-1);
      const afterListener = source.slice(firstListener);
      // `mediaImage` is the frame-backed Image; anything read from it after the
      // handoff is a read of state the camera may already have recycled.
      expect(afterListener).not.toMatch(/mediaImage\s*\./);
    },
  );
});
