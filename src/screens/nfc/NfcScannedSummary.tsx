import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import type { MrzScan } from '../../mrz/parse';

// ---------------------------------------------------------------------------
// Scanned identity card.
//
// What the MRZ scan read, shown back for confirmation — so the wrong document is
// obvious BEFORE the chip read rather than after an opaque BAC failure.
//
// NAME and DOCUMENT NUMBER only, 1:1 with the Flutter SDK's NfcScannedSummary.
// Those two are what a user actually checks against the printed page; the dates
// were noise on a screen whose job is "is this the right document, yes or no".
//
// Labels are uppercase, 10pt, 0.8 letter-spacing — the same treatment Flutter
// gives them, so the two SDKs read as one product.
// ---------------------------------------------------------------------------

export function NfcScannedSummary({ scan }: { scan: MrzScan }): React.ReactElement {
  const { colors } = useTheme();
  const name = [scan.firstName, scan.lastName].filter(Boolean).join(' ');

  const Label = ({ children }: { children: string }): React.ReactElement => (
    <MyazaText
      variant="bodySmall"
      color={colors.textMuted}
      style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.8 }}
    >
      {children.toUpperCase()}
    </MyazaText>
  );

  return (
    <View
      style={{
        padding: spacing.md,
        backgroundColor: colors.primary50,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: `${colors.primary}40`,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      {/* Optically aligned with the first line of text rather than the block's
          centre, which drifts as the name wraps. */}
      <View style={{ paddingTop: 2 }}>
        <Icon name="badge-check" size={18} color={colors.primary} />
      </View>
      <View style={{ width: spacing.sm }} />
      <View style={{ flex: 1 }}>
        {name ? (
          <View style={{ marginBottom: spacing.sm }}>
            <Label>Name</Label>
            <MyazaText variant="bodyMedium" color={colors.textDark} style={{ fontWeight: '600' }}>
              {name}
            </MyazaText>
          </View>
        ) : null}
        <View>
          <Label>Document number</Label>
          <MyazaText variant="bodyMedium" color={colors.textDark} style={{ fontWeight: '600' }}>
            {scan.documentNumber}
          </MyazaText>
        </View>
      </View>
    </View>
  );
}
