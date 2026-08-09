import React, { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { radius, spacing } from '../config/theme';
import { useKyc, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { Icon } from '../components/Icon';
import { CountryFlag } from '../components/CountryFlag';
import { regionCountryName } from '../config/regions';
import { KEY_PERSON_ROLE_LABELS } from '../config/keyPeople';
import type { KeyPersonInvite } from '../services/api-types';
import type { ApplicantRole, KeyPersonRole } from '../types/business';

// ---------------------------------------------------------------------------
// "Awaiting users" — the KYB success screen's people section. Every person the
// review is waiting on, grouped by role, each with a status pill; pending
// people carry a shareable verification link, and the APPLICANT (who verified
// in-flow) appears with a green Submitted pill so the picture is complete.
// Mirrors the web SDK's KeyPeopleInviteLinks 1:1 — mobile shares via the
// native sheet (reaches WhatsApp/SMS, still offers Copy inside).
// ---------------------------------------------------------------------------

type AwaitRole = ApplicantRole;

interface AwaitRow {
  name: string;
  role: AwaitRole;
  pct: string | null;
  country: string | null;
  status: 'submitted' | 'pending';
  inviteUrl?: string;
  isApplicant?: boolean;
}

const ROLE_LABELS: Record<AwaitRole, string> = {
  ...KEY_PERSON_ROLE_LABELS,
  authorized_representative: 'Authorized representative',
};

const SECTIONS: Array<{ role: AwaitRole; label: string }> = [
  { role: 'beneficial_owner', label: 'UBOS' },
  { role: 'director', label: 'DIRECTORS' },
  { role: 'signatory', label: 'SIGNATORIES' },
  { role: 'shareholder', label: 'SHAREHOLDERS' },
  { role: 'authorized_representative', label: 'REPRESENTATIVES' },
];

export function KeyPeopleInviteLinks({
  invites,
}: {
  invites: KeyPersonInvite[];
}): React.ReactElement | null {
  const { colors } = useTheme();
  const app = useKyc((s) => s.businessApplication);
  if (invites.length === 0) return null;

  const rows: AwaitRow[] = [];

  // The applicant themselves — verified in-flow, nothing more to do.
  if (app.applicantRole) {
    const self =
      app.applicantKeyPersonIndex !== null ? app.keyPeople[app.applicantKeyPersonIndex] : null;
    rows.push({
      name: (self?.name ?? app.applicantName).trim() || 'You',
      role: (self?.role ?? app.applicantRole) as AwaitRole,
      pct: self?.ownershipPct.trim() || null,
      country: self?.country.trim() ? self.country.trim().toUpperCase() : null,
      status: 'submitted',
      isApplicant: true,
    });
  }

  // Everyone the server minted a link for — enriched from the entered rows.
  for (const invite of invites) {
    const entered = app.keyPeople.find((p) => p.name.trim() === invite.name.trim());
    rows.push({
      name: invite.name,
      role: (entered?.role ?? 'director') as AwaitRole,
      pct: entered?.ownershipPct.trim() || null,
      country: entered?.country.trim() ? entered.country.trim().toUpperCase() : null,
      status: 'pending',
      inviteUrl: invite.inviteUrl,
    });
  }

  return (
    <View style={{ width: '100%', marginTop: spacing.lg }}>
      <MyazaText variant="bodySmall" color={colors.textMuted} style={{ textAlign: 'center', marginBottom: spacing.md }}>
        To complete the review, the people below must verify their identity with a KYC check.
        Anyone with an email on file has already been sent their link.
      </MyazaText>

      {SECTIONS.map(({ role, label }) => {
        const group = rows.filter((r) => r.role === role);
        if (group.length === 0) return null;
        return (
          <View key={role} style={{ marginBottom: spacing.sm }}>
            <MyazaText
              variant="bodySmall"
              color={colors.textMuted}
              style={{ fontWeight: '600', letterSpacing: 1.2, marginBottom: spacing.xs + 2 }}
            >
              {label}
            </MyazaText>
            {group.map((row, i) => (
              <AwaitCard key={`${role}-${i}`} row={row} />
            ))}
          </View>
        );
      })}

      <MyazaText variant="bodySmall" color={colors.textMuted} style={{ textAlign: 'center' }}>
        Links are valid for 14 days.
      </MyazaText>
    </View>
  );
}

function AwaitCard({ row }: { row: AwaitRow }): React.ReactElement {
  const { colors } = useTheme();
  const submitted = row.status === 'submitted';
  const [copied, setCopied] = useState(false);

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
          <MyazaText variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '700' }}>
            {row.name}
            {row.isApplicant ? (
              <MyazaText variant="bodySmall" color={colors.textMuted}>
                {'  (you)'}
              </MyazaText>
            ) : null}
          </MyazaText>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
            <MyazaText variant="bodySmall" color={colors.textMuted}>
              {ROLE_LABELS[row.role]}
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
            backgroundColor: submitted ? colors.successBg : colors.primary100,
          }}
        >
          <MyazaText
            variant="bodySmall"
            color={submitted ? colors.success : colors.primary}
            style={{ fontWeight: '700', fontSize: 11, letterSpacing: 0.6 }}
          >
            {submitted ? 'SUBMITTED' : 'KYC PENDING'}
          </MyazaText>
        </View>
      </View>

      {row.status === 'pending' && row.inviteUrl ? (
        // Both actions, since it's mobile: Copy for pasting anywhere, Share
        // for the native sheet (WhatsApp/SMS directly).
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
            <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '700', marginLeft: spacing.xs + 2 }}>
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
            <MyazaText variant="bodySmall" color={colors.primary} style={{ fontWeight: '700', marginLeft: spacing.xs + 2 }}>
              Share
            </MyazaText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
