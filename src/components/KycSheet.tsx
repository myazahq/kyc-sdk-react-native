import React, { useState } from 'react';
import { Image, Platform, ScrollView, StatusBar, View } from 'react-native';
import { StatusBarController } from './StatusBarController';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { headerSurface, radius, spacing } from '../config/theme';
import type { SupportedCountry } from '../types/config';
import { useKycConfig, useTheme } from './runtime';
import { useBranding } from './useBranding';
import { MyazaText } from './Typography';
import { StepHeader } from './StepHeader';
import { StepIndicator } from './StepIndicator';
import { GlassIconButton } from './GlassIconButton';
import { GlassSurface } from './glass/GlassSurface';
import { GlassGroup } from './glass/GlassGroup';

// Full-screen sheet shell — 1:1 with the Flutter SDK's KycBottomSheet:
//   • a tinted header block (Liquid Glass on iOS 26) with a bottom border:
//       row 1 → brand bar (left) + theme toggle + close (glass icon buttons)
//       row 2 → StepHeader (back + title + country flag, description)
//       row 3 → segmented step indicator
//   • scrollable step body below.

export interface KycSheetProps {
  children: React.ReactNode;
  title: string;
  description?: string | null;
  /** 0–1 progress fraction; null hides the step indicator. */
  progress?: number | null;
  stepCount?: number | null;
  country?: SupportedCountry | null;
  onBack?: (() => void) | null;
  onClose: () => void;
  /** Hide the persistent brand bar (e.g. on a fatal config-error screen). */
  hideBrand?: boolean;
}

export function KycSheet({
  children,
  title,
  description,
  progress,
  stepCount,
  country,
  onBack,
  onClose,
  hideBrand,
}: KycSheetProps): React.ReactElement {
  const { colors, mode, toggle } = useTheme();
  const config = useKycConfig();
  const { logoUri, companyName } = useBranding();

  const tint = headerSurface(colors, mode);
  const showIndicator = progress != null && stepCount != null;
  const showBrand = !hideBrand && !!logoUri;



  // On iOS the modal is a pageSheet by default (sits below the status bar), but
  // `disableClose` presents it full-screen (to drop the swipe-to-dismiss), so it
  // then extends under the notch + over the home indicator and needs its own
  // safe-area insets — the pageSheet provides them for free.
  const iosFullScreen = Platform.OS === 'ios' && config.disableClose === true;

  // Static safe-area snapshot (captured at app launch — no SafeAreaProvider
  // needed). On Android 15+/API 35+ the modal is drawn EDGE-TO-EDGE, and
  // `StatusBar.currentHeight` is unreliable there, so the real top inset comes
  // from here.
  const sa = initialWindowMetrics?.insets;

  // Keep the header controls clear of the status bar / notch.
  //   • Android: full-screen edge-to-edge modal → clear the status bar using the
  //     safe-area top inset (fall back to StatusBar.currentHeight, then 28dp).
  //   • iOS pageSheet: already below the status bar → no inset.
  //   • iOS full-screen (disableClose): 56 covers the status bar + notch.
  const topInset =
    Platform.OS === 'android'
      ? sa?.top || StatusBar.currentHeight || 28
      : iosFullScreen
        ? 56
        : 0;

  // Clear the home indicator / nav bar at the bottom of a full-screen modal.
  const bottomInset =
    Platform.OS === 'android' ? sa?.bottom ?? 0 : iosFullScreen ? 34 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* The SDK theme drives the status-bar glyph colour so it stays readable on
          the modal background — light glyphs in dark mode, dark in light mode.
          Android: JS StatusBar/SystemBars can't reach the <Modal>'s Dialog window,
          so a native view (StatusBarController) themes it from inside the modal.
          iOS: only the full-screen modal (disableClose) slides under the bar — the
          default pageSheet keeps the host bar above the card. */}
      {Platform.OS === 'android' ? (
        <StatusBarController barStyle={mode === 'dark' ? 'light' : 'dark'} />
      ) : iosFullScreen ? (
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} animated />
      ) : null}
      <View style={{ flex: 1 }}>
        {/* Header block (glass on iOS 26, tinted surface otherwise) */}
        <GlassSurface
          glassStyle="regular"
          fallbackColor={tint}
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.md }}
        >
          {/* Row 1 — brand + controls */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.md,
              paddingTop: topInset + spacing.sm,
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              {showBrand ? <BrandBar logoUri={logoUri!} companyName={companyName} /> : null}
            </View>

            {/* Header controls. When BOTH the theme toggle and close show, they
                share a single Liquid Glass capsule (each button `plain`). When
                only one shows — the consumer disabled the other (`disableClose`
                or `showThemeToggle: false`) — that button stands on its own
                glass instead of a one-icon capsule. Neither → nothing. */}
            {(() => {
              const showToggle = config.showThemeToggle !== false;
              const showClose = !config.disableClose;
              const toggleBtn = showToggle ? (
                <GlassIconButton
                  icon={mode === 'dark' ? 'sun' : 'moon'}
                  onPress={toggle}
                  solid
                  plain={showClose}
                  accessibilityLabel="Toggle theme"
                />
              ) : null;
              const closeBtn = showClose ? (
                <GlassIconButton
                  icon="close"
                  onPress={onClose}
                  plain={showToggle}
                  accessibilityLabel="Close"
                />
              ) : null;

              if (showToggle && showClose) {
                return (
                  <GlassGroup style={{ gap: 2 }}>
                    {toggleBtn}
                    {closeBtn}
                  </GlassGroup>
                );
              }
              // Exactly one (or zero) — render it standalone with its own glass.
              return toggleBtn ?? closeBtn;
            })()}
          </View>

          {/* Row 2 — title + back + flag */}
          {title || onBack ? (
            <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
              <StepHeader title={title} description={description} onBack={onBack} country={country} />
            </View>
          ) : null}

          {/* Row 3 — step indicator */}
          {showIndicator ? (
            <View style={{ marginTop: spacing.md }}>
              <StepIndicator progress={progress!} stepCount={stepCount!} />
            </View>
          ) : null}
        </GlassSurface>

        {/* Step body */}
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl + bottomInset, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

// Persistent header brand — circular logo avatar + company name. A broken/missing
// logo image collapses the whole brand bar (mirrors the web SDK's `onError` and
// Flutter's `errorBuilder`), so the header never shows a broken-image box.
function BrandBar({ logoUri, companyName }: { logoUri: string; companyName: string }): React.ReactElement | null {
  const { colors } = useTheme();
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radius.full,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.05)',
          overflow: 'hidden',
          marginRight: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Fill + cover-crop the circle. The borderRadius is repeated on the
            Image itself because iOS doesn't reliably clip an Image child to a
            parent's rounded corners (mirrors Flutter's ClipOval + cover). */}
        <Image
          source={{ uri: logoUri }}
          style={{ width: '100%', height: '100%', borderRadius: radius.full }}
          resizeMode="cover"
          onError={() => setBroken(true)}
        />
      </View>
      <MyazaText variant="heading3" numberOfLines={1} color={colors.textDark} style={{ flexShrink: 1, fontSize: 14 }}>
        {companyName}
      </MyazaText>
    </>
  );
}
