import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { radius } from '../config/theme';
import { loadWebView, type WebViewLike } from '../lib/webview-available';
import { useTheme } from './runtime';
import { MapPinPicker } from './MapPinPicker';
import {
  MAP_FRAME_READY_TIMEOUT_MS,
  buildMapFrameSrc,
  centerCommandScript,
  parseMapFrameMessage,
  samePin,
} from '../lib/map-frame';
import type { LatLng } from '../lib/map-tiles';

// Google Maps on mobile, via OUR hosted /embed/map page in a WebView (the OkHi
// model — the map runs on the hosted origin, on Myaza's own key; the host app
// never brings one). Mirrors the web SDK's FramedMapPicker: a page that never
// says `ready` (no webview module installed, blocked script, refused grant,
// vendor outage) falls back to the dependency-free OSM picker, so the step can
// never go blank. `react-native-webview` is an OPTIONAL peer: absent, this
// component IS the OSM picker.

interface FramedMapPickerProps {
  /** The server-minted page URL; null ⇒ the OSM picker outright. */
  frameUrl: string | null;
  value: LatLng | null;
  /** Corner rounding. 0 where a parent already shapes the frame — the review
   *  card rounds its TOP corners only, and the picker's own radius put a curve
   *  where the map meets the address band. */
  cornerRadius?: number;
  onChange: (pin: LatLng) => void;
  defaultCenter: LatLng;
  defaultZoom: number;
  height?: number;
}

export function FramedMapPicker({ frameUrl, value, onChange, defaultCenter, defaultZoom, height = 300, cornerRadius }: FramedMapPickerProps): React.ReactElement {
  const WebView = useMemo(loadWebView, []);
  const { colors, mode } = useTheme();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!frameUrl || !WebView);
  const readyRef = useRef(false);
  const webRef = useRef<WebViewLike>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastFromFrame = useRef<LatLng | null>(null);

  // Built once per mount: a src that tracked the pin would reload the page per drag.
  const src = useMemo(
    () =>
      frameUrl
        ? buildMapFrameSrc(frameUrl, {
            center: value ?? defaultCenter,
            zoom: defaultZoom,
            hasPin: value != null,
            theme: mode === 'dark' ? 'dark' : 'light',
            primaryColor: colors.primary,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameUrl],
  );

  useEffect(() => {
    if (failed) return undefined;
    const timeout = setTimeout(() => {
      if (!readyRef.current) setFailed(true);
    }, MAP_FRAME_READY_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [failed]);

  // An external recentre (Use my location, restored progress) moves the map —
  // but never echo back a pin the page itself just reported.
  useEffect(() => {
    if (!value || !ready || samePin(lastFromFrame.current, value)) return;
    webRef.current?.injectJavaScript(centerCommandScript(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, ready]);

  if (failed || !WebView || !src) {
    return <MapPinPicker value={value} onChange={onChange} defaultCenter={defaultCenter} defaultZoom={defaultZoom} height={height} cornerRadius={cornerRadius} />;
  }

  return (
    <View style={{ height, borderRadius: cornerRadius ?? radius.md, overflow: 'hidden', backgroundColor: colors.backgroundSecondary }}>
      <WebView
        ref={webRef}
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
        onError={() => setFailed(true)}
        onMessage={(event) => {
          const msg = parseMapFrameMessage(event.nativeEvent.data);
          if (!msg) return;
          if (msg.type === 'ready') {
            readyRef.current = true;
            setReady(true);
          } else if (msg.type === 'failed') {
            setFailed(true);
          } else {
            lastFromFrame.current = { lat: msg.lat, lng: msg.lng };
            onChangeRef.current({ lat: msg.lat, lng: msg.lng });
          }
        }}
      />
      {!ready ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}
