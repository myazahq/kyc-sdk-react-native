import {
  Info, BadgeCheck, BookUser, Building2, Stamp, Calendar, Camera, CameraOff, ChevronDown,
  ChevronLeft, ChevronRight, Car, Check, CircleAlert, Contact, CreditCard, Fingerprint,
  FileText, FlaskConical, IdCard, Image as ImageIcon, Landmark, Lightbulb, LocateFixed, MapPin,
  MapPinHouse, MapPinCheck, MapPinned, Radar, BellRing, SlidersHorizontal, Minus, Globe, House,
  Mail, Maximize2, Lock, MessageCircle, MessageSquare, Moon, MoveLeft, Nfc, Filter, Pencil,
  PencilLine, Smartphone, RefreshCw, RefreshCcw, ScanFace, ScanLine, Search, Zap, ZapOff,
  CircleDashed, CircleCheck, CircleHelp, CircleX, ShieldCheck, Sun, Timer, Upload, Plus,
  UserRound, UserRoundPlus, Link2, Copy, Share2, UsersRound, VideoOff, Vote, X,
  type LucideIcon
} from 'lucide-react-native';

// Centralised icon set — the SAME Lucide icons the Flutter SDK uses
// (`lucide_icons_flutter`) and the web SDK uses (`lucide-react`), so the
// glyphs are pixel-identical across all three platforms. The component that
// draws them is Icon.tsx (200-line split).

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
  | 'refresh-ccw'
  | 'maximize'
  | 'calendar'
  | 'image'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  // consent hero + process steps
  | 'shield'
  | 'badge-check'
  | 'circle-dashed'
  | 'circle-check'
  | 'circle-help'
  | 'circle-x'
  | 'building-2'
  | 'stamp'
  | 'user'
  | 'user-plus'
  | 'plus'
  | 'info'
  | 'users'
  | 'scan-line'
  | 'scan-face'
  | 'nfc'
  | 'filter'
  | 'pencil'
  | 'pencil-line'
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
  | 'house'
  | 'landmark'
  | 'id-card'
  | 'contact'
  | 'passport'
  | 'camera'
  | 'camera-off'
  | 'video-off'
  | 'upload'
  | 'x'
  // address collection (map picker + the presence milestone track)
  | 'map-pin'
  | 'map-pin-house'
  | 'map-pin-check'
  | 'map-pinned'
  | 'radar'
  | 'bell-ring'
  | 'sliders'
  | 'locate'
  | 'minus'
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
export const ICONS: Record<IconName, LucideIcon> = {
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
  'refresh-ccw': RefreshCcw,
  maximize: Maximize2,
  calendar: Calendar,
  image: ImageIcon,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  shield: ShieldCheck,
  'badge-check': BadgeCheck,
  'circle-dashed': CircleDashed,
  'circle-check': CircleCheck,
  'circle-help': CircleHelp,
  'circle-x': CircleX,
  'building-2': Building2,
  stamp: Stamp,
  user: UserRound,
  info: Info,
  'user-plus': UserRoundPlus,
  plus: Plus,
  link: Link2,
  copy: Copy,
  share: Share2,
  users: UsersRound,
  'scan-line': ScanLine,
  'scan-face': ScanFace,
  nfc: Nfc,
  filter: Filter,
  pencil: Pencil,
  'pencil-line': PencilLine,
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
  house: House,
  landmark: Landmark,
  'map-pin': MapPin,
  'map-pin-house': MapPinHouse,
  'map-pin-check': MapPinCheck,
  'map-pinned': MapPinned,
  radar: Radar,
  'bell-ring': BellRing,
  sliders: SlidersHorizontal,
  locate: LocateFixed,
  minus: Minus,
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
