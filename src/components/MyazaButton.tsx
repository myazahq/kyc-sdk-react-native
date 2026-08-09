import React from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, sizing, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { Icon, type IconName } from './Icon';

// Branded button — 1:1 with the Flutter SDK's MyazaButton:
//   • primary     — solid primary fill, onPrimary label
//   • outline     — transparent, 1.5px primary border, primary label
//   • ghost       — transparent, primary label
//   • destructive — error fill, white label
// Radius is `sm` (12px), height 48. No Liquid Glass on buttons (glass is reserved
// for the modal chrome / icon buttons, per the design).

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'destructive';

export interface MyazaButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  leadingIcon?: IconName;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

export function MyazaButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  leadingIcon,
  style,
  fullWidth = true,
}: MyazaButtonProps): React.ReactElement {
  const { colors } = useTheme();
  const isDisabled = disabled || loading || !onPress;

  const fg =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'destructive'
        ? '#FFFFFF'
        : colors.primary;
  const effectiveFg = isDisabled ? `${fg}80` : fg; // 50% alpha when disabled

  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'destructive'
        ? colors.error
        : 'transparent';

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: sizing.buttonHeight,
          borderRadius: radius.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.md,
          width: fullWidth ? '100%' : undefined,
          backgroundColor: isDisabled
            ? variant === 'primary'
              ? `${colors.primary}80`
              : variant === 'destructive'
                ? `${colors.error}80`
                : 'transparent'
            : bg,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: variant === 'outline' ? (isDisabled ? `${colors.primary}66` : colors.primary) : undefined,
          opacity: pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={effectiveFg} size="small" />
      ) : (
        // `flexShrink: 1` on the ROW and the label: a Text in a row that cannot
        // shrink does not wrap, it OVERFLOWS and gets clipped. That was
        // invisible with the bundled font and cut "Continue" to "Continu" the
        // moment an org picked a wider one. A button label must never be
        // truncated by a branding choice, hence the shrink-to-fit as well.
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
          {leadingIcon ? (
            <View style={{ marginRight: 8 }}>
              <Icon name={leadingIcon} size={18} color={effectiveFg} />
            </View>
          ) : null}
          <MyazaText
            variant="button"
            color={effectiveFg}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={{ flexShrink: 1 }}
          >
            {label}
          </MyazaText>
        </View>
      )}
    </Pressable>
  );
}
