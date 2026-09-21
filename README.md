# @myazahq/kyc-sdk-react-native

Myaza KYC SDK for **React Native (Expo)** — ID verification with document
auto-capture, **eMRTD chip reading (NFC)**, active **on-device** liveness,
email/phone OTP verification, questionnaires, proof of address, and full
business (**KYB**) verification, for any supported country. Mirrors the
[web](https://www.npmjs.com/package/@myazahq/kyc-sdk-react) and Flutter SDKs
feature-for-feature — including `workflowId` embeds — and calls the same Myaza
KYC API server.

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

Add the config plugins to `app.json`. The SDK's plugin adds the iOS camera and
location usage strings + Android `CAMERA`/`INTERNET` and foreground location
permissions (location backs the address-collection step's "Use my current
location" and presence attestation; `["@myazahq/kyc-sdk-react-native",
{ "location": false }]` opts out); the VisionCamera plugin wires up
the camera + frame processors. Make sure the **New Architecture** is on (it is by
default on Expo SDK 56):

```jsonc
// app.json
{
  "expo": {
    "newArchEnabled": true,
    "plugins": [
      "@myazahq/kyc-sdk-react-native"
    ]
  }
}
```

VisionCamera v5 ships **no config plugin** (v4 did), so it takes no `plugins`
entry. Listing it makes `expo prebuild` load the package's main entry as a
plugin and fail with `Cannot find module '.../lib/VisionCamera'`. The camera
permission and usage strings come from this SDK's own plugin; pass
`cameraPermission` to change the iOS wording.

Then build a dev client (regenerates the native projects):

```sh
npx expo prebuild
npx expo run:ios                                  # iOS
JAVA_HOME=/path/to/jdk-17 npx expo run:android    # Android — needs JDK 17
```

> The SDK plugin accepts optional custom prompts:
> `["@myazahq/kyc-sdk-react-native", { "cameraPermission": "Your message…",
> "locationPermission": "Your message…", "nfcPermission": "Your message…" }]`.

#### NFC is opt-in

Reading the eMRTD chip in a passport or chip ID card needs platform permissions
that most apps should not carry, so the SDK declares **none of them** unless you
ask:

```jsonc
["@myazahq/kyc-sdk-react-native", { "nfc": true }]
```

With it on, the plugin writes the Android `NFC` permission plus a
`uses-feature android:required="false"` declaration, and on iOS the
`NFCReaderUsageDescription`, the reader-session entitlement and the eMRTD
application identifier.

Leave it off and none of that is added. The chip step already checks for a radio
at runtime and skips itself when there is none, so an app built without NFC
behaves exactly like a phone that has no NFC hardware — every other step is
unaffected.

Two reasons this is opt-in rather than on by default:

- **iOS code signing.** The reader entitlement requires the App ID to carry the
  "NFC Tag Reading" capability in the Apple Developer portal. Adding it
  unconditionally breaks signing for every consumer who does not read chips and
  has not enabled that capability.
- **Play Store visibility.** `android.permission.NFC` makes Android infer that
  the app *requires* an NFC radio, which hides it from every device without one.
  That is why the permission and the `uses-feature` declaration are written
  together and never separately.

> **Changed in 3.0.0.** Earlier versions declared the Android NFC permission in
> the library manifest, so it merged into every host app regardless of this
> option — the opt-in only ever governed iOS. If you read chips on Android and
> have not set `nfc: true`, set it now: without it the permission is no longer
> declared and the chip step will find no radio. Apps that never read chips need
> no change and lose a permission they never wanted.

### Optional modules

Four `expo-*` modules are **optional peers**. The SDK loads each one lazily and
carries on without it, so nothing crashes if you skip them — but each one is
missing a capability rather than a detail, so install them deliberately:

| Module | What installing it buys | Without it |
|--------|------------------------|-----------|
| `expo-device` | Make, model, manufacturer and physical-vs-simulator in the device metadata | Those fields are omitted and the device class is guessed from the platform, so Device Intelligence has a weaker fingerprint and shared-device detection suffers |
| `expo-application` | Your app's id, version and build number on the submission | The `app` block is omitted entirely, so a result cannot be traced to the build that produced it |
| `expo-localization` | The device's region, explicitly | Country defaults and the reported locale fall back to the JS runtime's locale, which often carries no region at all (`en` rather than `en-NG`) |
| `expo-document-picker` | "Choose a file" on the proof-of-address and KYB document steps | Those steps accept a camera capture only, so a PDF bank statement cannot be submitted at all |

```sh
npx expo install expo-device expo-application expo-localization expo-document-picker
```

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
  expo-glass-effect expo-crypto \
  expo-location

# 3. iOS pods:
cd ios && pod install && cd ..
```

Then add the native permissions yourself (the Expo config plugin only runs under
prebuild):

- **iOS** — add to `ios/<App>/Info.plist`:
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>We use the camera to photograph your ID and capture a live selfie.</string>
  <key>NSLocationWhenInUseUsageDescription</key>
  <string>We use your location to confirm you are at the address you pin during verification.</string>
  ```
- **Android** — add to `android/app/src/main/AndroidManifest.xml`:
  ```xml
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
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

### Recommended — mount a workflow

Build the flow once in the Myaza dashboard as a **workflow**, then mount it by
id. The country, ID types, capture steps, add-ons, branding and copy all come
from the workflow, so changing the flow is a re-publish in the dashboard rather
than a new app build and an app-store review. See [Workflows](#workflows).

```tsx
import { MyazaKYC } from '@myazahq/kyc-sdk-react-native';

export default function VerifyScreen() {
  return (
    <MyazaKYC
      apiKey="pk_live_xxx"          // prefix selects the env: pk_test_ → sandbox
      workflowId="wf_AbC123dEf456"
      // Runtime data — a workflow is a shared template and cannot carry any of it.
      userId="usr_123"
      userData={{ firstName: 'Jane', lastName: 'Doe' }}
      metadata={{ orderId: 'ord_456' }}
      onSubmit={(submission) => console.log('Submitted!', submission.verificationId)}
      onError={(err) => console.warn('SDK error:', err.code, err.message)}
      onClose={() => console.log('Modal closed')}
    >
      Verify my identity
    </MyazaKYC>
  );
}
```

**`userData` is worth passing.** It is the name you believe the user has, and it
is compared against the name read off their document — that comparison is what
produces `dataMatch` on the verification. It cannot live on the workflow:
`userId`, `userData` and `metadata` are per-user runtime values, and a workflow
is a template shared by every visitor, so these stay in code even when
everything else moves to the dashboard.

### Or configure everything in code

Skip the workflow and pass the flow's shape as props. Useful for a quick start
or a single fixed flow; anything you'd change later means shipping a new build.

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
      userId='usr_123'
      metadata={{ orderId: 'ord_456' }}
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
| `country`               | `string` (ISO-2)                          | —                   | Country whose ID types are offered. **Required unless `workflowId` is set** (the workflow carries its own country). Any ISO-2 code works — `'NG' \| 'GH' \| 'KE' \| 'ZA' \| 'CI'` keep autocomplete and client-side ID-number validation; other countries render their ID types from the server. |
| `workflowId`            | `string` (`wf_…`)                         | —                   | Run a **published Workflow** built in the dashboard. Workflow config wins over overlapping props. See [Workflows](#workflows). |
| `countries`             | `WorkflowCountry[]`                       | —                   | Multi-region — more than one entry inserts a country-select step between consent and ID type. Usually from a workflow. |
| `idTypes`               | `IdType[]`                                | all allowed for org | Subset of ID types to offer; must be valid for `country`.                                                            |
| `userId`                | `string`                                  | —                   | **Your** reference for the person being verified. Not matched during verification — it correlates repeat checks of the same user onto one identity so results map back to your record. Prefer this over putting a user id in `metadata`. |
| `userData`              | `{ firstName?, lastName?, dateOfBirth? }` | —                   | Pre-fills the user's details.                                                                                        |
| `enableSelfie`          | `boolean`                                 | `true`              | Capture a selfie during liveness.                                                                                    |
| `enableDocumentCapture` | `boolean`                                 | `true`              | Enable the document-scan step for document IDs.                                                                      |
| `allowDocumentUpload`   | `boolean`                                 | `true`              | Allow picking a document photo from the gallery as an alternative to the camera. `false` hides every "upload instead" affordance (it's still offered on the camera-permission-denied screen as an escape hatch). |
| `allowDocumentScan`     | `boolean`                                 | `true`              | Allow photographing the document with the live camera. `false` makes document capture upload-only: the SDK never asks for camera access and the applicant chooses a photo of each side from their device. At least one of `allowDocumentScan` and `allowDocumentUpload` must stay on; a config that switches both off keeps the camera on. |
| `enableLiveness`        | `boolean`                                 | `true`              | Run the liveness challenge step. The server can still disable it per ID type.                                        |
| `livenessMode`          | `'gestures' \| 'flash' \| 'both'`         | `'gestures'`        | How liveness is proven. See [Liveness](#liveness).                                                                   |
| `flashSequenceLength`   | `number` (2–5)                            | `4`                 | Colours in the flash sequence, for `'flash'` / `'both'`.                                                             |
| `voiceGuidance`         | `boolean \| { enabled?, language? }`      | `true`              | Spoken liveness instructions (accessibility, TTS **output** — no microphone). `false` mutes it; pass `{ language: 'fr-FR' }` to set the voice. See [Robustness & error handling](#robustness--error-handling). |
| `emailVerification`     | `EmailVerificationConfig`                 | off                 | Email OTP step after consent. See [Optional steps](#optional-steps).                                                 |
| `phoneVerification`     | `PhoneVerificationConfig`                 | off                 | Phone OTP step (SMS or WhatsApp). See [Optional steps](#optional-steps).                                             |
| `proofOfAddress`        | `ProofOfAddressConfig`                    | off                 | Proof-of-address upload after capture. See [Optional steps](#optional-steps).                                        |
| `questionnaire`         | `QuestionnaireConfig`                     | off                 | Compliance declarations before submission. See [Optional steps](#optional-steps).                                    |
| `nfc`                   | `NfcConfig`                               | off                 | **eMRTD chip read** — native on this SDK, and the strongest assurance level available. See [Optional steps](#optional-steps). |
| `subjectType`           | `'individual' \| 'business'`              | `'individual'`      | Business (KYB) flows require a published KYB workflow. See [Business (KYB) flows](#business-kyb-flows).               |
| `business`              | `WorkflowBusinessConfig`                  | —                   | KYB registry configuration. Normally supplied by a resolved workflow.                                                |
| `deviceIntelligence`    | `boolean`                                 | `true`              | Device + IP fraud signals (multi-accounting, emulator, velocity). **Billed per verification**; `false` disables the analysis, its charge, and the SDK's fingerprint collection. |
| `requireMobileDevice`   | `boolean`                                 | `false`             | Refuse to run on a desktop/laptop — relevant because React Native also targets desktop runtimes and emulators. The server re-checks and rejects with `mobile_device_required`. |
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
| `pk_test_` | sandbox     | `https://trust.myaza.app`      |
| `pk_live_` | production  | `https://trust.myaza.app`      |

An unrecognized or malformed key throws at setup (it never silently defaults).

## Workflows

The recommended integration (see [Usage](#usage)): build the flow in the Myaza
dashboard and reference it by id —

```tsx
<MyazaKYC apiKey="pk_live_xxx" workflowId="wf_abc123" userId="usr_123" />
```

- **Workflow config wins** over any overlapping prop — country, ID types, step
  toggles, appearance, copy. Set them in the builder, not in code.
- **Runtime data always comes from your code**: `userId`, `userData`,
  `metadata`, and every callback.
- `country` becomes optional, because the workflow carries it.

This is the recommended way to drive the optional steps below: compliance teams
change the flow in the dashboard without shipping a new app build — which
matters far more on mobile than on web, where a redeploy is instant and an app
store review is not.

## Optional steps

Steps that are off unless configured. Each is normally switched on in the
dashboard workflow builder (so it rides `workflowId`), but every one can also be
passed directly as a prop.

The flow runs them in this order:

```
consent → email-verification → phone-verification → country-select → id-type
       → id-input / document-capture → nfc → liveness → proof-of-address
       → questionnaire → submitted
```

| Prop | Shape | What it adds |
|---|---|---|
| `emailVerification` | `{ enabled?, required?, codeLength?, maxAttempts?, inputStyle? }` | Email OTP right after consent. `required: false` adds a "skip for now". `codeLength` 4–8 (default 6), `maxAttempts` 1–5 (default 3). |
| `phoneVerification` | same, plus `{ channels?, defaultCountry? }` | Phone OTP. `channels` defaults to `['sms']`; add `'whatsapp'` to offer it. |
| `proofOfAddress` | `{ enabled?, documentTypes?, otherLabel?, maxAgeDays? }` | Upload a utility bill, bank statement, tenancy agreement, or other document. `maxAgeDays` is the recency window (default 90). |
| `questionnaire` | `{ enabled?, title?, description?, fields }` | Compliance declarations before submission. Field `type` is one of `text`, `number`, `money`, `select`, `multiselect`, `boolean`, `date`. |
| `nfc` | `{ enabled?, idTypes?, allowSkip? }` | Reads the passport/ID **chip** (eMRTD). |

**The chip read is a real, native capability on this SDK** — unlike the web SDK,
which cannot do ISO-DEP from a browser. It gives the strongest assurance level
available. A device with no NFC radio skips the step automatically; `allowSkip`
adds a manual escape hatch for a chip that will not read, revealed after a failed
attempt rather than offered on arrival. Skipping never fails the verification —
the chip result is a soft sub-result.

Answers and outcomes arrive in the verification webhook
(`data.questionnaire`, `data.emailVerification`, `data.phoneVerification`,
`data.proofOfAddress`).

```tsx
<MyazaKYC
  apiKey="pk_live_xxx"
  country="NG"
  nfc={{ enabled: true, allowSkip: true }}
  phoneVerification={{ enabled: true, channels: ["sms", "whatsapp"] }}
  questionnaire={{
    title: "A few final questions",
    fields: [
      { key: "source_of_funds", label: "Source of funds", type: "select", required: true,
        options: [{ value: "salary", label: "Salary" }, { value: "business", label: "Business income" }] },
    ],
  }}
/>
```

## Business (KYB) flows

When a resolved workflow's config carries `subjectType: 'business'`, the SDK runs
a company-verification flow instead of the individual one: a registry lookup
(country, product, registration number/name), and — when the workflow configures
them — a company profile, directors & owners, and supporting-document uploads.

KYB is **workflow-required**: there is no prop-only business flow, because the
server rejects a business submission that does not reference a published KYB
workflow.

If the workflow asks the submitter to verify their own identity, the ordinary
individual capture leg runs afterwards for them, and the success screen can hand
back invite links for any directors or owners who need their own check.

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
gallery-upload fallback unless `allowDocumentUpload` is `false`. When
`allowDocumentScan` is `false` the document step never requests the camera, so
this screen cannot appear there: each side is a photo chosen from the device.

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

## App size

The SDK adds native machine learning to a host app, and that is where the weight
sits. Two things decide what a user actually downloads, and the defaults are
already the small ones — but the third and fourth are the host app's to set, and
they are worth more than everything the SDK can do on its own.

**On-device models are fetched, not bundled.** Face detection and text
recognition both run on Google ML Kit on Android, and the SDK depends on the
Play Services variants, which download their models on first use. Measured on a
real integrator's release APK, the bundled pair cost **18.5 MB per device**
(arm64: text 10.55 MB, face 7.95 MB) plus `.tflite` files in `assets/`, which
ship to every device because assets are not split by ABI. Fetched, that is about
0.4 MB of shims.

The SDK primes both downloads the moment the flow opens, so they overlap the
consent and ID-type screens. If a model has not arrived by the time it is needed,
the step says so rather than failing silently — the liveness step waits and
explains, and the MRZ scanner tells the user the code cannot be read and lets
them continue without the chip.

The trade is real: the Play Services variants need Google Play Services, so they
do not work on Huawei or bare AOSP builds. If you ship to those devices, put this
in your root `build.gradle` and you get fully-offline models back, at 18.5 MB per
device:

```gradle
ext { myazaKycBundledMlKit = true }
```

**Ship an App Bundle, or filter your ABIs.** Native libraries dominate the rest
of the download, and a universal APK carries every architecture at once. An `.aab`
lets Play deliver only the one a device needs. If you must ship an APK, name the
architectures your users actually have:

```gradle
android {
  defaultConfig {
    ndk { abiFilters 'arm64-v8a', 'armeabi-v7a' }
  }
}
```

**Turn on R8 and resource shrinking.** The SDK ships its own consumer rules
(`consumer-rules.pro`), so you do not need to learn which of its classes Nitro
constructs by name:

```gradle
android {
  buildTypes {
    release {
      minifyEnabled true
      shrinkResources true
    }
  }
}
```

**Use Expo SDK 54 or newer.** Its default template builds smaller than earlier
ones, and the SDK's peer range assumes it.

## Documentation

Full documentation, configuration options, and webhook setup: **[trust.myaza.co/documentation/sdks](https://trust.myaza.co/documentation/sdks)**.

## License

MIT © Flitstack Technologies Inc.

## Presence reporting (Address Intelligence)

When a workflow enables presence verification (`addressCollection.presence.enabled`),
the SDK stores the confirmed pin on-device at capture. Call the reporter from your
app on a natural moment (app open works well):

```tsx
import { reportAddressPresence, clearPresencePin } from '@myazahq/kyc-sdk-react-native';

const result = await reportAddressPresence({
  apiKey: 'pk_live_…',
  externalUserId: 'user_42', // the same userId the KYC flow ran with
});
// result.reason: 'reported' | 'no_pin' | 'services_off' | 'no_fix' | 'outside_fence' | 'network_error'
```

It never throws and never blocks startup. The geofence is evaluated ON-DEVICE:
only the derived record (calendar day + a night flag) is transmitted, never a
coordinate. A fix outside the fence sends nothing (the server scores presence,
never absence); a mock-location fix is reported flagged. `clearPresencePin`
drops the stored pin (sign-out, or once the watch resolves).

### Background monitoring (OS geofencing)

The stronger tier: the OS wakes the SDK on fence crossings around the stored
pin, app closed or not, so dwell and nights accrue with nobody in the loop.
Entries stamp a timestamp; exits fold the dwell span into per-day aggregates
and flush them. As with the foreground tier, only the derived day records
ever leave the phone.

Three opt-ins, each deliberate:

1. Install the optional peer: `npx expo install expo-task-manager` (without
   it the background tier simply does not exist — never a crash).
2. Declare background location via the config plugin — this is what changes
   your app's store review posture, so it is never a default:

   ```json
   ["@myazahq/kyc-sdk-react-native", { "location": "always" }]
   ```

3. Register the task at your app's ROOT module (before the component tree —
   a task defined inside a component never fires headlessly), then enable:

   ```tsx
   // index.js
   import { registerBackgroundPresence } from '@myazahq/kyc-sdk-react-native';
   registerBackgroundPresence();

   // later, after the KYC flow stored a pin:
   const result = await enableBackgroundPresence({
     apiKey: 'pk_live_…',
     externalUserId: 'user_42',
   });
   // result.reason: 'enabled' | 'module_missing' | 'no_pin'
   //              | 'foreground_denied' | 'background_denied' | 'start_failed'
   ```

`disableBackgroundPresence()` disarms the fence. A permission refusal leaves
the foreground tier working exactly as before — the tiers degrade, never
break.

### The Android foreground service (reliability on OEM-managed phones)

A geofence alone is not reliable on Android once a manufacturer's battery
manager decides your app is idle: transitions are dropped, nothing says so,
and the watch quietly lapses to inconclusive. The phones on that list (Tecno,
Infinix, itel, Xiaomi, Oppo, Vivo) are the ones the market carries. A
foreground service, with its persistent notification, is the one thing those
managers leave alone — and OkHi's own integration guidance for the same
markets is exactly this.

Opt-in, Android only (iOS region monitoring is reliable on its own), on the
same `location: "always"` plugin setting, which also declares the
`FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION` permissions it needs.
`registerBackgroundPresence()` at the root already defines its task; then:

```tsx
const result = await enableForegroundService({
  apiKey: 'pk_live_…',
  externalUserId: 'user_42',
  notification: {
    title: 'Address verification in progress', // shown in the status bar
    body: 'Open the app to see your progress',
    color: '#5645F5',
  },
});
// result.reason: 'enabled' | 'unsupported_platform' | 'module_missing' | 'no_pin'
//              | 'foreground_denied' | 'background_denied' | 'start_failed'
```

While it runs, a low-power fix every ten minutes (or hundred metres) is
turned into the same enter/exit spans the geofence folds, on the same stored
state, so the two never double-count a stay; the queue flushes while the
process is alive; and a fence the OS dropped (a location toggle clears every
registered fence) is re-armed. `disableForegroundService()` stops it and its
notification. Word the notification honestly — it is on screen for days.

### Which tier is running?

Permissions get revoked in Settings and nothing tells the app. Ask:

```tsx
import { presenceStatus, openLocationSettings } from '@myazahq/kyc-sdk-react-native';

const status = await presenceStatus('user_42');
// status.tier: 'background' | 'foreground' | 'none'
// plus pinStored, alwaysOn, locationServicesEnabled, both permission states,
// geofenceArmed, foregroundServiceRunning
if (!status.locationServicesEnabled) {
  // The phone's location toggle is off: permission granted or not, no fix
  // can be taken. Android deep-links to the toggle itself.
  await openLocationSettings('services');
} else if (status.tier === 'none' && status.pinStored) {
  // The road back runs through Settings — no OS allows re-prompting in-app.
  await openLocationSettings();
}
```

### Showing the person where the check stands

Somebody kept from a feature until their address is verified should be able
to see the progress in your app, without a webhook relayed through your
backend. The status endpoint is publishable-safe and enumeration-safe (an
unknown user and a user with no watch answer the same `not_started` shape):

```ts
const res = await fetch(`${serverUrl}/api/kyc/address/presence/${externalUserId}`, {
  headers: { Authorization: `Bearer pk_live_…` },
});
const { status, progress, tier } = await res.json();
// status: 'not_started' | 'in_progress' | 'verified' | 'failed' | 'inconclusive' | 'expired' | 'revoked'
// progress.score: 0..1 on WEIGHTED evidence (five foreground nights and three
//                 geofence nights both read 1); nightsObserved/daysObserved beside it
// tier: 'background' | 'foreground' | null — what is actually feeding it
```
