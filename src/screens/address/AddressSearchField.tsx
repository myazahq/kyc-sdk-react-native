import React from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { radius, sizing, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { useInputFontFamily } from '../../components/fonts';
import { Icon } from '../../components/Icon';

/**
 * The address search box.
 *
 * Its own field rather than MyazaInput because it needs the return key to
 * submit (the basic backend is explicit-submit only) and a trailing spinner
 * while a details call is out — neither of which belongs on the generic input.
 * The border, radius and height are the SAME tokens, so it reads as one family.
 */
export function AddressSearchField({
  value,
  onChangeText,
  busy,
  showSubmit,
  canSubmit,
  autoFocus,
  onSubmit,
}: {
  value: string;
  onChangeText: (text: string) => void;
  /** A request is in flight: a details call (autocomplete) or the search. */
  busy: boolean;
  /** The basic backend gets an explicit Search button beside the field. */
  showSubmit: boolean;
  canSubmit: boolean;
  autoFocus: boolean;
  onSubmit: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const fontFamily = useInputFontFamily();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          height: sizing.inputHeight,
          paddingHorizontal: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.sm,
          backgroundColor: colors.background,
        }}
      >
        <Icon name="search" size={16} color={colors.textSecondary} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Search your address, e.g. 12 Adeola Odeku Street"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Search your address"
          autoCapitalize="none"
          // An address is a proper noun: iOS autocorrect rewrites street names
          // right before the person submits.
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (canSubmit) onSubmit();
          }}
          style={{
            flex: 1,
            height: '100%',
            marginLeft: spacing.sm,
            color: colors.textDark,
            fontSize: 16,
            fontFamily,
          }}
        />
        {busy && !showSubmit ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
      </View>

      {showSubmit ? (
        <Pressable
          onPress={canSubmit ? onSubmit : undefined}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Search"
          // Web's OUTLINE button (`variant="outline" h-11 w-11 rounded-xl`),
          // which Flutter draws too: a bordered box whose glyph takes the
          // primary once the query is long enough, never a filled button.
          style={{
            width: sizing.inputHeight,
            height: sizing.inputHeight,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Icon
              name="search"
              size={18}
              color={canSubmit ? colors.primary : colors.textMuted}
            />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
