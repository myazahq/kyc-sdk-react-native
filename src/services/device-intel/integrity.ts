import { deviceIntelNative, withDeadline } from './native';

// ---------------------------------------------------------------------------
// `fingerprint.integrity` — client-side root / jailbreak / hook heuristics
// (kyc-core docs/DEVICE_INTEL_WIRE.md).
//
// Native code only reports which heuristics FIRED; the sorting into `rooted`
// and `hooked` happens here, in one pure, tested function, so the two native
// sides cannot disagree about what a token means. Client-reported and soft:
// the server reads a positive as evidence and a negative as nothing.
// ---------------------------------------------------------------------------

/** Root / jailbreak tokens: the device's OS has been modified. */
export const ROOT_SIGNALS = [
  'su_binary',
  'magisk',
  'test_keys',
  'busybox',
  'root_apps',
  'writable_system',
  'jailbreak_paths',
  'cydia_scheme',
  'sandbox_escape',
] as const;

/** Instrumentation tokens: something is hooking or tracing this process. */
export const HOOK_SIGNALS = ['dyld_injection', 'frida', 'debugger'] as const;

export type IntegritySignal = (typeof ROOT_SIGNALS)[number] | (typeof HOOK_SIGNALS)[number];

export interface DeviceIntegrity {
  /** True when any root/jailbreak heuristic fired; null when none could run. */
  rooted: boolean | null;
  /** True when any instrumentation heuristic fired; null when none could run. */
  hooked: boolean | null;
  signals: IntegritySignal[];
}

const KNOWN = new Set<string>([...ROOT_SIGNALS, ...HOOK_SIGNALS]);
const ROOT = new Set<string>(ROOT_SIGNALS);
const HOOK = new Set<string>(HOOK_SIGNALS);

/** Bound on the native checks: they touch the filesystem and a loopback port. */
export const INTEGRITY_TIMEOUT_MS = 1500;

/**
 * Sort fired heuristics into the contract's shape. `null` input means the
 * checks could not run at all, which is "unknown", never "clean". Tokens
 * outside the contract are dropped (validate-and-drop): the wire vocabulary is
 * add-only and owned by the server.
 */
export function classifyIntegrity(fired: readonly string[] | null): DeviceIntegrity {
  if (fired === null) return { rooted: null, hooked: null, signals: [] };
  const signals = [...new Set(fired.filter((s) => KNOWN.has(s)))].sort() as IntegritySignal[];
  return {
    rooted: signals.some((s) => ROOT.has(s)),
    hooked: signals.some((s) => HOOK.has(s)),
    signals,
  };
}

/**
 * Run the native heuristics. Undefined when there is no native module — the
 * field is then omitted from the fingerprint rather than sent as unknowns.
 */
export async function collectIntegrity(): Promise<DeviceIntegrity | undefined> {
  const native = deviceIntelNative();
  if (!native) return undefined;
  let run: Promise<string[]>;
  try {
    run = native.integritySignals();
  } catch {
    return classifyIntegrity(null);
  }
  const fired = await withDeadline(run, INTEGRITY_TIMEOUT_MS);
  return classifyIntegrity(fired ?? null);
}
