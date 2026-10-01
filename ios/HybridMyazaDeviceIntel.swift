import Foundation
import CryptoKit
import DeviceCheck
import NitroModules

// ---------------------------------------------------------------------------
// HybridMyazaDeviceIntel — the iOS half of the native Device Intelligence
// signals, implementing the nitrogen-generated `HybridMyazaDeviceIntelSpec`
// from src/specs/MyazaDeviceIntel.nitro.ts. The Android half is
// HybridMyazaDeviceIntel.kt. Wire contract: kyc-core docs/DEVICE_INTEL_WIRE.md.
//
// Collects only. Whether an attestation is genuine, and what a jailbreak
// signal means, is the server's call — it holds the Apple root certificate and
// the org's registered App ID; this file holds neither.
// ---------------------------------------------------------------------------

final class HybridMyazaDeviceIntel: HybridMyazaDeviceIntelSpec {

  struct DeviceIntelError: LocalizedError {
    let errorDescription: String?
    init(_ message: String) { errorDescription = message }
  }

  func stableId() throws -> String {
    MyazaDeviceKeychain.stableId()
  }

  func integritySignals() throws -> Promise<[String]> {
    // Off the JS thread: the image walk and the loopback probe are cheap but
    // not free, and nothing here needs the main queue.
    Promise.parallel { MyazaIntegrityChecks.run() }
  }

  // MARK: - App Attest

  func appAttestSupported() throws -> Bool {
    DCAppAttestService.shared.isSupported
  }

  func appAttestKeyId() throws -> String {
    MyazaDeviceKeychain.read(MyazaDeviceKeychain.appAttestAccount) ?? ""
  }

  func appAttestAttestNewKey(challengeBase64: String) throws -> Promise<AppAttestKey> {
    let hash = try Self.clientDataHash(challengeBase64)
    return Promise.async {
      let service = DCAppAttestService.shared
      guard service.isSupported else { throw DeviceIntelError("App Attest unsupported") }
      // A key can be attested exactly once, so "attest" always means a NEW
      // key. The previous id stays in the Keychain until the new one is
      // proven, so a failed attempt leaves the install with the key it had.
      let keyId: String = try await withCheckedThrowingContinuation { cont in
        service.generateKey { id, error in
          if let id { cont.resume(returning: id) } else { cont.resume(throwing: error ?? DeviceIntelError("no key")) }
        }
      }
      let attestation: Data = try await withCheckedThrowingContinuation { cont in
        service.attestKey(keyId, clientDataHash: hash) { data, error in
          if let data { cont.resume(returning: data) } else { cont.resume(throwing: error ?? DeviceIntelError("no attestation")) }
        }
      }
      MyazaDeviceKeychain.write(MyazaDeviceKeychain.appAttestAccount, keyId)
      return AppAttestKey(keyId: keyId, attestation: attestation.base64EncodedString())
    }
  }

  func appAttestAssert(keyId: String, challengeBase64: String) throws -> Promise<String> {
    let hash = try Self.clientDataHash(challengeBase64)
    return Promise.async {
      let assertion: Data = try await withCheckedThrowingContinuation { cont in
        DCAppAttestService.shared.generateAssertion(keyId, clientDataHash: hash) { data, error in
          if let data { cont.resume(returning: data) } else { cont.resume(throwing: error ?? DeviceIntelError("no assertion")) }
        }
      }
      return assertion.base64EncodedString()
    }
  }

  // MARK: - Play Integrity (Android only)

  func playIntegrityToken(cloudProjectNumber: String, challengeBase64: String) throws -> Promise<String> {
    Promise.rejected(withError: DeviceIntelError("Play Integrity is Android-only"))
  }

  /// `clientDataHash = SHA256(challenge bytes)` — the contract's binding of
  /// the attestation to the server's single-use challenge.
  private static func clientDataHash(_ challengeBase64: String) throws -> Data {
    guard let challenge = Data(base64Encoded: challengeBase64), !challenge.isEmpty else {
      throw DeviceIntelError("challenge is not base64")
    }
    return Data(SHA256.hash(data: challenge))
  }
}
