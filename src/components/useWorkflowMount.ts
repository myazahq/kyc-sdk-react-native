import { useCallback, useEffect, useRef, useState } from 'react';

import { KYCError } from '../types/verification';
import type { MyazaKYCConfig, ResolvedKYCConfig } from '../types/config';
import type { ServerConfigState } from '../store/serverConfig';
import { requireCountry, resolveWorkflow } from '../services/workflowGate';

// ---------------------------------------------------------------------------
// Resolving a workflow, separated from anything that draws.
//
// This used to live inside the gate, which lived inside the modal — so opening
// the SDK presented a modal FIRST and resolved afterwards. That ordering is
// visible: the modal, its chrome and its loader all had to be painted before
// the workflow's appearance was known, so they came up in the default brand and
// then changed colour underneath the user. A flash of the wrong brand is worse
// than a moment of nothing, because it looks like someone else's product.
//
// Hoisting resolution out here lets the caller wait for a settled config and
// present a modal that is correctly branded on its first frame.
//
// It also PREFETCHES: resolution starts when the SDK mounts, not when the
// button is tapped, so by tap time the answer is usually already in hand. That
// matters — gating the modal without prefetching would just trade a wrong
// colour for a dead press, which reads as a broken button.
// ---------------------------------------------------------------------------

export interface ResolvedMount {
  config: ResolvedKYCConfig;
  /** Preloaded server config when a workflow supplied one; else undefined. */
  serverConfig?: ServerConfigState;
}

export type MountState =
  | { status: 'resolving' }
  | { status: 'ready'; mount: ResolvedMount }
  | { status: 'error'; error: KYCError };

export interface WorkflowMount {
  state: MountState;
  /** Re-run a failed resolution. */
  retry: () => void;
  /**
   * Re-fetch before opening, so a flow edited since the app started is picked
   * up.
   *
   * The prefetch below is a warm-up, NOT a cache: resolving once at mount and
   * reusing it meant an org could publish a change, reopen the SDK, and still
   * get the config fetched when the app launched — with nothing to indicate the
   * screen was stale. A workflow is edited far more often than an app is
   * relaunched, so freshness has to win over saving one request.
   */
  refresh: () => void;
}

/** Synchronous settle for a props-only mount — no network, no barrier. */
export function settleWithoutWorkflow(config: MyazaKYCConfig): MountState {
  try {
    return { status: 'ready', mount: { config: requireCountry(config) } };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof KYCError ? err : new KYCError('unknown', String(err)),
    };
  }
}

export function useWorkflowMount(config: MyazaKYCConfig): WorkflowMount {
  // A props-only mount settles synchronously, so the common case never reports
  // `resolving` for even one frame and the modal opens with no added latency.
  const initial = useRef<MountState | null>(null);
  if (initial.current === null) {
    initial.current = config.workflowId ? { status: 'resolving' } : settleWithoutWorkflow(config);
  }
  const [state, setState] = useState<MountState>(initial.current);
  const [attempt, setAttempt] = useState(0);

  // Consumers spread props into a fresh object every render, so depending on
  // `config` itself would abort and restart resolution on each of the
  // consumer's re-renders — a loop that never settles. What resolution actually
  // depends on is the key, the host and the workflow id; the rest is read from
  // the ref at call time.
  const configRef = useRef(config);
  configRef.current = config;
  const { workflowId, apiKey, devUrl } = config;

  useEffect(() => {
    if (!workflowId) return;
    const controller = new AbortController();
    let live = true;
    setState({ status: 'resolving' });

    resolveWorkflow(configRef.current, controller.signal)
      .then((result) => {
        if (!live) return;
        setState({ status: 'ready', mount: result });
      })
      .catch((err: unknown) => {
        // An abort is this component going away, not a failure to report.
        if (!live || controller.signal.aborted) return;
        setState({
          status: 'error',
          error: err instanceof KYCError ? err : new KYCError('unknown', String(err)),
        });
      });

    return () => {
      live = false;
      controller.abort();
    };
    // `attempt` re-runs this on Retry.
  }, [workflowId, apiKey, devUrl, attempt]);

  const bump = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, retry: bump, refresh: bump };
}
