import type { IconSvgElement } from '@hugeicons/react-native';

import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import AlertCircleIcon from '@hugeicons/core-free-icons/AlertCircleIcon';
import BadgeCheckIcon from '@hugeicons/core-free-icons/BadgeCheckIcon';
import BellRingIcon from '@hugeicons/core-free-icons/BellRingIcon';
import BookUserIcon from '@hugeicons/core-free-icons/BookUserIcon';
import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon';
import Building02Icon from '@hugeicons/core-free-icons/Building02Icon';
import BulbIcon from '@hugeicons/core-free-icons/BulbIcon';
import Calendar01Icon from '@hugeicons/core-free-icons/Calendar01Icon';
import Camera01Icon from '@hugeicons/core-free-icons/Camera01Icon';
import CameraOff01Icon from '@hugeicons/core-free-icons/CameraOff01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import CancelCircleIcon from '@hugeicons/core-free-icons/CancelCircleIcon';
import Car01Icon from '@hugeicons/core-free-icons/Car01Icon';
import CheckIcon from '@hugeicons/core-free-icons/CheckIcon';
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon';
import ChevronDownIcon from '@hugeicons/core-free-icons/ChevronDownIcon';
import ChevronLeftIcon from '@hugeicons/core-free-icons/ChevronLeftIcon';
import ChevronRightIcon from '@hugeicons/core-free-icons/ChevronRightIcon';
import CircleDashedIcon from '@hugeicons/core-free-icons/CircleDashedIcon';
import ContactIcon from '@hugeicons/core-free-icons/ContactIcon';
import CopyIcon from '@hugeicons/core-free-icons/CopyIcon';
import CreditCardIcon from '@hugeicons/core-free-icons/CreditCardIcon';
import ExpandIcon from '@hugeicons/core-free-icons/ExpandIcon';
import FaceIdIcon from '@hugeicons/core-free-icons/FaceIdIcon';
import File02Icon from '@hugeicons/core-free-icons/File02Icon';
import FilterIcon from '@hugeicons/core-free-icons/FilterIcon';
import FingerPrintIcon from '@hugeicons/core-free-icons/FingerPrintIcon';
import FlashOffIcon from '@hugeicons/core-free-icons/FlashOffIcon';
import FlaskConicalIcon from '@hugeicons/core-free-icons/FlaskConicalIcon';
import GlobeIcon from '@hugeicons/core-free-icons/GlobeIcon';
import Gps02Icon from '@hugeicons/core-free-icons/Gps02Icon';
import HelpCircleIcon from '@hugeicons/core-free-icons/HelpCircleIcon';
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon';
import IdentityCardIcon from '@hugeicons/core-free-icons/IdentityCardIcon';
import Image01Icon from '@hugeicons/core-free-icons/Image01Icon';
import InformationCircleIcon from '@hugeicons/core-free-icons/InformationCircleIcon';
import LandmarkIcon from '@hugeicons/core-free-icons/LandmarkIcon';
import Link02Icon from '@hugeicons/core-free-icons/Link02Icon';
import Location02Icon from '@hugeicons/core-free-icons/Location02Icon';
import LocationCheck01Icon from '@hugeicons/core-free-icons/LocationCheck01Icon';
import LockIcon from '@hugeicons/core-free-icons/LockIcon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import MapPinHouseIcon from '@hugeicons/core-free-icons/MapPinHouseIcon';
import MapPinIcon from '@hugeicons/core-free-icons/MapPinIcon';
import Message01Icon from '@hugeicons/core-free-icons/Message01Icon';
import MinusSignIcon from '@hugeicons/core-free-icons/MinusSignIcon';
import MoonIcon from '@hugeicons/core-free-icons/MoonIcon';
import NfcIcon from '@hugeicons/core-free-icons/NfcIcon';
import PencilEdit01Icon from '@hugeicons/core-free-icons/PencilEdit01Icon';
import PencilIcon from '@hugeicons/core-free-icons/PencilIcon';
import Radar01Icon from '@hugeicons/core-free-icons/Radar01Icon';
import RefreshCwIcon from '@hugeicons/core-free-icons/RefreshCwIcon';
import RefreshIcon from '@hugeicons/core-free-icons/RefreshIcon';
import ScanIcon from '@hugeicons/core-free-icons/ScanIcon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import SecurityCheckIcon from '@hugeicons/core-free-icons/SecurityCheckIcon';
import Share01Icon from '@hugeicons/core-free-icons/Share01Icon';
import SlidersHorizontalIcon from '@hugeicons/core-free-icons/SlidersHorizontalIcon';
import SmartPhone01Icon from '@hugeicons/core-free-icons/SmartPhone01Icon';
import StampIcon from '@hugeicons/core-free-icons/StampIcon';
import Sun01Icon from '@hugeicons/core-free-icons/Sun01Icon';
import Timer01Icon from '@hugeicons/core-free-icons/Timer01Icon';
import Upload01Icon from '@hugeicons/core-free-icons/Upload01Icon';
import UserAdd01Icon from '@hugeicons/core-free-icons/UserAdd01Icon';
import UserCircleIcon from '@hugeicons/core-free-icons/UserCircleIcon';
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon';
import VideoOffIcon from '@hugeicons/core-free-icons/VideoOffIcon';
import VoteIcon from '@hugeicons/core-free-icons/VoteIcon';
import ZapIcon from '@hugeicons/core-free-icons/ZapIcon';

