import React from 'react';
import { View } from 'react-native';

import { spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { Icon } from './Icon';

// Segmented numbered step indicator — 1:1 with the Flutter SDK's _StepIndicator.
// N circles connected by thin lines:
//   • completed → filled primary + white check
//   • active    → filled primary + white number
//   • upcoming  → outlined (primary200) + muted number
// activeIndex = round(progress * stepCount) - 1.

export interface StepIndicatorProps {
  /** 0.0–1.0 progress fraction. */
  progress: number;
  stepCount: number;
}

export function StepIndicator({ progress, stepCount }: StepIndicatorProps): React.ReactElement {
  const { colors } = useTheme();
  const active = Math.round(progress * stepCount) - 1;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }}>
      {Array.from({ length: stepCount }).map((_, i) => {
        const completed = i < active;
        const isActive = i === active;
        const filled = completed || isActive;
        return (
          <React.Fragment key={i}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: filled ? colors.primary : 'transparent',
                borderWidth: 1.5,
                borderColor: filled ? colors.primary : colors.primary200,
              }}
            >
              {completed ? (
                <Icon name="check" size={14} color="#FFFFFF" />
              ) : (
                <MyazaText
                  variant="bodySmall"
                  color={isActive ? '#FFFFFF' : colors.textMuted}
                  style={{ fontSize: 11, fontWeight: '700' }}
                >
                  {i + 1}
                </MyazaText>
              )}
            </View>
            {i < stepCount - 1 ? (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  marginHorizontal: 3,
                  borderRadius: 1,
                  backgroundColor: completed ? colors.primary : colors.primary200,
                }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}
