import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../../components/runtime';

/**
 * The NFC scan illustration, ported 1:1 from the web SDK's
 * `NfcScanIllustration` — same 320×240 geometry, same three beats: a document
 * with a CHIP, a phone held over it, a FIELD between them. The web component
 * is the design source of truth; every coordinate here matches it digit for
 * digit so the builder preview (web) and the live mobile screen stay the same
 * picture. Change the web one first, then mirror.
 *
 * Exactly ONE element is `primary`: the field. Everything else is neutral
 * theme tokens, so it inherits an org's palette and works in both modes.
 */

/** Where the field originates: on the phone's edge, at antenna height. */
const COUPLING = { x: 173, y: 88 } as const;

/** Arc radii, innermost first — each is one "ripple" of the field. */
const WAVES = [
  { r: 16, opacity: 0.9, delay: 0 },
  { r: 28, opacity: 0.65, delay: 150 },
  { r: 40, opacity: 0.42, delay: 300 },
  { r: 50, opacity: 0.25, delay: 450 },
] as const;

/** Half-angle of the fan, in degrees. */
const SPREAD = 56;

/** Web keyframes: 0% .25 → 45% 1 → 100% .25 over 1.8s, staggered. */
const PERIOD_MS = 1800;
const RISE_MS = PERIOD_MS * 0.45;

function wavePath(r: number): string {
  const rad = (SPREAD * Math.PI) / 180;
  const dx = Math.cos(rad) * r;
  const dy = Math.sin(rad) * r;
  const x = COUPLING.x + dx;
  return `M ${x.toFixed(1)} ${(COUPLING.y - dy).toFixed(1)} A ${r} ${r} 0 0 1 ${x.toFixed(1)} ${(COUPLING.y + dy).toFixed(1)}`;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Web-parity alpha suffixes for the theme's hex colours (the web draws with
 * `token/NN` Tailwind opacities; RN colours are plain hex strings).
 */
const A10 = '1A';
const A20 = '33';
const A25 = '40';
const A40 = '66';
const A50 = '80';
const A70 = 'B3';

