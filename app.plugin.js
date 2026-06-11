const { withInfoPlist, withAndroidManifest, createRunOncePlugin, AndroidConfig } = require('expo/config-plugins');

const pkg = require('./package.json');

// ---------------------------------------------------------------------------
// Expo config plugin for @myazahq/kyc-sdk-react-native.
//
// The native face-detector frame-processor plugin (iOS Apple Vision / Android
// ML Kit) is autolinked via expo-module.config.json (the podspec + the Android
// Gradle project + MyazaFaceDetectorPackage). This config plugin only handles
// the things that must be written into the HOST app's native config:
//
//   • iOS  — NSCameraUsageDescription (document scan + selfie liveness).
//            NOTE: voice guidance is TTS OUTPUT only, so NO microphone usage
//            string and no NSMicrophoneUsageDescription are added.
//   • Android — CAMERA + INTERNET permissions.
//
// Camera *preview/capture* itself comes from react-native-vision-camera; add its
// own config plugin too (it injects the VisionCamera frame-processor build flag).
// This plugin is intentionally minimal and idempotent (createRunOncePlugin).
// ---------------------------------------------------------------------------

const CAMERA_USAGE =
  'We use the camera to photograph your ID document and to capture a live selfie for identity verification.';

function withIosCameraUsage(config, customMessage) {
  return withInfoPlist(config, (cfg) => {
    if (!cfg.modResults.NSCameraUsageDescription) {
      cfg.modResults.NSCameraUsageDescription = customMessage || CAMERA_USAGE;
    }
    return cfg;
  });
}

function withAndroidCameraPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermissions(cfg.modResults, [
      'android.permission.CAMERA',
      'android.permission.INTERNET',
    ]);
    return cfg;
  });
}

/**
 * @param {object} config
 * @param {{ cameraPermission?: string }} [props]
 */
function withMyazaKyc(config, props = {}) {
  config = withIosCameraUsage(config, props.cameraPermission);
  config = withAndroidCameraPermissions(config);
  return config;
}

module.exports = createRunOncePlugin(withMyazaKyc, pkg.name, pkg.version);
