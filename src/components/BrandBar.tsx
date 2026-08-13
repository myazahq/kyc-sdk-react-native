import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';

/** Whether a logo URI points at an SVG (extension check, query-safe). */
export function isSvgUri(uri: string): boolean {
  const path = uri.split('?')[0] ?? uri;
  return path.toLowerCase().endsWith('.svg');
}

// Deliberately NOT on a Liquid Glass capsule, though it would balance the
// theme/close capsule opposite it. Glass at capsule scale is the material for
// controls — something that floats and responds to touch. The brand is a label,
// so a pill around it promises a tap that never does anything. The header block
// behind it is glass, which is the correct use: a surface, not a control.
//
// Persistent header brand — circular logo avatar + company name. A broken/missing
// logo image collapses the whole brand bar (mirrors the web SDK's `onError` and
// Flutter's `errorBuilder`), so the header never shows a broken-image box.
export function BrandBar({
  logoUri,
  companyName,
}: {
  logoUri: string;
  companyName: string;
}): React.ReactElement | null {
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
      {/* TWO layers, deliberately.

          A shadow and `overflow: 'hidden'` CANNOT live on the same view on iOS:
          overflow-hidden compiles to `masksToBounds`, which clips the shadow
          away with everything else outside the bounds. Android draws `elevation`
          outside the view, so it survived there — which is why the chip lost its
          ring on iPhone only.

          So the outer view owns the border and shadow and does NOT clip, and the
          inner one clips the logo. Same split Flutter gets for free by putting
          the border on the Container's decoration and the crop in a ClipOval.

          The white plate is load-bearing, not decoration: brand logos are
          routinely dark artwork on a transparent background (the import picks up
          favicons), which would vanish against a dark header. */}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radius.full,
          backgroundColor: '#FFFFFF',
          // Light ring + soft shadow — the same treatment as the Flutter SDK's
          // brand chip (black 5% ring, black 6% blur-4 y-1 shadow) and the web
          // SDK's ring-1 ring-black/5.
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.05)',
          shadowColor: '#000000',
          shadowOpacity: 0.06,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
          marginRight: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            // Fills the parent's CONTENT box (inside its 1px border) and is the
            // only thing that clips, so the logo reaches the ring on every side.
            alignSelf: 'stretch',
            flex: 1,
            borderRadius: radius.full,
            overflow: 'hidden',
          }}
        >
          {/* Fill + cover-crop, matching Flutter's SizedBox.expand + BoxFit.cover.

            Sized in PERCENTAGES, not the literal 26 this used to hardcode: that
            number was "28 minus the 1px border on each side", so it silently
            went wrong the moment either value changed, and it left the logo a
            pixel short of the ring. The clipping parent now owns the geometry.

            SVG logos are common here because the brand import picks up site
            favicons, and <Image> cannot decode SVG at all — hence the fetched
            markup through SvgXml. `slice` is the SVG spelling of cover-crop. */}
          {svg ? (
            xml ? (
              <SvgXml xml={xml} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
            ) : null
          ) : (
            <Image
              source={{ uri: logoUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              onError={() => setBroken(true)}
            />
          )}
        </View>
      </View>
      <MyazaText
        variant="heading3"
        numberOfLines={1}
        color={colors.textDark}
        style={{ flexShrink: 1, fontSize: 14 }}
      >
        {companyName}
      </MyazaText>
    </>
  );
}
