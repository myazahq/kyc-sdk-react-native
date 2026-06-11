# @myazahq/kyc-sdk-react-native

Myaza KYC SDK for **React Native (Expo)** — ID verification, document capture, and
active liveness detection. Mirrors the [web](https://www.npmjs.com/package/@myazahq/kyc-sdk-react)
and Flutter SDKs feature-for-feature and calls the same Myaza KYC API server.

The SDK is a **thin UI layer**: it captures the user's data (ID number, document
photos, a live selfie), uploads the media, and submits a verification request.
All verification (OCR, facial comparison, gov-DB checks) happens server-side and
is delivered asynchronously via webhook — the SDK is fire-and-forget.

## Install

This library ships **native code** (an Apple Vision + Google ML Kit face-detector
VisionCamera frame-processor plugin), so it needs a custom native build. It does
**not** run in Expo Go. Pick your setup below.

Peer dependencies (both setups): `react-native-vision-camera`,
`react-native-worklets-core`, `react-native-svg`, and `expo` (the SDK uses several
`expo-*` modules — see *Bare React Native* if you're not on a managed Expo app).

### Expo app (managed / prebuild — recommended)

```sh
npx expo install @myazahq/kyc-sdk-react-native \
  react-native-vision-camera react-native-worklets-core react-native-svg
```

Add the config plugins to `app.json` (the SDK's plugin adds the iOS camera usage
string + Android `CAMERA`/`INTERNET` permissions; the VisionCamera plugin wires up
the camera + frame processors):

```jsonc
// app.json
{
  "expo": {
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
npx expo run:ios       # or: npx expo run:android
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
  react-native-vision-camera react-native-worklets-core react-native-svg \
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
- Enable VisionCamera frame processors (it needs `react-native-worklets-core`,
  installed above) — see the
  [VisionCamera setup docs](https://react-native-vision-camera.com/docs/guides).

The face-detector native module (podspec + Android Gradle project + the
`detectFace` frame-processor plugin) is autolinked via React Native / Expo
autolinking — no manual linking required.

> Voice guidance is **text-to-speech output only** — the SDK never records audio,
> so **no microphone permission** is requested or required
> (`enableMicrophonePermission: false`).

## Usage

```tsx
import { MyazaKYC } from '@myazahq/kyc-sdk-react-native';

export default function Screen() {
  return (
    <MyazaKYC
      apiKey="pk_test_xxx"          // prefix selects the env: pk_test_ → sandbox
      country="NG"
      idTypes={['bvn', 'nin', 'passport']}
      enableDocumentCapture
      enableLiveness
      appearance={{ primaryColor: '#5645F5', companyName: 'Myaza', theme: 'light' }}
      onSubmit={(s) => console.log('submitted', s.verificationId)}
      onError={(e) => console.warn(e.code, e.message)}
    />
  );
}
```

Or drive the flow from your own trigger with the hook:

```tsx
import { useMyazaKYC } from '@myazahq/kyc-sdk-react-native';

const { open, close, isOpen, currentStep } = useMyazaKYC({ apiKey, country: 'NG' });
```

## Environment

The base URL is auto-detected from the API key prefix — there is **no**
`environment` prop:

| Prefix     | Environment | Base URL                          |
| ---------- | ----------- | --------------------------------- |
| `pk_dev_`  | development | `http://localhost:3001` (override with `devUrl`) |
| `pk_test_` | sandbox     | `https://sandbox.identity.myaza.app` |
| `pk_live_` | production  | `https://identity.myaza.app`      |

## Liveness

Active, challenge-based liveness (nod / turn / blink / smile — 2 randomly chosen
per session). Face detection runs **on-device, natively**:

- **iOS** — Apple Vision (`VNDetectFaceLandmarksRequest`).
- **Android** — Google ML Kit (native Gradle dep, Android-only — so no
  cross-platform ML Kit iOS pod, and the SDK still builds on Apple-Silicon iOS
  simulators).

Both run as a [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera)
frame-processor plugin: the camera frame never crosses the JS bridge. The selfie
is **auto-captured** once challenges pass (anti-spoofing), and a short liveness
video is recorded and uploaded best-effort.

## Callbacks

`onSubmit(submission)` fires the moment the server accepts the request
(`status: 'pending'`). `onError(KYCError)` fires for **technical** errors only
(`network_error`, `invalid_api_key`, `insufficient_credits`, `upload_failed`,
`camera_permission_denied`, `feature_disabled`). Verification *outcomes* arrive
asynchronously via webhook / `GET /api/kyc/status/:id` — never through `onError`.

## License

UNLICENSED — © Myaza.
