import React from 'react';
import { Pressable, View } from 'react-native';

import { MyazaText } from '../components/Typography';
import { useTheme } from '../components/runtime';
import { spacing } from '../config/theme';
import type { KeyPersonRole } from '../types/business';

// The representative form's role chips — real classifications, not job titles
// (those go in the free-text position field). Multi-select over the entry's
// role SET, with the last representative hat pinned on: unticking it would
// silently drop the person from the section they are being edited in.
// Mirrors the web SDK's KeyPersonRoleChips.

const REP_ROLES: Array<{ role: KeyPersonRole; label: string }> = [
  { role: 'director', label: 'Director' },
  { role: 'signatory', label: 'Signatory' },
];

export function KeyPersonRoleChips({
  roles,
  onRoles,
}: {
  roles: KeyPersonRole[];
  onRoles: (next: KeyPersonRole[]) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const repCount = roles.filter((r) => r === 'director' || r === 'signatory').length;
  return (
    <View>
      <MyazaText variant="label" style={{ marginBottom: spacing.sm }}>
        Role
      </MyazaText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {REP_ROLES.map(({ role, label }) => {
          const active = roles.includes(role);
          return (
            <Pressable
              key={role}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (active && repCount <= 1) return;
                onRoles(active ? roles.filter((r) => r !== role) : [...roles, role]);
              }}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : 'transparent',
                paddingHorizontal: 14,
                paddingVertical: 7,
              }}
            >
              <MyazaText
                variant="bodyMedium"
                color={active ? colors.onPrimary : colors.textSecondary}
                style={{ fontWeight: '500' }}
              >
                {label}
              </MyazaText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
