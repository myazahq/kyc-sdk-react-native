# Changelog

## 3.0.0

### NFC is genuinely opt-in now (breaking)

The config plugin has always taken an `nfc` option that defaults to off, but the
library's own `AndroidManifest.xml` declared `android.permission.NFC` and a
`uses-feature` entry unconditionally. A library manifest is merged into every
host app, so the permission reached every integrator regardless of the option —
including the majority whose workflows never read a chip, and who had no way to
remove it. The opt-in only ever governed iOS.

Both declarations have moved into the plugin and are written only on
`nfc: true`:

```jsonc
["@myazahq/kyc-sdk-react-native", { "nfc": true }]
```

**If you read chips on Android and have not set `nfc: true`, set it now.**
Without it the permission is no longer declared and the chip step will find no
radio. Apps that never read chips need no change and lose a permission they
never asked for. iOS is unaffected: the reader entitlement and usage string
were already behind this option, because adding them unconditionally breaks
code signing for any App ID without the "NFC Tag Reading" capability.

The permission and the `uses-feature` declaration are written together and can
never be separated. Android infers `uses-feature android:required="true"` from
`android.permission.NFC` when the feature is not declared explicitly, and Play
then hides the app from every device without an NFC radio. That failure has no
runtime symptom — the app builds, installs and runs perfectly on the developer's
own NFC-capable phone, and is simply absent from the store listing for everyone
else — so the pairing is pinned by a test rather than left to review.

This changes permissions only. It removes no code: `edu.ucar:jj2000`, the
JPEG 2000 decoder for the chip portrait, is referenced by `Jp2Decoder.kt` at
compile time and still ships. The chip step continues to check for a radio at
runtime and skip itself when there is none, so a build without the permission
behaves exactly like a phone with no NFC hardware.

### The ML Kit models are fetched, not bundled

Face detection and text recognition now resolve to the
`play-services-mlkit-*` artifacts, so their models are downloaded through
Google Play Services on first use instead of shipping inside your APK. That is
roughly 18.5 MB per device off the install, measured on an arm64 release build
of the example app: 57.67 MB bundled against 45.73 MB fetched.

No integration change. The flow starts both downloads the moment it opens, so
they overlap consent and ID selection, and each step checks its own model
before opening a camera: a device still waiting shows a brief "getting ready"
state rather than a viewfinder that cannot see anything.

Fleets without Play Services at all (bare AOSP, some Huawei devices) should
keep the models embedded:

```gradle
// android/build.gradle
ext { myazaKycBundledMlKit = true }
```

### Android document captures were cropping the wrong region

A capture was cropped using dimensions from React Native's `Image.getSize`,
which on Android reports DP — pixels divided by display density — while the
cropper works in real pixels. On a density-2 phone a 3048x4064 photo measured
1524x2032, so a crop computed as centred was applied at half scale and landed
in the upper-left quadrant. The document your user framed was often not in the
stored photo, and it failed silently: no error, just an image that failed to
read later.

Every Android density is greater than one, so this affected every Android
document capture, wrong by the device's own density factor. iOS was unaffected.
Dimensions are now measured through the same module that performs the crop.

### Fixed

- **A crash when liveness detected a face (Android).** The face detector read
  the camera frame inside ML Kit's completion callback, by which point the
  frame could already have been recycled: `IllegalStateException: Image is
  already closed`. It surfaced with the fetched models, whose answers arrive
  over IPC and so more often land after the frame is gone.
- **The models were not pre-fetched for `useMyazaKYC`.** Only the
  `<MyazaKYC />` component started the downloads, so hook-based integrations
  first requested the face model when the applicant reached liveness, in front
  of an already-open camera. Both entry points now warm them at open.
- **The liveness step now says it is preparing.** It previously opened the
  camera while the model was still arriving and asked the applicant to position
  a face that could not register.
- **Capture header and document pill on small screens.** With a long document
  name the step counter wrapped alone to the right edge, and the country flag
  floated between two lines of the title.
