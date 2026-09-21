const {
  withInfoPlist,
  withEntitlementsPlist,
  withAndroidManifest,
  createRunOncePlugin,
  AndroidConfig,
} = require('expo/config-plugins');

const pkg = require('./package.json');

// ---------------------------------------------------------------------------
// Expo config plugin for @myazahq/kyc-sdk-react-native.
//
// The native modules (face detector, text recogniser, eMRTD reader) autolink
// via expo-module.config.json. This plugin only handles what must be written
// into the HOST app's native config:
//
//   • iOS  — NSCameraUsageDescription (document scan + selfie liveness), and,
//            when NFC is enabled, NFCReaderUsageDescription plus the
//            reader-session entitlements.
//            NOTE: voice guidance is TTS OUTPUT only, so NO microphone usage
//            string and no NSMicrophoneUsageDescription are added.
//   • Android — CAMERA + INTERNET, plus NFC when enabled.
//
// NFC is OPT-IN (`nfc: true`). The entitlement requires the App ID to carry the
// "NFC Tag Reading" capability in the Apple Developer portal; adding it
// unconditionally would break code-signing for every consumer who does not read
// chips and has not enabled it.
//
// Camera preview/capture itself comes from react-native-vision-camera, but v5
// ships NO config plugin (v4 did), so it must NOT be listed in the host app's
// `plugins`. Expo then loads the package's main entry as a plugin and prebuild
// dies on `Cannot find module '.../lib/VisionCamera'`. That is why the camera
// permission and usage string are declared HERE. This plugin is intentionally
// minimal and idempotent.
// ---------------------------------------------------------------------------

const CAMERA_USAGE =
  'We use the camera to photograph your ID document and to capture a live selfie for identity verification.';

const NFC_USAGE =
  'We read the secure chip in your passport or ID card to confirm the document is genuine.';

const LOCATION_USAGE =
  'We use your location to confirm you are at the address you pin during verification.';

/**
 * The eMRTD application identifier.
 *
 * iOS will not open an ISO-7816 session at all unless the AID the app intends
 * to select is declared — an undeclared one fails at connect time with an error
 * that says nothing about the cause.
 */
const EMRTD_AID = 'A0000002471001';

/** Adds a value to a plist array, leaving any existing entries alone. */
function addToList(container, key, value) {
  const current = container[key];
  const list = Array.isArray(current) ? current : [];
  if (!list.includes(value)) container[key] = [...list, value];
}

function withIosCameraUsage(config, customMessage) {
  return withInfoPlist(config, (cfg) => {
    if (!cfg.modResults.NSCameraUsageDescription) {
      cfg.modResults.NSCameraUsageDescription = customMessage || CAMERA_USAGE;
    }
    return cfg;
  });
}

/**
 * iOS location usage string, for the address-collection step's one-shot fix
 * ("Use my current location" + the attest-presence claim). Written by DEFAULT
 * because its ABSENCE is a crash: iOS kills an app that requests location
 * without a usage string, and whether the step runs is decided by the org's
 * WORKFLOW, not by anything the host app author can see at build time. An
 * unused usage string costs nothing. `location: false` opts out.
 */
function withIosLocationUsage(config, customMessage) {
  return withInfoPlist(config, (cfg) => {
    if (!cfg.modResults.NSLocationWhenInUseUsageDescription) {
      cfg.modResults.NSLocationWhenInUseUsageDescription = customMessage || LOCATION_USAGE;
    }
    return cfg;
  });
}

const AID_KEY = 'com.apple.developer.nfc.readersession.iso7816.select-identifiers';
const FORMATS_KEY = 'com.apple.developer.nfc.readersession.formats';

/**
 * Info.plist half of NFC. Exported so the split below can be tested without a
 * device build — which is the only thing that caught it being wrong.
 * @param {Record<string, unknown>} plist
 */
function applyNfcInfoPlist(plist, customMessage) {
  if (!plist.NFCReaderUsageDescription) {
    plist.NFCReaderUsageDescription = customMessage || NFC_USAGE;
  }
  // The AID list is an Info.plist key, NOT an entitlement — Apple documents it
  // there, and the App ID's "NFC Tag Reading" capability covers only the
  // formats entitlement. Adding it to the entitlements file as well fails the
  // build outright: Xcode finds no matching capability to put in the profile
  // and refuses to sign ("not found and could not be included in profile").
  addToList(plist, AID_KEY, EMRTD_AID);
  return plist;
}

/**
 * Entitlements half of NFC.
 * @param {Record<string, unknown>} plist
 */
function applyNfcEntitlements(plist) {
  // 'TAG' is the raw ISO-7816 format a passport needs; 'NDEF' is a different
  // capability entirely and does not cover it.
  addToList(plist, FORMATS_KEY, 'TAG');
  // Actively REMOVE the AID list from here. An earlier version of this plugin
  // wrote it to the entitlements too, and prebuild MERGES into whatever
  // entitlements file already exists — so without this, anyone who built once
  // with that version keeps a key that makes signing fail forever, and
  // re-running prebuild never clears it.
  delete plist[AID_KEY];
  return plist;
}

function withIosNfc(config, customMessage) {
  config = withInfoPlist(config, (cfg) => {
    applyNfcInfoPlist(cfg.modResults, customMessage);
    return cfg;
  });

  return withEntitlementsPlist(config, (cfg) => {
    applyNfcEntitlements(cfg.modResults);
    return cfg;
  });
}

/**
 * The Android permission list for a given set of opt-ins. Pure and exported
 * so the tests can pin what `location: 'always'` declares — a permission
 * that changes review posture must never arrive by accident.
 */
