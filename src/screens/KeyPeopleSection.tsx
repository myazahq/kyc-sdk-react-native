import React from 'react';
import { Pressable, View } from 'react-native';

import { DashedBorder } from '../components/DashedBorder';
import { Icon } from '../components/Icon';
import { MyazaText } from '../components/Typography';
import { useTheme } from '../components/runtime';
import { radius, spacing } from '../config/theme';
import { KEY_PERSON_ROLE_LABELS, type KeyPersonEntry } from '../config/keyPeople';
import { SECTION_ROLE, type KeyPeopleSection as SectionKey } from '../config/keyPeopleSections';
import { KeyPersonCard } from './KeyPersonCard';
import type { KeyPersonRole } from '../types/business';

// One section of the key-people step — heading, plain-language definition,
// member cards, quick-add chips for people already entered elsewhere, and the
// dashed add-tile. Sections are VIEWS over one shared list
// (keyPeopleSections.ts). Mirrors the web SDK's KeyPeopleSection 1:1.

export function KeyPeopleSection({
  section,
  title,
  description,
  rows,
  members,
  quickAdd,
  emailRequiredFor,
  addLabel,
  canAdd,
  onAdd,
  onEdit,
  onRemove,
  onQuickAdd,
  children,
}: {
  section: SectionKey;
  title: string;
  description: string;
  rows: KeyPersonEntry[];
  members: number[];
  quickAdd: number[];
  emailRequiredFor: ReadonlySet<KeyPersonRole>;
  addLabel: string;
  canAdd: boolean;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onQuickAdd: (index: number) => void;
  children?: React.ReactNode;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View>
      <MyazaText variant="heading3">{title}</MyazaText>
      <MyazaText variant="bodyMedium" color={colors.textSecondary} style={{ marginTop: 2 }}>
        {description}
      </MyazaText>

      {members.length > 0 ? (
        <View style={{ marginTop: spacing.sm + 4 }}>
          {members.map((index) => (
            <KeyPersonCard
              key={index}
              entry={rows[index]!}
              emailRequiredFor={emailRequiredFor}
              // The card names the hat THIS section is about, so the same
              // person reads "Beneficial owner" here and "Director" there.
              roleLabel={KEY_PERSON_ROLE_LABELS[SECTION_ROLE[section]]}
              onPress={() => onEdit(index)}
              onRemove={() => onRemove(index)}
            />
          ))}
        </View>
      ) : null}

      {quickAdd.length > 0 && canAdd ? (
        <View style={{ marginTop: spacing.sm + 4 }}>
          <MyazaText
            variant="bodySmall"
            color={colors.textSecondary}
            style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' }}
          >
            Quick add from people you already entered
          </MyazaText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm }}>
            {quickAdd.map((index) => {
              const row = rows[index]!;
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  onPress={() => onQuickAdd(index)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingLeft: 12,
                    paddingRight: 8,
                  }}
                >
                  <Icon
                    name={row.isCorporate ? 'building-2' : 'user'}
                    size={16}
                    color={colors.textSecondary}
                  />
                  <MyazaText
                    variant="bodyMedium"
                    color={colors.textDark}
                    numberOfLines={1}
                    style={{ fontWeight: '500', maxWidth: 160 }}
                  >
                    {row.name.trim()}
                  </MyazaText>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: colors.primary100,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="plus" size={12} color={colors.primary} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {canAdd ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAdd}
          style={{
            marginTop: spacing.sm + 4,
            borderRadius: radius.sm,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}
        >
          {/* The same tight dashed language as the document slots. */}
          <DashedBorder color={colors.border} radius={radius.sm} />
          <Icon name="plus" size={16} color={colors.primary} />
          <MyazaText variant="bodyMedium" color={colors.primary} style={{ fontWeight: '600' }}>
            {addLabel}
          </MyazaText>
        </Pressable>
      ) : null}

      {children}
    </View>
  );
}
