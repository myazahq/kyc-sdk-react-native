import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { ID_TYPES, resolveIdTypeDefinition } from '../config/idTypes';
import { useMultiIdPlan } from '../lib/use-multi-id-plan';
import type { IdType, IdTypeDefinition } from '../types/config';
import {
  useEffectiveCountry,
  useKyc,
  useKycConfig,
  useKycStore,
  useTheme,
} from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaPulseLoader } from '../components/MyazaPulseLoader';
import { Icon, type IconName } from '../components/Icon';

// ID-type picker — 1:1 with the Flutter SDK's IdTypeScreen: a list of cards
// (icon tile + label + forward chevron) that ADVANCE ON TAP.
//
// No Continue button and no radio, matching Flutter and the web SDK. It is a
// single-select list with nothing else on the step to confirm, so Continue only
// restated a decision already made; and country-select already advances on tap,
// so a second list that behaved differently taught users one rule then broke
// it. A mis-tap costs one Back. The affordance is therefore a "go to the next
// step" chevron — a radio would imply a select-then-confirm this flow does not
// have.
//
// The advance reads the TAPPED value through the store, never the
// `selectedIdType` bound at render: that closure is a step behind inside the
// handler (and empty on the first selection), which would route a document ID
// to the number-only step. Going through `store.getState()` is what makes the
// write visible to `nextStep()`, since zustand commits synchronously.

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
  const country = useEffectiveCountry();
  const store = useKycStore();
  const serverConfig = useKyc((s) => s.serverConfig);
  const selectedIdType = useKyc((s) => s.selectedIdType);
  // Multi-ID: this picker is for ONE check of several. It may only offer picks
  // that leave every later check something to offer — the server validates the
  // same rule, so an unsafe pick would be a submission it rejects.
  const plan = useMultiIdPlan();

  // Select AND advance in one tap. Both go through the store so `nextStep`
  // routes off the value just written — a document ID to document-capture, a
  // number-only ID to id-input.
  const pick = (key: IdType): void => {
    store.getState().setIdType(key);
    store.getState().nextStep();
  };

  const available = useMemo<IdTypeDefinition[]>(() => {
    // In a multi-region flow the PICKED country's own `idTypes` narrow the
    // list; otherwise the top-level prop applies. Absent or empty means every
    // granted type, which is the server's own "unset = all" semantic.
    const perCountry = (config.countries ?? []).find(
      (e) => e.country.toUpperCase() === country.toUpperCase(),
    )?.idTypes;
    const keys = (perCountry?.length ? perCountry : config.idTypes) as
      | readonly string[]
      | undefined;
    const allowed = (key: string): boolean => !keys?.length || keys.includes(key);

    // Built from the SERVER rows, not the curated table. The curated table only
    // knows the five gov-DB countries; a Global-Documents flow offers ~240, and
    // filtering against the table rendered an empty list — "no ID types are
    // enabled" — for every country outside it. The row carries the label and
    // capture shape, so an uncurated country renders correctly from it.
    if (serverConfig.status === 'ready') {
      return serverConfig.idTypes
        .filter((row) => row.country === country && allowed(row.idType))
        .map((row) =>
          resolveIdTypeDefinition(country, row.idType, {
            label: row.label,
            requiresDocumentCapture: row.requiresDocumentCapture,
            scanSides: row.scanSides,
            supportsNfc: row.supportsNfc,
          }),
        );
    }
    if (serverConfig.status === 'loading') return [];
    // Config failed to load: fall back to the curated list. The server still
    // rejects anything actually disabled, so this is permissive, not unsafe.
    const table = ID_TYPES as Record<string, readonly IdTypeDefinition[] | undefined>;
    return (table[country.toUpperCase()] ?? []).filter((t) => allowed(t.key));
  }, [country, config.idTypes, config.countries, serverConfig]);

  // Document Intelligence off ⇒ number-only IDs only (there is no document
  // capture step), so drop every document-scanned ID from the picker. This is
  // what makes the disabled step actually disappear from the live flow rather
  // than still offering passports and licences that then have nowhere to be
  // captured. Mirrors the web SDK's IdTypeStep.
  const visible = useMemo<IdTypeDefinition[]>(() => {
    const base =
      config.enableDocumentCapture === false
        ? available.filter((t) => !t.requiresDocumentCapture)
        : available;
    // Multi-ID: only the picks that are still free AND leave every later check
    // an option. An ID already used earlier in the run is simply not offered.
    return plan ? base.filter((t) => plan.safeOptions.includes(t.key)) : base;
  }, [available, config.enableDocumentCapture, plan]);

  if (serverConfig.status === 'loading') {
    return (
      <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
        <MyazaPulseLoader />
      </View>
    );
  }

  if (serverConfig.status === 'ready' && visible.length === 0) {
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
      {visible.map((t) => {
        const selected = selectedIdType === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => pick(t.key)}
            accessibilityRole="button"
            accessibilityLabel={t.label}
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
            {/* Forward chevron, not a radio: the tap advances, so the icon has
                to promise the next step rather than a pending confirmation. */}
            <Icon
              name="chevron-right"
              size={20}
              color={selected ? colors.primary : colors.gray400}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
