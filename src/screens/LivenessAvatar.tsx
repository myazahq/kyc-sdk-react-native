import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image } from 'react-native';

import { useTheme } from '../components/runtime';
import { Icon } from '../components/Icon';
import type { LivenessChallenge } from '../liveness/types';

// Animated GIF avatar demonstrating the requested gesture — the RN mirror of the
// web/Flutter `LivenessAvatar`. Shows the same Nod/Turn/Blink/Smile GIFs in a
// circular badge (primary-tinted, like Flutter), sliding up + fading in when the
// challenge changes. RN's <Image> animates GIFs natively.

const GIFS: Record<LivenessChallenge, number> = {
  nod: require('../assets/liveness/Nod.gif'),
  turn: require('../assets/liveness/Turn.gif'),
  blink: require('../assets/liveness/Blink.gif'),
  smile: require('../assets/liveness/Smile.gif'),
};

const SIZE = 96;

export function LivenessAvatar({ challenge }: { challenge: LivenessChallenge }): React.ReactElement {
  const { colors } = useTheme();
  const [displayed, setDisplayed] = useState<LivenessChallenge>(challenge);
  const [broken, setBroken] = useState(false);
  const anim = useRef(new Animated.Value(1)).current;

  // Slide-up + fade transition when the challenge changes (mirrors Flutter's
  // AnimatedSwitcher: Offset(0, 0.4) → 0, easeOutCubic, ~350ms).
  useEffect(() => {
    if (challenge === displayed) return;
    anim.setValue(0);
    setDisplayed(challenge);
    setBroken(false);
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [challenge, displayed, anim]);

  return (
    <Animated.View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: `${colors.primary}1A`, // ~10% primary (primary100 tint)
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [SIZE * 0.4, 0] }) }],
      }}
    >
      {broken ? (
        <Icon name="scan-face" size={40} color={colors.primary} />
      ) : (
        <Image
          source={GIFS[displayed]}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setBroken(true)}
        />
      )}
    </Animated.View>
  );
}
