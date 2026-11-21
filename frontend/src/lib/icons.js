import {
  Award,
  BadgeCheck,
  Banknote,
  Egg,
  FileText,
  Eye,
  EyeOff,
  Fence,
  PawPrint,
  HandCoins,
  Handshake,
  MapPin,
  Package,
  QrCode,
  ReceiptText,
  Ruler,
  Search,
  Sprout,
  Star,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  Volume2,
  Wallet
} from "lucide-react";

// One icon per meaning, used everywhere in the app. If two screens show the
// same thing (money received, a harvest, a group…), they use the same icon
// from here, so a farmer who learns a picture once can trust it everywhere.
// Pictures for choices (crops, buyers, costs…) live with their words in
// words.js; they are all from the same icon set.
export const ICONS = {
  money: Wallet, // the Money tab and money as a whole
  sale: HandCoins, // "I sell", total sales
  income: Banknote, // money received / "they pay me"
  expense: ReceiptText, // "I spend", total expenses
  profit: TrendingUp, // what I keep
  loss: TrendingDown, // Loss
  harvest: Package, // a harvest batch
  production: Egg, // what animals give (eggs, milk)
  quality: BadgeCheck, // quality check
  grade: Award, // a grade (A, B, C)
  passport: QrCode, // Harvest Passport
  visible: Eye,
  hidden: EyeOff,
  group: Users, // farmer group / cooperative
  leader: Star, // group leader
  buyer: Handshake, // a buyer
  farmer: UserRound,
  farm: Fence, // a farm (the place)
  planting: Sprout, // a crop planting
  animals: PawPrint, // an animal group
  place: MapPin,
  size: Ruler,
  search: Search,
  voice: Volume2,
  report: FileText // the farm report
};
