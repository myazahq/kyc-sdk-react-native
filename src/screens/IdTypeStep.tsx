import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { ID_TYPES } from '../config/idTypes';
import type { IdType, IdTypeDefinition } from '../types/config';
import { useKyc, useKycConfig, useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaButton } from '../components/MyazaButton';
import { MyazaPulseLoader } from '../components/MyazaPulseLoader';
import { Icon, type IconName } from '../components/Icon';

// ID-type picker — 1:1 with the Flutter SDK's IdTypeScreen: a list of cards
// (icon tile + label + radio circle), select-on-tap, Continue to advance.

const ICON_FOR: Record<string, IconName> = {
  bvn: 'landmark', // Bank Verification Number → bank/landmark
  nin: 'fingerprint',
  vnin: 'fingerprint',
  passport: 'passport',
  'drivers-license': 'id-card',
  pvc: 'contact', // Permanent Voter's Card
  'ghana-card': 'id-card',
  voters: 'contact',
  ssnit: 'id-card',
  'national-id': 'id-card',
  cni: 'id-card',
  'residence-card': 'id-card',
};

export function IdTypeStep(): React.ReactElement {
  const { colors } = useTheme();
  const config = useKycConfig();
  const serverConfig = useKyc((s) => s.serverConfig);
  const selectedIdType = useKyc((s) => s.selectedIdType);
  const setIdType = useKyc((s) => s.setIdType);
  const nextStep = useKyc((s) => s.nextStep);

  const available = useMemo<IdTypeDefinition[]>(() => {
    const allForCountry = ID_TYPES[config.country] ?? [];
    const requested = config.idTypes?.length
      ? allForCountry.filter((t) => (config.idTypes as IdType[]).includes(t.key))
      : [...allForCountry];
    if (serverConfig.status === 'ready') {
      const granted = new Set(
        serverConfig.idTypes.filter((t) => t.country === config.country).map((t) => t.idType),
      );
      return requested.filter((t) => granted.has(t.key));
    }
    if (serverConfig.status === 'loading') return [];
    return requested;
  }, [config.country, config.idTypes, serverConfig]);

  if (serverConfig.status === 'loading') {
    return (
      <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
        <MyazaPulseLoader />
      </View>
    );
  }

  if (serverConfig.status === 'ready' && available.length === 0) {
    return (
      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.errorBg,
          borderWidth: 1,
          borderColor: `${colors.error}4D`,
        }}
      >
        <MyazaText variant="bodyMedium" color={colors.error}>
          No ID types are enabled for your organization. Contact your administrator to request access.
        </MyazaText>
      </View>
    );
  }

  return (
    <View>
      {available.map((t) => {
        const selected = selectedIdType === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => setIdType(t.key)}
            style={{
              marginBottom: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: selected ? colors.primary50 : colors.background,
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected ? colors.primary : colors.border,
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: colors.textDark,
              shadowOpacity: 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.sm,
                backgroundColor: selected ? colors.primary100 : colors.primary50,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={ICON_FOR[t.key] ?? 'credit-card'} size={22} color={selected ? colors.primary : colors.textSecondary} />
            </View>
            <View style={{ width: spacing.md }} />
            <MyazaText variant="label" style={{ flex: 1, fontWeight: '600' }}>
              {t.label}
            </MyazaText>
            <View style={{ width: spacing.md }} />
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 1.5,
                borderColor: selected ? colors.primary : colors.gray300,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} /> : null}
            </View>
          </Pressable>
        );
      })}

      <View style={{ height: spacing.lg }} />
      <MyazaButton label="Continue" onPress={selectedIdType ? nextStep : undefined} disabled={!selectedIdType} />
    </View>
  );
}
