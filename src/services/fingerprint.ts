import { OS } from '../utils/platform';
import {
  persistentDeviceId,
  safeLanguages,
  safeScreen,
  safeTimezone,
  platformVersion,
  expoDevice,
} from './fingerprint-sources';

// ---------------------------------------------------------------------------
// Device Intelligence — the client fingerprint.
//
// The SDK sends RAW components and never a self-computed id: the server
// canonicalises and hashes them, so a client cannot mint a fresh identity by
// posting a random hash. Everything is best-effort — a component that cannot be
// read is simply omitted, and the server scores what it gets.
//
// The components differ from the web SDK's on purpose. There is no WebGL
// renderer or canvas to hash here, but a native app can answer questions a
// browser cannot: whether it is running on real hardware rather than an
// emulator, and a per-install identifier the OS itself vends. Those are
// stronger signals than anything the browser fingerprint recovers.
//
// `deviceHash` is a RISK SIGNAL, never an identity link — phone models collide
// constantly, and merging two people because they own the same handset would
// corrupt the identity graph.
// ---------------------------------------------------------------------------

export interface FingerprintComponents {
  screen?: { width: number; height: number; scale: number; fontScale: number };
  timezone?: string;
  languages?: string[];
  platform?: string;
  osVersion?: string;
  /** Device maker + model, as the OS reports them. */
  brand?: string;
  manufacturer?: string;
  model?: string;
  /** Total RAM in bytes — the native counterpart of the web's deviceMemory. */
  totalMemory?: number;
  cpuArchitectures?: string[];
  /** OS build identifier — differs between a stock ROM and a modified one. */
  osBuildId?: string;
  /**
   * FALSE means an emulator or simulator. The single most useful signal here:
   * a real user is not verifying their identity from an Android emulator, and
   * unlike the web's headless heuristics this is a direct answer from the OS.
   */
  isPhysicalDevice?: boolean;
  /** True when the app is running from a development client / debug build. */
  isDevelopmentBuild?: boolean;
}

export interface ClientFingerprint {
  /**
   * Per-install identifier vended by the OS — `identifierForVendor` on iOS,
   * `ANDROID_ID` on Android. Preferred over a self-generated UUID in storage:
   * it survives app data being cleared on iOS, needs no storage dependency, and
   * cannot be spoofed from JavaScript. Resets on uninstall, which is correct —
   * it identifies an install, not a person.
   */
  deviceId?: string;
  components: FingerprintComponents;
}

/**
 * Collect the fingerprint.
 *
 * Async only because iOS's vendor id is; everything else is synchronous. It is
 * called once at submit and must never throw — a fingerprint that fails to
 * collect is a missing signal, not a failed verification.
 */
export async function collectFingerprint(): Promise<ClientFingerprint> {
  const device = expoDevice();

  const components: FingerprintComponents = {
    screen: safeScreen(),
    timezone: safeTimezone(),
    languages: safeLanguages(),
    platform: OS,
    osVersion: device?.osVersion ?? platformVersion(),
    brand: device?.brand ?? undefined,
    manufacturer: device?.manufacturer ?? undefined,
    model: device?.modelName ?? undefined,
    totalMemory: device?.totalMemory ?? undefined,
    cpuArchitectures: device?.supportedCpuArchitectures ?? undefined,
    osBuildId: device?.osBuildId ?? undefined,
    isPhysicalDevice: device?.isDevice,
    isDevelopmentBuild: typeof __DEV__ === 'boolean' ? __DEV__ : undefined,
  };

  return {
    deviceId: await persistentDeviceId(),
    // Undefined entries are stripped so the server canonicalises the same shape
    // whether a module was missing or a value was genuinely absent.
    components: Object.fromEntries(
      Object.entries(components).filter(([, v]) => v !== undefined),
    ) as FingerprintComponents,
  };
}
