# Changelog

## 3.2.0

Passive Liveness, customisable texts, the organisation's own footer logo, silent capture and a bright screen during liveness.

**Rebuild your native app after upgrading:** this release adds the native module `expo-brightness` as a dependency of the SDK. You do not install it yourself, and you should not add its config plugin (it declares `WRITE_SETTINGS`, which the SDK never uses).

These features need the Myaza server release of 2026-09-28. Against an older server the flow still completes: the new settings are simply ignored, and silent frames are refused at upload and left out.

### Passive Liveness, and a head turn in every 3D Active Motion run

`livenessMode: 'passive'` asks the person to hold still for a moment while the SDK records a short clip and takes the selfie. There are no prompts: Myaza's liveness model decides from the capture. 3D Active Motion now always includes a head turn, and the SDK reports the prompts it ran.

### The liveness result is sent with the submission

Builds up to 3.1.0 recorded the liveness result and never sent it, so the server could not audit it. It is sent now. A flash sequence that could not be measured no longer counts as passed, and a recording that fails to upload is reported with its reason.

### A bright screen during liveness

While the liveness camera is on, the flow shows its light theme and raises the screen to full brightness, then restores both. Android changes the brightness of the SDK's own window only, never the system setting; iOS uses `expo-brightness` and reverts on lock. A workflow turns this off with `livenessBrightScreen: false`.

### Customisable texts

A workflow can reword the main text of each screen through its `texts` setting, on the same keys as the web SDK.

### The organisation's own footer logo

When a workflow uses custom trust branding, its logo replaces the Myaza mark in the footer, and the consent notice names Myaza Trust as the processor for the organisation.

### Silent capture

On the document review, the SDK briefly opens the front camera with no prompt, flash or shutter sound and takes one frame of the person holding the ID. It is on by default; a workflow turns it off with `silentCapture: false`.

### Selfie guidance

The selfie primer asks for a bright spot with no glare and an uncovered face (glasses off), and no longer states a duration.

### Logos in local development

With a development key, a workflow's own logo and the footer logos now load over a USB tunnel (`adb reverse`) or after your machine's network address changes, like the organisation logo. Production is unaffected.

### Background monitoring is on by default, and the SDK turns it on

When a presence flow is submitted, the SDK now asks the person to allow location all the time and arms the background geofence itself, unless the workflow switches Background monitoring off. You no longer call `enableBackgroundPresence()` for it. It still needs your app's one-time setup (`expo-task-manager`, the `location: "always"` plugin setting, and `registerBackgroundPresence()` at your app's root). Without that setup the SDK skips the step and asks for nothing: `enableBackgroundPresence()` now returns the new reason `not_registered` when `registerBackgroundPresence()` never ran, instead of arming a fence nothing would handle.

### The SDK sends the first presence report itself

When a workflow enables presence verification, the SDK now reports presence on its own the moment the flow is submitted, so the watch gets its first day (and night, when submitted at night) without any code in your app. Until now every observation depended on your app calling `reportAddressPresence()`, and apps that had not added that call produced watches that collected nothing and lapsed as inconclusive.

Later days still come from your app: keep calling `reportAddressPresence()` on app open, or enable background monitoring. A call you already make at submit is harmless, since one day's reports merge into one. The pin is stored under your `userId`, so pass one: without it there is nothing to report against, and the server now starts no watch.

## 3.1.0

### The icon set is Hugeicons, the same one the web and Flutter SDKs draw

The other two SDKs moved to Hugeicons some time ago and this one did not, so
the three agreed on names and differed on every glyph. They now draw one set.

Nothing about the integration changes. The icons are internal, so no exported
type or prop moved, and the only visible difference is the drawing itself: the
glyphs are Hugeicons' Stroke Rounded at a 1.6 stroke rather than Lucide's at 2,
which reads slightly lighter. If you have screenshot tests over the flow, expect
them to need new baselines.

The bundle gets SMALLER, by 1.33 MB on a minified production build, because
Lucide's own barrel was not tree-shaking either.

Two details worth knowing if you ever fork or patch this package. Icons are
imported one module at a time (`@hugeicons/core-free-icons/Camera01Icon`) and
must stay that way: importing from the package index instead pulls all 6,025
icons into the bundle, measured at +8.33 MB for five icons against +7 KB the
deep way. And the theme toggle's moon and sun are no longer filled — that
worked because Lucide's glyph bodies take a fill, and Hugeicons' free pack is
Stroke Rounded only, so they are stroked now, which is what the Flutter SDK has
always done.

### A brand colour now tints cards as well as the sheet

`appearance.primaryColor` derives three faint washes used behind numbered
markers, pills and selected rows. They were pre-blended against the sheet
background, but they are drawn on several surfaces, and on a card the 10% wash
landed within 3/255 of the card underneath it — close enough to be invisible.
The supporting-documents step showed it most clearly: its numbered markers were
there and could not be seen.

They carry real alpha now, so each one composites against whatever it is
actually drawn on, which is what the web SDK has always done. On a card the
result is identical to the web SDK's; on the sheet it matches the old value to
within 1/255. Flows that set no `primaryColor` are untouched.

### Supporting documents

The step is at visual parity with the web and Flutter SDKs: each requested
document is a card naming what it is being collected for, with the fields the
server will read off it, rather than a bare upload slot.

Two fixes behind it. The consent screen now discloses the step, which it never
did. And `supportingDocuments` reaches the SDK at all: the key was missing from
the workflow merge, so a workflow-mounted flow never received the block and the
whole feature was inert — no step, and nothing on consent.

### The liveness ring starts and closes at the top

It drew from three o'clock while its own comment said twelve. The rotation sat
on the root `<Svg>`, which react-native-svg silently drops, so it never applied.
It matches the Flutter SDK now.


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
