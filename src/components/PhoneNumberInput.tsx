import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';

import { radius, sizing, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { MyazaInput } from './MyazaInput';
import { Icon } from './Icon';
import { CountryFlag } from './CountryFlag';
import { DialCodePicker, type DialCodeOption } from './DialCodePicker';
import { formatNationalNumber } from '../config/phone';
// Names come from the generated table, NOT Intl.DisplayNames: Hermes may ship
// without region data, and every row then reads as a bare ISO code.
import { COUNTRY_NAMES } from '../config/countryNames.g';

// ---------------------------------------------------------------------------
// Phone field: a dial-code country picker beside a nationally-formatted number.
//
// The RN mirror of the web SDK's PhoneNumberInput and Flutter's
// phone_number_input.dart. Before this the step was a bare text field asking
// for "+2348012345678" — the user had to know their own country code and type
// it, and validity was a length guess.
//
// Formatting and validity both come from libphonenumber: "8031234567" shows as
// "803 123 4567" for NG, and a wrong-length number is rejected by the country's
// actual numbering plan rather than a 6–15 digit heuristic.
// ---------------------------------------------------------------------------

export function PhoneNumberInput({
  value,
  defaultCountry,
  disabled,
  autoFocus = false,
  onChange,
}: {
  /**
   * E.164 seed. The field itself stays uncontrolled (the formatter owns the
   * text), but a value arriving after mount — the register's, prefilled a
   * moment later — has to reach the field, or we hold a number the applicant
   * can neither see nor correct and submit it as though they gave it.
   */
  value?: string;
  /** Seeds the picker (ISO-2). Falls back to NG. */
  defaultCountry?: string;
  disabled?: boolean;
  /** Focus + keyboard on mount. Opt-in: right for a single-field OTP screen,
   *  wrong for a row in a company-profile form. */
  autoFocus?: boolean;
  /** Fires on every edit with the E.164 value ('' until parseable) + validity. */
  onChange: (value: { e164: string; isValid: boolean; country: string }) => void;
}): React.ReactElement {
  const { colors } = useTheme();

  const options = useMemo<DialCodeOption[]>(
    () =>
      getCountries()
        // Only countries the shared table can name. libphonenumber lists five
        // that it cannot (AC, CC, CX, IO, TA — dependencies with populations in
        // the hundreds, reachable on their parent country's code anyway), and a
        // row reading "AC" is worse than no row. Dropping them also makes this
        // list exactly Flutter's, which is generated from the same table.
        .filter((code) => COUNTRY_NAMES[code])
        .map((code) => ({
          code,
          name: COUNTRY_NAMES[code] as string,
          dialCode: `+${getCountryCallingCode(code)}`,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  // A supplied number decides its OWN dial code — it is a fact, where the
  // country prop is a guess. Falls through to the guess when there is no
  // number or it cannot be parsed.
  const supplied = value ? parsePhoneNumberFromString(value) : null;
  const seed = (supplied?.country ??
    defaultCountry?.toUpperCase() ??
    'NG') as CountryCode;
  const [country, setCountry] = useState<CountryCode>(
    options.some((o) => o.code === seed) ? seed : ('NG' as CountryCode),
  );
  const [national, setNational] = useState(() =>
    supplied ? formatNationalNumber(supplied.nationalNumber, seed) : '',
  );
  // A number that arrives AFTER mount — the register's, prefilled a moment
  // later — has to reach the field. Seeding is one-way and keyed on the value,
  // so the applicant's own edits are never fought.
  const seededRef = useRef(value ?? '');
  useEffect(() => {
    if (!value || value === seededRef.current) return;
    seededRef.current = value;
    const parsed = parsePhoneNumberFromString(value);
    if (!parsed) return;
    const next = (parsed.country ?? country) as CountryCode;
    setCountry(next);
    setNational(formatNationalNumber(parsed.nationalNumber, next));
  }, [value, country]);
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.code === country);

  const emit = (nextCountry: CountryCode, nextNational: string): void => {
    const parsed = parsePhoneNumberFromString(nextNational, nextCountry);
    onChange({
      e164: parsed?.number ?? '',
      isValid: parsed?.isValid() ?? false,
      country: nextCountry,
    });
  };

  // The caret sits at the end: separators shift on nearly every keystroke, so
  // tracking an interior caret fights the formatter more than it helps.
  const onTyped = (raw: string): void => {
    const formatted = formatNationalNumber(raw, country);
    setNational(formatted);
    emit(country, formatted);
  };

  const pickCountry = (code: string): void => {
    const next = code as CountryCode;
    setCountry(next);
    setOpen(false);
    // Re-group the digits already typed under the new country's plan.
    const regrouped = formatNationalNumber(national, next);
    setNational(regrouped);
    emit(next, regrouped);
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pressable
          onPress={disabled ? undefined : () => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Country code ${selected?.dialCode ?? ''}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.sm + 2,
            height: sizing.inputHeight,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
            backgroundColor: colors.background,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <CountryFlag country={country} size={22} />
          <MyazaText variant="body">{selected?.dialCode ?? ''}</MyazaText>
          <Icon name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <MyazaInput
            value={national}
            onChangeText={onTyped}
            placeholder="803 123 4567"
            keyboardType="phone-pad"
            editable={!disabled}
            autoFocus={autoFocus}
          />
        </View>
      </View>

      <DialCodePicker
        visible={open}
        options={options}
        selected={country}
        onPick={pickCountry}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
