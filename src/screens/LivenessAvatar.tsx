import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image } from 'react-native';

import { useTheme, useKycConfig } from '../components/runtime';
import { Icon } from '../components/Icon';
import { livenessAvatarUrl } from '../liveness/avatarSource';
import type { LivenessChallenge } from '../liveness/types';

// Animated GIF avatar demonstrating the requested gesture — the RN mirror of the
// web/Flutter `LivenessAvatar`. Shows the same Nod/Turn/Blink/Smile animations in
// a circular badge (primary-tinted, like Flutter), sliding up + fading in when
// the challenge changes. RN's <Image> animates GIFs natively.
//
// The animations are FETCHED (see liveness/avatarSource) rather than bundled.
// They were 5.5 MB of this package, in every integrator's app, for a badge the
// liveness step shows for a few seconds. The flow prefetches all four at open,
// so by the time this renders the file is normally already on the device; when
// it is not, `broken` renders the gesture icon exactly as it always did for a
// failed decode.

/** The badge on a tall phone; the step hands a smaller size down on a short one
 *  (lib/livenessLayout), so the gesture stays on screen beside the circle. */
const DEFAULT_SIZE = 96;
const DEFAULT_ICON = 40;

export function LivenessAvatar({
  challenge,
  size = DEFAULT_SIZE,
  iconSize = DEFAULT_ICON,
}: {
  challenge: LivenessChallenge;
  size?: number;
  iconSize?: number;
}): React.ReactElement {
  const SIZE = size;
  const { colors } = useTheme();
  const { apiKey, devUrl } = useKycConfig();
  const [displayed, setDisplayed] = useState<LivenessChallenge>(challenge);
  const [broken, setBroken] = useState(false);
  const anim = useRef(new Animated.Value(1)).current;
  // `displayed`, not `challenge`: the badge cross-fades, so the image must keep
  // showing the outgoing gesture until the transition swaps it.
  const uri = livenessAvatarUrl(displayed, apiKey, devUrl);

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
      {broken || uri == null ? (
        <Icon name="scan-face" size={iconSize} color={colors.primary} />
      ) : (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setBroken(true)}
        />
      )}
    </Animated.View>
  );
}
