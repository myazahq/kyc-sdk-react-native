import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../components/runtime';
import { spacing } from '../config/theme';
import {
  grantRole,
  quickAddCandidates,
  sectionMembers,
  withoutSection,
  type KeyPeopleSection as SectionKey,
} from '../config/keyPeopleSections';
import type { KeyPeopleSectionDef } from '../config/keyPeopleSectionDefs';
import { KeyPeopleSection } from './KeyPeopleSection';
import { KeyPeopleUboExemption } from './KeyPeopleUboExemption';
import type { KeyPersonEntry } from '../config/keyPeople';
import type { KeyPersonRole } from '../types/business';

// The stacked sections with their shared-list plumbing: quick-add grants an
// existing person the section's hat, and the card's X takes them out of that
// section — dropping just the hat when membership rested on it, or the whole
// person when a declared stake (or a last remaining hat) is what holds them
// there. Split from BusinessKeyPeopleStep (200-line rule); mirrors the web
// SDK's KeyPeopleSectionsList 1:1.

export function KeyPeopleSectionsList({
  sections,
  rows,
  threshold,
  emailRequiredFor,
  uboUnidentifiable,
  canAdd,
  onRows,
  onSheet,
  onExemption,
}: {
  sections: KeyPeopleSectionDef[];
  rows: KeyPersonEntry[];
  threshold: number;
  emailRequiredFor: ReadonlySet<KeyPersonRole>;
  uboUnidentifiable: boolean;
  canAdd: boolean;
  onRows: (next: KeyPersonEntry[]) => void;
  onSheet: (sheet: { mode: 'add' | 'edit'; section: SectionKey; index?: number }) => void;
  onExemption: (next: boolean) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const members = sectionMembers(rows, threshold);

  const removeFromSection = (section: SectionKey, index: number): void => {
    const next = withoutSection(rows[index]!, section, threshold);
    onRows(
      next === null
        ? rows.filter((_, i) => i !== index)
        : rows.map((row, i) => (i === index ? next : row)),
    );
  };

  return (
    <View>
      {sections.map(({ key, title, description, addLabel }, i) => (
        <React.Fragment key={key}>
          {i > 0 ? (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                marginVertical: spacing.lg,
              }}
            />
          ) : null}
          <KeyPeopleSection
            section={key}
            title={title}
            description={description}
            rows={rows}
            members={members[key]}
            quickAdd={
              key === 'ubos' && uboUnidentifiable ? [] : quickAddCandidates(rows, key, threshold)
            }
            emailRequiredFor={emailRequiredFor}
            addLabel={addLabel}
            canAdd={canAdd && !(key === 'ubos' && uboUnidentifiable)}
            onAdd={() => onSheet({ mode: 'add', section: key })}
            onEdit={(index) => onSheet({ mode: 'edit', section: key, index })}
            onRemove={(index) => removeFromSection(key, index)}
            onQuickAdd={(index) =>
              onRows(rows.map((row, i2) => (i2 === index ? grantRole(row, key) : row)))
            }
          >
            {key === 'ubos' ? (
              <KeyPeopleUboExemption
                checked={uboUnidentifiable}
                hasUbos={members.ubos.length > 0}
                onChange={onExemption}
              />
            ) : null}
          </KeyPeopleSection>
        </React.Fragment>
      ))}
    </View>
  );
}
