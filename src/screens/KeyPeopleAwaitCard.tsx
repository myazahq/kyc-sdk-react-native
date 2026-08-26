import React, { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { Icon } from '../components/Icon';
import { CountryFlag } from '../components/CountryFlag';
import { regionCountryName } from '../config/regions';
import { KEY_PERSON_ROLE_LABELS } from '../config/keyPeople';
import type { AwaitRow } from './KeyPeopleAwaitList';

// One person's card on the KYB "awaiting users" list — split from
// KeyPeopleAwaitList per the 200-line rule.

const ROLE_LABELS: Record<string, string> = {
  ...KEY_PERSON_ROLE_LABELS,
  authorized_representative: 'Authorized representative',
};

function statusView(
  row: AwaitRow,
  colors: ReturnType<typeof useTheme>['colors'],
): { label: string; bg: string; fg: string } {
  switch (row.status) {
    case 'verified':
      return { label: 'VERIFIED', bg: colors.successBg, fg: colors.success };
    case 'submitted':
      return { label: 'SUBMITTED', bg: colors.successBg, fg: colors.success };
    case 'failed':
      return { label: 'CHECK FAILED', bg: colors.errorBg, fg: colors.error };
    case 'not_needed':
      return { label: 'NOT NEEDED', bg: colors.border, fg: colors.textMuted };
    default:
      return {
        label: row.isCorporate ? 'KYB PENDING' : 'KYC PENDING',
        bg: colors.primary100,
        fg: colors.primary,
      };
  }
}

export function AwaitCard({ row }: { row: AwaitRow }): React.ReactElement {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const status = statusView(row, colors);

  const share = (): void => {
    if (!row.inviteUrl) return;
    Share.share({ message: row.inviteUrl }).catch(() => undefined);
  };
  const copy = (): void => {
    if (!row.inviteUrl) return;
    Clipboard.setStringAsync(row.inviteUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  return (
    <View
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0, marginRight: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MyazaText
              variant="bodyMedium"
              numberOfLines={1}
              style={{ fontWeight: '700', flexShrink: 1 }}
            >
              {row.name}
              {row.isApplicant ? (
                <MyazaText variant="bodySmall" color={colors.textMuted}>
                  {'  (you)'}
                </MyazaText>
              ) : null}
            </MyazaText>
            {row.isCorporate ? (
              // Readability over subtlety: foreground text on a bordered chip.
              // The muted-on-muted version disappeared on dark org themes.
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.xs + 4,
                  paddingVertical: 2,
                  marginLeft: spacing.xs + 2,
                }}
              >
                <Icon name="building-2" size={12} color={colors.textDark} />
                <MyazaText
                  variant="bodySmall"
                  color={colors.textDark}
                  style={{ fontSize: 12, fontWeight: '600', marginLeft: 4 }}
                >
                  Company
                </MyazaText>
              </View>
            ) : null}
          </View>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}
          >
            <MyazaText variant="bodySmall" color={colors.textMuted}>
              {ROLE_LABELS[row.role] ?? 'Key person'}
              {row.pct ? ` · ${row.pct}%` : ''}
              {row.country ? ' · ' : ''}
            </MyazaText>
            {row.country ? (
              <>
                <CountryFlag country={row.country} size={14} />
                <MyazaText variant="bodySmall" color={colors.textMuted}>
                  {` ${regionCountryName(row.country)}`}
                </MyazaText>
              </>
            ) : null}
          </View>
        </View>
        <View
          style={{
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm + 4,
            paddingVertical: spacing.xs,
            backgroundColor: status.bg,
          }}
        >
          <MyazaText
            variant="bodySmall"
            color={status.fg}
            style={{ fontWeight: '700', fontSize: 11, letterSpacing: 0.6 }}
          >
            {status.label}
          </MyazaText>
        </View>
      </View>

      {/* A failed check keeps its link — that is the retry. */}
      {row.inviteUrl ? (
        <View style={{ flexDirection: 'row', marginTop: spacing.sm + 4 }}>
          <Pressable
            onPress={copy}
            accessibilityRole="button"
            accessibilityLabel={`Copy ${row.name}'s verification link`}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary100,
              borderRadius: radius.full,
              paddingVertical: spacing.sm + 2,
              marginRight: spacing.sm,
            }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={15} color={colors.primary} />
            <MyazaText
              variant="bodySmall"
              color={colors.primary}
              style={{ fontWeight: '600', marginLeft: 6 }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </MyazaText>
          </Pressable>
          <Pressable
            onPress={share}
            accessibilityRole="button"
            accessibilityLabel={`Share ${row.name}'s verification link`}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary100,
              borderRadius: radius.full,
              paddingVertical: spacing.sm + 2,
            }}
          >
            <Icon name="share" size={15} color={colors.primary} />
            <MyazaText
              variant="bodySmall"
              color={colors.primary}
              style={{ fontWeight: '600', marginLeft: 6 }}
            >
              Share
            </MyazaText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
