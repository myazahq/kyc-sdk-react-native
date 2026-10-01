package com.margelo.nitro.myazakyc

import android.content.Context
import android.util.Base64
import com.google.android.gms.tasks.Tasks
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager.PrepareIntegrityTokenRequest
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenProvider
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenRequest
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/**
 * Play Integrity, Standard API, as the wire contract asks: prepare a token
 * provider ONCE per process for the cloud project the server names, then
 * request a token bound to the server's challenge via
 * `requestHash = lowercase hex SHA-256(challenge bytes)`.
 *
 * Blocking by design (`Tasks.await`), so it must only run on a background
 * thread — HybridMyazaDeviceIntel calls it from `Promise.parallel`. The
 * TypeScript side bounds the whole attestation step to ~5 s on top of the
 * per-call timeouts here.
 */
internal object PlayIntegrityClient {
  private const val PREPARE_TIMEOUT_S = 4L
  private const val REQUEST_TIMEOUT_S = 4L

  @Volatile private var provider: StandardIntegrityTokenProvider? = null
  @Volatile private var preparedFor: String? = null

  fun token(context: Context, cloudProjectNumber: String, challengeBase64: String): String {
    val number = cloudProjectNumber.trim().toLong()
    val challenge = Base64.decode(challengeBase64, Base64.DEFAULT)
    require(challenge.isNotEmpty()) { "empty challenge" }
    val requestHash = MessageDigest.getInstance("SHA-256").digest(challenge)
      .joinToString("") { "%02x".format(it) }

    return try {
      request(providerFor(context, number, cloudProjectNumber), requestHash)
    } catch (_: Throwable) {
      // A provider can go stale (Play Services updated, the process lived
      // for hours). Prepare afresh exactly once before giving up.
      synchronized(this) { provider = null; preparedFor = null }
      request(providerFor(context, number, cloudProjectNumber), requestHash)
    }
  }

  private fun providerFor(context: Context, number: Long, key: String): StandardIntegrityTokenProvider {
    synchronized(this) {
      provider?.takeIf { preparedFor == key }?.let { return it }
      val manager = IntegrityManagerFactory.createStandard(context.applicationContext)
      val task = manager.prepareIntegrityToken(
        PrepareIntegrityTokenRequest.builder().setCloudProjectNumber(number).build(),
      )
      val prepared = Tasks.await(task, PREPARE_TIMEOUT_S, TimeUnit.SECONDS)
      provider = prepared
      preparedFor = key
      return prepared
    }
  }

  private fun request(provider: StandardIntegrityTokenProvider, requestHash: String): String {
    val task = provider.request(
      StandardIntegrityTokenRequest.builder().setRequestHash(requestHash).build(),
    )
    return Tasks.await(task, REQUEST_TIMEOUT_S, TimeUnit.SECONDS).token()
  }
}
