package com.margelo.nitro.myazakyc

import co.myazahq.kyc.rn.BuildConfig
import com.google.android.gms.common.api.OptionalModuleApi
import com.google.android.gms.common.moduleinstall.InstallStatusListener
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallClient
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate
import com.margelo.nitro.NitroModules
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * The readiness gate both ML Kit detectors share.
 *
 * The default build fetches ML Kit's models through Play Services instead of
 * bundling them (android/build.gradle), which is what keeps ~18.5 MB per device
 * out of the APK. The cost is a window where the detector cannot run: first
 * launch before the download completes, or a device with no GMS at all.
 *
 * Neither detector can report that through its own result. A face detector
 * answers in `FaceResult`, where a missing model and an empty frame are both
 * `faceCount: 0`; a text recogniser answers in `TextResult`, where both are an
 * empty `lines` array. So a user on a fresh install would watch "position your
 * face" forever, or aim at a passport that never auto-captures, with nothing to
 * explain it. Hence a separate, explicit contract, checked before the camera
 * opens rather than inferred per frame.
 *
 * Two properties make it actually settle, and both were missing once:
 *  - The install is URGENT (`installModules`). `deferredInstall` leaves the
 *    timing to Play Services, which may wait for an idle, charging phone; right
 *    for a model somebody might want next week, wrong for one a person is
 *    waiting on now.
 *  - The answer is REFRESHED. `isModelReady` is a synchronous Nitro call and
 *    `areModulesAvailable` is asynchronous, so it returns the cached flag, but
 *    while the flag is false each call also starts a background re-check. The
 *    cache used to be set once at flow start and never again, so a download that
 *    finished a few seconds later was never noticed and the step gave up.
 */
class MlKitModelReadiness(private val api: OptionalModuleApi) {
  // A bundled build has the model in the APK, so there is nothing to wait for
  // and nothing to ask. Asking anyway would be worse than useless: Play
  // Services answers about its OWN optional modules, so it would report "not
  // available" and strand a build that works perfectly offline — which is the
  // exact scenario the bundled flag exists to serve.
  @Volatile private var ready = BuildConfig.BUNDLED_ML_KIT
  @Volatile private var checking = false
  @Volatile private var installing = false

  fun isReady(): Boolean {
    if (!ready) refresh()
    return ready
  }

  /**
   * Ask Play Services for the model, returning true once it is usable, and
   * request an urgent install when it is not.
   *
   * Safe to call repeatedly; returns immediately when already ready. Blocking
   * — callers run it inside a Nitro `Promise.async`.
   */
  fun prepare(): Boolean {
    if (ready) return true

    val ctx = NitroModules.applicationContext
      ?: return false // No context — cannot ask Play Services anything.

    val latch = CountDownLatch(1)
    try {
      val client = ModuleInstall.getClient(ctx)
      client.areModulesAvailable(api)
        .addOnSuccessListener { response ->
          if (response.areModulesAvailable()) ready = true else requestInstall(client)
          latch.countDown()
        }
        .addOnFailureListener {
          // Thrown on devices without Google Play Services at all (Huawei, bare
          // AOSP). Not an error to retry — it will never succeed on this device.
          // Such orgs should build with `myazaKycBundledMlKit = true`.
          latch.countDown()
        }
      latch.await(MODEL_CHECK_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    } catch (_: Throwable) {
      // Leave `ready` as it was; the shared gate's wait decides when to stop.
    }
    return ready
  }

  /** Re-asks Play Services in the background; at most one check at a time. */
  private fun refresh() {
    if (checking) return
    val ctx = NitroModules.applicationContext ?: return
    checking = true
    try {
      ModuleInstall.getClient(ctx).areModulesAvailable(api)
        .addOnSuccessListener { response -> if (response.areModulesAvailable()) ready = true }
        .addOnCompleteListener { checking = false }
    } catch (_: Throwable) {
      checking = false
    }
  }

  private fun requestInstall(client: ModuleInstallClient) {
    if (installing) return
    installing = true

    val listener = object : InstallStatusListener {
      override fun onInstallStatusUpdated(update: ModuleInstallStatusUpdate) {
        when (update.installState) {
          ModuleInstallStatusUpdate.InstallState.STATE_COMPLETED -> {
            ready = true
            installing = false
            client.unregisterListener(this)
          }
          ModuleInstallStatusUpdate.InstallState.STATE_FAILED,
          ModuleInstallStatusUpdate.InstallState.STATE_CANCELED -> {
            // Cleared so the next prepare() can ask again.
            installing = false
            client.unregisterListener(this)
          }
        }
      }
    }

    // `installModules` takes a ModuleInstallRequest; `deferredInstall` takes the
    // OptionalModuleApi itself. Handing a request to the wrong one is how this
    // file once stopped compiling.
    val request = ModuleInstallRequest.Builder().addApi(api).setListener(listener).build()
    client.installModules(request)
      .addOnSuccessListener { response ->
        // The listener never fires for a module that was already there.
        if (response.areModulesAlreadyInstalled()) {
          ready = true
          installing = false
          client.unregisterListener(listener)
        }
      }
      .addOnFailureListener {
        installing = false
        client.unregisterListener(listener)
      }
  }

  private companion object {
    /**
     * Bound on the availability query. It is a local Play Services call, not the
     * model download — the download runs in the background afterwards. Generous
     * enough for a cold Play Services process, short enough that a wedged one
     * cannot stall flow start.
     */
    const val MODEL_CHECK_TIMEOUT_MS = 3_000L
  }
}
