import Foundation
import CoreNFC
import ImageIO
import UIKit
import CommonCrypto
import NitroModules

// ---------------------------------------------------------------------------
// HybridMyazaEmrtd — the iOS half of eMRTD chip reading, implementing the
// nitrogen-generated `HybridMyazaEmrtdSpec` from src/specs/MyazaEmrtd.nitro.ts.
// The Android half is HybridMyazaEmrtd.kt.
//
// Two responsibilities, deliberately no more:
//
//   • TRANSPORT. CoreNFC's ISO-7816 tag, wrapped so TypeScript can send an
//     APDU and get bytes back. Everything above — BAC, secure messaging, file
//     reads — is TypeScript, where it is tested against ICAO 9303's worked
//     examples in CI.
//   • PRIMITIVES. CommonCrypto's DES, AES and SHA. Apple's implementations are
//     audited and hardware-backed; a hand-written DES in JavaScript would be
//     both slower and a novel implementation on a path that authenticates a
//     passport.
//
// This file decides NOTHING about authenticity. It moves bytes.
// ---------------------------------------------------------------------------

final class HybridMyazaEmrtd: HybridMyazaEmrtdSpec {

  private var session: NFCTagReaderSession?
  private var tag: NFCISO7816Tag?
  private var delegate: SessionDelegate?

  // MARK: - Transport

  /// Whether this device can read chips.
  ///
  /// `NFCTagReaderSession.readingAvailable` has been observed returning FALSE on
  /// a device that reads chips perfectly well — across app restarts, a
  /// foreground transition and a reinstall — and on the very same run that then
  /// opened a session and read a passport's MRZ. A device that truly lacked the
  /// capability could not have got that far, so the false is the property
  /// lying, not the hardware answering.
  ///
  /// The likeliest reason is the thread: Nitro invokes this synchronously from
  /// the JS thread, and CoreNFC is UIKit-adjacent. Reading it on the main thread
  /// would be the direct fix, but a `DispatchQueue.main.sync` from the JS thread
  /// can deadlock whenever main is itself waiting on JS — a real possibility
  /// during startup, and far worse than a wrong boolean.
  ///
  /// So it exploits the one thing that IS certain: NFC hardware cannot vanish
  /// while the app is running. A single observed `true` is therefore
  /// authoritative for the rest of the process, and later false readings — which
  /// have only ever been wrong — cannot retract it. A device genuinely without
  /// NFC never observes a true and keeps reporting false, which is correct.
  private static var everAvailable = false

  func isAvailable() throws -> Bool {
    let now = NFCTagReaderSession.readingAvailable
    if now { Self.everAvailable = true }
    return now || Self.everAvailable
  }

