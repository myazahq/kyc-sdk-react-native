import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import type { KycState } from '../store/state';
import { useKyc } from './runtime';
import { Icon } from './Icon';
import { MyazaText } from './Typography';

/**
 * "You are not in production" strip, shown above the sheet's header.
 *
 * A sandbox flow is pixel-identical to a live one, which is the point — you are
 * testing the real thing — and also the hazard: screenshots get mistaken for
 * production incidents, testers wonder why a real passport was rejected, and a
 * `pk_test_` key shipped to production looks like it works right up until
 * nobody is actually verified.
 *
 * Environment comes from the SERVER (`/config`), not the API key prefix. Hosted
 * sessions authenticate with an `hs_` handoff token that carries no environment
 * slot, so key-sniffing would leave exactly the surface an end user sees
 * unlabelled.
 *
 * DEVELOPMENT is labelled too, and differently: it runs the real pipeline
 * against staging provider credentials, so "test data only" would be a lie
 * there. 1:1 with the web and Flutter SDKs.
 */
/**
 * Whether the banner will render. The sheet needs this to decide who owns the
 * safe-area top inset: the banner sits ABOVE the header, so when it shows it is
 * the topmost element and must clear the status bar itself — otherwise the
 * header pads for an inset the banner already crossed, and the strip is drawn
 * under the clock on Android's edge-to-edge modals.
 */
export function useSandboxBannerVisible(): boolean {
  const environment = useKyc((s: KycState) => s.serverConfig.environment);
  return environment === 'SANDBOX' || environment === 'DEVELOPMENT';
}

export function SandboxBanner({
  topInset = 0,
}: {
  /** Safe-area top inset to absorb, when the banner is the topmost element. */
  topInset?: number;
}): React.ReactElement | null {
  const environment = useKyc((s: KycState) => s.serverConfig.environment);
  if (environment !== 'SANDBOX' && environment !== 'DEVELOPMENT') return null;

  const sandbox = environment === 'SANDBOX';

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs + 2,
        // Amber, not the brand colour: this is an out-of-band status about the
        // session, and the org's palette would read as part of their flow.
        backgroundColor: AMBER_TINT,
        paddingHorizontal: spacing.md,
        // The tint extends up through the status bar so the strip reads as one
        // band rather than floating below a bare gap.
        paddingTop: topInset + spacing.xs + 2,
        paddingBottom: spacing.xs + 2,
      }}
    >
      {/* Flask, not an alert mark: nothing is wrong — this is a statement about
          WHICH environment you are in ("test environment", "test data only").
          An alert glyph reads as a fault and sends testers hunting for one.
          Same lucide icon the web SDK uses; Flutter mirrors it with
          Icons.science_outlined. */}
      <Icon name="flask" size={13} color={AMBER_INK} />
      <MyazaText
        variant="bodySmall"
        color={AMBER_INK}
        style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}
      >
        {sandbox ? 'Sandbox' : 'Development'}
      </MyazaText>
      <MyazaText variant="bodySmall" color={AMBER_INK} style={{ fontSize: 11, flexShrink: 1 }}>
        {sandbox ? 'Test data only, no real checks run' : 'Test environment, results are not live'}
      </MyazaText>
    </View>
  );
}

// Fixed rather than themed: the strip must read identically in light and dark,
// and it deliberately does not belong to the org's palette.
const AMBER_TINT = 'rgba(245, 158, 11, 0.18)';
const AMBER_INK = '#B45309';
