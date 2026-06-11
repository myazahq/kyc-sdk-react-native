import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StatusBar, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { Icon } from './Icon';

// Top toast — the RN SDK surfaces technical errors (upload/network failures) as a
// toast that slides down from the top of the modal, rather than an inline alert.
// Mounted once (by KycFlow) so any step can raise one via `useToast()`.

type ToastVariant = 'error' | 'success' | 'warning' | 'info';

export interface ToastInput {
  message: string;
  title?: string;
  variant?: ToastVariant;
  /** Auto-dismiss after this many ms (0 = sticky). Default 4500. */
  duration?: number;
}

interface ToastApi {
  show: (toast: ToastInput) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {}, hide: () => {} });

/** Raise/dismiss the top toast. No-op outside the SDK modal. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

  const show = useCallback((input: ToastInput) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    idRef.current += 1;
    setToast({ ...input, id: idRef.current });
    const dur = input.duration ?? 4500;
    if (dur > 0) {
      timerRef.current = setTimeout(() => setToast(null), dur);
    }
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      <View style={{ flex: 1 }}>
        {children}
        {toast ? <ToastView key={toast.id} {...toast} onDismiss={hide} /> : null}
      </View>
    </ToastContext.Provider>
  );
}

function ToastView({
  message,
  title,
  variant = 'error',
  onDismiss,
}: ToastInput & { onDismiss: () => void }): React.ReactElement {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  // Slide in below the status bar / notch.
  const topInset =
    (initialWindowMetrics?.insets.top ?? (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0)) +
    spacing.sm;

  const accent =
    variant === 'success'
      ? colors.success
      : variant === 'warning'
        ? colors.warning
        : variant === 'info'
          ? colors.primary
          : colors.error;
  const iconName = variant === 'success' ? 'check' : 'alert';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: topInset,
        left: spacing.md,
        right: spacing.md,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.sm,
          backgroundColor: colors.background,
          borderRadius: radius.md,
          borderLeftWidth: 3,
          borderLeftColor: accent,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          // Subtle elevation so it reads as floating above the content.
          shadowColor: '#000000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Icon name={iconName} size={18} color={accent} />
        <View style={{ flex: 1 }}>
          {title ? (
            <MyazaText variant="bodySmall" color={accent} style={{ fontWeight: '700' }}>
              {title}
            </MyazaText>
          ) : null}
          <MyazaText variant="bodySmall" color={colors.textDark}>
            {message}
          </MyazaText>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Icon name="close" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
