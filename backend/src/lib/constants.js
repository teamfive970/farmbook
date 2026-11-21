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
  "feeding",
  "vaccination",
  "cleaning",
  "other"
];
