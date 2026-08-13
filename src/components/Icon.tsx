import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  BadgeCheck,
  BookUser,
  Building2,
  Calendar,
  Camera,
  CameraOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Car,
  Check,
  CircleAlert,
  Contact,
  CreditCard,
  Fingerprint,
  FileText,
  FlaskConical,
  IdCard,
  Image as ImageIcon,
  Landmark,
  Lightbulb,
  Globe,
  Mail,
  Maximize2,
  Lock,
  MessageCircle,
  MessageSquare,
  Moon,
  MoveLeft,
  Nfc,
  Pencil,
  Smartphone,
  RefreshCw,
  ScanFace,
  ScanLine,
  Search,
  Zap,
  ZapOff,
  ShieldCheck,
  Sun,
  Timer,
  Upload,
  UserRound,
  UserRoundPlus,
  Link2,
  Copy,
  Share2,
  UsersRound,
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
  | 'flask'
  | 'refresh'
  | 'maximize'
  | 'calendar'
  | 'image'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  // consent hero + process steps
  | 'shield'
  | 'badge-check'
  | 'building-2'
  | 'user'
  | 'user-plus'
  | 'users'
  | 'scan-line'
  | 'scan-face'
  | 'nfc'
  | 'pencil'
  | 'search'
  | 'zap'
  | 'link'
  | 'copy'
  | 'share'
  | 'zap-off'
  | 'timer'
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
  | 'x'
  | 'lightbulb'
  // contact verification (OTP channels + step footer)
  | 'mail'
  | 'smartphone'
  | 'message-square'
  | 'message-circle';

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
  // The environment banner's mark, shared with the web SDK (same lucide glyph)
  // and mirrored by Flutter's Icons.science_outlined.
  flask: FlaskConical,
  refresh: RefreshCw,
  maximize: Maximize2,
  calendar: Calendar,
  image: ImageIcon,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  shield: ShieldCheck,
  'badge-check': BadgeCheck,
  'building-2': Building2,
  user: UserRound,
  'user-plus': UserRoundPlus,
  link: Link2,
  copy: Copy,
  share: Share2,
  users: UsersRound,
  'scan-line': ScanLine,
  'scan-face': ScanFace,
  nfc: Nfc,
  pencil: Pencil,
  search: Search,
  zap: Zap,
  'zap-off': ZapOff,
  timer: Timer,
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
  x: X,
  lightbulb: Lightbulb,
  mail: Mail,
  smartphone: Smartphone,
  'message-square': MessageSquare,
  'message-circle': MessageCircle,
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
