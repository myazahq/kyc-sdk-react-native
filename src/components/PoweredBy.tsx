import React from 'react';
import { Linking, Pressable, View } from 'react-native';

import { PRODUCT_NAME, PRODUCT_URL, brandMarkColor, brandMarkIsLight } from '../config/brand';
import { TODEN_ACCENT, TODEN_ACCENT_ON_DARK, TodenWordmark } from './TodenWordmark';
import { useFlowState, useTheme } from './runtime';
import { UiText } from './Typography';
import { CustomAttributionMark } from './CustomAttributionMark';
import { resolveTrustAttribution } from '../lib/trust-attribution';

/**
 * Vendor attribution, pinned below the step body on every screen.
 *
 * "POWERED BY", deliberately, not "Secured by" — at this moment we are
 * COLLECTING a passport and a live selfie, not protecting something, so what the
 * user needs is provenance (a name to hold responsible) rather than an
 * unfalsifiable security promise, which is the kind of reassurance a phishing
 * screen writes.
 *
 * The mark is the Toden logo as the console draws it: the split-shield T beside
 * the "toden" lettering, one piece with nothing after it.
 *
 * Kept on the camera screens too: a trust mark that disappears exactly where
 * biometrics are captured would vanish where it matters most.
 *
 * Two modes, chosen per workflow and resolved SERVER-side
 * (`branding.trustAttribution`): the Toden logo (the default, and what an older
 * server that sends nothing means), or the organisation's own logo with no
 * Toden mark or link at all (CustomAttributionMark). The consent notice then
 * names Myaza Trust instead (screens/consent/legal.ts).
 */
export function PoweredBy({ bottomInset = 0 }: { bottomInset?: number }): React.ReactElement {
  const { colors, mode } = useTheme();
  // Resolved SERVER-side from the published workflow: the Toden logo,
  // or the org's own logo in its place (lib/trust-attribution).
  const attribution = resolveTrustAttribution(
    useFlowState((s) => s.serverConfig.branding?.trustAttribution),
    mode === 'dark',
  );
  // ONE tone for the label and the logo's ink, picked against the background it will actually sit on rather than
  // taken from the org's palette. `colors.background` already reflects an org
  // override, so this holds for a custom background too, not just light/dark.
  const markColor = brandMarkColor(colors.background);

  return (
    <View
      style={{
        paddingTop: 10,
        // Symmetric with the top. It was `lg`, which read as a heavy band on the
        // one screen where vertical space is contested — the searchable country
        // list, where the footer costs a visible row. The home-indicator inset
        // rides on top, so notched devices still clear it comfortably.
        paddingBottom: 12 + bottomInset,
        alignItems: 'center',
      }}
    >
      {/* The ROW is not the link — only the mark is. "Protected by" is a label,
          not a destination, so it does not carry the tap. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: 0.9 }}>
        {/* Small and muted on purpose: "Protected by" is connective tissue, not
            the message. The BRAND carries the weight. The same words whichever
            logo follows, as on the web and Flutter SDKs. */}
        <UiText variant="body" color={markColor} style={{ flexShrink: 1, fontSize: 12 }}>
          Protected by
        </UiText>

        {/* The logo is the link, and nothing beyond it is.

            openURL can reject (no browser / a locked-down device). The mark
            itself is the point, so a failed open is swallowed. */}
        {attribution.mode === 'custom' ? (
          <CustomAttributionMark
            logo={attribution.logo}
            companyName={attribution.companyName}
            markColor={markColor}
          />
        ) : (

          <Pressable
            onPress={() => {
              void Linking.openURL(PRODUCT_URL).catch(() => undefined);
            }}
            accessibilityRole="link"
            accessibilityLabel={PRODUCT_NAME}
            hitSlop={8}
          >
            {/* The shield's purple half steps lighter when the ink is the light
                tone, as the console's own dark logo does. */}
            <TodenWordmark
              height={20}
              ink={markColor}
              accent={brandMarkIsLight(markColor) ? TODEN_ACCENT_ON_DARK : TODEN_ACCENT}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}
