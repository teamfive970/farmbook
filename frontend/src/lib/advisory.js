// Where farmers can get advice beyond FarmBok: extension services in Liberia
// and free advice sites and apps for the crops they grow.
//
// To add or change a link, edit this list. `crops` are the crop names used in
// FarmBok (lower case); leave it empty for advice on every crop.
// Check each link still works before a release.

export const ADVISORY = [
  {
    id: "moa-extension",
    name: "Talk to an extension officer",
    by: "Ministry of Agriculture, Liberia",
    kind: "person",
    text: "Every county has agriculture officers who visit farms and give advice. The Ministry lists the extension contact in each county.",
    say: "Talk to an extension officer. Every county has agriculture officers who can visit your farm.",
    url: "https://moa.gov.lr/node/3249",
    linkText: "See extension contacts",
    crops: []
  },
  {
    id: "moa",
    name: "Ministry of Agriculture",
    by: "Government of Liberia",
    kind: "guide",
    text: "News, farm programmes, seed and support schemes, and research and extension services, including the Liberia Forum for Agricultural Advisory Services.",
    say: "The Ministry of Agriculture has news, farm programmes and support for farmers.",
    url: "https://moa.gov.lr",
    linkText: "Open the Ministry site",
    crops: []
  },
  {
    id: "riceadvice",
    name: "RiceAdvice app",
    by: "AfricaRice",
    kind: "app",
    text: "A free Android app that gives advice for your own rice field: which fertilizer, how much and when, and weed control. It works without internet once installed.",
    say: "RiceAdvice is a free app with advice for your own rice field. Fertilizer, weeds and planting time.",
    url: "https://africarice.org/riceadvice",
    linkText: "Get RiceAdvice",
    crops: ["rice"]
  },
  {
    id: "cocoa-ffs",
    name: "Cocoa farmer field school manual",
    by: "Ministry of Agriculture (Tree Crops Extension Project)",
    kind: "guide",
    text: "A training guide made for Liberian cocoa farmers: good farm practice, pruning, pests and diseases, harvest and drying.",
    say: "A training guide made for Liberian cocoa farmers.",
    url: "https://moa.gov.lr/sites/default/files/documents/Cocoa%20FFS%20Training%20Manual%20%28Final%20Version%29.pdf",
    linkText: "Open the guide (PDF)",
    crops: ["cocoa"]
  },
  {
    id: "access-agriculture",
    name: "Farmer training videos",
    by: "Access Agriculture",
    kind: "videos",
    text: "Thousands of free videos where farmers show other farmers how they do it, in many African languages. Videos can be downloaded to watch later without network.",
    say: "Free videos where farmers show other farmers how they farm. You can download them to watch later.",
    url: "https://www.accessagriculture.org",
    linkText: "Watch videos",
    crops: []
  },
  {
    id: "plantwise",
    name: "Pest and disease help",
    by: "CABI PlantwisePlus Knowledge Bank",
    kind: "guide",
    text: "Find out what is attacking your crop and how to treat it safely. Simple factsheets for farmers, and a tool that helps you name the pest from what you see.",
    say: "Find out what pest or sickness is attacking your crop, and how to treat it safely.",
    url: "https://plantwiseplusknowledgebank.org",
    linkText: "Find pest help",
    crops: []
  },
  {
    id: "fao-liberia",
    name: "FAO in Liberia",
    by: "Food and Agriculture Organization of the UN",
    kind: "guide",
    text: "Projects, training and news for farmers in Liberia from the UN food and farming agency.",
    say: "The UN food and farming agency in Liberia. Projects and training for farmers.",
    url: "https://www.fao.org/liberia",
    linkText: "Open FAO Liberia",
    crops: []
  }
];

// Advice for the farmer's crops first, then advice for every crop.
export function adviceFor(crops = []) {
  const mine = new Set(crops.map((crop) => String(crop).toLowerCase()));
  const forMyCrops = ADVISORY.filter((item) => item.crops.some((crop) => mine.has(crop)));
  const general = ADVISORY.filter((item) => !item.crops.length);
  const other = ADVISORY.filter((item) => item.crops.length && !item.crops.some((crop) => mine.has(crop)));
  return { forMyCrops, general, other };
}
