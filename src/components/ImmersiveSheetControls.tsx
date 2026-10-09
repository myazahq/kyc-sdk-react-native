import React from 'react';
import { View } from 'react-native';

import { radius } from '../config/theme';
import { useTheme } from './runtime';
import { OwnTheme } from './theme-provider';
import { GlassIconButton } from './GlassIconButton';

// ---------------------------------------------------------------------------
// Back and close for a step that has the whole sheet (the full-screen liveness
// camera), which has no header to hold them.
//
// Each sits on its own solid disc in the flow's colours: behind them is a
// camera, and a bare glyph on whatever the room looks like is not a button.
// The buttons are the header's own (same glyphs, same 40dp disc, named for a
// screen reader, with a tap area that reaches past the disc).
//
// In the flow's OWN theme, not the lit one: on a dark flow the bright screen is
// there to light the face, and two white buttons are no part of that.
// ---------------------------------------------------------------------------

/** Where the middle of each button sits from its edge of the sheet. */
const CENTRE_INSET = 32;
const DISC = 40;

function Disc({ children }: { children: React.ReactNode }): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: DISC,
        height: DISC,
        borderRadius: radius.full,
        backgroundColor: colors.backgroundSecondary,
        borderColor: colors.border,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

export function ImmersiveSheetControls({
  top,
  onBack,
  onClose,
}: {
  top: number;
  onBack?: () => void;
  onClose?: () => void;
}): React.ReactElement {
  const side = CENTRE_INSET - DISC / 2;
  return (
    <OwnTheme>
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top, left: 0, right: 0, height: DISC, zIndex: 10, elevation: 10 }}
    >
      {onBack ? (
        <View style={{ position: 'absolute', left: side, top: 0 }}>
          <Disc>
            <GlassIconButton icon="back" onPress={onBack} size={DISC - 2} plain accessibilityLabel="Back" />
          </Disc>
        </View>
      ) : null}
      {onClose ? (
        <View style={{ position: 'absolute', right: side, top: 0 }}>
          <Disc>
            <GlassIconButton icon="close" onPress={onClose} size={DISC - 2} plain accessibilityLabel="Close" />
          </Disc>
        </View>
      ) : null}
    </View>
    </OwnTheme>
  );
}
