import React from 'react';
import { Linking, Pressable, View } from 'react-native';

import { PRODUCT_URL, brandMarkColor } from '../config/brand';
import { spacing } from '../config/theme';
import { MyazaWordmark } from './MyazaWordmark';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';

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
 */
export function PoweredBy({ bottomInset = 0 }: { bottomInset?: number }): React.ReactElement {
  const { colors } = useTheme();
  // ONE Myaza tone for the whole mark — label, wordmark lettering, rule and
  // TRUST — picked against the background it will actually sit on rather than
  // taken from the org's palette. `colors.background` already reflects an org
  // override, so this holds for a custom background too, not just light/dark.
  const markColor = brandMarkColor(colors.background);

  return (
    <View
      style={{
        paddingTop: spacing.md,
        // Symmetric with the top. It was `lg`, which read as a heavy band on the
        // one screen where vertical space is contested — the searchable country
        // list, where the footer costs a visible row. The home-indicator inset
        // rides on top, so notched devices still clear it comfortably.
        paddingBottom: spacing.md + bottomInset,
        alignItems: 'center',
      }}
    >
      {/* openURL can reject (no browser / a locked-down device). The mark itself
          is the point, so a failed open is swallowed rather than surfaced. */}
      <Pressable
        onPress={() => {
          void Linking.openURL(PRODUCT_URL).catch(() => undefined);
        }}
        accessibilityRole="link"
        accessibilityLabel="Powered by Myaza Trust"
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: 0.9 }}
      >
        {/* Small and muted on purpose — "Powered by" is connective tissue, not
            the message. The BRAND carries the weight. */}
        <MyazaText variant="body" color={markColor} style={{ flexShrink: 1, fontSize: 12 }}>
          Powered by
        </MyazaText>

        {/* The lockup, spaced TIGHTER than the gap before it so it reads as one
            mark rather than three evenly-spaced items. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <MyazaWordmark height={28} wordmark={markColor} />

          <View style={{ width: 1, height: 24, backgroundColor: markColor, opacity: 0.35 }} />

          {/* ~half the wordmark's height — the ratio the dashboard lockup uses. */}
          {/* Pinned to the brand face rather than inheriting: this word is part
              of the MARK, and the font an org sets in their workflow would
              otherwise redraw someone else's logo in the customer's typeface.
              Matches the web's BRAND_FONT_STACK on the same element. */}
          <MyazaText
            brandMark
            variant="body"
            color={markColor}
            style={{ flexShrink: 1, fontSize: 14, fontWeight: '600', letterSpacing: 2 }}
          >
            TRUST
          </MyazaText>
        </View>
      </Pressable>
    </View>
  );
}
