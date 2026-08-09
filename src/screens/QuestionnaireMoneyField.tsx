import React, { useState } from 'react';
import { View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaInput } from '../components/MyazaInput';
import { MyazaSelect } from '../components/MyazaSelect';
import { CountryFlag } from '../components/CountryFlag';
import { currencyFlagCountry, currencyName } from '../config/currencyFlags';
import { formatGroupedAmount, parseGroupedAmount } from '../utils/amountFormat';
import type { QuestionnaireAnswerValue, QuestionnaireField as FieldDef } from '../types/workflow';

// ---------------------------------------------------------------------------
// A money question: an amount plus the currency it is in.
//
// Two answer keys, not one — `<key>` and `<key>_currency`. Keeping them as
// separate scalars is what lets a decision graph compare the amount with `gt`
// and `lt`; a `{amount, currency}` object would not compare at all.
//
// Laid out as ONE row — amount, then the currency beside it — mirroring the
// Flutter SDK. Currencies stacked below the field read as a second question
// rather than a unit attached to the number above them.
// ---------------------------------------------------------------------------

/** Matches MyazaInput's single-line height so the two controls line up. */
const CONTROL_HEIGHT = 48;

/** Flag for a currency code — blank for supranational codes (XOF, XAU…). */
function CurrencyFlag({ code }: { code: string }): React.ReactElement | null {
  const country = currencyFlagCountry(code);
  if (!country) return null;
  return <CountryFlag country={country} size={18} />;
}

export function MoneyField({
  field,
  value,
  currencyValue,
  error,
  onChange,
  onCurrencyChange,
}: {
  field: FieldDef;
  value: QuestionnaireAnswerValue | undefined;
  currencyValue?: string;
  error?: string;
  onChange: (value: QuestionnaireAnswerValue | undefined) => void;
  onCurrencyChange: (currency: string) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const currencies = field.currencies ?? [];
  // The showing currency is the answer when the user never opens the picker,
  // which is why the payload defaults to the definition's first.
  const currency = currencyValue ?? currencies[0];

  // The field shows a GROUPED string while the answer stays a number. Seeded
  // once from any previously entered answer (returning to the step via back),
  // then owned by the input — same as Flutter's controller.
  const [display, setDisplay] = useState(() =>
    value === undefined ? '' : formatGroupedAmount(String(value)),
  );

  const onAmountText = (text: string): void => {
    const grouped = formatGroupedAmount(text);
    setDisplay(grouped);
    const amount = parseGroupedAmount(grouped);
    onChange(amount === null ? undefined : amount);
  };

  return (
    // Currency FIRST, then the amount — it reads as a unit prefix
    // ("NGN 250,000"), the way a currency is actually written.
    // TOP-aligned, not centered: the amount column grows taller when its
    // validation error renders under it, and centering would drag the
    // currency select down out of line with the input box. Both controls are
    // CONTROL_HEIGHT tall, so top alignment keeps them level always.
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {currencies.length > 1 ? (
        <>
          {/* Height is pinned so the select matches MyazaInput's single-line
              box exactly; without it the select renders short and the two
              controls sit at different heights. */}
          <View style={{ height: CONTROL_HEIGHT }}>
            <MyazaSelect<string>
              value={currency}
              sheetTitle="Currency"
              height={CONTROL_HEIGHT}
              compact
              options={currencies.map((code) => ({
                value: code,
                label: code,
                description: currencyName(code) ?? undefined,
                leading: <CurrencyFlag code={code} />,
              }))}
              onChange={onCurrencyChange}
            />
          </View>
          <View style={{ width: spacing.sm }} />
        </>
      ) : currency ? (
        <>
          <View
            style={{
              height: CONTROL_HEIGHT,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.md,
              borderRadius: radius.sm,
              backgroundColor: colors.primary50,
            }}
          >
            <CurrencyFlag code={currency} />
            <View style={{ width: spacing.xs }} />
            <MyazaText variant="body" style={{ fontWeight: '600' }}>
              {currency}
            </MyazaText>
          </View>
          <View style={{ width: spacing.sm }} />
        </>
      ) : null}

      <View style={{ flex: 1 }}>
        <MyazaInput
          value={display}
          onChangeText={onAmountText}
          placeholder={field.placeholder ?? '0.00'}
          error={error ?? null}
          keyboardType="decimal-pad"
        />
      </View>
    </View>
  );
}
