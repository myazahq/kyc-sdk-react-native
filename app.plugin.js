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
// Camera preview/capture itself comes from react-native-vision-camera; add its
// config plugin too. This one is intentionally minimal and idempotent.
// ---------------------------------------------------------------------------

const CAMERA_USAGE =
  'We use the camera to photograph your ID document and to capture a live selfie for identity verification.';

const NFC_USAGE =
  'We read the secure chip in your passport or ID card to confirm the document is genuine.';

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

function withAndroidPermissions(config, { nfc }) {
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermissions(cfg.modResults, [
      'android.permission.CAMERA',
      'android.permission.INTERNET',
      ...(nfc ? ['android.permission.NFC'] : []),
    ]);
    return cfg;
  });
}

/**
 * @param {object} config
 * @param {{ cameraPermission?: string, nfc?: boolean, nfcPermission?: string }} [props]
 */
function withMyazaKyc(config, props = {}) {
  config = withIosCameraUsage(config, props.cameraPermission);
  config = withAndroidPermissions(config, { nfc: props.nfc === true });
  if (props.nfc === true) {
    config = withIosNfc(config, props.nfcPermission);
  }
  return config;
}

module.exports = createRunOncePlugin(withMyazaKyc, pkg.name, pkg.version);
// Named exports for the tests. The plugin itself stays the default export, so
// consumers' app.json entries are unaffected.
module.exports.applyNfcInfoPlist = applyNfcInfoPlist;
module.exports.applyNfcEntitlements = applyNfcEntitlements;
module.exports.EMRTD_AID = EMRTD_AID;
