import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { spacing, radius } from '../../config/theme';
import { MyazaText } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { AMBER_50, AMBER_200, AMBER_800 } from './constants';

// ---------------------------------------------------------------------------
// Lighting warning — 1:1 with the Flutter `_LightingWarningBanner`: amber-50
// background, amber-200 border, amber-800 lightbulb + text, fading and sliding
// in over ~300ms.
// ---------------------------------------------------------------------------

export function LightingBanner({ text }: { text: string }): React.ReactElement {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      style={{
        alignSelf: 'stretch',
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.sm,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: AMBER_200,
          backgroundColor: AMBER_50,
          paddingHorizontal: spacing.sm + 4,
          paddingVertical: 10,
        }}
      >
        <Icon name="lightbulb" size={16} color={AMBER_800} />
        <MyazaText variant="bodySmall" color={AMBER_800} style={{ flexShrink: 1, lineHeight: 17 }}>
          {text}
        </MyazaText>
      </View>
    </Animated.View>
  );
}

/** The single guidance string + tone to show under the camera. */