export function NfcScanIllustration(): React.ReactElement {
  const { colors } = useTheme();

  // One value per ripple; the element opacity animates while strokeOpacity
  // holds the per-arc base — exactly the web's two-layer opacity.
  const pulses = useRef(WAVES.map(() => new Animated.Value(1))).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!cancelled) setReduceMotion(reduced);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      // Same behaviour as the web's reduced-motion rule: the animation stops
      // and the arcs stay VISIBLE at full element opacity.
      pulses.forEach((v) => v.setValue(1));
      return undefined;
    }
    const runs = pulses.map((value, i) => {
      value.setValue(0.25);
      const run = Animated.sequence([
        Animated.delay(WAVES[i]!.delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: RISE_MS,
              easing: Easing.inOut(Easing.ease),
              // SVG props can't ride the native driver.
              useNativeDriver: false,
            }),
            Animated.timing(value, {
              toValue: 0.25,
              duration: PERIOD_MS - RISE_MS,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ]),
        ),
      ]);
      run.start();
      return run;
    });
    return () => runs.forEach((r) => r.stop());
  }, [pulses, reduceMotion]);

  return (
    // Same footprint as the web: full width up to 384 (`max-w-sm`), 320:240.
    <View style={{ width: '100%', maxWidth: 384, aspectRatio: 320 / 240, alignSelf: 'center' }}>
      <Svg width="100%" height="100%" viewBox="0 0 320 240">
        <Defs>
          {/* The field falls off with distance — the reason the document has
              to be held CLOSE, said as a gradient instead of a caption. */}
          <RadialGradient
            id="kyc-nfc-field"
            cx={COUPLING.x}
            cy={COUPLING.y}
            r={90}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.18} />
            <Stop offset="0.55" stopColor={colors.primary} stopOpacity={0.06} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* ── The document, tucked BEHIND the phone: portrait, chip, MRZ. ── */}
        <G rotation={7} origin="212, 112">
          <Rect
            x={154}
            y={30}
            width={114}
            height={164}
            rx={10}
            fill={`${colors.backgroundSecondary}${A50}`}
            stroke={colors.border}
            strokeWidth={2}
          />

          {/* Portrait, top-right — an outline glyph floating in its frame. */}
          <Rect
            x={224}
            y={46}
            width={32}
            height={42}
            rx={6}
            fill={`${colors.textDark}${A10}`}
            stroke={colors.border}
            strokeWidth={1.5}
          />
          <G
            stroke={`${colors.textSecondary}${A50}`}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          >
            <Circle cx={240} cy={61} r={5.5} />
            <Path d="M231.5 77.5a8.5 8.5 0 0 1 17 0" />
          </G>

          {/* The chip — the familiar card contact pad, centred on the card,
              below the fan's lowest reach so the arcs can never touch it. */}
          <G stroke={`${colors.textSecondary}${A70}`} strokeWidth={1.5} fill="none">
            <Rect
              x={200.5}
              y={133}
              width={21}
              height={16}
              rx={3}
              fill={`${colors.textDark}${A10}`}
            />
            <Path d="M200.5 138.3h21M200.5 143.7h21M211 138.3v5.4" />
          </G>

          {/* The MRZ, low on the card, running edge to edge behind the phone.
              Border tone: background texture, not an icon. */}
          <G stroke={colors.border} strokeWidth={3} strokeLinecap="round" fill="none">
            <Path d="M170 174h84" strokeDasharray="6 4" />
            <Path d="M166 184h88" strokeDasharray="4 5" strokeOpacity={0.7} />
          </G>
        </G>

        {/* ── The phone, in front, screen toward us — pressed in close. ── */}
        <G x={12}>
          <G rotation={-5} origin="112, 126">
            {/* Volume buttons, on the side away from the field. */}
            <Rect x={57} y={84} width={3} height={14} rx={1.5} fill={`${colors.textDark}${A25}`} />
            <Rect x={57} y={103} width={3} height={14} rx={1.5} fill={`${colors.textDark}${A25}`} />

            {/* Opaque base + tint: the tint token alone is an alpha fill and
                let the card ghost THROUGH the glass. */}
            <Rect x={60} y={30} width={104} height={192} rx={24} fill={colors.background} />
            <Rect
              x={60}
              y={30}
              width={104}
              height={192}
              rx={24}
              fill={`${colors.backgroundSecondary}${A40}`}
              stroke={`${colors.textDark}${A25}`}
              strokeWidth={2}
            />
            <Rect x={99} y={46} width={26} height={8} rx={4} fill={`${colors.textDark}${A25}`} />

            {/* Ghost caption bars where the instruction copy sits in the app. */}
            <Rect x={87} y={170} width={50} height={5} rx={2.5} fill={colors.border} />
            <Rect
              x={96}
              y={181}
              width={32}
              height={4}
              rx={2}
              fill={colors.border}
              opacity={0.6}
            />

            {/* Home indicator — the strongest "this is the front" cue. */}
            <Rect x={97} y={205} width={30} height={3.5} rx={1.75} fill={`${colors.textDark}${A20}`} />
          </G>
        </G>

        {/* ── The field, over both objects. ── */}
        <Circle cx={COUPLING.x} cy={COUPLING.y} r={90} fill="url(#kyc-nfc-field)" />
        <Circle cx={COUPLING.x} cy={COUPLING.y} r={4.5} fill={colors.primary} />
        {WAVES.map((w, i) => (
          <AnimatedPath
            key={w.r}
            d={wavePath(w.r)}
            stroke={colors.primary}
            strokeWidth={3.25}
            strokeLinecap="round"
            fill="none"
            strokeOpacity={w.opacity}
            opacity={pulses[i]!}
          />
        ))}
      </Svg>
    </View>
  );
}
