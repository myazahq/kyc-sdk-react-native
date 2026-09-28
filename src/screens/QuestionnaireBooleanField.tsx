import React from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { useText } from '../i18n/useText';
import type { QuestionnaireAnswerValue } from '../types/workflow';

// ---------------------------------------------------------------------------
// A yes/no questionnaire answer: two centred cards on one row. Split from
// QuestionnaireField (200-line rule).
// ---------------------------------------------------------------------------

export function QuestionnaireBooleanField({
  value,
  onChange,
}: {
  value: QuestionnaireAnswerValue | undefined;
  onChange: (value: QuestionnaireAnswerValue | undefined) => void;
}): React.ReactElement {
  const t = useText();
  const options = [
    { label: t('questionnaire.yes'), option: true },
    { label: t('questionnaire.no'), option: false },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {options.map(({ label, option }) => (
        <View key={String(option)} style={{ flex: 1 }}>
          <BooleanChoice
            label={label}
            selected={value === option}
            // Re-tapping the chosen answer clears it — the only way to
            // un-answer an optional yes/no.
            onPress={() => onChange(value === option ? undefined : option)}
          />
        </View>
      ))}
    </View>
  );
}

/** A centred Yes / No card — no radio mark; the label IS the choice. */
function BooleanChoice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={{
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary50 : 'transparent',
      }}
    >
      <MyazaText
        variant="body"
        color={selected ? colors.primary : undefined}
        style={{ fontWeight: '600' }}
      >
        {label}
      </MyazaText>
    </Pressable>
  );
}
