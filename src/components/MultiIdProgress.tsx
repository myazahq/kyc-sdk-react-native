import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { resolveIdTypeDefinition } from '../config/idTypes';
import type { MultiIdPlan } from '../lib/multi-id';
import type { MultiIdSlot } from '../store/state';
import { useEffectiveCountry, useKyc, useTheme } from './runtime';
import { MyazaText } from './Typography';
import { Icon } from './Icon';

// The multi-ID run's position strip: one chip per check, filling in with the
// picked ID's name as each check commits, the current one highlighted.
//
// A PORT of the web SDK's MultiIdProgress. Rendered above the picker, the
// evidence steps and liveness so a reader always knows which of the run's IDs
// the screen is about and how many remain — without it a three-ID run is three
// visits to the same-looking screen with nothing saying which is which.

export function MultiIdProgress({ plan }: { plan: MultiIdPlan }): React.ReactElement {
  const { colors } = useTheme();
  const country = useEffectiveCountry();
  const serverConfig = useKyc((s) => s.serverConfig);
  const slots: MultiIdSlot[] = useKyc((s) => s.multiIdSlots);

  const labelFor = (idType: string): string => {
    const row = serverConfig.idTypes.find(
      (r) => r.country === country && r.idType === idType,
    );
    return resolveIdTypeDefinition(country, idType, {
      label: row?.label,
      requiresDocumentCapture: row?.requiresDocumentCapture,
      scanSides: row?.scanSides,
      supportsNfc: row?.supportsNfc,
    }).label;
  };

  return (
    <View
      accessibilityLabel={`ID ${Math.min(plan.index + 1, plan.count)} of ${plan.count}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.backgroundSecondary,
      }}
    >
      {Array.from({ length: plan.count }, (_, i) => {
        const committed = slots[i];
        const active = i === plan.index;
        return (
          <View
            key={i}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}
          >
            {i > 0 && (
              <View
                style={{
                  height: 1,
                  width: 16,
                  backgroundColor: committed || active ? colors.primary : colors.border,
                  opacity: committed || active ? 0.5 : 1,
                }}
              />
            )}
            <View
              style={{
                height: 20,
                width: 20,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: committed ? colors.primary : 'transparent',
                borderWidth: committed ? 0 : active ? 2 : 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              {committed ? (
                <Icon name="check" size={12} color={colors.onPrimary} />
              ) : (
                <MyazaText
                  variant="bodySmall"
                  color={active ? colors.primary : colors.textMuted}
                >
                  {String(i + 1)}
                </MyazaText>
              )}
            </View>
            <MyazaText
              variant="bodySmall"
              color={active ? colors.textDark : colors.textMuted}
              numberOfLines={1}
            >
              {committed ? labelFor(committed.idType) : `ID ${i + 1}`}
            </MyazaText>
          </View>
        );
      })}
    </View>
  );
}
