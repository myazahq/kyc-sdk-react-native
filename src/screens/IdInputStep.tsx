import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { ID_TYPES } from '../config/idTypes';
import { validateIdNumber } from '../services/validators';
import type { IdType } from '../types/config';
import { useEffectiveCountry, useFlowState, useVerificationConfig } from '../components/runtime';
import { UiText } from '../components/Typography';
import { UiInput } from '../components/UiInput';
import { UiButton } from '../components/UiButton';
import { useText } from '../i18n/useText';

// Number-only ID entry (BVN / NIN / vNIN) — 1:1 with the Flutter SDK's
// IdInputScreen. Client-side format validation only; no OCR pre-fill. The step
// title/description live in the header.

function hintFor(def: { label: string; inputLabel?: string; digits?: number } | null): string {
  if (!def) return 'Enter your ID number';
  // e.g. Tax ID is looked up by the person's NIN — ask for what they type.
  const label = def.inputLabel ?? def.label;
  if (def.digits != null) return `Enter ${def.digits}-digit ${label}`;
  return `Enter your ${label}`;
}

export function IdInputStep(): React.ReactElement {
  const config = useVerificationConfig();
  const t = useText();
  const country = useEffectiveCountry();
  const selectedIdType = useFlowState((s) => s.selectedIdType);
  const storedIdNumber = useFlowState((s) => s.idNumber);
  const setIdNumber = useFlowState((s) => s.setIdNumber);
  const nextStep = useFlowState((s) => s.nextStep);

  // Seeded from the store so a back-and-forward through the flow never loses
  // what was already typed — everything persists until submission, or until
  // the user themselves changes it (mirrors web + Flutter).
  const [value, setValue] = useState(storedIdNumber ?? '');
  const [error, setError] = useState<string | null>(null);

  const def = useMemo(() => Object.values(ID_TYPES).flat().find((d) => d.key === selectedIdType) ?? null, [selectedIdType]);
  const isDigits = def?.digits !== undefined;

  const valid = useMemo(() => {
    if (!selectedIdType || !value.trim()) return false;
    return validateIdNumber(country, selectedIdType as IdType, value).valid;
  }, [country, selectedIdType, value]);

  const handleChange = (text: string) => {
    // Match Flutter: BVN/NIN are digits-only.
    const next = isDigits ? text.replace(/[^0-9]/g, '') : text;
    setValue(next);
    // Write-through to the store as they type — a back-swipe mid-entry must
    // not cost them the digits they already entered.
    setIdNumber(next);
    if (selectedIdType && next.trim()) {
      const result = validateIdNumber(country, selectedIdType as IdType, next);
      setError(result.valid ? null : result.message ?? null);
    } else {
      setError(null);
    }
  };

  const handleContinue = () => {
    if (!valid) return;
    setIdNumber(value.trim());
    nextStep();
  };

  return (
    <View>
      {def ? (
        <UiText variant="label" style={{ marginBottom: spacing.sm }}>
          {def.inputLabel ?? def.label}
        </UiText>
      ) : null}
      <UiInput
        value={value}
        onChangeText={handleChange}
        placeholder={hintFor(def)}
        error={error}
        keyboardType={isDigits ? 'number-pad' : 'default'}
        autoCapitalize={isDigits ? 'none' : 'characters'}
        maxLength={def?.digits}
        autoFocus
      />
      <View style={{ height: spacing.xl }} />
      <UiButton label={t('common.continue')} onPress={valid ? handleContinue : undefined} disabled={!valid} />
    </View>
  );
}
