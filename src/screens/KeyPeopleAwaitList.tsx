import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { AwaitCard } from './KeyPeopleAwaitCard';
import { StaggerIn } from '../components/StaggerIn';
import type { AwaitingPersonPayload } from '../services/api-types';

// ---------------------------------------------------------------------------
// "Awaiting users" — the KYB success screen's people section, rendered from
// the SERVER's reconciled list (mirrors the web SDK's KeyPeopleAwaitList).
// Registry discovery can add people the applicant never listed, so the rows
// here come from the session summary once it settles — never from what was
// typed. Statuses stay live: the people named go and verify after this screen
// is first shown.
// ---------------------------------------------------------------------------

export interface AwaitRow {
  name: string;
  role: string;
  pct: string | null;
  country: string | null;
  status: AwaitingPersonPayload['status'];
  inviteUrl?: string;
  isApplicant?: boolean;
  /** A company on the list completes a KYB application, not a KYC. It gets a
   *  Company tag and its pending pill reads "KYB PENDING". */
  isCorporate?: boolean;
}

/** Ownership as the list renders it: a whole number where that is honest. */
function formatPct(pct: number | null): string | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '');
}

/** Server payload → display rows. */
export function rowsFromServer(people: AwaitingPersonPayload[]): AwaitRow[] {
  return people.map((p) => ({
    name: p.name,
    role: p.role,
    pct: formatPct(p.ownershipPct),
    country: p.country,
    status: p.status,
    ...(p.inviteUrl ? { inviteUrl: p.inviteUrl } : {}),
    isApplicant: p.isApplicant,
    isCorporate: p.isCorporate ?? false,
  }));
}

const SECTIONS: Array<{ role: string; label: string }> = [
  { role: 'beneficial_owner', label: 'UBOS' },
  { role: 'director', label: 'DIRECTORS' },
  { role: 'signatory', label: 'SIGNATORIES' },
  { role: 'shareholder', label: 'SHAREHOLDERS' },
  { role: 'authorized_representative', label: 'REPRESENTATIVES' },
];
const KNOWN_ROLES = new Set(SECTIONS.map((s) => s.role));

export function KeyPeopleAwaitList({ rows }: { rows: AwaitRow[] }): React.ReactElement | null {
  const { colors } = useTheme();
  if (rows.length === 0) return null;

  // Anything whose role we have no section for still has to appear — quietly
  // dropping people from a "who still owes a check" list is the worst failure
  // it could have.
  const groups = SECTIONS.map(({ role, label }) => ({
    label,
    rows: rows.filter((r) => r.role === role),
  })).filter((g) => g.rows.length > 0);
  const others = rows.filter((r) => !KNOWN_ROLES.has(r.role));
  if (others.length > 0) groups.push({ label: 'OTHER PEOPLE', rows: others });

  const outstanding = rows.filter((r) => r.status === 'pending' || r.status === 'failed').length;

  // Entrance stagger, mirroring the web SDK: cards rise in reading order,
  // ~45ms apart, capped so a long roster is not a slow reveal. Together with
  // the skeleton this list replaces (drawn at the same geometry), the
  // hand-off reads as the ghost roster resolving into the real one.
  let entranceIndex = 0;

  return (
    <View style={{ width: '100%', marginTop: spacing.lg }}>
      <MyazaText
        variant="bodySmall"
        color={colors.textMuted}
        style={{ textAlign: 'center', marginBottom: spacing.md }}
      >
        {outstanding === 0
          ? 'Everyone on this application has completed their identity check.'
          : 'To complete the review, the people below must verify their identity with a KYC check. Anyone with an email on file has already been sent their link.'}
      </MyazaText>

      {groups.map((group) => (
        <View key={group.label} style={{ marginBottom: spacing.sm }}>
          <MyazaText
            variant="bodySmall"
            color={colors.textMuted}
            style={{ fontWeight: '600', letterSpacing: 1.2, marginBottom: spacing.xs + 2 }}
          >
            {group.label}
          </MyazaText>
          {group.rows.map((row, i) => (
            <StaggerIn key={`${group.label}-${i}`} delayMs={Math.min(entranceIndex++, 8) * 45}>
              <AwaitCard row={row} />
            </StaggerIn>
          ))}
        </View>
      ))}

      {outstanding > 0 ? (
        <MyazaText
          variant="bodySmall"
          color={colors.textMuted}
          // Clear air below: this caption is the list's last element and the
          // Done button renders immediately after it in the parent.
          style={{ textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg }}
        >
          Links are valid for 14 days.
        </MyazaText>
      ) : null}
    </View>
  );
}
