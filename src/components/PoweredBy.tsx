import React from 'react';
import { Linking, Pressable, View } from 'react-native';

import { PRODUCT_URL, brandMarkColor } from '../config/brand';
import { spacing } from '../config/theme';
import { MyazaWordmark } from './MyazaWordmark';
import { useKyc, useTheme } from './runtime';
import { MyazaText } from './Typography';
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
 * The lockup mirrors the dashboard's canonical treatment: [Myaza wordmark],
 * hairline rule, TRUST in tracked uppercase. The divider is a 1px VIEW, not a
 * "|" character — a typed pipe sits on the text baseline at whatever weight the
 * font gives it and reads as a separator between two names. The rule is what
 * makes it one brand: Myaza Trust.
 *
 * Kept on the camera screens too: a trust mark that disappears exactly where
 * biometrics are captured would vanish where it matters most.
 *
 * Two modes, chosen per workflow and resolved SERVER-side
 * (`branding.trustAttribution`): this lockup (the default, and what an older
 * server that sends nothing means), or the organisation's own logo with no
 * Myaza mark or link at all (CustomAttributionMark). The consent notice then
 * names Myaza Trust instead (screens/consent/legal.ts).
 */
export function PoweredBy({ bottomInset = 0 }: { bottomInset?: number }): React.ReactElement {
  const { colors, mode } = useTheme();
  // Resolved SERVER-side from the published workflow: the Myaza Trust lockup,
  // or the org's own logo in its place (lib/trust-attribution).
  const attribution = resolveTrustAttribution(
    useKyc((s) => s.serverConfig.branding?.trustAttribution),
    mode === 'dark',
  );
  // ONE Myaza tone for the whole mark — label, wordmark lettering, rule and
  // TRUST — picked against the background it will actually sit on rather than
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
      {/* The ROW is not the link — only the mark is. "Powered by" is a label,
          not a destination, so it does not carry the tap. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: 0.9 }}>
        {/* Small and muted on purpose — "Powered by" is connective tissue, not
            the message. The BRAND carries the weight. With the org's own logo
            it reads "Protected by", the web SDK's label for that mode. */}
        <MyazaText variant="body" color={markColor} style={{ flexShrink: 1, fontSize: 12 }}>
          {attribution.mode === 'custom' ? 'Protected by' : 'Powered by'}
        </MyazaText>

        {/* The lockup, spaced TIGHTER than the gap before it so it reads as one
            mark rather than three evenly-spaced items. This is the link:
            wordmark, rule and TRUST are one brand, so the whole lockup is the
            target — but nothing beyond it is.

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
            accessibilityLabel="Myaza Trust"
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
          >
            <MyazaWordmark height={24} wordmark={markColor} />

            <View style={{ width: 1, height: 20, backgroundColor: markColor, opacity: 0.35 }} />

            {/* ~half the wordmark's height — the ratio the dashboard lockup uses. */}
            {/* Pinned to the brand face rather than inheriting: this word is part
                of the MARK, and the font an org sets in their workflow would
                otherwise redraw someone else's logo in the customer's typeface.
                Matches the web's BRAND_FONT_STACK on the same element. */}
            <MyazaText
              brandMark
              variant="body"
              color={markColor}
              style={{ flexShrink: 1, fontSize: 12, fontWeight: '600', letterSpacing: 1.68 }}
            >
              TRUST
            </MyazaText>
          </Pressable>
        )}
      </View>
    </View>
  );
}