  /// Decode an image format JS cannot render, returning base64 JPEG.
  ///
  /// Passport chips overwhelmingly store DG2 as JPEG 2000, which React Native
  /// cannot display — so the portrait the issuing government signed was being
  /// read, hash-verified against the SOD, and then thrown away unshown. iOS has
  /// a decoder: ImageIO registers `public.jpeg-2000`.
  ///
  /// Empty string on failure rather than throwing. The preview is a courtesy;
  /// the chip read's verdict does not depend on it.
  func decodeImage(dataBase64: String) throws -> Promise<String> {
    Promise.async {
      guard let data = Data(base64Encoded: dataBase64) else { return "" }
      // Off the main thread: a full-resolution portrait is a few hundred
      // kilobytes of wavelet data and decoding it should not stall a frame.
      return await withCheckedContinuation { (continuation: CheckedContinuation<String, Never>) in
        DispatchQueue.global(qos: .userInitiated).async {
          guard let source = CGImageSourceCreateWithData(data as CFData, nil),
                let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil),
                let jpeg = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.9)
          else {
            continuation.resume(returning: "")
            return
          }
          continuation.resume(returning: jpeg.base64EncodedString())
        }
      }
    }
  }

  func startSession(alertMessage: String) throws -> Promise<EmrtdTagInfo> {
    Promise.async {
      try await withCheckedThrowingContinuation { continuation in
        // The WHOLE session lifecycle runs on the MAIN thread. Nitro promises
        // execute on a background executor, and a session created and begun
        // there has been observed invalidating INSTANTLY with `Code=202
        // "Session invalidated unexpectedly"` — before the system sheet ever
        // appears — on the same phone that reads chips happily through a
        // main-thread session (the Flutter SDK's path; method channels deliver
        // on main). Consistent with `isAvailable` above: CoreNFC is
        // UIKit-adjacent and answers wrongly off the main thread. Unlike the
        // availability read, dispatching async here cannot deadlock — nothing
        // waits synchronously on the result.
        DispatchQueue.main.async {
          // A stale session from an earlier attempt must never overlap the new
          // one — two live sessions is itself an instant invalidation.
          self.session?.invalidate()
          self.session = nil
          self.tag = nil

          // The delegate is retained explicitly: NFCTagReaderSession holds its
          // delegate weakly, and a deallocated one silently ends the session
          // with no callback at all.
          let delegate = SessionDelegate { [weak self] result in
            switch result {
            case .success(let tag):
              self?.tag = tag
              continuation.resume(
                returning: EmrtdTagInfo(connected: true, uid: Self.identifier(of: tag))
              )
            case .failure(let error):
              continuation.resume(throwing: error)
            }
          }
          self.delegate = delegate

          guard
            let session = NFCTagReaderSession(
              pollingOption: .iso14443, delegate: delegate, queue: nil
            )
          else {
            continuation.resume(throwing: EmrtdError.unavailable)
            return
          }
          session.alertMessage = alertMessage
          self.session = session
          session.begin()
        }
      }
    }
  }

  func stopSession(message: String) throws -> Promise<Void> {
    Promise.async {
      await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
        // Same main-thread rule as startSession — teardown must not race a
        // begin() already queued on main.
        DispatchQueue.main.async {
          if !message.isEmpty {
            self.session?.alertMessage = message
          }
          self.session?.invalidate()
          self.session = nil
          self.tag = nil
          self.delegate = nil
          continuation.resume()
        }
      }
    }
  }

  func updateSessionMessage(message: String) throws -> Promise<Void> {
    Promise.async {
      await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
        // Same main-thread rule as the rest of the session lifecycle. The
        // system sheet covers the app during a read, so this line is the only
        // narration an iOS user gets — updated per stage from TypeScript.
        DispatchQueue.main.async {
          self.session?.alertMessage = message
          continuation.resume()
        }
      }
    }
  }

  func transceive(apduBase64: String) throws -> Promise<EmrtdApduResponse> {
    Promise.async {
      guard let tag = self.tag else { throw EmrtdError.notConnected }
      guard
        let raw = Data(base64Encoded: apduBase64),
        let apdu = NFCISO7816APDU(data: raw)
      else {
        throw EmrtdError.malformedApdu
      }

      let (data, sw1, sw2) = try await tag.sendCommand(apdu: apdu)
      // A non-success status word RESOLVES rather than throwing: 0x6CXX and
      // 0x63CF are answers the protocol layer has to interpret, not failures.
      return EmrtdApduResponse(
        data: data.base64EncodedString(),
        statusWord: Double(Int(sw1) << 8 | Int(sw2))
      )
    }
  }

  private static func identifier(of tag: NFCISO7816Tag) -> String {
    tag.identifier.base64EncodedString()
  }

  // MARK: - Primitives

  func sha1(dataBase64: String) throws -> String {
    let data = Self.decode(dataBase64)
    // The length is captured BEFORE the buffer is borrowed: reading
    // `data.count` inside `withUnsafeBytes` is an overlapping access.
    let length = CC_LONG(data.count)
    var digest = [UInt8](repeating: 0, count: Int(CC_SHA1_DIGEST_LENGTH))
    data.withUnsafeBytes { buffer in
      _ = CC_SHA1(buffer.baseAddress, length, &digest)
    }
    return Data(digest).base64EncodedString()
  }

  func sha256(dataBase64: String) throws -> String {
    let data = Self.decode(dataBase64)
    let length = CC_LONG(data.count)
    var digest = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
    data.withUnsafeBytes { buffer in
      _ = CC_SHA256(buffer.baseAddress, length, &digest)
    }
    return Data(digest).base64EncodedString()
  }

  func desEde2Cbc(
    keyBase64: String, dataBase64: String, ivBase64: String, encrypt: Bool
  ) throws -> String {
    // Two-key 3DES is K1|K2|K1. CommonCrypto wants the full 24 bytes, so the
    // expansion happens here rather than being assumed.
    let key16 = Self.decode(keyBase64)
    guard key16.count == 16 else { throw EmrtdError.badKeyLength }
    var key24 = Data(key16)
    key24.append(key16.prefix(8))

    return try Self.crypt(
      algorithm: CCAlgorithm(kCCAlgorithm3DES),
      key: key24,
      iv: Self.decode(ivBase64),
      data: Self.decode(dataBase64),
      blockSize: kCCBlockSize3DES,
      encrypt: encrypt
    )
  }

  func desBlock(keyBase64: String, blockBase64: String, encrypt: Bool) throws -> String {
    // ECB on a single block — the retail MAC's inner primitive. The chaining is
    // done in TypeScript, where the standard's construction is testable.
    try Self.crypt(
      algorithm: CCAlgorithm(kCCAlgorithmDES),
      key: Self.decode(keyBase64),
      iv: Data(),
      data: Self.decode(blockBase64),
      blockSize: kCCBlockSizeDES,
      encrypt: encrypt,
      options: CCOptions(kCCOptionECBMode)
    )
  }

  func aesCbc(
    keyBase64: String, dataBase64: String, ivBase64: String, encrypt: Bool
  ) throws -> String {
    try Self.crypt(
      algorithm: CCAlgorithm(kCCAlgorithmAES),
      key: Self.decode(keyBase64),
      iv: Self.decode(ivBase64),
      data: Self.decode(dataBase64),
      blockSize: kCCBlockSizeAES128,
      encrypt: encrypt
    )
  }

  func aesCmac(keyBase64: String, dataBase64: String) throws -> String {
    // CommonCrypto has no CMAC, so RFC 4493 is built on AES-ECB here. It is a
    // short, exactly-specified construction; the alternative is a third-party
    // dependency inside the passport path.
    let key = Self.decode(keyBase64)
    let message = Self.decode(dataBase64)
    let block = 16

    // Subkeys: encrypt a zero block, then shift-and-conditionally-XOR.
    let zeros = Data(repeating: 0, count: block)
    let l = Self.decode(
      try Self.crypt(
        algorithm: CCAlgorithm(kCCAlgorithmAES), key: key, iv: Data(), data: zeros,
        blockSize: kCCBlockSizeAES128, encrypt: true, options: CCOptions(kCCOptionECBMode)
      )
    )
    let k1 = Self.shiftLeftXor(l)
    let k2 = Self.shiftLeftXor(k1)

    // The final block is XORed with K1 when the message divides evenly, and
    // padded then XORed with K2 when it does not.
    var blocks = [Data]()
    var i = 0
    while i < message.count {
      blocks.append(message.subdata(in: i..<min(i + block, message.count)))
      i += block
    }
    if blocks.isEmpty { blocks = [Data()] }

    var last = blocks.removeLast()
    if last.count == block {
      last = Self.xor(last, k1)
    } else {
      var padded = last
      padded.append(0x80)
      padded.append(Data(repeating: 0, count: block - padded.count))
      last = Self.xor(padded, k2)
    }

    var chain = Data(repeating: 0, count: block)
    for b in blocks + [last] {
      let input = Self.xor(chain, b)
      chain = Self.decode(
        try Self.crypt(
          algorithm: CCAlgorithm(kCCAlgorithmAES), key: key, iv: Data(), data: input,
          blockSize: kCCBlockSizeAES128, encrypt: true, options: CCOptions(kCCOptionECBMode)
        )
      )
    }
    return chain.base64EncodedString()
  }

  func randomBytes(length: Double) throws -> String {
    var bytes = [UInt8](repeating: 0, count: Int(length))
    // SecRandomCopyBytes, not arc4random: the BAC nonce's unpredictability is
    // what stops the exchange being replayable.
    guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
      throw EmrtdError.randomFailed
    }
    return Data(bytes).base64EncodedString()
  }

  // MARK: - Helpers

  private static func decode(_ b64: String) -> Data {
    Data(base64Encoded: b64) ?? Data()
  }

  private static func xor(_ a: Data, _ b: Data) -> Data {
    Data(zip(a, b).map { $0 ^ $1 })
  }

  /// One-bit left shift, XORed with the RFC 4493 constant on overflow.
  private static func shiftLeftXor(_ input: Data) -> Data {
    var out = [UInt8](repeating: 0, count: input.count)
    var carry: UInt8 = 0
    for i in stride(from: input.count - 1, through: 0, by: -1) {
      let byte = input[i]
      out[i] = (byte << 1) | carry
      carry = (byte & 0x80) != 0 ? 1 : 0
    }
    if (input.first! & 0x80) != 0 { out[out.count - 1] ^= 0x87 }
    return Data(out)
  }

  private static func crypt(
    algorithm: CCAlgorithm,
    key: Data,
    iv: Data,
    data: Data,
    blockSize: Int,
    encrypt: Bool,
    options: CCOptions = 0
  ) throws -> String {
    // NO padding option: the protocol applies ISO 9797-1 method 2 itself, and
    // letting CommonCrypto add PKCS#7 on top would corrupt every message.
    var out = Data(count: data.count + blockSize)
    // Captured BEFORE the buffer is exclusively borrowed below — reading
    // `out.count` inside `withUnsafeMutableBytes` is an overlapping access.
    let capacity = out.count
    let keyLength = key.count
    let dataLength = data.count
    let hasIv = !iv.isEmpty
    var moved = 0
    let status = out.withUnsafeMutableBytes { outPtr in
      data.withUnsafeBytes { dataPtr in
        key.withUnsafeBytes { keyPtr in
          iv.withUnsafeBytes { ivPtr in
            CCCrypt(
              CCOperation(encrypt ? kCCEncrypt : kCCDecrypt),
              algorithm,
              options,
              keyPtr.baseAddress, keyLength,
              hasIv ? ivPtr.baseAddress : nil,
              dataPtr.baseAddress, dataLength,
              outPtr.baseAddress, capacity,
              &moved
            )
          }
        }
      }
    }
    guard status == kCCSuccess else { throw EmrtdError.cryptoFailed(Int(status)) }
    return out.prefix(moved).base64EncodedString()
  }
}

