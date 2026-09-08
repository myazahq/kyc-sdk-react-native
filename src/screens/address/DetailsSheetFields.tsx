import React from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { CountryFlag } from '../../components/CountryFlag';
import { MyazaText } from '../../components/Typography';
import { MyazaInput } from '../../components/MyazaInput';
import type { AddressFieldMode } from '../../lib/address-field-modes';

// The edit-details form primitives (200-line split from DetailsSheet).
// Mirrors the web SDK's DetailsSheetFields; keep the two in lockstep.

/** undefined = never touched (the map's prefill shows); '' = cleared. The
 *  distinction is what lets an applicant DELETE a wrong prefill without the
 *  field refilling itself under their cursor. */
export interface DetailValues {
  propertyNumber: string;
  street?: string;
  unit?: string;
  propertyName: string;
  directions: string;
  neighbourhood?: string;
  city?: string;
  state?: string;
  postcode?: string;
}

export type DetailPatch = Partial<DetailValues>;

export function EditField({
  label,
  value,
  placeholder,
  maxLength,
  disabled,
  multiline,
  required,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  disabled?: boolean;
  multiline?: boolean;
  /** Workflow-required (addressCollection.fields): marked, and the pin
   *  step's Continue holds until it is filled. */
  required?: boolean;
  onChange: (value: string) => void;
}): React.ReactElement {
  return (
    <MyazaInput
      value={value}
      onChangeText={onChange}
      label={label}
      required={required}
      placeholder={placeholder}
      maxLength={maxLength}
      multiline={multiline}
      editable={!disabled}
    />
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <MyazaText
      variant="bodySmall"
      color={colors.textSecondary}
      style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11, marginBottom: spacing.sm }}
    >
      {children}
    </MyazaText>
  );
}

/** Read-only country row: the flow's country is a fact of the verification,
 *  not an address field — visually distinct from a disabled input. */
export function CountryRow({ country }: { country: string | null }): React.ReactElement | null {
  const { colors } = useTheme();
  if (!country) return null;
  let name = country;
  try {
    name = new Intl.DisplayNames(['en'], { type: 'region' }).of(country) ?? country;
  } catch {
    // The ISO code stands in where DisplayNames is unavailable.
  }
  return (
    <View>
      {/* The SAME label treatment MyazaInput gives its own fields (web: one
          `text-sm font-medium` for both), so the tile's box lines up with the
          input beside it and the two labels read as one row. */}
      <MyazaText variant="label" style={{ marginBottom: spacing.sm }}>
        Country
      </MyazaText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs + 2,
          height: 48,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.backgroundSecondary,
          paddingHorizontal: spacing.sm + 4,
        }}
      >
        <CountryFlag country={country} size={20} />
        <MyazaText variant="bodyMedium" style={{ fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
          {name}
        </MyazaText>
      </View>
      <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 4 }}>
        From your verification
      </MyazaText>
    </View>
  );
}

// TOP-aligned, so the two columns' labels and boxes sit on one line. Bottom
// alignment pushed the country tile up by the height of its own caption, since
// it is the taller of the pair (web has no such problem: its grid stretches).
const twoCol = { flexDirection: 'row' as const, gap: spacing.sm, alignItems: 'flex-start' as const };
const col = { flex: 1, minWidth: 0 };

/** The "Area and region" section. Each field honours its workflow mode:
 *  'off' hides it, 'required' marks it. Returns null when all four are off. */
export function AreaFields({
  modes,
  values,
  parts,
  shown,
  country,
  disabled,
  onChange,
}: {
  modes: Record<'neighbourhood' | 'city' | 'state' | 'postcode', AddressFieldMode>;
  values: DetailValues;
  parts: { area?: string | null; city?: string | null; state?: string | null; postcode?: string | null } | null;
  /** Typed wins (a cleared field stays cleared); the map's answer fills the gap. */
  shown: (typed: string | undefined, part: string | null | undefined) => string;
  country: string | null;
  disabled?: boolean;
  onChange: (patch: DetailPatch) => void;
}): React.ReactElement | null {
  const on = (k: keyof typeof modes) => modes[k] !== 'off';
  const req = (k: keyof typeof modes) => modes[k] === 'required';
  if (!on('neighbourhood') && !on('city') && !on('state') && !on('postcode')) return null;
  return (
    <View style={{ marginTop: spacing.md }}>
      <SectionHeading>Area and region</SectionHeading>
      {on('neighbourhood') ? (
        <EditField label="Neighbourhood" value={shown(values.neighbourhood, parts?.area)} placeholder="e.g. Idim Ita" maxLength={80} disabled={disabled} required={req('neighbourhood')} onChange={(neighbourhood) => onChange({ neighbourhood })} />
      ) : null}
      {on('city') || on('state') ? (
        <View style={[twoCol, { marginTop: spacing.sm }]}>
          {on('city') ? (
            <View style={col}>
              <EditField label="City" value={shown(values.city, parts?.city)} placeholder="e.g. Calabar" maxLength={80} disabled={disabled} required={req('city')} onChange={(city) => onChange({ city })} />
            </View>
          ) : null}
          {on('state') ? (
            <View style={col}>
              <EditField label="State" value={shown(values.state, parts?.state)} placeholder="e.g. Cross River" maxLength={80} disabled={disabled} required={req('state')} onChange={(state) => onChange({ state })} />
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={[twoCol, { marginTop: spacing.sm }]}>
        {on('postcode') ? (
          <View style={col}>
            <EditField label="Area code" value={shown(values.postcode, parts?.postcode)} placeholder="e.g. 540281" maxLength={12} disabled={disabled} required={req('postcode')} onChange={(postcode) => onChange({ postcode })} />
          </View>
        ) : null}
        <View style={col}>
          <CountryRow country={country} />
        </View>
      </View>
    </View>
  );
}
