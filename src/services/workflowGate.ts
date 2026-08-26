import { createKYCApi } from './api';
import { KYCApiError } from './api';
import { resolveBaseUrl } from './resolveUrl';
import { mergeWorkflowConfig, overlayApplicantWorkflow } from '../config/workflowMerge';
import { KYCError } from '../types/verification';
import type { MyazaKYCConfig, ResolvedKYCConfig } from '../types/config';
import type { ServerConfigState } from '../store/serverConfig';

// ---------------------------------------------------------------------------
// Resolve-before-mount.
//
// A config carrying a `workflowId` needs the published flow BEFORE anything
// renders: the flow supplies `country`, the step toggles and the appearance, so
// mounting first would show the wrong flow and then rearrange it under the user.
// One round trip also returns the org's ID-type allowlist and branding, so the
// separate `/config` call is skipped entirely.
//
// Two things the Flutter SDK's gate does NOT have and this one must:
//
//   • a TIMEOUT — its barrier is `barrierDismissible: false` with no deadline,
//     so a request that never settles (a captive-portal Wi-Fi, a dead VPN) hangs
//     the user on a spinner with no way out;
//   • CANCELLATION — closing the sheet mid-resolve leaves the request in flight
//     and its completion handler pointed at a screen that is gone.
//
// Both live here rather than in the component, so a caller cannot forget them.
// ---------------------------------------------------------------------------

/** How long to wait for a workflow before giving up. */
export const WORKFLOW_RESOLVE_TIMEOUT_MS = 15_000;

export interface WorkflowGateResult {
  config: ResolvedKYCConfig;
  /** Preloaded server config, so the flow skips its own `/config` fetch. */
  serverConfig: ServerConfigState;
}

/** Distinguishes "we gave up waiting" from "the server said no". */
export class WorkflowTimeoutError extends Error {
  constructor() {
    super('Timed out loading the verification workflow.');
    this.name = 'WorkflowTimeoutError';
    Object.setPrototypeOf(this, WorkflowTimeoutError.prototype);
  }
}

function toKycError(err: unknown): KYCError {
  if (err instanceof WorkflowTimeoutError) {
    return new KYCError(
      'network_error',
      'We could not reach the verification service. Check your connection and try again.',
    );
  }
  if (err instanceof KYCApiError) {
    return new KYCError(
      err.statusCode === 401 ? 'invalid_api_key' : 'invalid_workflow',
      err.statusCode === 401
        ? 'Invalid API key. Please contact support.'
        : 'This verification workflow could not be loaded. Please contact support.',
    );
  }
  return new KYCError('invalid_workflow', 'This verification workflow could not be loaded.');
}

/**
 * Resolve the workflow and merge it over the props.
 *
 * `signal` aborts the request — pass the caller's so an abandoned resolve stops
 * consuming the network rather than merely being ignored. Rejects with a
 * {@link KYCError}; the timeout surfaces as `network_error` because that is what
 * it is from the user's side.
 */
export async function resolveWorkflow(
  config: MyazaKYCConfig,
  signal?: AbortSignal,
): Promise<WorkflowGateResult> {
  const api = createKYCApi(resolveBaseUrl(config.apiKey, config.devUrl), config.apiKey);

  // The deadline is ours, not the platform's: React Native's fetch has no
  // default request timeout, so without this a socket that is open but silent
  // never settles.
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  signal?.addEventListener('abort', abort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, WORKFLOW_RESOLVE_TIMEOUT_MS);

  try {
    const res = await api.workflow(config.workflowId!, controller.signal);
    return {
      // KYB: the mapped applicant workflow's capture template overlays the
      // merged config (and its id is recorded for stamping) — see
      // overlayApplicantWorkflow.
      config: overlayApplicantWorkflow(
        res.applicantWorkflow,
        mergeWorkflowConfig(res.config, config as unknown as Record<string, unknown>),
      ) as unknown as ResolvedKYCConfig,
      serverConfig: {
        status: 'ready',
        idTypes: res.idTypes,
        branding: res.branding,
        geoCountry: res.geoCountry,
        environment: res.environment,
        fatal: false,
      },
    };
  } catch (err) {
    // An abort we caused by the deadline reads as a timeout; an abort the
    // caller caused is a cancellation and must propagate untranslated, so the
    // caller can tell "the user left" from "this failed".
    if (timedOut) throw toKycError(new WorkflowTimeoutError());
    if (signal?.aborted) throw err;
    throw toKycError(err);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/**
 * The config to mount with when there is no workflow to resolve.
 *
 * Without a `workflowId` the consumer must supply `country` themselves — the
 * flow cannot pick ID types, guides or endpoints without one. Failing here with
 * a named error beats the alternative, which is a flow that mounts and then
 * shows an empty ID-type list.
 */
export function requireCountry(config: MyazaKYCConfig): ResolvedKYCConfig {
  if (!config.country) {
    throw new KYCError(
      'invalid_config',
      'A `country` is required unless you pass a `workflowId`.',
    );
  }
  return config as ResolvedKYCConfig;
}