// MARK: - Session delegate

private final class SessionDelegate: NSObject, NFCTagReaderSessionDelegate {
  private let onResult: (Result<NFCISO7816Tag, Error>) -> Void
  private var settled = false

  init(onResult: @escaping (Result<NFCISO7816Tag, Error>) -> Void) {
    self.onResult = onResult
  }

  /// The continuation may be resumed exactly once; CoreNFC can deliver both an
  /// invalidation and a detection in edge cases, and resuming twice traps.
  private func settle(_ result: Result<NFCISO7816Tag, Error>) {
    guard !settled else { return }
    settled = true
    onResult(result)
  }

  func tagReaderSessionDidBecomeActive(_ session: NFCTagReaderSession) {}

  func tagReaderSession(_ session: NFCTagReaderSession, didInvalidateWithError error: Error) {
    settle(.failure(error))
  }

  func tagReaderSession(_ session: NFCTagReaderSession, didDetect tags: [NFCTag]) {
    guard let detected = tags.first, case let .iso7816(tag) = detected else {
      session.invalidate(errorMessage: "That is not a passport chip.")
      settle(.failure(EmrtdError.wrongTagType))
      return
    }
    session.connect(to: detected) { [weak self] error in
      if let error {
        self?.settle(.failure(error))
      } else {
        self?.settle(.success(tag))
      }
    }
  }
}

enum EmrtdError: Error {
  case unavailable
  case notConnected
  case malformedApdu
  case wrongTagType
  case badKeyLength
  case randomFailed
  case cryptoFailed(Int)
}
