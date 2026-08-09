package com.margelo.nitro.myazakyc

import android.app.Activity
import android.nfc.NfcAdapter
import android.os.Bundle
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import java.io.ByteArrayOutputStream
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import java.security.MessageDigest
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

/** How long to wait for the user to present a document before giving up. */
private const val NFC_WAIT_SECONDS = 60L

/**
 * How long Android waits between "is the tag still there?" probes.
 *
 * Generous on purpose: the probes interleave with ISO-DEP traffic, and the
 * default (~125ms) is a known cause of chips dropping partway through a large
 * DG2 read. The read itself has its own timeout, so a tag genuinely removed is
 * still noticed.
 */
private const val PRESENCE_CHECK_DELAY_MS = 5_000

/**
 * Android half of eMRTD chip reading, implementing the nitrogen-generated
 * `HybridMyazaEmrtdSpec` from src/specs/MyazaEmrtd.nitro.ts. The iOS half is
 * HybridMyazaEmrtd.swift.
 *
 * Two responsibilities, deliberately no more:
 *
 *  - TRANSPORT. `IsoDep` reader-mode, wrapped so TypeScript can send an APDU and
 *    get bytes back. Everything above — BAC, secure messaging, file reads — is
 *    TypeScript, tested against ICAO 9303's worked examples in CI.
 *  - PRIMITIVES. javax.crypto's DES, AES and SHA. A hand-written DES in
 *    JavaScript would be slower and a novel implementation on a path that
 *    authenticates a passport.
 *
 * This file decides NOTHING about authenticity. It moves bytes.
 */
class HybridMyazaEmrtd : HybridMyazaEmrtdSpec() {

  // @Volatile because every entry point runs on an ARBITRARY pool thread
  // (Nitro's Promise.async dispatches to Dispatchers.Default) and the reader
  // callback lands on a binder thread. Without it the `isoDep = dep` write in
  // startSession has no happens-before edge to the read in transceive, and a
  // fresh connection can be invisible to the very next call — the iOS side
  // avoids this whole class by serializing on the main queue.
  @Volatile private var isoDep: IsoDep? = null
  @Volatile private var pending: CompletableFuture<Tag>? = null
  @Volatile private var adapter: NfcAdapter? = null

  private val context: ReactApplicationContext?
    get() = NitroModules.applicationContext

  // ── Transport ─────────────────────────────────────────────────────────────

  /**
   * Whether this device can read chips.
   *
   * DELIBERATELY not the "sticky true" the iOS side uses. There, a false is
   * always the platform lying about fixed hardware, so the first true is kept
   * forever. Here `isEnabled` reports a SETTING the user can turn off mid-flow,
   * so a false is real, actionable information and must be allowed to retract a
   * previous true — telling someone their chip can be read when they have just
   * disabled NFC would be worse than useless.
   *
   * Do not "harmonise" the two platforms: they are answering different
   * questions.
   */
  override fun isAvailable(): Boolean {
    val ctx = context ?: return false
    return NfcAdapter.getDefaultAdapter(ctx)?.isEnabled == true
  }

  /**
   * Decode an image format JS cannot render, returning base64 JPEG.
   *
   * Passport chips overwhelmingly store DG2 as JPEG 2000, which React Native
   * cannot display. BitmapFactory handles the formats the platform knows —
   * which does NOT include JPEG 2000 (an earlier comment here claimed it did;
   * it never has, which is why the portrait showed on iOS and never on
   * Android) — so JP2/J2K falls through to the bundled JJ2000 decoder.
   *
   * Empty string on failure rather than throwing: the preview is a courtesy and
   * the chip read's verdict does not depend on it.
   */
  override fun decodeImage(dataBase64: String): Promise<String> {
    return Promise.async {
      try {
        val bytes = Base64.decode(dataBase64, Base64.NO_WRAP)
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
          ?: Jp2Decoder.decode(bytes)
          ?: return@async ""
        val out = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
        Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
      } catch (_: Throwable) {
        ""
      }
    }
  }

