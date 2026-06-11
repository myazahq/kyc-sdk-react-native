package co.myazahq.kyc.rn

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.margelo.nitro.myazakyc.KycSdkReactNativeOnLoad

/**
 * Loads the SDK's Nitro C++ library (`libKycSdkReactNative.so`) at app startup.
 * The library's JNI_OnLoad (`src/main/cpp/cpp-adapter.cpp`) registers the
 * MyazaFaceDetector HybridObject, so JS
 * `NitroModules.createHybridObject('MyazaFaceDetector')` resolves to the Kotlin
 * impl (`com.margelo.nitro.myazakyc.HybridMyazaFaceDetector`).
 *
 * VisionCamera v5 dropped the FrameProcessorPluginRegistry model — Nitro
 * HybridObjects replace it — so this package no longer registers a frame
 * processor. It exists only so RN CLI autolinking (`react-native.config.js`)
 * instantiates it on the host app's PackageList, triggering the library load
 * (and therefore the HybridObject registration) before the liveness screen runs.
 * It exposes no React Native modules or views.
 */
class MyazaFaceDetectorPackage : ReactPackage {
  init {
    KycSdkReactNativeOnLoad.initializeNative()
  }

  // MyazaStatusBarModule themes the modal's (Dialog window's) status/nav bars —
  // something JS StatusBar/SystemBars can't reach. A native module (not a view
  // manager) because legacy view managers aren't instantiated under Fabric.
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(MyazaStatusBarModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
