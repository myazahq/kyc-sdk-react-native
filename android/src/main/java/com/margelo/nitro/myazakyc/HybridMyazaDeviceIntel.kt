package com.margelo.nitro.myazakyc

import android.annotation.SuppressLint
import android.provider.Settings
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise

/**
 * Android half of the native Device Intelligence signals, implementing the
 * nitrogen-generated `HybridMyazaDeviceIntelSpec` from
 * src/specs/MyazaDeviceIntel.nitro.ts. The iOS half is
 * HybridMyazaDeviceIntel.swift. Wire contract: kyc-core
 * docs/DEVICE_INTEL_WIRE.md.
 *
 * Collects only. Whether a Play Integrity verdict is acceptable, and what a
 * root signal means, is the server's call: it decodes the token with the org's
 * Google Cloud project, which this file never sees.
 */
class HybridMyazaDeviceIntel : HybridMyazaDeviceIntelSpec() {

  /**
   * `Settings.Secure.ANDROID_ID`: per signing key, user and device, and kept
   * across a reinstall since Android 8. The TypeScript side reads the same
   * value through expo-application first; this is the fallback when that
   * module is not installed. Empty when unavailable.
   */
  @SuppressLint("HardwareIds")
  override fun stableId(): String {
    val resolver = NitroModules.applicationContext?.contentResolver ?: return ""
    return try {
      Settings.Secure.getString(resolver, Settings.Secure.ANDROID_ID) ?: ""
    } catch (_: Throwable) {
      ""
    }
  }

  override fun integritySignals(): Promise<Array<String>> =
    // A background thread: the checks read /proc and probe a loopback port.
    Promise.parallel { AndroidIntegrityChecks.run(NitroModules.applicationContext).toTypedArray() }

  // ── App Attest (iOS only) ────────────────────────────────────────────────

  override fun appAttestSupported(): Boolean = false

  override fun appAttestKeyId(): String = ""

  override fun appAttestAttestNewKey(challengeBase64: String): Promise<AppAttestKey> =
    Promise.rejected(UnsupportedOperationException("App Attest is iOS-only"))

  override fun appAttestAssert(keyId: String, challengeBase64: String): Promise<String> =
    Promise.rejected(UnsupportedOperationException("App Attest is iOS-only"))

  // ── Play Integrity ───────────────────────────────────────────────────────

  override fun playIntegrityToken(cloudProjectNumber: String, challengeBase64: String): Promise<String> =
    Promise.parallel {
      val context = NitroModules.applicationContext
        ?: throw IllegalStateException("no application context")
      PlayIntegrityClient.token(context, cloudProjectNumber, challengeBase64)
    }
}
