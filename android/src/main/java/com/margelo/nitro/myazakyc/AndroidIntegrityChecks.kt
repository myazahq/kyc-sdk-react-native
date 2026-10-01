package com.margelo.nitro.myazakyc

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Debug
import java.io.File
import java.net.InetSocketAddress
import java.net.Socket

/**
 * Android root and instrumentation heuristics for `fingerprint.integrity`
 * (kyc-core docs/DEVICE_INTEL_WIRE.md). Each check returns a contract token
 * when it FIRES; the TypeScript side sorts tokens into rooted / hooked.
 *
 * Heuristics, not proof: Magisk's DenyList hides from most of these, which is
 * why the server treats a positive as evidence and a negative as nothing, and
 * why Play Integrity (a separate signal) carries the real weight. None of them
 * prompts or needs a permission. The root-app lookup relies on the <queries>
 * entries in this library's AndroidManifest.xml (Android 11+ package
 * visibility); without them it can only ever answer "not installed".
 */
internal object AndroidIntegrityChecks {
  private val suPaths = listOf(
    "/system/bin/su", "/system/xbin/su", "/sbin/su", "/system/su", "/su/bin/su",
    "/system/bin/.ext/.su", "/system/sd/xbin/su", "/system/bin/failsafe/su",
    "/data/local/su", "/data/local/bin/su", "/data/local/xbin/su", "/vendor/bin/su",
  )
  private val magiskPaths = listOf(
    "/sbin/.magisk", "/data/adb/magisk", "/data/adb/modules", "/cache/.disable_magisk",
    "/dev/.magisk.unblock", "/system/bin/magisk", "/debug_ramdisk/magisk",
  )
  private val busyboxPaths = listOf(
    "/system/xbin/busybox", "/system/bin/busybox", "/sbin/busybox", "/data/local/xbin/busybox",
  )

  /** Keep in step with the <queries> list in AndroidManifest.xml. */
  private val rootApps = listOf(
    "com.topjohnwu.magisk", "eu.chainfire.supersu", "com.koushikdutta.superuser",
    "com.noshufou.android.su", "com.thirdparty.superuser", "com.kingroot.kinguser",
    "com.kingo.root", "me.weishu.kernelsu", "com.devadvance.rootcloak",
  )

  fun run(context: Context?): List<String> {
    val signals = mutableListOf<String>()
    if (suPaths.any(::exists)) signals += "su_binary"
    if (magiskPaths.any(::exists) || installed(context, "com.topjohnwu.magisk")) signals += "magisk"
    if (Build.TAGS?.contains("test-keys") == true) signals += "test_keys"
    if (busyboxPaths.any(::exists)) signals += "busybox"
    if (rootApps.any { installed(context, it) }) signals += "root_apps"
    if (systemMountedWritable()) signals += "writable_system"
    if (fridaInProcess() || fridaPortOpen()) signals += "frida"
    if (Debug.isDebuggerConnected() || Debug.waitingForDebugger()) signals += "debugger"
    return signals
  }

  private fun exists(path: String): Boolean = try { File(path).exists() } catch (_: Throwable) { false }

  @Suppress("DEPRECATION")
  private fun installed(context: Context?, pkg: String): Boolean {
    val pm = context?.packageManager ?: return false
    return try {
      pm.getPackageInfo(pkg, 0)
      true
    } catch (_: PackageManager.NameNotFoundException) {
      false
    } catch (_: Throwable) {
      false
    }
  }

  /**
   * `/system` (or `/` on system-as-root) mounted read-write. Older devices
   * mount a rootfs/tmpfs ramdisk at `/` read-write legitimately, so those
   * filesystem types do not count.
   */
  private fun systemMountedWritable(): Boolean = try {
    File("/proc/mounts").readLines().any { line ->
      val parts = line.split(" ")
      val target = parts.getOrNull(1)
      val fs = parts.getOrNull(2)
      val systemMount = target == "/system" || (target == "/" && fs != "rootfs" && fs != "tmpfs")
      systemMount && parts.getOrNull(3)?.split(",")?.contains("rw") == true
    }
  } catch (_: Throwable) {
    false
  }

  /** Frida's agent maps its gadget / gum runtime into the process. */
  private fun fridaInProcess(): Boolean = try {
    File("/proc/self/maps").useLines { lines ->
      lines.any { it.contains("frida", ignoreCase = true) || it.contains("gum-js-loop") }
    }
  } catch (_: Throwable) {
    false
  }

  /** frida-server's default port on loopback, bounded to 100 ms. */
  private fun fridaPortOpen(): Boolean = try {
    Socket().use { it.connect(InetSocketAddress("127.0.0.1", 27042), 100); true }
  } catch (_: Throwable) {
    false
  }
}
