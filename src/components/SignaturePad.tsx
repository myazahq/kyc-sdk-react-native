import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { radius } from '../config/theme';
import { Icon } from './Icon';
import { useTheme } from './runtime';
import { useScrollLock } from './ScrollLock';
import { TouchGuard } from './TouchGuard';
import { useReduceMotion } from './StaggerIn';
import { MyazaText } from './Typography';
import {
  hasSignature,
  MAX_POINTS,
  pointCount,
  rescaleStrokes,
  strokePath,
  type SignatureDrawing,
  type SignatureStroke,
} from '../lib/signature';

// ---------------------------------------------------------------------------
// A box to sign in with a finger.
//
// The pad is always white with dark ink, in both themes: it is a picture of ink
// on paper, and the image the server draws from these strokes looks the same.
// The strokes are kept as points and sent as points; nothing here rasterises a
// view, so the SDK needs no native capture dependency.
//
// The responder claims the touch and refuses to hand it back. On iOS that is
// not enough: the native scroll view, and the gesture that drags a page sheet
// down, take a vertical drag whatever the JS responder says, so signing
// scrolled the page and pulled the sheet down. Two things hold it: a native
// view over the pad that refuses those gestures (TouchGuard), and the sheet's
// scroll switched off while the finger is down (ScrollLock).
//
// MIRRORS the web SDK's SignaturePad and the Flutter one. Keep the three in step.
// ---------------------------------------------------------------------------

// The web pad's sizes: h-40, and min(60vh, 26rem) once expanded.
const PAD_HEIGHT = 160;
/** A bigger box for a long signature or a small phone. */
const PAD_HEIGHT_EXPANDED_MAX = 416;
const PAD_HEIGHT_EXPANDED_SHARE = 0.6;
const RESIZE_MS = 200;
const INK = '#111111';

