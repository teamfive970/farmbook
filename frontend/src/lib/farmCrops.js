// What a farm grows or raises, as a list. Newer farms carry `crops`; older
// records only have the text "Rice, Cassava", which is split the same way
// the server does (backend/src/services/farmService.js).
export function splitCrops(text) {
  return String(text || "")
    .split(/\s*(?:,|&|\/|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function farmCrops(farm) {
  if (!farm) return [];
  const list = Array.isArray(farm.crops) && farm.crops.length ? farm.crops : splitCrops(farm.mainCropOrLivestock);
  const seen = new Set();
  return list.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function farmGrows(farm, crop) {
  const wanted = String(crop || "").trim().toLowerCase();
  return farmCrops(farm).some((name) => name.toLowerCase() === wanted);
}

// Every crop or animal on any of the farmer's farms (for a sale that is not
// from a harvest batch).
export function allFarmCrops(farms) {
  const seen = new Map();
  for (const farm of farms || []) {
    for (const name of farmCrops(farm)) if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()];
}

// What animals give (eggs, milk, meat, weight gain, manure): any farm that
// keeps animals can record them, as well as what is on its own list. Same
// rule as the server (ANIMAL_PRODUCTS in backend/src/services/farmService.js).
export const ANIMAL_PRODUCT_NAMES = ["Eggs", "Milk", "Meat", "Weight gain", "Manure"];
const ANIMAL_FARM_TYPES = new Set(["livestock", "poultry", "mixed_farming", "other"]);

export function farmKeepsAnimals(farm) {
  return Boolean(farm) && ANIMAL_FARM_TYPES.has(farm.farmType);
}

export function yieldChoices(farm) {
  const list = farmCrops(farm);
  if (!farmKeepsAnimals(farm)) return list;
  const have = new Set(list.map((name) => name.toLowerCase()));
  return [...list, ...ANIMAL_PRODUCT_NAMES.filter((name) => !have.has(name.toLowerCase()))];
}

export function farmYields(farm, crop) {
  const wanted = String(crop || "").trim().toLowerCase();
  return yieldChoices(farm).some((name) => name.toLowerCase() === wanted);
}

export function allYieldChoices(farms) {
  const seen = new Map();
  for (const farm of farms || []) {
    for (const name of yieldChoices(farm)) if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()];
}
