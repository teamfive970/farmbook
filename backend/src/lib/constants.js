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

export const FARM_TYPES = ["crop_farming", "livestock", "poultry", "mixed_farming", "other"];

export const SECURITY_QUESTIONS = [
  { key: "mother_first_name", text: "What is your mother's first name?" },
  { key: "father_first_name", text: "What is your father's first name?" },
  { key: "first_school", text: "What is the name of your first school?" },
  { key: "home_town", text: "What is the name of your home town?" },
  { key: "first_farm_animal", text: "What was your first farm animal?" }
];

export const SECURITY_QUESTION_KEYS = SECURITY_QUESTIONS.map((item) => item.key);

export const ACTIVITY_TYPES = [
  "land_preparation",
  "planting",
  "watering",
  "fertilizer_application",
  "pesticide_application",
  "weeding",
  "monitoring",
  "feeding",
  "vaccination",
  "cleaning",
  "breeding",
  "health_check",
  "production",
  "other"
];

export const SIZE_UNITS = ["acres", "hectares", "lots", "square_meters"];
export const CURRENCIES = ["LRD", "USD"];
export const QUALITY_GRADES = ["A", "B", "C", "rejected"];
// Simple yes/no checks a farmer or extension officer can do by eye.
export const QUALITY_CHECKS = ["dry", "clean", "no_pests", "no_mold", "sorted", "good_smell"];
export const BUYER_TYPES = ["market_woman", "trader", "cooperative", "company", "neighbor", "other"];
export const PAYMENT_METHODS = ["cash", "mobile_money", "bank", "other"];
export const EXPENSE_CATEGORIES = [
  "seeds",
  "fertilizer",
  "pesticide",
  "labour",
  "tools",
  "transport",
  "feed",
  "medicine",
  "land",
  "other"
];

// Production records (crop plantings and animal groups) — see migration 008.
export const PRODUCTION_KINDS = ["crop", "animal"];
export const PRODUCTION_SOURCES = ["own", "bought", "given", "group", "born"];
export const CROP_METHODS = ["seeds", "seedlings", "cuttings", "suckers", "other"];
export const AGE_GROUPS = ["young", "grown", "mixed"];
export const ANIMAL_ADD_EVENTS = ["born", "bought", "given_in"];
export const ANIMAL_REMOVE_EVENTS = ["died", "sold", "eaten", "given_out"];
export const ANIMAL_EVENT_TYPES = [...ANIMAL_ADD_EVENTS, ...ANIMAL_REMOVE_EVENTS];
export const DEATH_CAUSES = ["sickness", "accident", "predator", "weather", "unknown", "other"];
