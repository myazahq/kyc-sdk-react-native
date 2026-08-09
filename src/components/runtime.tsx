import React, { createContext, useContext, useMemo, useRef } from 'react';
import { useStore } from 'zustand';

import { createKycStore, effectiveCountry, type KycState, type KycStore } from '../store/kycStore';
import type { ResolvedKYCConfig, SupportedCountry } from '../types/config';
import type { ServerConfigState } from '../store/serverConfig';
import { MyazaThemeProvider } from './theme-provider';

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
  store: KycStore;
  config: ResolvedKYCConfig;
}

const RuntimeContext = createContext<RuntimeValue | null>(null);

function useRuntime(): RuntimeValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) {
    throw new Error('Myaza KYC components must be rendered inside <KycRuntimeProvider>.');
  }
  return ctx;
}

export function KycRuntimeProvider({
  config,
  serverConfig,
  children,
}: {
  config: ResolvedKYCConfig;
  /** Preloaded from a resolved workflow — skips the flow's own `/config` call. */
  serverConfig?: ServerConfigState;
  children: React.ReactNode;
}): React.ReactElement {
  // The store is created once per provider instance (per modal launch).
  const storeRef = useRef<KycStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createKycStore(config, serverConfig);
  }
  const store = storeRef.current;

  const value = useMemo<RuntimeValue>(() => ({ store, config }), [store, config]);

  return (
    <RuntimeContext.Provider value={value}>
      <MyazaThemeProvider appearance={config.appearance}>{children}</MyazaThemeProvider>
    </RuntimeContext.Provider>
  );
}

/** Selects from the KYC store (re-renders only on selected-slice changes). */
export function useKyc<T>(selector: (state: KycState) => T): T {
  return useStore(useRuntime().store, selector);
}

/** Returns the raw store (for actions / one-off reads). */
export function useKycStore(): KycStore {
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
  return useKyc(effectiveCountry);
}

/** The resolved SDK config (props + callbacks) for this launch. */
export function useKycConfig(): ResolvedKYCConfig {
  return useRuntime().config;
}

export { MyazaThemeProvider, useTheme, type ThemeValue } from './theme-provider';
