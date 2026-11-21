import {
  Bird,
  ClipboardList,
  Droplets,
  FlaskConical,
  Layers,
  MoreHorizontal,
  PawPrint,
  Scissors,
  Shovel,
  Sparkles,
  SprayCan,
  Sprout,
  Syringe,
  Wheat
} from "lucide-react";

export const ACTIVITY_TYPES = [
  {
    value: "land_preparation",
    label: "Land preparation",
    shortLabel: "Land prep",
    Icon: Shovel,
    tone: "bg-amber-100 text-amber-700"
  },
  {
    value: "planting",
    label: "Planting",
    shortLabel: "Planting",
    Icon: Sprout,
    tone: "bg-emerald-100 text-emerald-700"
  },
  {
    value: "watering",
    label: "Watering",
    shortLabel: "Watering",
    Icon: Droplets,
    tone: "bg-sky-100 text-sky-700"
  },
  {
    value: "fertilizer_application",
    label: "Fertilizer",
    shortLabel: "Fertilizer",
    Icon: FlaskConical,
    tone: "bg-lime-100 text-lime-700"
  },
  {
    value: "pesticide_application",
    label: "Pesticide",
    shortLabel: "Pesticide",
    Icon: SprayCan,
    tone: "bg-rose-100 text-rose-700"
  },
  {
    value: "weeding",
    label: "Weeding",
    shortLabel: "Weeding",
    Icon: Scissors,
    tone: "bg-teal-100 text-teal-700"
  },
  {
    value: "feeding",
    label: "Feeding",
    shortLabel: "Feeding",
    Icon: Wheat,
    tone: "bg-orange-100 text-orange-700"
  },
  {
    value: "vaccination",
    label: "Vaccination",
    shortLabel: "Vaccination",
    Icon: Syringe,
    tone: "bg-indigo-100 text-indigo-700"
  },
  {
    value: "cleaning",
    label: "Cleaning",
    shortLabel: "Cleaning",
    Icon: Sparkles,
    tone: "bg-cyan-100 text-cyan-700"
  },
  {
    value: "other",
    label: "Other activity",
    shortLabel: "Other",
    Icon: ClipboardList,
    tone: "bg-slate-100 text-slate-700"
  }
];

export const FARM_TYPES = [
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
