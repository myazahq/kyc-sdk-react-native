#include <jni.h>
#include <fbjni/fbjni.h>
#include "KycSdkReactNativeOnLoad.hpp"

// Loaded via System.loadLibrary("KycSdkReactNative") (KycSdkReactNativeOnLoad.kt).
// Registers all nitrogen-generated HybridObjects (MyazaFaceDetector) so the JS
// `NitroModules.createHybridObject('MyazaFaceDetector')` resolves to the Kotlin impl.
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::myazakyc::registerAllNatives();
  });
}