import { LONG_ARROW_LEFT } from './glyphs';
import type { IconName } from './names';

/**
 * Each role, and the glyph that draws it.
 *
 * Imports are DEEP - one module per icon - and must stay that way. Importing
 * from the package index instead pulls the whole 6,025-icon pack into the
 * bundle: measured at +8.33 MB for five icons against +7 KB for the same five
 * imported this way. The pack declares a `./*` export for exactly this, and
 * iconImports.test.ts fails the build on a barrel import.
 *
 * The glyphs are the ones the web SDK and Flutter already chose for these
 * names, so the three SDKs draw one set. Where neither had a choice to copy,
 * it was made against the catalogue by meaning and is noted below.
 */
export const ICONS: Record<IconName, IconSvgElement> = {
  close: Cancel01Icon,
  back: LONG_ARROW_LEFT,
  moon: MoonIcon,
  sun: Sun01Icon,
  check: CheckIcon,
  lock: LockIcon,
  alert: AlertCircleIcon,
  // The environment banner's mark, shared with the web SDK (same lucide glyph)
  // and mirrored by Flutter's Icons.science_outlined.
  flask: FlaskConicalIcon,
  refresh: RefreshCwIcon,
  'refresh-ccw': RefreshIcon,
  maximize: ExpandIcon,
  calendar: Calendar01Icon,
  image: Image01Icon,
  'chevron-left': ChevronLeftIcon,
  'chevron-right': ChevronRightIcon,
  'chevron-down': ChevronDownIcon,
  shield: SecurityCheckIcon,
  'badge-check': BadgeCheckIcon,
  'circle-dashed': CircleDashedIcon,
  'circle-check': CheckmarkCircle02Icon,
  'circle-help': HelpCircleIcon,
  'circle-x': CancelCircleIcon,
  'building-2': Building02Icon,
  stamp: StampIcon,
  user: UserCircleIcon,
  info: InformationCircleIcon,
  'user-plus': UserAdd01Icon,
  plus: Add01Icon,
  link: Link02Icon,
  copy: CopyIcon,
  share: Share01Icon,
  users: UserGroupIcon,
  'scan-line': ScanIcon,
  'scan-face': FaceIdIcon,
  nfc: NfcIcon,
  filter: FilterIcon,
  pencil: PencilIcon,
  'pencil-line': PencilEdit01Icon,
  search: Search01Icon,
  zap: ZapIcon,
  'zap-off': FlashOffIcon,
  timer: Timer01Icon,
  fingerprint: FingerPrintIcon,
  'credit-card': CreditCardIcon,
  globe: GlobeIcon,
  car: Car01Icon,
  vote: VoteIcon,
  'file-text': File02Icon,
  house: Home01Icon,
  landmark: LandmarkIcon,
  'map-pin': MapPinIcon,
  'map-pin-house': MapPinHouseIcon,
  'map-pin-check': LocationCheck01Icon,
  'map-pinned': Location02Icon,
  radar: Radar01Icon,
  'bell-ring': BellRingIcon,
  sliders: SlidersHorizontalIcon,
  locate: Gps02Icon,
  minus: MinusSignIcon,
  'id-card': IdentityCardIcon,
  contact: ContactIcon,
  passport: BookUserIcon,
  camera: Camera01Icon,
  'camera-off': CameraOff01Icon,
  'video-off': VideoOffIcon,
  upload: Upload01Icon,
  x: Cancel01Icon,
  lightbulb: BulbIcon,
  mail: Mail01Icon,
  smartphone: SmartPhone01Icon,
  'message-square': Message01Icon,
  'message-circle': BubbleChatIcon,
};
