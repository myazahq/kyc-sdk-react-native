import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { ID_TYPES } from '../config/idTypes';
import { validateIdNumber } from '../services/validators';
import type { IdType } from '../types/config';
import { useKyc, useKycConfig } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { MyazaInput } from '../components/MyazaInput';
import { MyazaButton } from '../components/MyazaButton';

// Number-only ID entry (BVN / NIN / vNIN) — 1:1 with the Flutter SDK's
// IdInputScreen. Client-side format validation only; no OCR pre-fill. The step
// title/description live in the header.

function hintFor(def: { label: string; digits?: number } | null): string {
  if (!def) return 'Enter your ID number';
  if (def.digits != null) return `Enter ${def.digits}-digit ${def.label}`;
  return `Enter your ${def.label}`;
}

export function IdInputStep(): React.ReactElement {
  const config = useKycConfig();
  const selectedIdType = useKyc((s) => s.selectedIdType);
  const setIdNumber = useKyc((s) => s.setIdNumber);
  const nextStep = useKyc((s) => s.nextStep);

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const def = useMemo(() => Object.values(ID_TYPES).flat().find((t) => t.key === selectedIdType) ?? null, [selectedIdType]);
  const isDigits = def?.digits !== undefined;

  const valid = useMemo(() => {
    if (!selectedIdType || !value.trim()) return false;
    return validateIdNumber(config.country, selectedIdType as IdType, value).valid;
  }, [config.country, selectedIdType, value]);

  const handleChange = (text: string) => {
    // Match Flutter: BVN/NIN are digits-only.
    const next = isDigits ? text.replace(/[^0-9]/g, '') : text;
    setValue(next);
    if (selectedIdType && next.trim()) {
      const result = validateIdNumber(config.country, selectedIdType as IdType, next);
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
        <MyazaText variant="label" style={{ marginBottom: spacing.sm }}>
          {def.label}
        </MyazaText>
      ) : null}
      <MyazaInput
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
      <MyazaButton label="Continue" onPress={valid ? handleContinue : undefined} disabled={!valid} />
    </View>
  );
}