  override fun startSession(alertMessage: String): Promise<EmrtdTagInfo> {
    // `alertMessage` is iOS's system NFC sheet; Android shows nothing of its
    // own, so the SDK's own UI carries the instruction there.
    return Promise.async {
      val activity = context?.currentActivity
        ?: throw IllegalStateException("No foreground activity to attach the NFC reader to.")
      val nfc = NfcAdapter.getDefaultAdapter(activity)
        ?: throw IllegalStateException("This device has no NFC hardware.")

      val future = CompletableFuture<Tag>()
      pending = future
      adapter = nfc

      // Reader mode with NFC-A/B and the platform's own NDEF check SKIPPED: a
      // passport is not an NDEF tag, and letting the system probe for one adds
      // a round trip and can knock the chip off the field.
      //
      // The presence-check delay is the setting that decides whether a large
      // file survives. Android otherwise probes the tag every ~125ms to see if
      // it is still there, and those probes interleave with an ISO-DEP exchange
      // — long enough into a 30KB DG2 read, some chips drop the connection. The
      // library the Flutter SDK uses sets this for the same reason.
      val options = Bundle().apply {
        putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, PRESENCE_CHECK_DELAY_MS)
      }
      nfc.enableReaderMode(
        activity,
        { tag -> future.complete(tag) },
        NfcAdapter.FLAG_READER_NFC_A or
          NfcAdapter.FLAG_READER_NFC_B or
          NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
        options,
      )

      // BOUNDED. `get()` with no timeout waits forever for a tap that may never
      // come, and the caller would have no way out — the same unbounded-wait
      // trap the SDK avoids everywhere else. A user who does not present a
      // document gets a clean timeout instead of a frozen screen.
      val tag = try {
        future.get(NFC_WAIT_SECONDS, TimeUnit.SECONDS)
      } catch (e: TimeoutException) {
        throw IllegalStateException("No chip was detected. Try again and hold the phone still.")
      }
      val dep = IsoDep.get(tag)
        ?: throw IllegalStateException("That tag does not speak ISO-DEP.")
      // Passports are slow and DG2 is large; the default timeout aborts
      // mid-file on a chip that is working perfectly well.
      dep.timeout = 20_000
      dep.connect()
      isoDep = dep

      EmrtdTagInfo(connected = true, uid = Base64.encodeToString(tag.id, Base64.NO_WRAP))
    }
  }

  override fun stopSession(message: String): Promise<Unit> {
    return Promise.async {
      // Cancel a wait that is still in flight, so closing the sheet releases
      // the caller rather than leaving it blocked until the timeout.
      pending?.completeExceptionally(IllegalStateException("The scan was cancelled."))
      runCatching { isoDep?.close() }
      isoDep = null
      pending = null
      val activity = context?.currentActivity
      if (activity != null) runCatching { adapter?.disableReaderMode(activity) }
      adapter = null
    }
  }

  override fun updateSessionMessage(message: String): Promise<Unit> {
    // Android has no system NFC sheet to write to — the SDK's own screen
    // narrates the read there. Accepted and ignored so the JS side can call
    // one API on both platforms.
    return Promise.async { }
  }

  override fun transceive(apduBase64: String): Promise<EmrtdApduResponse> {
    return Promise.async {
      val dep = isoDep ?: throw IllegalStateException("No chip is connected.")
      val response = dep.transceive(Base64.decode(apduBase64, Base64.NO_WRAP))
      if (response.size < 2) throw IllegalStateException("The chip returned a truncated response.")

      // A non-success status word RESOLVES rather than throwing: 0x6CXX and
      // 0x63CF are answers the protocol layer must interpret, not failures.
      val sw1 = response[response.size - 2].toInt() and 0xFF
      val sw2 = response[response.size - 1].toInt() and 0xFF
      val data = response.copyOfRange(0, response.size - 2)

      EmrtdApduResponse(
        data = Base64.encodeToString(data, Base64.NO_WRAP),
        statusWord = ((sw1 shl 8) or sw2).toDouble(),
      )
    }
  }

  // ── Primitives ────────────────────────────────────────────────────────────

  override fun sha1(dataBase64: String): String = digest("SHA-1", dataBase64)

  override fun sha256(dataBase64: String): String = digest("SHA-256", dataBase64)

  private fun digest(algorithm: String, dataBase64: String): String =
    Base64.encodeToString(
      MessageDigest.getInstance(algorithm).digest(decode(dataBase64)),
      Base64.NO_WRAP,
    )

  override fun desEde2Cbc(
    keyBase64: String,
    dataBase64: String,
    ivBase64: String,
    encrypt: Boolean,
  ): String {
    // Two-key 3DES is K1|K2|K1. javax.crypto's DESede wants all 24 bytes, so
    // the expansion happens here rather than being assumed.
    val key16 = decode(keyBase64)
    require(key16.size == 16) { "3DES needs a 16-byte two-key value." }
    val key24 = ByteArray(24)
    System.arraycopy(key16, 0, key24, 0, 16)
    System.arraycopy(key16, 0, key24, 16, 8)

    val iv = decode(ivBase64)
    // NoPadding: the protocol applies ISO 9797-1 method 2 itself, and letting
    // the provider add PKCS#5 on top would corrupt every message.
    return crypt(
      "DESede/CBC/NoPadding",
      SecretKeySpec(key24, "DESede"),
      IvParameterSpec(if (iv.isEmpty()) ByteArray(8) else iv),
      decode(dataBase64),
      encrypt,
    )
  }

  override fun desBlock(keyBase64: String, blockBase64: String, encrypt: Boolean): String =
    // ECB on a single block — the retail MAC's inner primitive. The chaining is
    // done in TypeScript, where the standard's construction is testable.
    crypt(
      "DES/ECB/NoPadding",
      SecretKeySpec(decode(keyBase64), "DES"),
      null,
      decode(blockBase64),
      encrypt,
    )

  override fun aesCbc(
    keyBase64: String,
    dataBase64: String,
    ivBase64: String,
    encrypt: Boolean,
  ): String {
    val iv = decode(ivBase64)
    return crypt(
      "AES/CBC/NoPadding",
      SecretKeySpec(decode(keyBase64), "AES"),
      IvParameterSpec(if (iv.isEmpty()) ByteArray(16) else iv),
      decode(dataBase64),
      encrypt,
    )
  }

  override fun aesCmac(keyBase64: String, dataBase64: String): String {
    // No CMAC in the platform providers, so RFC 4493 is built on AES-ECB here.
    // A short, exactly-specified construction; the alternative is a
    // third-party dependency inside the passport path.
    val key = SecretKeySpec(decode(keyBase64), "AES")
    val message = decode(dataBase64)
    val block = 16

    val l = decode(crypt("AES/ECB/NoPadding", key, null, ByteArray(block), true))
    val k1 = shiftLeftXor(l)
    val k2 = shiftLeftXor(k1)

    val blocks = mutableListOf<ByteArray>()
    var i = 0
    while (i < message.size) {
      blocks.add(message.copyOfRange(i, minOf(i + block, message.size)))
      i += block
    }
    if (blocks.isEmpty()) blocks.add(ByteArray(0))

    // The final block is XORed with K1 when the message divides evenly, and
    // padded then XORed with K2 when it does not.
    var last = blocks.removeAt(blocks.size - 1)
    last = if (last.size == block) {
      xor(last, k1)
    } else {
      val padded = ByteArray(block)
      System.arraycopy(last, 0, padded, 0, last.size)
      padded[last.size] = 0x80.toByte()
      xor(padded, k2)
    }

    var chain = ByteArray(block)
    for (b in blocks + listOf(last)) {
      chain = decode(crypt("AES/ECB/NoPadding", key, null, xor(chain, b), true))
    }
    return Base64.encodeToString(chain, Base64.NO_WRAP)
  }

  override fun randomBytes(length: Double): String {
    val bytes = ByteArray(length.toInt())
    // SecureRandom, not Random: the BAC nonce's unpredictability is what stops
    // the exchange being replayable.
    SecureRandom().nextBytes(bytes)
    return Base64.encodeToString(bytes, Base64.NO_WRAP)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private fun decode(b64: String): ByteArray =
    if (b64.isEmpty()) ByteArray(0) else Base64.decode(b64, Base64.NO_WRAP)

  private fun xor(a: ByteArray, b: ByteArray): ByteArray =
    ByteArray(minOf(a.size, b.size)) { (a[it].toInt() xor b[it].toInt()).toByte() }

  /** One-bit left shift, XORed with the RFC 4493 constant on overflow. */
  private fun shiftLeftXor(input: ByteArray): ByteArray {
    val out = ByteArray(input.size)
    var carry = 0
    for (i in input.indices.reversed()) {
      val byte = input[i].toInt() and 0xFF
      out[i] = ((byte shl 1) or carry).toByte()
      carry = if (byte and 0x80 != 0) 1 else 0
    }
    if (input[0].toInt() and 0x80 != 0) {
      out[out.size - 1] = (out[out.size - 1].toInt() xor 0x87).toByte()
    }
    return out
  }

  private fun crypt(
    transformation: String,
    key: SecretKeySpec,
    iv: IvParameterSpec?,
    data: ByteArray,
    encrypt: Boolean,
  ): String {
    val cipher = Cipher.getInstance(transformation)
    val mode = if (encrypt) Cipher.ENCRYPT_MODE else Cipher.DECRYPT_MODE
    if (iv == null) cipher.init(mode, key) else cipher.init(mode, key, iv)
    return Base64.encodeToString(cipher.doFinal(data), Base64.NO_WRAP)
  }
}
