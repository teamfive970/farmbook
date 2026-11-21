import { Layers, PawPrint, Sprout } from "lucide-react";
import { ACTIVITY_TYPES, UNITS, activityMeta } from "./labels.js";
import { FARM_CATEGORY_WORDS, expenseCategoriesForCategory } from "./words.js";

// A farm's production category. The data keeps the older, narrower types
// (crop_farming, livestock, poultry, mixed_farming, other) so records already
// saved keep working; screens only ever offer the three categories below.
const CATEGORY_BY_FARM_TYPE = {
  crop_farming: "crop",
  livestock: "animal",
  poultry: "animal",
  mixed_farming: "mixed",
  other: "mixed"
};

export const FARM_CATEGORY_OPTIONS = [
  {
    value: "crop",
    label: "Crop farm",
    description: "Crops only",
    Icon: Sprout,
    tone: "bg-emerald-100 text-emerald-700",
    words: FARM_CATEGORY_WORDS.crop
  },
  {
    value: "animal",
    label: "Animal farm",
    description: "Animals only",
    Icon: PawPrint,
    tone: "bg-amber-100 text-amber-700",
    words: FARM_CATEGORY_WORDS.animal
  },
  {
    value: "mixed",
    label: "Mixed farm",
    description: "Crops and animals",
    Icon: Layers,
    tone: "bg-sky-100 text-sky-700",
    words: FARM_CATEGORY_WORDS.mixed
  }
];

export function farmCategory(farmType) {
  return CATEGORY_BY_FARM_TYPE[farmType] || "mixed";
}

export function farmSupportsCrops(farmType) {
  return farmCategory(farmType) !== "animal";
}

export function farmSupportsAnimals(farmType) {
  return farmCategory(farmType) !== "crop";
}

function categoryAllows(category, activityCategory) {
  return category === "mixed" || activityCategory === "any" || activityCategory === category;
}

export function farmSupportsActivity(farmType, activityType) {
  const meta = activityMeta(activityType);
  return categoryAllows(farmCategory(farmType), meta.category);
}

export function activityTypesForCategory(category) {
  return ACTIVITY_TYPES.filter((item) => categoryAllows(category, item.category));
}

export function activityTypesForFarm(farmType) {
  return activityTypesForCategory(farmCategory(farmType));
}

export function unitsForCategory(category) {
  if (category === "mixed") return UNITS;
  return UNITS.filter((item) => item.category === "any" || item.category === category);
}

export function unitsForFarm(farmType) {
  return unitsForCategory(farmCategory(farmType));
}

export function expenseCategoriesForFarm(farmType) {
  return expenseCategoriesForCategory(farmCategory(farmType));
}
