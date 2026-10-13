import React, { createContext, useContext, useMemo, useRef } from 'react';
import { useStore } from 'zustand';

import { createVerificationStore, effectiveCountry, type VerificationState, type VerificationStore } from '../store/verificationStore';
import type { ResolvedVerificationConfig, SupportedCountry } from '../types/config';
import type { ServerConfigState } from '../store/serverConfig';
import { UiThemeProvider } from './theme-provider';

// ---------------------------------------------------------------------------
// Runtime context — owns the per-instance zustand store. Mirrors the Flutter
// SDK's ProviderScope wiring.
//
// Theming moved to its own provider (theme-provider.tsx) because the two have
// different lifetimes: the trigger button and the workflow-resolution barrier
// need colours BEFORE there is a resolved config to build a store from. This
// one composes it, so a resolved workflow's appearance takes over from the
// props' appearance inside the flow.
// ---------------------------------------------------------------------------

interface RuntimeValue {
  store: VerificationStore;
  config: ResolvedVerificationConfig;
}

const RuntimeContext = createContext<RuntimeValue | null>(null);

function useRuntime(): RuntimeValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) {
    throw new Error('Toden components must be rendered inside <VerificationRuntimeProvider>.');
  }
  return ctx;
}

export function VerificationRuntimeProvider({
  config,
  serverConfig,
  children,
}: {
  config: ResolvedVerificationConfig;
  /** Preloaded from a resolved workflow — skips the flow's own `/config` call. */
  serverConfig?: ServerConfigState;
  children: React.ReactNode;
}): React.ReactElement {
  // The store is created once per provider instance (per modal launch).
  const storeRef = useRef<VerificationStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createVerificationStore(config, serverConfig);
  }
  const store = storeRef.current;

  const value = useMemo<RuntimeValue>(() => ({ store, config }), [store, config]);

  return (
    <RuntimeContext.Provider value={value}>
      <UiThemeProvider appearance={config.appearance}>{children}</UiThemeProvider>
    </RuntimeContext.Provider>
  );
}

/** Selects from the KYC store (re-renders only on selected-slice changes). */
export function useFlowState<T>(selector: (state: VerificationState) => T): T {
  return useStore(useRuntime().store, selector);
}

/** Returns the raw store (for actions / one-off reads). */
export function useVerificationStore(): VerificationStore {
  return useRuntime().store;
}

/**
 * The country this session is verifying against — the one picked on a
 * multi-region flow, else the config's.
 *
 * Screens must use THIS, never `config.country`: on a multi-region flow the
 * config carries only the primary, so reading it directly offers one country's
 * IDs and validates against another's.
 */
export function useEffectiveCountry(): SupportedCountry {
  return useFlowState(effectiveCountry);
}

/** The resolved SDK config (props + callbacks) for this launch. */
export function useVerificationConfig(): ResolvedVerificationConfig {
  return useRuntime().config;
}

/** The resolved config, or null outside the provider (for components that
 *  also render before a flow exists, like the text lookup). */
export function useOptionalVerificationConfig(): ResolvedVerificationConfig | null {
  return useContext(RuntimeContext)?.config ?? null;
}

export { UiThemeProvider, useTheme, type ThemeValue } from './theme-provider';
