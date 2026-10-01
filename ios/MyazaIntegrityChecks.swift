import Foundation
import MachO
import Darwin

// ---------------------------------------------------------------------------
// iOS jailbreak and instrumentation heuristics for `fingerprint.integrity`
// (kyc-core docs/DEVICE_INTEL_WIRE.md). Each check returns a contract token
// when it FIRES; the TypeScript side sorts tokens into rooted / hooked.
//
// Heuristics, not proof: a determined attacker hides from every one of these,
// which is why the server treats a positive as evidence and a negative as
// nothing. None of them prompts, needs a permission, or changes Info.plist.
//
// `cydia_scheme` is deliberately NOT checked: `canOpenURL("cydia://")` answers
// false for every scheme missing from the host app's LSApplicationQueriesSchemes,
// so without an Info.plist change it can only ever say "no".
// ---------------------------------------------------------------------------

enum MyazaIntegrityChecks {
  /// Files a stock iOS install does not have. `/var/jb` is the rootless
  /// jailbreaks' (Dopamine, palera1n) prefix.
  private static let jailbreakPaths = [
    "/Applications/Cydia.app", "/Applications/Sileo.app", "/Applications/Zebra.app",
    "/Library/MobileSubstrate/MobileSubstrate.dylib", "/usr/libexec/cydia",
    "/usr/sbin/sshd", "/usr/bin/ssh", "/bin/bash", "/etc/apt",
    "/private/var/lib/apt/", "/var/jb", "/var/binpack",
  ]

  /// Loaded-image fragments of tweak injectors and hooking frameworks.
  private static let injectedImages = [
    "mobilesubstrate", "substrateloader", "libhooker", "tweakinject",
    "libsubstitute", "substitute-inserter", "sslkillswitch", "cephei",
  ]

  static func run() -> [String] {
    var signals: [String] = []
    let images = loadedImageNames()

    // The simulator shares the Mac's filesystem (/bin/bash exists there) and
    // writes outside its container freely, so the filesystem checks would fire
    // on every developer's machine. The instrumentation checks still run.
    #if !targetEnvironment(simulator)
    if jailbreakPaths.contains(where: { FileManager.default.fileExists(atPath: $0) }) {
      signals.append("jailbreak_paths")
    }
    if canWriteOutsideSandbox() { signals.append("sandbox_escape") }
    #endif

    if getenv("DYLD_INSERT_LIBRARIES") != nil
      || images.contains(where: { name in injectedImages.contains { name.contains($0) } }) {
      signals.append("dyld_injection")
    }
    if images.contains(where: { $0.contains("frida") }) || fridaPortOpen() {
      signals.append("frida")
    }
    if debuggerAttached() { signals.append("debugger") }
    return signals
  }

  private static func loadedImageNames() -> [String] {
    (0..<_dyld_image_count()).compactMap { index in
      _dyld_get_image_name(index).map { String(cString: $0).lowercased() }
    }
  }

  /// A sandboxed app cannot write to /private. Succeeding means the sandbox is
  /// gone; the file is removed straight away.
  private static func canWriteOutsideSandbox() -> Bool {
    let path = "/private/myaza-\(UUID().uuidString).txt"
    do {
      try "x".write(toFile: path, atomically: true, encoding: .utf8)
      try? FileManager.default.removeItem(atPath: path)
      return true
    } catch {
      return false
    }
  }

  /// frida-server's default port on loopback. Non-blocking connect bounded to
  /// 100 ms, so a closed port costs nothing and an open one cannot hang us.
  private static func fridaPortOpen() -> Bool {
    let fd = socket(AF_INET, SOCK_STREAM, 0)
    guard fd >= 0 else { return false }
    defer { close(fd) }
    _ = fcntl(fd, F_SETFL, fcntl(fd, F_GETFL, 0) | O_NONBLOCK)
    var addr = sockaddr_in()
    addr.sin_family = sa_family_t(AF_INET)
    addr.sin_port = in_port_t(27042).bigEndian
    addr.sin_addr.s_addr = inet_addr("127.0.0.1")
    let result = withUnsafePointer(to: &addr) {
      $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        connect(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
      }
    }
    if result == 0 { return true }
    guard errno == EINPROGRESS else { return false }
    var pfd = pollfd(fd: fd, events: Int16(POLLOUT), revents: 0)
    guard poll(&pfd, 1, 100) > 0 else { return false }
    var error: Int32 = 0
    var length = socklen_t(MemoryLayout<Int32>.size)
    getsockopt(fd, SOL_SOCKET, SO_ERROR, &error, &length)
    return error == 0
  }

  /// `P_TRACED` on our own process: a debugger (or a tracing hook) is attached.
  private static func debuggerAttached() -> Bool {
    var info = kinfo_proc()
    var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
    var size = MemoryLayout<kinfo_proc>.stride
    guard sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0) == 0 else { return false }
    return (info.kp_proc.p_flag & P_TRACED) != 0
  }
}
