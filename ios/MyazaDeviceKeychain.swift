import Foundation
import Security

// ---------------------------------------------------------------------------
// The two Keychain items Device Intelligence keeps (kyc-core
// docs/DEVICE_INTEL_WIRE.md):
//
//   • `device-stable-id` — a random UUID, the iOS half of `fingerprint.stableId`.
//   • `app-attest-key-id` — the one App Attest key this install uses.
//
// Both are generic passwords under service `co.myazahq.kyc`, accessible
// AfterFirstUnlockThisDeviceOnly and NOT synchronizable: the point of the
// stable id is to recognise THIS handset across a reinstall (Keychain items
// survive an uninstall), and an iCloud-synced copy would make a user's new
// phone look like their old one.
// ---------------------------------------------------------------------------

enum MyazaDeviceKeychain {
  static let service = "co.myazahq.kyc"
  static let stableIdAccount = "device-stable-id"
  static let appAttestAccount = "app-attest-key-id"

  /// The stored string, or nil when absent or unreadable.
  static func read(_ account: String) -> String? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
          let data = item as? Data,
          let value = String(data: data, encoding: .utf8),
          !value.isEmpty
    else { return nil }
    return value
  }

  /// Store (or replace) a value. Returns false when the Keychain refused.
  @discardableResult
  static func write(_ account: String, _ value: String) -> Bool {
    let base: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
    ]
    let data = Data(value.utf8)
    let update: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    ]
    let status = SecItemUpdate(base as CFDictionary, update as CFDictionary)
    if status == errSecSuccess { return true }
    guard status == errSecItemNotFound else { return false }
    var add = base
    add.merge(update) { _, new in new }
    return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
  }

  /// The stable id, created on first use. Empty when the Keychain is not
  /// available (before first unlock, or a broken entitlement): an empty
  /// string is the "omit it" value the TypeScript side checks for.
  static func stableId() -> String {
    if let existing = read(stableIdAccount) { return existing }
    let fresh = UUID().uuidString.lowercased()
    // Only hand out an id we managed to keep. A UUID returned but not stored
    // would differ on the next submission, which is worse than no id: it reads
    // as a second device.
    return write(stableIdAccount, fresh) ? fresh : ""
  }
}
