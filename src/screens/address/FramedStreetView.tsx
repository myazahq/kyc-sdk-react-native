import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';

import { radius, spacing } from '../../config/theme';
import { useTheme } from '../../components/runtime';
import { MyazaText } from '../../components/Typography';
import { MyazaButton } from '../../components/MyazaButton';
import { StickyActions } from '../../components/StickyActions';
import { loadWebView } from '../../lib/webview-available';
import {
  MAP_FRAME_READY_TIMEOUT_MS,
  buildStreetViewFrameSrc,
  parseStreetViewFrameMessage,
} from '../../lib/map-frame';
import { captureStreetViewFrame, type StreetViewFrame } from '../../lib/street-view-fov';
import { mapSurfaceHeight, type LatLng } from '../../lib/map-tiles';
import { StreetViewChrome, streetViewFrameRect } from './StreetViewChrome';

// Street View on mobile, via OUR hosted /embed/street-view page in a WebView —
// the same model (and the same app grant) as FramedMapPicker. The page renders
// the panorama and streams the current view; THIS component owns the framing
// chrome, the frame-subtended fov maths and the capture decision, so hosted,
// embedded and native applicants meet the identical instrument. Mirrors the
// web SDK's FramedStreetView and the Flutter twin; keep the three in lockstep.
// A page that never says sv-ready (no webview module, blocked script, refused
// grant, no coverage) hands the step to the photo fallback via onUnavailable.

type Pov = { panoId: string; heading: number; pitch: number; viewFov: number };

export function FramedStreetView({
  frameUrl,
  pin,
  onCaptured,
  onSkip,
  hideSkip,
  onUnavailable,
}: {
  frameUrl: string;
  pin: LatLng;
  onCaptured: (frame: StreetViewFrame) => void;
  /** The applicant would rather add their own photo. */
  onSkip: () => void;
  /** streetView 'required': the skip affordance is removed while coverage
   *  exists (no-coverage still falls back — the client-UX gate only). */
  hideSkip?: boolean;
  /** No coverage, no grant, or no page — fall back to the photo. */
  onUnavailable: () => void;
}): React.ReactElement {
  const WebView = useMemo(loadWebView, []);
  const { colors, mode } = useTheme();
  const height = mapSurfaceHeight(useWindowDimensions());
  const [ready, setReady] = useState(false);
  const [viewWidth, setViewWidth] = useState(0);
  const readyRef = useRef(false);
  const latestPov = useRef<Pov | null>(null);
  const gone = useRef(false);
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;
  const unavailable = () => {
    if (gone.current) return;
    gone.current = true;
    unavailableRef.current();
  };

  // Built once per mount: a src that tracked the theme would reload the page.
  const src = useMemo(
    () => buildStreetViewFrameSrc(frameUrl, { pin, theme: mode === 'dark' ? 'dark' : 'light' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameUrl],
  );

  useEffect(() => {
    if (!WebView) {
      unavailable();
      return undefined;
    }
    const timeout = setTimeout(() => {
      if (!readyRef.current) unavailable();
    }, MAP_FRAME_READY_TIMEOUT_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WebView]);

  const capture = () => {
    const pov = latestPov.current;
    if (!pov) return;
    // The promise on screen is the FRAME, so the captured fov is the slice the
    // frame subtends of the reported viewport fov — same maths, same frame
    // geometry as the hosted framer.
    const frame = streetViewFrameRect(viewWidth, height);
    onCaptured(captureStreetViewFrame(pov, frame.width, viewWidth));
  };

  return (
    <StickyActions
      actions={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {!hideSkip ? (
            <View style={{ flex: 1 }}>
              <MyazaButton label="Skip" variant="outline" onPress={onSkip} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <MyazaButton label="Use this view" disabled={!ready} onPress={capture} />
          </View>
        </View>
      }
    >
      <View
        onLayout={(e) => setViewWidth(e.nativeEvent.layout.width)}
        style={{ height, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.backgroundSecondary }}
      >
        {WebView ? (
          <WebView
            source={{ uri: src }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            javaScriptEnabled
            // Android: this WebView sits inside StickyActions' ScrollView, and a
            // ScrollView intercepts every vertical drag its children start, so the
            // map moved a few pixels and stopped while the page scrolled instead.
            // nestedScrollEnabled makes the WebView ask the parent not to intercept
            // (requestDisallowInterceptTouchEvent) for the life of the touch. No-op
            // on iOS. Reported on a Galaxy S24, 2026-09-07.
            nestedScrollEnabled
            onError={unavailable}
            onMessage={(event) => {
              const msg = parseStreetViewFrameMessage(event.nativeEvent.data);
              if (!msg) return;
              if (msg.type === 'sv-ready') {
                readyRef.current = true;
                setReady(true);
              } else if (msg.type === 'sv-unavailable') {
                unavailable();
              } else {
                latestPov.current = { panoId: msg.panoId, heading: msg.heading, pitch: msg.pitch, viewFov: msg.viewFov };
              }
            }}
          />
        ) : null}
        {!ready ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <StreetViewChrome viewportWidth={viewWidth} viewportHeight={height} />
        )}
      </View>
      {ready ? (
        <MyazaText variant="bodySmall" color={colors.textSecondary} style={{ textAlign: 'center', marginTop: spacing.sm }}>
          Drag to look around until your gate or front door sits inside the frame.
        </MyazaText>
      ) : null}
    </StickyActions>
  );
}
