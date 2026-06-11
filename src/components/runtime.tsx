import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { createKycStore, type KycState, type KycStore } from '../store/kycStore';
import { resolveColors, type MyazaColorScheme, type ThemeMode } from '../config/theme';
import type { MyazaKYCConfig } from '../types/config';
import { useMyazaFonts } from './fonts';

// ---------------------------------------------------------------------------
// Runtime context — owns the per-instance zustand store + theme mode. Mirrors
// the Flutter SDK's ProviderScope + theme provider wiring.
// ---------------------------------------------------------------------------

interface ThemeValue {
  mode: ThemeMode;
  colors: MyazaColorScheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  /** True once Space Grotesk + Karla are loaded (system font until then). */
  fontsLoaded: boolean;
}

interface RuntimeValue {
  store: KycStore;
  config: MyazaKYCConfig;
  theme: ThemeValue;
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
  children,
}: {
  config: MyazaKYCConfig;
  children: React.ReactNode;
}): React.ReactElement {
  // The store is created once per provider instance (per modal launch).
  const storeRef = useRef<KycStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createKycStore(config);
  }
  const store = storeRef.current;

  const [mode, setMode] = useState<ThemeMode>(config.appearance?.theme ?? 'light');
  const colors = useMemo(() => resolveColors(mode, config.appearance), [mode, config.appearance]);
  const fontsLoaded = useMyazaFonts();

  const value = useMemo<RuntimeValue>(
    () => ({
      store,
      config,
      theme: {
        mode,
        colors,
        setMode,
        toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
        fontsLoaded,
      },
    }),
    [store, config, mode, colors, fontsLoaded],
  );

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

/** Selects from the KYC store (re-renders only on selected-slice changes). */
export function useKyc<T>(selector: (state: KycState) => T): T {
  return useStore(useRuntime().store, selector);
}

/** Returns the raw store (for actions / one-off reads). */
export function useKycStore(): KycStore {
  return useRuntime().store;
}

/** The resolved SDK config (props + callbacks) for this launch. */
export function useKycConfig(): MyazaKYCConfig {
  return useRuntime().config;
}

/** Theme colors + light/dark mode controls. */
export function useTheme(): ThemeValue {
  return useRuntime().theme;
}
