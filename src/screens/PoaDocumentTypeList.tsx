import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../components/runtime';
import { Icon, type IconName } from '../components/Icon';
import { OptionRow } from '../components/OptionRow';
import type { PoaDocumentType } from '../types/workflow';

// ---------------------------------------------------------------------------
// The document kinds LISTED OUT as the questionnaire's multi-select cards (a
// square check, primary when picked, an icon beside the label) rather than
// hidden behind a select — the options are the information, and a sheet makes
// the person open it to find out what is on offer (user decision 2026-09-05).
// ONE kind is picked, because one document is uploaded: the cards are radios
// wearing the multi-select's square check. Locked once a file is attached, so
// the kind cannot drift from the document already uploaded. Mirrors the web
// SDK's steps/PoaDocumentTypeList and Flutter's proof_of_address_kinds.
// ---------------------------------------------------------------------------

/** One glyph per kind — the SAME Lucide names the web and Flutter maps carry. */
export const POA_TYPE_ICONS: Record<PoaDocumentType, IconName> = {
  utility_bill: 'zap',
  bank_statement: 'landmark',
  tenancy_agreement: 'house',
  government_document: 'stamp',
  other: 'file-text',
};

export function PoaDocumentTypeList({
  options,
  value,
  disabled,
  onChange,
}: {
  options: Array<{ value: PoaDocumentType; label: string }>;
  value: PoaDocumentType;
  disabled?: boolean;
  onChange: (value: PoaDocumentType) => void;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <OptionRow
            key={opt.value}
            label={opt.label}
            selected={selected}
            multi
            role="radio"
            disabled={disabled}
            icon={
              <Icon
                name={POA_TYPE_ICONS[opt.value]}
                size={20}
                color={selected ? colors.primary : colors.textSecondary}
              />
            }
            onPress={() => onChange(opt.value)}
          />
        );
      })}
    </View>
  );
}
