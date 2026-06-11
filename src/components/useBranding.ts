import { useKyc, useKycConfig } from './runtime';

// Resolves the org logo + company name shown in the persistent header brand.
// Mirrors the web SDK's `useBranding` and the Flutter logo-resolution logic:
//   appearance.logo === 'default' → serverConfig.branding.logo (config endpoint)
//   any other value               → literal image URL
// The header brand is gated on a logo being present (no logo → no company name).

export interface ResolvedBranding {
  logoUri: string | null;
  companyName: string;
}

export function useBranding(): ResolvedBranding {
  const config = useKycConfig();
  const branding = useKyc((s) => s.serverConfig.branding);

  const appearanceLogo = config.appearance?.logo;
  const logoUri =
    appearanceLogo === 'default'
      ? branding?.logo ?? null
      : appearanceLogo ?? null;

  const companyName = config.appearance?.companyName ?? branding?.companyName ?? 'Myaza';

  return { logoUri, companyName };
}
