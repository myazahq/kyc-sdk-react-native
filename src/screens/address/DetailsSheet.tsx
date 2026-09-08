import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, ScrollView, useWindowDimensions, View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { MyazaButton } from '../../components/MyazaButton';
import { FloatingSheet } from '../../components/glass/FloatingSheet';
import { addressFieldModes, type AddressFieldKey } from '../../lib/address-field-modes';
import type { AddressCollectionConfig } from '../../types/workflow';
import { AreaFields, EditField, SectionHeading, type DetailPatch, type DetailValues } from './DetailsSheetFields';

// ---------------------------------------------------------------------------
// The EDIT-DETAILS sheet, OkHi-style (user decision 2026-08-31): everything on
// the address is editable. Two grouped sections — street and building, then
// area and region — with the map's answer prefilling the area fields so the
// applicant corrects rather than retypes. An untouched prefill is never
// stored as their claim (the parent only receives what they actually edit).
//
// Each typed field honours its workflow mode (lib/address-field-modes.ts):
// 'off' hides it, 'required' marks it and holds the pin step's Continue.
// Mirrors the web SDK's DetailsSheet; keep the two in lockstep.
//
// Rides the same FloatingSheet every other picker in the SDK uses, and lifts
// above the keyboard like the key-person sheet, since this one is a form.
// ---------------------------------------------------------------------------

export type DetailsPatch = DetailPatch;

export function DetailsSheet({
  isBusiness,
  parts,
  country,
  directionsRequired,
  addressConfig,
  values,
  disabled,
  onChange,
  onClose,
}: {
  isBusiness: boolean;
  /** The map's answer, broken down — the prefill for the area fields. */
  parts: { street?: string | null; area?: string | null; city?: string | null; state?: string | null; postcode?: string | null } | null;
  /** The flow's ISO-2 country (read-only: a verification fact, not a field). */
  country: string | null;
  directionsRequired: boolean;
  /** The flow's address step: which typed fields are offered or required. */
  addressConfig: AddressCollectionConfig | null | undefined;
  values: DetailValues;
  disabled: boolean;
  onChange: (patch: DetailsPatch) => void;
  onClose: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(show, (e) => setKeyboard(e.endCoordinates.height));
    const hidden = Keyboard.addListener(hide, () => setKeyboard(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const available = screenHeight - keyboard;
  const maxHeight = Math.min(available * 0.92, screenHeight * 0.85);

  const modes = addressFieldModes(addressConfig);
  const on = (k: AddressFieldKey) => modes[k] !== 'off';
  const req = (k: AddressFieldKey) => modes[k] === 'required';
  const anyRequired = (Object.keys(modes) as AddressFieldKey[]).some(req);

  // Typed wins (a cleared field STAYS cleared); the map's answer fills the
  // gap only while the applicant has never touched the field.
  const shown = (typed: string | undefined, part: string | null | undefined) =>
    typed ?? part?.trim() ?? '';

  const twoCol = { flexDirection: 'row' as const, gap: spacing.sm };
  const col = { flex: 1, minWidth: 0 };
  const showStreetSection = on('propertyNumber') || on('street') || on('unit') || on('propertyName');

  return (
    <FloatingSheet visible onClose={onClose} maxHeight={maxHeight} bottomOffset={keyboard} closeLabel="Close">
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
        {/* One close control, not two: FloatingSheet already carries its own
            in the same corner, and the pair read as a mis-render. */}
        <MyazaText variant="body" style={{ fontWeight: '700' }}>
          Edit your address
        </MyazaText>
        <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 2 }}>
          {anyRequired
            ? 'Correct anything the map got wrong. Fields marked * are required.'
            : 'Correct anything the map got wrong. Every field is optional, and it all helps someone find the door.'}
        </MyazaText>
      </View>

      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
      >
        {showStreetSection ? <SectionHeading>Street and building</SectionHeading> : null}
        {on('propertyNumber') || on('street') ? (
          <View style={twoCol}>
            {on('propertyNumber') ? (
              <View style={col}>
                <EditField label="Number" value={values.propertyNumber ?? ''} placeholder="e.g. 11" maxLength={20} disabled={disabled} required={req('propertyNumber')} onChange={(propertyNumber) => onChange({ propertyNumber })} />
              </View>
            ) : null}
            {on('street') ? (
              <View style={col}>
                <EditField label="Street name" value={shown(values.street, parts?.street)} placeholder="e.g. Awolowo Road" maxLength={120} disabled={disabled} required={req('street')} onChange={(street) => onChange({ street })} />
              </View>
            ) : null}
          </View>
        ) : null}
        {on('unit') || on('propertyName') ? (
          <View style={[twoCol, { marginTop: spacing.sm }]}>
            {on('unit') ? (
              <View style={col}>
                <EditField label="Unit" value={values.unit ?? ''} placeholder="e.g. Flat 4" maxLength={30} disabled={disabled} required={req('unit')} onChange={(unit) => onChange({ unit })} />
              </View>
            ) : null}
            {on('propertyName') ? (
              <View style={col}>
                <EditField label="Building name" value={values.propertyName ?? ''} placeholder="e.g. Sunrise Villa" maxLength={80} disabled={disabled} required={req('propertyName')} onChange={(propertyName) => onChange({ propertyName })} />
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={{ marginTop: spacing.sm }}>
          <EditField
            label={`${isBusiness ? 'Directions to the entrance' : 'Directions to this address'}${directionsRequired ? '' : ' (optional)'}`}
            value={values.directions ?? ''}
            placeholder="e.g. black gate opposite the kiosk, second building after the junction"
            maxLength={500}
            multiline
            disabled={disabled}
            onChange={(directions) => onChange({ directions })}
          />
        </View>

        <AreaFields modes={modes} values={values} parts={parts} shown={shown} country={country} disabled={disabled} onChange={onChange} />
      </ScrollView>

      {/* Bottom padding to match the web sheet's pb-6: the card floats clear
          of the screen edge by 8, so 16 here lands the button the same
          distance off the home indicator as the web drawer sits off the
          bottom of the window. */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
        <MyazaButton label="Done" onPress={onClose} />
      </View>
    </FloatingSheet>
  );
}

/** Kept beside the sheet so the pin step's summary row and this share one
 *  shape for the "N details added" count — every editable claim counts. */
export function detailCount(values: Partial<DetailValues>): number {
  return [
    values.propertyNumber,
    values.street,
    values.unit,
    values.propertyName,
    values.directions,
    values.neighbourhood,
    values.city,
    values.state,
    values.postcode,
  ].filter((v) => v?.trim()).length;
}
