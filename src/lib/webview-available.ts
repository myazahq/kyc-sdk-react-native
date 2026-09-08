import type React from 'react';

import { tryRequire } from '../services/fingerprint-sources';

// `react-native-webview` is an OPTIONAL peer. Absent, every surface that
// would ride it (the framed Google map, the framed Street View) degrades to
// its dependency-free path (the OSM picker, the entrance photo), and the
// FLOW MODEL must know that too, or it would offer a step the phone cannot
// render. Resolved once and cached: a require that failed will fail again.

export interface WebViewLike {
  injectJavaScript(script: string): void;
}

export type WebViewComponent = React.ComponentType<{
  ref?: React.Ref<WebViewLike>;
  source: { uri: string };
  style?: object;
  javaScriptEnabled?: boolean;
  /** Android: ask a parent ScrollView not to intercept the WebView's drags. */
  nestedScrollEnabled?: boolean;
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  onError?: () => void;
}>;

let resolved: WebViewComponent | null | undefined;

export function loadWebView(): WebViewComponent | null {
  if (resolved === undefined) {
    const mod = tryRequire<{ WebView?: WebViewComponent; default?: WebViewComponent }>(() =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('react-native-webview'),
    );
    resolved = mod?.WebView ?? mod?.default ?? null;
  }
  return resolved;
}

/** Whether a WebView can be rendered on this install. */
export function webViewAvailable(): boolean {
  return loadWebView() != null;
}

/** Test seam: forget the cached answer. */
export function __resetWebViewAvailability(): void {
  resolved = undefined;
}
