import {
  ScanEye,
  Baby,
  Bird,
  ClipboardList,
  Droplet,
  Droplets,
  Egg,
  FlaskConical,
  HeartPulse,
  Layers,
  MoreHorizontal,
  Package,
  PaintBucket,
  PawPrint,
  Scissors,
  ShoppingBag,
  Shovel,
  Sparkles,
  SprayCan,
  Sprout,
  Syringe,
  Weight,
  Wheat
} from "lucide-react";
import { ACTIVITY_WORDS, FARM_TYPE_WORDS, UNIT_WORDS } from "./words.js";

const BASE_ACTIVITY_TYPES = [
  {
    value: "land_preparation",
    label: "Land preparation",
    shortLabel: "Land prep",
    Icon: Shovel,
    tone: "bg-amber-100 text-amber-700",
    category: "crop"
  },
  {
    value: "planting",
    label: "Planting",
    shortLabel: "Planting",
    Icon: Sprout,
    tone: "bg-emerald-100 text-emerald-700",
    category: "crop"
  },
  {
    value: "watering",
    label: "Watering",
    shortLabel: "Watering",
    Icon: Droplets,
    tone: "bg-sky-100 text-sky-700",
    category: "crop"
  },
  {
    value: "fertilizer_application",
    label: "Fertilizer",
    shortLabel: "Fertilizer",
    Icon: FlaskConical,
    tone: "bg-lime-100 text-lime-700",
    category: "crop"
  },
  {
    value: "pesticide_application",
    label: "Pesticide",
    shortLabel: "Pesticide",
    Icon: SprayCan,
    tone: "bg-rose-100 text-rose-700",
    category: "crop"
  },
  {
    value: "weeding",
    label: "Weeding",
    shortLabel: "Weeding",
    Icon: Scissors,
    tone: "bg-teal-100 text-teal-700",
    category: "crop"
  },
  {
    value: "monitoring",
    label: "Crop check",
    shortLabel: "Crop check",
    Icon: ScanEye,
    tone: "bg-lime-100 text-lime-800",
    category: "crop"
  },
  {
    value: "feeding",
    label: "Feeding",
    shortLabel: "Feeding",
    Icon: Wheat,
    tone: "bg-orange-100 text-orange-700",
    category: "animal"
  },
  {
    value: "vaccination",
    label: "Vaccination",
    shortLabel: "Vaccination",
    Icon: Syringe,
    tone: "bg-indigo-100 text-indigo-700",
    category: "animal"
  },
  {
    value: "cleaning",
    label: "Cleaning",
    shortLabel: "Cleaning",
    Icon: Sparkles,
    tone: "bg-cyan-100 text-cyan-700",
    category: "animal"
  },
  {
    value: "breeding",
    label: "Breeding",
    shortLabel: "Breeding",
    Icon: Baby,
    tone: "bg-pink-100 text-pink-700",
    category: "animal"
  },
  {
    value: "health_check",
    label: "Health check",
    shortLabel: "Health",
    Icon: HeartPulse,
    tone: "bg-red-100 text-red-700",
    category: "animal"
  },
  {
    value: "production",
    label: "Production",
    shortLabel: "Production",
    Icon: Egg,
    tone: "bg-yellow-100 text-yellow-700",
    category: "animal"
  },
  {
    value: "other",
    label: "Other activity",
    shortLabel: "Other",
    Icon: ClipboardList,
    tone: "bg-slate-100 text-slate-700",
    category: "any"
  }
];

const BASE_FARM_TYPES = [
  {
    value: "crop_farming",
    label: "Crops",
    description: "Rice, cassava, vegetables and more",
    Icon: Sprout,
    tone: "bg-emerald-100 text-emerald-700"
  },
  {
    value: "livestock",
    label: "Livestock",
    description: "Cattle, goats, sheep or pigs",
    Icon: PawPrint,
    tone: "bg-amber-100 text-amber-700"
  },
  {
    value: "poultry",
    label: "Poultry",
    description: "Chickens, ducks or other birds",
    Icon: Bird,
    tone: "bg-orange-100 text-orange-700"
  },
  {
    value: "mixed_farming",
    label: "Mixed farm",
    description: "More than one kind of farming",
    Icon: Layers,
    tone: "bg-sky-100 text-sky-700"
  },
  {
    value: "other",
    label: "Other",
    description: "Another kind of farm",
    Icon: MoreHorizontal,
    tone: "bg-slate-100 text-slate-700"
  }
];

