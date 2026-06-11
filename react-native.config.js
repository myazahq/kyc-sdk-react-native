// React Native CLI autolinking config.
//
// The Android side of this SDK is a plain RN native module that exposes a
// `ReactPackage` (`MyazaFaceDetectorPackage`, which registers the VisionCamera
// "detectFace" frame-processor plugin). RN CLI autolinking — NOT Expo modules
// autolinking — is what discovers `ReactPackage`s, so the Android project is
// declared here. (Expo's `expo-module.config.json` is iOS-only for this package;
// a `ReactPackage` is not an Expo `Module` and can't be registered there.)
//
// iOS autolinking finds the pod via the `*.podspec` at the package root, so no
// iOS entry is needed here.

module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: 'android',
        packageImportPath: 'import co.myazahq.kyc.rn.MyazaFaceDetectorPackage;',
        packageInstance: 'new MyazaFaceDetectorPackage()',
      },
    },
  },
};