function androidPermissionsFor({ nfc, location, backgroundLocation }) {
  return [
    'android.permission.CAMERA',
    'android.permission.INTERNET',
    ...(nfc ? ['android.permission.NFC'] : []),
    // Foreground location, for the address-collection step's one-shot fix.
    ...(location
      ? ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION']
      : []),
    // The always-on presence tier (OkHi model, opt-in): OS geofencing needs
    // the background grant, and Google Play reviews any app that declares
    // it — which is why this is `location: 'always'` only, never a default.
    // The foreground-service pair rides the same opt-in: FOREGROUND_SERVICE
    // is a normal permission, and FOREGROUND_SERVICE_LOCATION (API 34+) is
    // what lets expo-location's service declare the `location` type; Play
    // reviews it under the same location declaration.
    ...(backgroundLocation
      ? [
          'android.permission.ACCESS_BACKGROUND_LOCATION',
          'android.permission.FOREGROUND_SERVICE',
          'android.permission.FOREGROUND_SERVICE_LOCATION',
        ]
      : []),
  ];
}

function withAndroidPermissions(config, opts) {
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermissions(cfg.modResults, androidPermissionsFor(opts));
    return cfg;
  });
}

/**
 * Declares `android.hardware.nfc` as NOT required, on the host's manifest.
 *
 * This is not decoration, and it must never be separated from the NFC
 * permission. Android INFERS `<uses-feature android:name="android.hardware.nfc"
 * android:required="true">` from `android.permission.NFC` whenever the feature
 * is not declared explicitly — and Play then hides the app from every device
 * without an NFC radio. For a KYC SDK that is most of the catalogue in the
 * markets we serve.
 *
 * So: the permission (androidPermissionsFor) and this declaration are written
 * under the same `nfc: true` opt-in in withMyazaKyc, and nothing else writes
 * either. plugin.test.ts pins that pairing with a source scan, because two
 * separate functions are otherwise free to drift apart.
 *
 * Pure and exported so the pairing can be pinned by a test. The failure it
 * guards has no runtime symptom in development — the app builds, installs and
 * runs perfectly on the NFC-capable phone the developer is holding, and is
 * simply absent from the store listing for everyone else.
 *
 * @param {Record<string, any>} manifest the `modResults.manifest` object
 */
function ensureNfcFeatureOptional(manifest) {
  const list = Array.isArray(manifest['uses-feature']) ? manifest['uses-feature'] : [];
  const existing = list.find((f) => f && f.$ && f.$['android:name'] === 'android.hardware.nfc');
  if (existing) {
    // An explicit `required="true"` from the host or another library would
    // reintroduce exactly the store-visibility problem above, so it is
    // overwritten rather than respected.
    existing.$['android:required'] = 'false';
  } else {
    list.push({
      $: { 'android:name': 'android.hardware.nfc', 'android:required': 'false' },
    });
  }
  manifest['uses-feature'] = list;
  return manifest;
}

function withAndroidNfcFeature(config) {
  return withAndroidManifest(config, (cfg) => {
    ensureNfcFeatureOptional(cfg.modResults.manifest);
    return cfg;
  });
}

/** iOS side of the always-on tier: the Always usage string plus the location
 *  background mode, without which a geofence wake is refused. */
function withIosBackgroundLocation(config, customMessage) {
  return withInfoPlist(config, (cfg) => {
    if (!cfg.modResults.NSLocationAlwaysAndWhenInUseUsageDescription) {
      cfg.modResults.NSLocationAlwaysAndWhenInUseUsageDescription =
        customMessage || LOCATION_USAGE;
    }
    const modes = Array.isArray(cfg.modResults.UIBackgroundModes)
      ? cfg.modResults.UIBackgroundModes
      : [];
    if (!modes.includes('location')) modes.push('location');
    cfg.modResults.UIBackgroundModes = modes;
    return cfg;
  });
}

/**
 * @param {object} config
 * @param {{ cameraPermission?: string, nfc?: boolean, nfcPermission?: string,
 *           location?: boolean | 'always', locationPermission?: string }} [props]
 */
function withMyazaKyc(config, props = {}) {
  const location = props.location !== false;
  // `location: 'always'` opts into the background presence tier. Explicit on
  // purpose: it changes the app's Play/App Store review posture, so it must
  // never arrive as a side effect of a default.
  const backgroundLocation = props.location === 'always';
  config = withIosCameraUsage(config, props.cameraPermission);
  config = withAndroidPermissions(config, {
    nfc: props.nfc === true,
    location,
    backgroundLocation,
  });
  if (location) {
    config = withIosLocationUsage(config, props.locationPermission);
  }
  if (backgroundLocation) {
    config = withIosBackgroundLocation(config, props.locationPermission);
  }
  if (props.nfc === true) {
    // Android: the permission comes from androidPermissionsFor above; this adds
    // the uses-feature that must accompany it. Never write one without the
    // other — see ensureNfcFeatureOptional.
    config = withAndroidNfcFeature(config);
    config = withIosNfc(config, props.nfcPermission);
  }
  return config;
}

module.exports = createRunOncePlugin(withMyazaKyc, pkg.name, pkg.version);
// Named exports for the tests. The plugin itself stays the default export, so
// consumers' app.json entries are unaffected.
module.exports.applyNfcInfoPlist = applyNfcInfoPlist;
module.exports.applyNfcEntitlements = applyNfcEntitlements;
module.exports.androidPermissionsFor = androidPermissionsFor;
module.exports.ensureNfcFeatureOptional = ensureNfcFeatureOptional;
module.exports.EMRTD_AID = EMRTD_AID;
