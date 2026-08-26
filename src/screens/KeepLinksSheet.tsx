import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { spacing } from '../config/theme';
import { FloatingSheet } from '../components/glass/FloatingSheet';
import { Icon } from '../components/Icon';
import { MyazaAlert } from '../components/MyazaAlert';
import { MyazaButton } from '../components/MyazaButton';
import { MyazaText } from '../components/Typography';
import { useTheme } from '../components/runtime';

// Shown when the applicant taps Done while key people still owe a check.
//
// The invite links live on THIS success screen, and on mobile the screen dies
// with the app: once closed, the applicant has no way back to the links unless
// the org re-sends them. The session's own hosted web page is the way back —
// the same rehydrated success screen, alive for as long as the invites are —
// so the one moment to hand it over is the moment they leave.

export function KeepLinksSheet({
  open,
  url,
  onClose,
  onDone,
}: {
  open: boolean;
  url: string;
  /** Dismiss the sheet only (they are staying on the success screen). */
  onClose: () => void;
  /** Close the sheet AND the flow (they are done here). */
  onDone: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  return (
    <FloatingSheet visible={open} onClose={onClose}>
      <View style={{ padding: spacing.md, paddingTop: spacing.xs, alignItems: 'center' }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.primary50,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="globe" size={26} color={colors.primary} />
        </View>

        <View style={{ height: spacing.md }} />
        <MyazaText variant="heading3" style={{ textAlign: 'center' }}>
          Keep a way back to these links
        </MyazaText>
        <View style={{ height: spacing.md }} />
        <View style={{ width: '100%' }}>
          <MyazaAlert
            variant="warning"
            title="This screen will not be shown again"
            message="Your key people's links live on a web page made for you. Open it in your browser or copy the address somewhere safe, then check who has finished and share the links from there at any time."
          />
        </View>

        <View style={{ height: spacing.lg }} />
        <View style={{ width: '100%', gap: spacing.sm }}>
          <MyazaButton
            label="Open in my browser"
            leadingIcon="globe"
            onPress={() => void Linking.openURL(url).catch(() => undefined)}
          />
          <MyazaButton
            label={copied ? 'Link copied' : 'Copy the page link'}
            variant="outline"
            leadingIcon={copied ? 'check' : 'copy'}
            onPress={() => {
              void Clipboard.setStringAsync(url)
                .then(() => setCopied(true))
                .catch(() => undefined);
            }}
          />
          <MyazaButton label="I'm done here" variant="ghost" onPress={onDone} />
        </View>
      </View>
    </FloatingSheet>
  );
}
