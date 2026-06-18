# @myazahq/kyc-sdk-react-native

Myaza KYC SDK for **React Native (Expo)** — ID verification, document capture, and
active **on-device** liveness. Mirrors the [web](https://www.npmjs.com/package/@myazahq/kyc-sdk-react)
and Flutter SDKs feature-for-feature and calls the same Myaza KYC API server.

The SDK is a **thin UI layer**: it captures the user's data (ID number, document
photos, a live selfie), uploads the media, and submits a verification request.
All verification (OCR, facial comparison, gov-DB checks) happens server-side and
is delivered asynchronously via webhook — the SDK is **fire-and-forget**.

## Requirements

This library ships **native code** (an Apple Vision + Google ML Kit face detector,
built as a [react-native-vision-camera](https://react-native-vision-camera.com) v5 /
Nitro module), so it needs a **custom native build** and **does not run in Expo Go**.

| Requirement | Minimum |
| --- | --- |
| **iOS** deployment target | **15.1** |
| **Android** `minSdkVersion` | **24** (Android 7.0) · `compileSdk` 34 · NDK 27.1 |
| **Expo SDK** | **56** (React 19, React Native 0.85) |
| **React Native** | **0.83+**, with the **New Architecture enabled** (VisionCamera v5 / Nitro requires it; Expo SDK 56 enables it by default) |
| **Build toolchain** | Xcode + CocoaPods (iOS) · **JDK 17** for Android Gradle builds |
| **Runtime** | A **dev client** or bare build — **not Expo Go** |

**Peer dependencies** to install in your app:

| Package | Range | Purpose |
| --- | --- | --- |
| `expo` | `>=56` | Expo module runtime (the SDK uses several `expo-*` modules) |
| `react` / `react-native` | `>=19` / `>=0.83` | — |
| `react-native-vision-camera` | `^5` | Camera preview + capture |
| `react-native-vision-camera-worklets` | `>=5` | Frame-processor worklet runtime |
| `react-native-worklets` | `>=0.8` | Worklet `runOnJS` bridge for liveness |
| `react-native-nitro-modules` | `>=0.35` | Native module runtime for the face detector |
| `react-native-nitro-image` | `>=0.15` | Frame → image interop used by the detector |
| `react-native-safe-area-context` | `>=4` | Safe-area insets for the modal |
| `react-native-svg` | `>=15` | Liveness/overlay graphics |

> Voice guidance is **text-to-speech output only** — the SDK never records audio,
> so **no microphone permission** is requested or required.

## Installation

### Expo app (managed / prebuild — recommended)

```sh
npx expo install @myazahq/kyc-sdk-react-native \
  react-native-vision-camera react-native-vision-camera-worklets \
  react-native-worklets react-native-nitro-modules react-native-nitro-image \
  react-native-safe-area-context react-native-svg
```

Add the config plugins to `app.json`. The SDK's plugin adds the iOS camera usage
string + Android `CAMERA`/`INTERNET` permissions; the VisionCamera plugin wires up
the camera + frame processors. Make sure the **New Architecture** is on (it is by
default on Expo SDK 56):

```jsonc
// app.json
{
  "expo": {
    "newArchEnabled": true,
    "plugins": [
      ["react-native-vision-camera", { "enableMicrophonePermission": false }],
      "@myazahq/kyc-sdk-react-native"
    ]
  }
}
```

Then build a dev client (regenerates the native projects):

```sh
npx expo prebuild
npx expo run:ios                                  # iOS
JAVA_HOME=/path/to/jdk-17 npx expo run:android    # Android — needs JDK 17
```

> The SDK plugin accepts an optional custom camera prompt:
> `["@myazahq/kyc-sdk-react-native", { "cameraPermission": "Your message…" }]`.

### Bare React Native app (no Expo prebuild)

The SDK depends on a handful of `expo-*` modules, so install **`expo`** (the
package — you don't need the managed workflow) and let it autolink:

```sh
# 1. Add the Expo module runtime to your bare app (one-time):
npx install-expo-modules@latest

# 2. Install the SDK + peers:
npm install @myazahq/kyc-sdk-react-native \
  react-native-vision-camera react-native-vision-camera-worklets \
  react-native-worklets react-native-nitro-modules react-native-nitro-image \
  react-native-safe-area-context react-native-svg \
  expo expo-image-manipulator expo-image-picker expo-speech expo-font \
  expo-glass-effect expo-application expo-crypto expo-device expo-localization

# 3. iOS pods:
cd ios && pod install && cd ..
```

Then add the native permissions yourself (the Expo config plugin only runs under
prebuild):

- **iOS** — add to `ios/<App>/Info.plist`:
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>We use the camera to photograph your ID and capture a live selfie.</string>
  ```
- **Android** — add to `android/app/src/main/AndroidManifest.xml`:
  ```xml
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.INTERNET" />
  ```
- Ensure the **New Architecture** is enabled (`newArchEnabled=true` in
  `android/gradle.properties`; `RCT_NEW_ARCH_ENABLED=1` for the iOS Podfile install),
  and enable VisionCamera frame processors / the worklets babel plugin — see the
  [VisionCamera setup docs](https://react-native-vision-camera.com/docs/guides).

The face-detector native module (Nitro HybridObject + Android lib loader) is
autolinked via React Native / Expo autolinking — no manual linking required.

## Usage

`<MyazaKYC />` renders a "Verify Identity" trigger plus the full modal flow. Pass
`children` (a string) to relabel it. For a fully custom trigger, use the
[`useMyazaKYC()` hook](#trigger-component--hook).

```tsx
import { MyazaKYC } from '@myazahq/kyc-sdk-react-native';

export default function VerifyScreen() {
  return (
    <MyazaKYC
      apiKey="pk_live_xxx"          // prefix selects the env: pk_test_ → sandbox
      country="NG"
      idTypes={['passport', 'drivers-license', 'bvn', 'nin', 'pvc']}
      userData={{ firstName: 'Jane', lastName: 'Doe' }}
      enableSelfie
      enableDocumentCapture
      enableLiveness
      showThemeToggle
      appearance={{
        primaryColor: '#5645F5',
        companyName: 'Myaza',
        logo: 'default',
        theme: 'dark',
      }}
      consent={{
        title: 'Welcome, {firstName}',
        description: "A quick check to confirm it's really you.",
      }}
      success={{
        title: "You're all set, {firstName}!",
        description: "We'll email you once your verification is reviewed.",
      }}
      metadata={{ userId: 'test_user_123' }}
      onStart={() => console.log('KYC started')}
      onStepChange={(step) => console.log('Step:', step)}
      onSubmit={(submission) => {
        // Fires as soon as the server accepts the request.
        // submission.status is always 'pending' — the result arrives later via
        // webhook to your backend (or poll GET /api/kyc/status/:id).
        console.log('Submitted!', submission.verificationId);
      }}
      onClose={() => console.log('Modal closed')}
      onError={(err) => console.warn('SDK error:', err.code, err.message)}
    >
      Verify my identity
    </MyazaKYC>
  );
}
```

## Props

| Prop                    | Type                                      | Default             | Description                                                                                                          |
| ----------------------- | ----------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `apiKey`                | `string`                                  | —                   | **Required.** Sent as `Authorization: Bearer`. The **environment is derived from the key prefix** (`pk_test_…` → sandbox, `pk_live_…` → production); an unrecognized prefix throws. |
| `country`               | `'NG' \| 'GH' \| 'KE' \| 'ZA' \| 'CI'`    | —                   | **Required.** Country whose ID types are offered.                                                                    |
| `idTypes`               | `IdType[]`                                | all allowed for org | Subset of ID types to offer; must be valid for `country`.                                                            |
| `userData`              | `{ firstName?, lastName?, dateOfBirth? }` | —                   | Pre-fills the user's details.                                                                                        |
| `enableSelfie`          | `boolean`                                 | `true`              | Capture a selfie during liveness.                                                                                    |
| `enableDocumentCapture` | `boolean`                                 | `true`              | Enable the document-scan step for document IDs.                                                                      |
| `allowDocumentUpload`   | `boolean`                                 | `true`              | Allow picking a document photo from the gallery as an alternative to the camera. `false` hides every "upload instead" affordance (it's still offered on the camera-permission-denied screen as an escape hatch). |
| `enableLiveness`        | `boolean`                                 | `true`              | Run the liveness challenge step. The server can still disable it per ID type.                                        |
| `voiceGuidance`         | `boolean \| { enabled?, language? }`      | `true`              | Spoken liveness instructions (accessibility, TTS **output** — no microphone). `false` mutes it; pass `{ language: 'fr-FR' }` to set the voice. See [Robustness & error handling](#robustness--error-handling). |
| `showThemeToggle`       | `boolean`                                 | `true`              | Show a light/dark toggle inside the modal header. When `false`, the flow stays on `appearance.theme`.                |
| `disableClose`          | `boolean`                                 | `false`             | Hide the close (X) and block **all** user dismissal (X, Android back, iOS swipe-down). The flow can then only be closed programmatically via `useMyazaKYC().close()`. |
| `appearance`            | `KYCAppearance`                           | brand defaults      | Brand & theme the modal — colors, logo, light/dark. See [Appearance & theming](#appearance--theming).                |
| `consent`               | `KYCConsentContent`                       | built-in copy       | Override the consent/welcome screen `title` and `description`. See [Consent screen copy](#consent-screen-copy).      |
| `success`               | `KYCSuccessContent`                       | built-in copy       | Override the success/submitted screen `title` and `description`. See [Success screen copy](#success-screen-copy).    |
| `metadata`              | `Record<string, string>`                  | —                   | Forwarded with every verify request.                                                                                 |
| `onStart`               | `() => void`                              | —                   | Called when the flow opens.                                                                                          |
| `onStepChange`          | `(step: KYCStep) => void`                 | —                   | Called on each step transition.                                                                                      |
| `onSubmit`              | `(submission: KYCSubmission) => void`     | —                   | Called when the server accepts the verification. `status` is always `'pending'`.                                     |
| `onError`               | `(error: KYCError) => void`               | —                   | Called for **technical** errors only. Receives a typed [`KYCError`](#robustness--error-handling). Verification outcomes never come through here. |
| `onClose`               | `() => void`                              | —                   | Called when the user closes the flow.                                                                                |
| `children`              | `string`                                  | `Verify Identity`   | Trigger label. Defaults to `Verify with {companyName}` when `companyName` is set, else `Verify Identity`.            |
| `disabled`              | `boolean`                                 | `false`             | Disable the trigger.                                                                                                 |

## Environment

There is **no `environment` prop** — the SDK derives the environment (and the
base URL) from the API key prefix, the single source of truth:

| Prefix     | Environment | Base URL                          |
| ---------- | ----------- | --------------------------------- |
| `pk_test_` | sandbox     | `https://identity.myaza.app`      |
| `pk_live_` | production  | `https://identity.myaza.app`      |

An unrecognized or malformed key throws at setup (it never silently defaults).

## Trigger component & hook

`<MyazaKYC />` renders a styled trigger that opens the modal. Beyond the config
props it accepts `children` (a string label) and `disabled`:

```tsx
<MyazaKYC {...config} disabled={!ready}>
  Start verification
</MyazaKYC>
```

For a **fully custom** trigger (your own `Pressable`, an icon, a list row, or to
open the flow programmatically), use the `useMyazaKYC()` hook:

```tsx
import { Pressable, Text } from 'react-native';
import { useMyazaKYC } from '@myazahq/kyc-sdk-react-native';

function CustomTrigger() {
  const { open, close, isOpen, currentStep } = useMyazaKYC({
    apiKey: 'pk_live_xxx',
    country: 'NG',
    onSubmit: (s) => console.log('submitted', s.verificationId),
  });

  return (
    <Pressable onPress={open}>
      <Text>Verify your identity</Text>
    </Pressable>
  );
}
```

`useMyazaKYC(config)` returns `{ open, close, isOpen, currentStep }`. `close()` is
the only way to dismiss the flow when `disableClose` is set.

## Appearance & theming

Pass an `appearance` object to brand the flow. Because the UI is token-driven,
setting one color cascades to all of its shades (hover/selected/focus states
included). Unset colors keep the built-in light/dark defaults.

| Field              | Type                | Description                                                                      |
| ------------------ | ------------------- | -------------------------------------------------------------------------------- |
| `primaryColor`     | `string`            | Brand color — buttons, selected states, progress, the shield hero. Defaults to `#5645F5`. |
| `primaryTextColor` | `string`            | Text/icons rendered on top of `primaryColor` (e.g. button labels).               |
| `accentColor`      | `string`            | Subtle hover/active surfaces.                                                    |
| `backgroundColor`  | `string`            | Modal background.                                                                |
| `surfaceColor`     | `string`            | Cards & panels.                                                                  |
| `borderColor`      | `string`            | Borders and input outlines.                                                      |
| `textColor`        | `string`            | Primary text color.                                                              |
| `companyName`      | `string`            | Used on the verify trigger ("Verify with …") and the persistent header.          |
| `logo`             | `string`            | Image URL, or `'default'` to use your org's logo. See below.                     |
| `theme`            | `'light' \| 'dark'` | Initial mode (defaults to `'light'`). With `showThemeToggle`, users can flip it. |

### Logo

The org logo renders as a small circular avatar in the modal header (top-left),
persistent on every step, alongside `companyName`.

- `logo: 'https://…/logo.png'` — uses that image directly.
- `logo: 'default'` — pulls your organization's logo configured in the **Myaza dashboard**
  (returned by the server on mount). If your org has no logo set, or the image fails
  to load, the avatar is hidden.
- omitted — no header logo.

```tsx
appearance={{
  primaryColor: '#0F7B6C',
  primaryTextColor: '#FFFFFF',
  surfaceColor: '#F4F7F6',
  borderColor: '#D7E3E0',
  logo: 'default',
  theme: 'light',
}}
```

## Consent screen copy

The welcome/consent step shows a heading and a short description. Override either
through the `consent` prop:

| Field         | Type     | Description                                                                                           |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `title`       | `string` | Heading. Defaults to `Welcome, {firstName}` when a first name is known, else `Identity Verification`. |
| `description` | `string` | Sub-text under the heading. Defaults to the built-in regulatory copy.                                 |

Both fields support `{firstName}` and `{lastName}` tokens, replaced with the values
from `userData` (empty string when absent), so a custom title can still greet the
user by name.

```tsx
consent={{
  title: 'Welcome, {firstName}',
  description: "We just need to confirm it's really you. This takes about a minute.",
}}
```

## Success screen copy

After the user submits, the final screen shows a confirmation heading and
description. Override either through the `success` prop:

| Field         | Type     | Description                                                                |
| ------------- | -------- | -------------------------------------------------------------------------- |
| `title`       | `string` | Heading. Defaults to `Verification Submitted!`.                            |
| `description` | `string` | Sub-text under the heading. Defaults to the built-in "submitted for review" copy. |

Both fields support the same `{firstName}` / `{lastName}` tokens as `consent`.

```tsx
success={{
  title: "You're all set, {firstName}!",
  description: "We'll email you once your verification is reviewed.",
}}
```

## Robustness & error handling

The SDK is resilient to flaky networks, denied permissions, and poor capture
conditions, and reports technical failures through `onError` with a typed code.

### Typed errors (`onError`)

`onError` receives a `KYCError` with a typed `code`, a human-readable `message`,
and optional `details`. The codes are **identical to the web and Flutter SDKs**:

```tsx
import { MyazaKYC, type KYCError } from '@myazahq/kyc-sdk-react-native';

<MyazaKYC
  {...config}
  onError={(error: KYCError) => {
    switch (error.code) {
      case 'camera_permission_denied': /* ask the user to allow the camera */ break;
      case 'insufficient_credits':     /* error.details = { required, balance, currency } */ break;
      case 'network_error':
      case 'upload_failed':            /* shown only after automatic retries */ break;
    }
  }}
/>
```

| `code`                     | When it fires                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `network_error`            | Connection failure / timeout, **after retries are exhausted**.      |
| `invalid_api_key`          | Server returned `401`.                                              |
| `insufficient_credits`     | Server returned `402`. `details = { required, balance, currency }`. |
| `upload_failed`            | A media upload failed, **after retries are exhausted**.            |
| `camera_permission_denied` | The user denied (or the OS blocks) camera access.                  |
| `feature_disabled`         | Server returned `403` (ID type / feature not enabled for the org). |
| `unknown`                  | Anything else.                                                      |

> Verification *outcomes* (identity not found, document mismatch, …) never come
> through `onError` — they arrive asynchronously via webhook / `GET /api/kyc/status/:id`.

### Network resilience

Media uploads and the verify submission are wrapped in exponential-backoff retry
(with jitter), retrying only *transient* failures (network / timeout / `5xx`);
terminal `4xx` surface immediately. The UI shows a top toast while retrying, and
`onError` fires **only after retries are exhausted** (`upload_failed` for uploads,
`network_error` for connectivity).

### Camera permission

If the user denies camera access, the SDK shows a clear "camera access needed"
screen (with an **Open Settings** action) instead of hanging, and reports
`camera_permission_denied` to `onError`. Document capture additionally offers a
gallery-upload fallback unless `allowDocumentUpload` is `false`.

### Liveness quality guards

- **Multiple faces** — if more than one face is in frame, the challenge pauses
  ("Make sure only your face is visible") and resumes automatically when only one
  face remains. This guards capture quality and a class of spoofing.
- **Lighting** — too-dark *and* too-bright (glare) conditions are detected live
  during liveness; the SDK shows guidance ("Move to a brighter area" / "Too bright
  — reduce glare") and blocks auto-capture until lighting is acceptable.

## Liveness

Active, challenge-based liveness (nod / turn / blink / smile — 2 randomly chosen
per session). Face detection runs **on-device, natively**:

- **iOS** — Apple Vision (`VNDetectFaceLandmarksRequest`).
- **Android** — Google ML Kit (native Gradle dep, Android-only — so no
  cross-platform ML Kit iOS pod, and the SDK still builds on Apple-Silicon iOS
  simulators).

Both run as a [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera)
v5 Nitro frame processor: the camera frame never crosses the JS bridge. The selfie
is **auto-captured** once challenges pass (anti-spoofing — never user-triggered),
and a short liveness video is recorded and uploaded best-effort.

## Documentation

Full documentation, configuration options, and webhook setup: **[identity.myaza.co/documentation/sdks](https://identity.myaza.co/documentation/sdks)**.

## License

MIT © Flitstack Technologies Inc.
