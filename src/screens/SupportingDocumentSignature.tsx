import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../components/runtime';
import { UiButton } from '../components/UiButton';
import { UiText } from '../components/Typography';
import { SignaturePad } from '../components/SignaturePad';
import { hasSignature, type SignatureDrawing } from '../lib/signature';

// The sign-on-screen half of a supporting document: the pad, and one button
// that keeps what was drawn. The button stays disabled until there is real
// ink, so nobody saves a dot. MIRRORS the web SDK's SupportingDocumentSignature.
// The wording is fixed: only the texts in the shared customisable contract go
// through the text catalogue.

export function SupportingDocumentSignature({
  label,
  saving,
  initial,
  onSave,
  onUploadInstead,
}: {
  label: string;
  saving: boolean;
  /** The signature being edited, when there is one. */
  initial?: SignatureDrawing | null;
  onSave: (drawing: SignatureDrawing) => void;
  /** Offered when the workflow also takes a photo of a signature on paper. */
  onUploadInstead?: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const [drawing, setDrawing] = useState<SignatureDrawing | null>(initial ?? null);
  const [ready, setReady] = useState(initial ? hasSignature(initial) : false);

  return (
    <View>
      <SignaturePad
        label={`Sign here: ${label}`}
        hint={'Sign here with your index finger'}
        clearLabel={'Clear'}
        disabled={saving}
        initial={initial}
        onChange={(next, enough) => {
          setDrawing(next);
          setReady(enough);
        }}
      />
      <View style={{ height: 8 }} />
      <UiButton
        label={saving ? 'Saving…' : 'Use this signature'}
        loading={saving}
        disabled={!ready || !drawing}
        onPress={() => {
          if (drawing) onSave(drawing);
        }}
      />
      {onUploadInstead ? (
        <Pressable
          onPress={onUploadInstead}
          disabled={saving}
          accessibilityRole="button"
          style={({ pressed }) => ({
            minHeight: 44,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 8,
            opacity: saving ? 0.5 : pressed ? 0.7 : 1,
          })}
        >
          <UiText variant="label" color={colors.primary} style={{ fontSize: 12 }}>
            {'Upload a photo of your signature instead'}
          </UiText>
        </Pressable>
      ) : null}
    </View>
  );
}
