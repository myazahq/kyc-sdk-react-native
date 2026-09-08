import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaPulseLoader } from '../components/MyazaPulseLoader';

// ─── The one loading screen ─────────────────────────────────────────────────
//
// Every wait after the capture renders THIS, with copy from
// lib/result-copy.ts: the selfie upload, the submission and (on a flow that
// waits for its verdict) the status poll all show one loader under one title.
// Three screens with three sentences read as three things going wrong; one
// screen reads as the check running. A retry in flight swaps only the
// description, in the warning colour.

export function SubmittedWaiting({
  title,
  description,
  retrying = false,
}: {
  title: string;
  description: string;
  retrying?: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl }}>
      <MyazaPulseLoader />
      <View style={{ height: spacing.lg }} />
      <MyazaText variant="heading3" style={{ textAlign: 'center' }}>
        {title}
      </MyazaText>
      <View style={{ height: spacing.sm }} />
      <MyazaText
        variant="bodyMedium"
        color={retrying ? colors.warning : undefined}
        style={{ textAlign: 'center', paddingHorizontal: spacing.lg }}
      >
        {description}
      </MyazaText>
    </View>
  );
}
