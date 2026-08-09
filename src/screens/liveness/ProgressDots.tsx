import React from 'react';
import { View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '../../components/Icon';
import { MyazaText } from '../../components/Typography';

// ---------------------------------------------------------------------------
// Numbered progress dots with connectors.
//
// One dot per step the user actually performs — the gestures AND the flash. The
// flash was omitted for a long time, so in 'both' mode the indicator read as
// finished while the flash was still to come, and in flash-only mode it showed
// no steps at all.
// ---------------------------------------------------------------------------

export function ProgressDots({
  total,
  completed,
  active,
}: {
  total: number;
  completed: number;
  active: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => {
        const state: 'passed' | 'active' | 'pending' =
          i < completed ? 'passed' : i === completed && active ? 'active' : 'pending';
        return (
          <React.Fragment key={i}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: state === 'passed' ? colors.success : state === 'active' ? colors.background : colors.gray300,
                borderWidth: state === 'active' ? 2 : 0,
                borderColor: colors.success,
              }}
            >
              {state === 'passed' ? (
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  <Path d="M5 13l4 4L19 7" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ) : (
                <MyazaText variant="bodySmall" color={state === 'active' ? colors.success : colors.textMuted} style={{ fontWeight: '700' }}>
                  {String(i + 1)}
                </MyazaText>
              )}
            </View>
            {i < total - 1 ? (
              <View style={{ width: 28, height: 2, backgroundColor: i < completed ? colors.success : colors.gray300 }} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}