export const COUNTIES = [
  "Bomi",
  "Bong",
  "Gbarpolu",
  "Grand Bassa",
  "Grand Cape Mount",
  "Grand Gedeh",
  "Grand Kru",
  "Lofa",
  "Margibi",
  "Maryland",
  "Montserrado",
  "Nimba",
  "River Cess",
  "River Gee",
  "Sinoe"
];

export const SECURITY_QUESTIONS = [
  { key: "mother_first_name", text: "What is your mother's first name?" },
  { key: "father_first_name", text: "What is your father's first name?" },
  { key: "first_school", text: "What is the name of your first school?" },
  { key: "home_town", text: "What is the name of your home town?" },
  { key: "first_farm_animal", text: "What was your first farm animal?" }
];

export function securityQuestionText(key) {
  return SECURITY_QUESTIONS.find((item) => item.key === key)?.text || "";
}

const fallbackActivity = {
  value: "other",
  label: "Activity",
  shortLabel: "Activity",
  Icon: ClipboardList,
  tone: "bg-slate-100 text-slate-700"
};

const fallbackFarm = {
  value: "other",
  label: "Farm",
  description: "",
  Icon: Layers,
  tone: "bg-slate-100 text-slate-700"
};

export function activityMeta(value) {
  return ACTIVITY_TYPES.find((item) => item.value === value) || fallbackActivity;
}

export function farmMeta(value) {
  return FARM_TYPES.find((item) => item.value === value) || fallbackFarm;
}

// Common units as picture chips, so the farmer taps instead of typing.
const BASE_UNITS = [
  { value: "bags", label: "Bags", Icon: ShoppingBag, category: "any" },
  { value: "kg", label: "Kg", Icon: Weight, category: "any" },
  { value: "buckets", label: "Buckets", Icon: PaintBucket, category: "any" },
  { value: "litres", label: "Litres", Icon: Droplet, category: "any" },
  { value: "stems", label: "Stems", Icon: Sprout, category: "crop" },
  { value: "birds", label: "Birds", Icon: Bird, category: "animal" },
  { value: "eggs", label: "Eggs", Icon: Egg, category: "animal" },
  { value: "packs", label: "Packs", Icon: Package, category: "any" }
];

function formatQuantity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2)));
}

// The words shown for a record. A farmer may save with taps only, so when there
// is no typed description we build one: "Planting · Cassava · 40 stems".
export function activitySummary(activity = {}) {
  const typed = typeof activity.description === "string" ? activity.description.trim() : "";
  if (typed) return typed;
  const parts = [activityMeta(activity.activityType).label];
  if (activity.inputUsed) parts.push(activity.inputUsed);
  if (activity.quantity !== null && activity.quantity !== undefined && activity.quantity !== "") {
    parts.push([formatQuantity(activity.quantity), activity.unit].filter(Boolean).join(" "));
  }
  return parts.join(" · ");
}

// "2.5 acres". Units come from words.js (SIZE_UNITS).
export function formatFarmSize(farm) {
  if (farm?.size === null || farm?.size === undefined || farm.size === "") return "";
  const names = { acres: "acres", hectares: "hectares", lots: "lots", square_meters: "square meters" };
  return `${Number(farm.size)} ${names[farm.sizeUnit] || ""}`.trim();
}

// Farmer-facing words come from words.js (simple Liberian English plus the
// phrase the phone speaks). The original English stays as `englishLabel`.
export const ACTIVITY_TYPES = BASE_ACTIVITY_TYPES.map((item) => {
  const words = ACTIVITY_WORDS[item.value];
  return words
    ? { ...item, englishLabel: item.label, label: words.text, shortLabel: words.text, words }
    : item;
});

export const FARM_TYPES = BASE_FARM_TYPES.map((item) => {
  const words = FARM_TYPE_WORDS[item.value];
  return words ? { ...item, englishLabel: item.label, label: words.text, words } : item;
});

export const UNITS = BASE_UNITS.map((item) => {
  const words = UNIT_WORDS[item.value];
  return words ? { ...item, label: words.text, words } : item;
});
