import React, { useState } from 'react';
import { Image, View } from 'react-native';

import { spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { MyazaButton } from '../../components/MyazaButton';
import { Icon } from '../../components/Icon';
import { useChipPortrait } from './useChipPortrait';
import { NfcScannedSummary } from './NfcScannedSummary';
import type { EmrtdReadResult } from '../../emrtd';
import type { MrzScan } from '../../mrz/parse';

// ---------------------------------------------------------------------------
// "Chip read successfully".
//
// The read used to advance silently, which gave the user nothing to show for
// the one step that asks them to hold a phone against a passport.
//
// The chip's OWN portrait is the confirmation when we can show it: it is the
// issuing government's photo of the holder, which is a far stronger signal
// than a tick. Most passports store it as JPEG 2000, which React Native cannot
// decode, so the generic mark is the ordinary case rather than a failure — the
// read stands either way and the bytes still go to the server.
// ---------------------------------------------------------------------------

export function NfcSuccessPanel({
  result,
  mrz,
  onContinue,
  onRescan,
}: {
  result: EmrtdReadResult;
  mrz: MrzScan | null;
  onContinue: () => void;
  onRescan: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const portraitUri = useChipPortrait(result.dg2);
  // A URI that turns out unrenderable (a corrupt slice, a format the Image
  // component rejects) must degrade to the generic mark, not an empty circle.
  const [portraitBroken, setPortraitBroken] = useState(false);
  const portrait = portraitBroken ? null : portraitUri;
  const name = [mrz?.firstName, mrz?.lastName].filter(Boolean).join(' ');

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ height: spacing.lg }} />
      {/* The chip's own portrait, circular, with the success mark tucked into
          its lower-right — 1:1 with Flutter.
          
          Circular and large on purpose: this is the issuing government's photo
          of the holder, and seeing it is a far stronger confirmation than a
          tick. The tick rides ON the portrait rather than replacing it, so the
          screen says "verified" and "this is who it says" at once. */}
      <View style={{ width: PORTRAIT, height: PORTRAIT }}>
        {portrait ? (
          <Image
            source={{ uri: portrait }}
            style={{
              width: PORTRAIT,
              height: PORTRAIT,
              borderRadius: PORTRAIT / 2,
              backgroundColor: colors.backgroundSecondary,
            }}
            resizeMode="cover"
            onError={() => {
              if (__DEV__) console.log('[myaza] chip portrait: Image failed to render the URI');
              setPortraitBroken(true);
            }}
          />
        ) : (
          // No renderable portrait — the generic mark, at the same size, so the
          // layout does not jump between documents that carry one and those
          // that do not.
          <View
            style={{
              width: PORTRAIT,
              height: PORTRAIT,
              borderRadius: PORTRAIT / 2,
              backgroundColor: `${colors.primary}1A`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="badge-check" size={56} color={colors.primary} />
          </View>
        )}
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 2,
            width: BADGE,
            height: BADGE,
            borderRadius: BADGE / 2,
            backgroundColor: colors.success,
            alignItems: 'center',
            justifyContent: 'center',
            // Punched out of the portrait rather than floating over it.
            borderWidth: 3,
            borderColor: colors.background,
          }}
        >
          <Icon name="check" size={20} color="#FFFFFF" />
        </View>
      </View>

      <View style={{ height: spacing.lg }} />
      <MyazaText variant="heading2" style={{ textAlign: 'center' }}>
        Chip read successfully
      </MyazaText>
      <View style={{ height: spacing.xs }} />
      <MyazaText variant="bodyMedium" color={colors.textSecondary} style={{ textAlign: 'center' }}>
        {name
          ? `We read the secure chip in ${name}’s document.`
          : 'The secure chip in your document was read and verified.'}
      </MyazaText>

      {/* Said plainly rather than hidden: without the signed security object
          the server cannot verify the chip data against the issuer, so the read
          is worth materially less — and the user is the only one who can
          retry it. */}
      {!result.sod ? (
        <>
          <View style={{ height: spacing.md }} />
          <MyazaText variant="bodySmall" color={colors.textMuted} style={{ textAlign: 'center' }}>
            The document&#8217;s security file could not be read, so the chip data
            cannot be fully verified. You can try again or continue.
          </MyazaText>
        </>
      ) : null}

      {/* What was read, shown back — the same card the pre-read screen uses, so
          the user checks the same two fields against the printed page. */}
      {mrz ? (
        <>
          <View style={{ height: spacing.lg }} />
          <View style={{ alignSelf: 'stretch' }}>
            <NfcScannedSummary scan={mrz} />
          </View>
        </>
      ) : null}

      <View style={{ height: spacing.lg }} />
      <View style={{ alignSelf: 'stretch' }}>
        <MyazaButton label="Continue" onPress={onContinue} />
        {!result.sod ? (
          <>
            <View style={{ height: spacing.sm }} />
            <MyazaButton label="Scan again" variant="ghost" onPress={onRescan} />
          </>
        ) : null}
      </View>
    </View>
  );
}

/** Portrait diameter. Large enough to read a face at arm's length. */
const PORTRAIT = 132;
/** The success mark overlapping its lower-right corner. */
const BADGE = 40;
