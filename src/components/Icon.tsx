import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  BadgeCheck,
  BookUser,
  Camera,
  CameraOff,
  Car,
  Check,
  CircleAlert,
  Contact,
  CreditCard,
  Fingerprint,
  FileText,
  IdCard,
  Landmark,
  Lightbulb,
  Globe,
  Lock,
  Moon,
  MoveLeft,
  RefreshCw,
  ScanFace,
  ScanLine,
  ShieldCheck,
  Sun,
  Upload,
  UserRound,
  VideoOff,
  Vote,
  X,
  type LucideIcon,
} from 'lucide-react-native';

// Centralised icon set — the SAME Lucide icons the Flutter SDK uses
// (`lucide_icons_flutter`) and the web SDK uses (`lucide-react`). Rendered via
// lucide-react-native (react-native-svg), so the glyphs are pixel-identical
// across all three platforms.

export type IconName =
  // chrome
  | 'close'
  | 'back'
  | 'moon'
  | 'sun'
  | 'check'
  | 'lock'
  | 'alert'
  | 'refresh'
  // consent hero + process steps
  | 'shield'
  | 'badge-check'
  | 'user'
  | 'scan-line'
  | 'scan-face'
  // id-type glyphs
  | 'fingerprint'
  | 'credit-card'
  | 'globe'
  | 'car'
  | 'vote'
  | 'file-text'
  | 'landmark'
  | 'id-card'
  | 'contact'
  | 'passport'
  | 'camera'
  | 'camera-off'
  | 'video-off'
  | 'upload'
  | 'lightbulb';

// Maps each name to its Lucide component. Names mirror the Flutter SDK exactly:
//   shieldCheck · badgeCheck · userRound · scanLine · scanFace · fingerprint ·
//   creditCard · globe · car · vote · fileText  (+ chrome: X / ArrowLeft /
//   Moon / Sun / Check / Lock / CircleAlert / RefreshCw / Camera).
const ICONS: Record<IconName, LucideIcon> = {
  close: X,
  back: MoveLeft, // longer-shaft left arrow, matching Flutter's keyboard_backspace
  moon: Moon,
  sun: Sun,
  check: Check,
  lock: Lock,
  alert: CircleAlert,
  refresh: RefreshCw,
  shield: ShieldCheck,
  'badge-check': BadgeCheck,
  user: UserRound,
  'scan-line': ScanLine,
  'scan-face': ScanFace,
  fingerprint: Fingerprint,
  'credit-card': CreditCard,
  globe: Globe,
  car: Car,
  vote: Vote,
  'file-text': FileText,
  landmark: Landmark,
  'id-card': IdCard,
  contact: Contact,
  passport: BookUser,
  camera: Camera,
  'camera-off': CameraOff,
  'video-off': VideoOff,
  upload: Upload,
  lightbulb: Lightbulb,
};

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  /** Render a solid/filled glyph (used for the theme toggle, matching Flutter's filled moon/sun). */
  solid?: boolean;
}

export function Icon({ name, size = 20, color, strokeWidth = 2, solid = false }: IconProps): React.ReactElement {
  // Solid moon/sun for the theme toggle — Lucide has no filled variants, so use
  // Ionicons' purpose-built solid glyphs (matches Flutter's dark_mode/light_mode).
  if (solid && (name === 'moon' || name === 'sun')) {
    return <Ionicons name={name === 'moon' ? 'moon' : 'sunny'} size={size} color={color} />;
  }
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
}
