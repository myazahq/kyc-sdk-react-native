import React from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from '../components/runtime';
import { MyazaText } from '../components/Typography';
import { Icon } from '../components/Icon';
import { WhatsAppIcon } from '../components/WhatsAppIcon';
import { CHANNEL_LABELS, type PhoneOtpChannel } from '../config/contact';

// ---------------------------------------------------------------------------
// How the user wants their one-time code delivered.
//
// The org decides which channels are ON OFFER; the person receiving the code
// decides between them, because only they know whether they have WhatsApp
// installed or whether SMS is landing for them today. With a single offered
// channel there is no choice to make and this renders nothing.
//
// Card shape, icon and selected treatment mirror the web SDK's picker so the
// step reads the same on every platform.
// ---------------------------------------------------------------------------

const HINTS: Record<PhoneOtpChannel, string> = {
  sms: 'Text message',
  whatsapp: 'Needs WhatsApp',
};

/** WhatsApp needs its own brand mark; SMS reads fine as a generic glyph. */
function ChannelGlyph({
  channel,
  color,
}: {
  channel: PhoneOtpChannel;
  color: string;
}): React.ReactElement {
  return channel === 'whatsapp' ? (
    <WhatsAppIcon size={16} color={color} />
  ) : (
    <Icon name="message-square" size={16} color={color} />
  );
}

export function ContactChannelChoice({
  offered,
  picked,
  disabled,
  onPick,
}: {
  offered: PhoneOtpChannel[];
  picked: PhoneOtpChannel;
  disabled?: boolean;
  onPick: (channel: PhoneOtpChannel) => void;
}): React.ReactElement | null {
  const { colors } = useTheme();
  if (offered.length < 2) return null;

  return (
    <View>
      <View style={{ height: spacing.md }} />
      <MyazaText variant="bodySmall" color={colors.textMuted}>
        How should we send it?
      </MyazaText>
      <View style={{ height: spacing.xs }} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {offered.map((channel) => (
          <ChannelTile
            key={channel}
            channel={channel}
            selected={picked === channel}
            disabled={disabled}
            onPress={() => onPick(channel)}
          />
        ))}
      </View>
    </View>
  );
}

function ChannelTile({
  channel,
  selected,
  disabled,
  onPress,
}: {
  channel: PhoneOtpChannel;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={CHANNEL_LABELS[channel]}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm + 2,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? `${colors.primary}0D` : 'transparent',
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? `${colors.primary}1A` : colors.backgroundSecondary,
        }}
      >
        <ChannelGlyph channel={channel} color={selected ? colors.primary : colors.textMuted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <MyazaText variant="bodyMedium" style={{ fontWeight: "600" }}>
          {CHANNEL_LABELS[channel]}
        </MyazaText>
        <MyazaText variant="bodySmall" color={colors.textMuted} numberOfLines={1}>
          {HINTS[channel]}
        </MyazaText>
      </View>
    </Pressable>
  );
}