export function SignaturePad({
  label,
  hint,
  clearLabel,
  disabled = false,
  initial,
  onChange,
}: {
  /** Names the pad for a screen reader. */
  label: string;
  /** Shown faintly until the first stroke. */
  hint: string;
  clearLabel: string;
  disabled?: boolean;
  /** A signature to start from, when the person comes back to edit theirs. */
  initial?: SignatureDrawing | null;
  /** Called after every stroke with the drawing so far, and whether it is enough ink. */
  onChange: (drawing: SignatureDrawing, ready: boolean) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const [strokes, setStrokes] = useState<SignatureStroke[]>(() =>
    initial ? initial.strokes.map((stroke) => [...stroke]) : [],
  );
  const [expanded, setExpanded] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const padHeight = expanded
    ? Math.min(windowHeight * PAD_HEIGHT_EXPANDED_SHARE, PAD_HEIGHT_EXPANDED_MAX)
    : PAD_HEIGHT;
  // The box grows and shrinks over 200ms, as the web pad does. Height cannot
  // run on the native driver; it is one short animation on one view.
  const animatedHeight = useRef(new Animated.Value(PAD_HEIGHT)).current;
  useEffect(() => {
    if (reduceMotion) {
      animatedHeight.setValue(padHeight);
      return undefined;
    }
    const run = Animated.timing(animatedHeight, {
      toValue: padHeight,
      duration: RESIZE_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [animatedHeight, padHeight, reduceMotion]);
  const live = useRef<SignatureStroke[]>(strokes);
  // An edited signature arrives in the size of the pad it was drawn in; the
  // first layout fits it to this one.
  const size = useRef({ width: initial?.width ?? 0, height: initial?.height ?? PAD_HEIGHT });
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const setScrollLocked = useScrollLock();
  const lockRef = useRef(setScrollLocked);
  lockRef.current = setScrollLocked;
  // A pad that goes away mid-stroke must not leave the sheet unable to scroll.
  useEffect(() => () => lockRef.current(false), []);

  const emit = (): void => {
    const drawing = { strokes: live.current, width: size.current.width, height: size.current.height };
    onChangeRef.current(drawing, hasSignature(drawing));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          lockRef.current(true);
          const { locationX, locationY } = e.nativeEvent;
          live.current = [...live.current, [{ x: locationX, y: locationY }]];
          setStrokes(live.current);
        },
        onPanResponderMove: (e) => {
          if (pointCount(live.current) >= MAX_POINTS) return;
          const stroke = live.current[live.current.length - 1];
          if (!stroke) return;
          const { locationX, locationY } = e.nativeEvent;
          const last = stroke[stroke.length - 1]!;
          // Skip sub-point jitter: it adds points and nothing to the line.
          if (Math.hypot(locationX - last.x, locationY - last.y) < 1) return;
          stroke.push({ x: locationX, y: locationY });
          setStrokes([...live.current]);
        },
        onPanResponderRelease: () => {
          lockRef.current(false);
          emit();
        },
        onPanResponderTerminate: () => {
          lockRef.current(false);
          emit();
        },
      }),
    // The responder reads everything through refs, so it is built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onLayout = (e: LayoutChangeEvent): void => {
    const next = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
    // Expanded, shrunk or rotated: keep what was signed, fitted to the new box.
    const fitted = rescaleStrokes(live.current, size.current, next);
    size.current = next;
    if (fitted !== live.current) {
      live.current = fitted;
      setStrokes(fitted);
      emit();
    }
  };

  const clear = (): void => {
    live.current = [];
    setStrokes([]);
    emit();
  };

  const empty = strokes.length === 0;
  const strokeWidth = Math.max(1.5, Math.min(size.current.width || 320, padHeight) / 90);

  return (
    <View>
      <Animated.View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        onLayout={onLayout}
        style={{
          height: animatedHeight,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.border,
          borderRadius: radius.sm,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
        }}
        {...responder.panHandlers}
      >
        {/* pointerEvents none: locationX/Y must be measured against the pad,
            never against a child the finger happens to be over. */}
        <View pointerEvents="none" style={{ flex: 1 }}>
          <Svg width="100%" height="100%">
            {strokes.map((stroke, i) => (
              <Path
                key={i}
                d={strokePath(stroke)}
                stroke={INK}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
          {/* The line a signature sits on, and the prompt until there is one. */}
          <View
            style={{ position: 'absolute', left: 24, right: 24, bottom: 36, height: 1, backgroundColor: '#D4D4D4' }}
          />
          {empty ? (
            <MyazaText
              variant="bodySmall"
              color="#737373"
              style={{ position: 'absolute', left: 0, right: 0, bottom: 10, textAlign: 'center' }}
            >
              {hint}
            </MyazaText>
          ) : null}
        </View>
        {/* iOS: keeps the stroke from also scrolling the page or dragging the
            sheet down (components/TouchGuard). It covers the same box as the
            ink, so a touch measured against it is in the ink's coordinates. */}
        <TouchGuard guarding={!disabled} />
        {/* In the corner of the box itself, where the eye already is. Outside
            the pointerEvents-none layer so it takes its own press; always dark
            on the white pad, whatever the flow's theme. */}
        <Pressable
          onPress={() => setExpanded((on) => !on)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse the signature box' : 'Expand the signature box'}
          accessibilityState={{ expanded }}
          // Small to look at; the slop keeps the tap area generous.
          hitSlop={10}
          style={({ pressed }) => ({
            position: 'absolute',
            top: 8,
            right: 8,
            height: 28,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#D4D4D4',
            backgroundColor: pressed ? '#F5F5F5' : 'rgba(255,255,255,0.95)',
            // The web pill's shadow-sm.
            shadowColor: '#000000',
            shadowOpacity: 0.05,
            shadowOffset: { width: 0, height: 1 },
            shadowRadius: 2,
            elevation: 1,
          })}
        >
          <Icon name={expanded ? 'minimize' : 'maximize'} size={12} color="#262626" />
          <MyazaText
            variant="bodySmall"
            color="#262626"
            style={{ fontWeight: '600', fontSize: 11, lineHeight: 13, marginLeft: 4 }}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </MyazaText>
        </Pressable>
      </Animated.View>
      <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
        <Pressable
          onPress={clear}
          disabled={disabled || empty}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          accessibilityState={{ disabled: disabled || empty }}
          hitSlop={8}
          style={({ pressed }) => ({
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: 12,
            opacity: disabled || empty ? 0.5 : pressed ? 0.7 : 1,
          })}
        >
          <MyazaText variant="label" color={colors.primary} style={{ fontSize: 12 }}>
            {clearLabel}
          </MyazaText>
        </Pressable>
      </View>
    </View>
  );
}
