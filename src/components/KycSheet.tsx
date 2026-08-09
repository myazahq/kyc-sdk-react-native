import React, { useEffect, useState } from 'react';
import { Image, Platform, ScrollView, StatusBar, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { StatusBarController } from './StatusBarController';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import { headerSurface, radius, spacing } from '../config/theme';
import { useKeyboardInset } from '../lib/use-keyboard-inset';
import type { SupportedCountry } from '../types/config';
import { useKycConfig, useTheme } from './runtime';
import { useBranding } from './useBranding';
import { MyazaText } from './Typography';
import { PoweredBy } from './PoweredBy';
import { StepHeader } from './StepHeader';
import { StepIndicator } from './StepIndicator';
import { GlassIconButton } from './GlassIconButton';
import { GlassSurface } from './glass/GlassSurface';
import { GlassGroup } from './glass/GlassGroup';
import { FlashOverlay } from './FlashOverlay';

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
  /**
   * Render the step body as a fixed-height flex container instead of a scroll
   * view, so the step owns its own scrolling.
   *
   * Needed by any step with a PINNED element above a long list — the country
   * picker's search box, for one. RN gives a nested same-axis ScrollView an
   * unbounded height, so the inner list grows to fit every row, the outer
   * content outgrows the viewport, and the outer view scrolls the "pinned"
   * element off the top. `flexGrow: 1` cannot prevent that: it sets a minimum
   * height, not a maximum. Flutter hits the same wall and solves it the same
   * way (`KycBottomSheet.fillsViewport`).
   */
  fillsViewport?: boolean;
  /**
   * Hand the whole surface to the step — no header, no footer, no padding.
   *
   * Used by the live camera, which wants the entire display. It is a PROP
   * rather than the caller rendering its own tree because the toggle happens
   * MID-STEP: swapping the step's parent would unmount and remount it, losing
   * its state (the acknowledged primer, the captured sides) and restarting the
   * camera. Keeping one stable tree is the whole point.
   */
  immersive?: boolean;
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
  fillsViewport,
  immersive = false,
}: KycSheetProps): React.ReactElement {
  const { colors, mode, toggle } = useTheme();
  const config = useKycConfig();
  const { logoUri, companyName } = useBranding();
  // Android-only (0 on iOS): the translucent Modal blocks adjustResize there,
  // so the keyboard height is added to the scroll padding by hand.
  const keyboardInset = useKeyboardInset();

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
    <View style={{ flex: 1, backgroundColor: immersive ? '#000000' : colors.background }}>
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
        {/* Header block (glass on iOS 26, tinted surface otherwise) — dropped
            entirely when the step owns the display. */}
        {immersive ? null : <GlassSurface
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
        </GlassSurface>}

        {/* Step body */}
        {fillsViewport ? (
          // Only the visual gap here, NOT the scroll variant's `xl`: that
          // padding exists so scrolled content clears the home indicator, but
          // in a fixed-height body it just lifts the list off the footer and
          // reads as a dead band. PoweredBy owns the safe-area inset already.
          <View style={{ flex: 1, padding: spacing.md, paddingBottom: spacing.md }}>
            {children}
          </View>
        ) : (
          // IMMERSIVE keeps this a ScrollView rather than swapping in a View.
          // The toggle happens MID-STEP, and changing the children's parent
          // element remounts the step — which wiped the acknowledged primer and
          // bounced the user straight back to it. Same element, different
          // props: scrolling off and the padding dropped.
          <ScrollView
            scrollEnabled={!immersive}
            contentContainerStyle={
              immersive
                ? { flexGrow: 1 }
                : {
                    padding: spacing.md,
                    paddingTop: spacing.md,
                    paddingBottom: spacing.xl + keyboardInset,
                    flexGrow: 1,
                  }
            }
            keyboardShouldPersistTaps="handled"
            // iOS: inset the content by the keyboard AND scroll the focused
            // input into view — the platform's own handling, which a
            // KeyboardAvoidingView only approximates. Without this the
            // keyboard simply covered the bottom of every input step.
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios' && !immersive}
          >
            {children}
          </ScrollView>
        )}

        {/* Vendor attribution — a sibling of the ScrollView, so it stays pinned
            while a long step scrolls under it. It now owns the bottom safe-area
            inset that the scroll padding used to carry. */}
        {immersive ? null : <PoweredBy bottomInset={bottomInset} />}
      </View>

      {/* The flash paints over the WHOLE sheet — header, body and footer — but
          from inside the sheet's own tree, so its cutout and the camera preview
          scale together. It subscribes to the store itself, so a colour change
          re-renders this leaf and not the step (and not the camera).

          LAST sibling, on purpose. As the first child it sat below everything
          later in the tree, and on Android the header's elevated surface
          painted over it — the flash lit the body and stopped dead at the
          header. Last-with-elevation out-stacks the header on both platforms
          by construction. */}
      <FlashOverlay />
    </View>
  );
}

/** Whether a logo URI points at an SVG (extension check, query-safe). */
function isSvgUri(uri: string): boolean {
  const path = uri.split('?')[0] ?? uri;
  return path.toLowerCase().endsWith('.svg');
}

// Persistent header brand — circular logo avatar + company name. A broken/missing
// logo image collapses the whole brand bar (mirrors the web SDK's `onError` and
// Flutter's `errorBuilder`), so the header never shows a broken-image box.
function BrandBar({ logoUri, companyName }: { logoUri: string; companyName: string }): React.ReactElement | null {
  const { colors } = useTheme();
  const [broken, setBroken] = useState(false);
  const svg = isSvgUri(logoUri);
  // SVG logos render through SvgXml with SELF-FETCHED markup — the exact
  // pipeline the country flags use, which is proven on-device. SvgUri's own
  // fetch/sizing was flaky here (the favicon rendered at intrinsic size
  // instead of filling the chip).
  const [xml, setXml] = useState<string | null>(null);
  useEffect(() => {
    if (!svg) return;
    let cancelled = false;
    fetch(logoUri)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => {
        if (!cancelled) setXml(text);
      })
      .catch(() => {
        if (!cancelled) setBroken(true);
      });
    return () => {
      cancelled = true;
    };
  }, [logoUri, svg]);
  if (broken) return null;
  return (
    <>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radius.full,
          backgroundColor: '#FFFFFF',
          // Light border + soft shadow — the same treatment as the Flutter
          // SDK's brand chip (black 5% ring, black 6% blur-4 y-1 shadow) and
          // the web SDK's ring-1 ring-black/5.
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.05)',
          shadowColor: '#000000',
          shadowOpacity: 0.06,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
          overflow: 'hidden',
          marginRight: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Fill + cover-crop the circle. The borderRadius is repeated on the
            Image itself because iOS doesn't reliably clip an Image child to a
            parent's rounded corners (mirrors Flutter's ClipOval + cover).
            SVG logos (common — the brand import picks up site favicons) can't
            be decoded by <Image>; the fetched markup renders via SvgXml at
            the chip's inner size (26 = 28 minus the 1px border each side),
            slice = cover-crop. */}
        {svg ? (
          xml ? (
            <SvgXml
              xml={xml}
              width={26}
              height={26}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : null
        ) : (
          <Image
            source={{ uri: logoUri }}
            style={{ width: '100%', height: '100%', borderRadius: radius.full }}
            resizeMode="cover"
            onError={() => setBroken(true)}
          />
        )}
      </View>
      <MyazaText variant="heading3" numberOfLines={1} color={colors.textDark} style={{ flexShrink: 1, fontSize: 14 }}>
        {companyName}
      </MyazaText>
    </>
  );
}
