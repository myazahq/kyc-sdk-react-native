import React from 'react';
import { Linking, Platform, View } from 'react-native';

import { radius, spacing } from '../config/theme';
import { useTheme } from './runtime';
import { MyazaText } from './Typography';
import { MyazaButton } from './MyazaButton';
import { Icon, type IconName } from './Icon';

// Camera error states for the document-capture step. Two variants share one
// scaffold (an 80×80 error-tinted circle + heading + message + actions):
//   • CameraPermissionView   — OS permission denied ("Camera access needed")
//                              → Open Settings + Try Again (Android only) + Upload
//   • CameraUnavailableView  — no camera device / init failure ("Camera not available")
//                              → Upload a photo instead
// Both mirror the Flutter SDK's permission/error treatment.

interface ScaffoldProps {
  icon: IconName;
  title: string;
  message: string;
  /** When true (default), vertically centers; false flows top-down below a heading. */
  centered?: boolean;
  /** Accent color for the icon + its circle (defaults to the error tint). */
  tint?: string;
  children: React.ReactNode; // action buttons
}

function CameraErrorScaffold({ icon, title, message, centered = true, tint, children }: ScaffoldProps): React.ReactElement {
  const { colors } = useTheme();
  const accent = tint ?? colors.error;
  return (
    <View
      style={
        centered
          ? { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl }
          : { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xl }
      }
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: radius.full,
          backgroundColor: `${accent}1A`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={38} color={accent} />
      </View>
      <View style={{ height: spacing.lg }} />
      <MyazaText variant="heading2" style={{ textAlign: 'center' }}>
        {title}
      </MyazaText>
      <View style={{ height: spacing.xs }} />
      <MyazaText variant="bodyMedium" color={colors.textSecondary} style={{ textAlign: 'center' }}>
        {message}
      </MyazaText>
      <View style={{ height: spacing.lg }} />
      <View style={{ width: '100%' }}>{children}</View>
    </View>
  );
}

// ── Permission denied ────────────────────────────────────────────────────────

const DEFAULT_PERMISSION_MESSAGE =
  'Camera access is required to photograph your document. Please allow camera access, or upload a photo instead.';

export interface CameraPermissionViewProps {
  message?: string;
  onRetry: () => void;
  /** Secondary action — e.g. "Upload a photo instead" on document capture. */
  onUpload?: () => void;
  centered?: boolean;
}

export function CameraPermissionView({ message, onRetry, onUpload, centered = true }: CameraPermissionViewProps): React.ReactElement {
  // iOS: re-checking in place can't succeed (only Settings grants, which
  // relaunches the app), so omit "Try Again" there — matches Flutter.
  const showRetry = Platform.OS !== 'ios';
  return (
    <CameraErrorScaffold icon="camera-off" title="Camera access needed" message={message ?? DEFAULT_PERMISSION_MESSAGE} centered={centered}>
      <MyazaButton label="Open Settings" onPress={() => void Linking.openSettings()} />
      {showRetry ? (
        <>
          <View style={{ height: spacing.sm }} />
          <MyazaButton label="Try Again" variant="outline" onPress={onRetry} />
        </>
      ) : null}
      {onUpload ? (
        <>
          <View style={{ height: spacing.sm }} />
          <MyazaButton label="Upload a photo instead" variant="ghost" leadingIcon="upload" onPress={onUpload} />
        </>
      ) : null}
    </CameraErrorScaffold>
  );
}

// ── Permission primer (before the OS prompt) ─────────────────────────────────

const DEFAULT_PRIMING_MESSAGE =
  'When prompted, allow camera access to continue your verification.';

export interface CameraPermissionPrimingViewProps {
  message?: string;
  /** Fires when the user taps "Grant access" — triggers the real OS prompt. */
  onGrant: () => void;
  centered?: boolean;
}

/**
 * "Allow camera access" priming screen, shown right before the native OS camera
 * permission prompt (mirrors Stripe Identity). The actual `requestPermission()`
 * only fires once the user taps "Grant access". Distinct from
 * `CameraPermissionView`, which is shown *after* a denial.
 */
export function CameraPermissionPrimingView({ message, onGrant, centered = true }: CameraPermissionPrimingViewProps): React.ReactElement {
  const { colors } = useTheme();
  return (
    <CameraErrorScaffold
      icon="camera"
      title="Allow camera access"
      message={message ?? DEFAULT_PRIMING_MESSAGE}
      centered={centered}
      tint={colors.primary}
    >
      <MyazaButton label="Grant access" onPress={onGrant} />
    </CameraErrorScaffold>
  );
}

// ── Camera unavailable (no device / init failure) ────────────────────────────

const DEFAULT_UNAVAILABLE_MESSAGE =
  "We couldn't start the camera on this device. Please upload a photo of your document instead.";

export interface CameraUnavailableViewProps {
  message?: string;
  onUpload?: () => void;
  centered?: boolean;
}

export function CameraUnavailableView({ message, onUpload, centered = true }: CameraUnavailableViewProps): React.ReactElement {
  return (
    <CameraErrorScaffold icon="video-off" title="Camera not available" message={message ?? DEFAULT_UNAVAILABLE_MESSAGE} centered={centered}>
      {onUpload ? <MyazaButton label="Upload a photo instead" leadingIcon="upload" onPress={onUpload} /> : null}
    </CameraErrorScaffold>
  );
}
