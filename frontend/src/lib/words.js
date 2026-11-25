import {
  CircleHelp,
  Clock,
  HandHeart,
  Drumstick,
  HandCoins,
  HeartCrack,
  Baby,
  Gift,
  ShoppingCart,
  Minus,
  Milk,
  Layers,
  ArrowRightLeft,
  Award,
  Banana,
  Banknote,
  Bean,
  Beef,
  Bird,
  Briefcase,
  Brush,
  Bug,
  BugOff,
  Building2,
  Carrot,
  Cherry,
  CircleCheck,
  CircleEllipsis,
  CircleX,
  Citrus,
  Cloud,
  CloudRain,
  Coffee,
  Container,
  Cookie,
  CookingPot,
  Droplet,
  Droplets,
  Egg,
  Feather,
  Fence,
  Fish,
  Flame,
  FlaskConical,
  FlaskRound,
  Grape,
  Grid2x2,
  Ham,
  Hammer,
  HardHat,
  Hash,
  Hourglass,
  House,
  LandPlot,
  Landmark,
  Leaf,
  LeafyGreen,
  ListFilter,
  Mountain,
  Nut,
  PaintBucket,
  PawPrint,
  Pill,
  Popcorn,
  Rabbit,
  Recycle,
  Salad,
  ShieldCheck,
  ShoppingBag,
  Shovel,
  Shrub,
  Slice,
  Smartphone,
  Soup,
  Sparkles,
  SprayCan,
  Sprout,
  Store,
  Sun,
  Syringe,
  Thermometer,
  ThumbsDown,
  ThumbsUp,
  TreeDeciduous,
  TreePalm,
  TriangleAlert,
  Truck,
  UserRound,
  Users,
  Utensils,
  Warehouse,
  Weight,
  Wheat,
  Wind,
} from "lucide-react";

// Words for farmers, in simple Liberian English (the English people speak
// every day in Liberia), written so an old ma who does not read can follow when
// the phone says them out loud.
//
//   text = the short word shown on the screen
//   say  = what the phone says when "Talk to me" is on
//   key  = name of a recorded clip (public/audio/manifest.json). When a clip is
//          recorded in Kpelle, Bassa or another language, the phone plays the
//          clip instead of reading `say`.
//
// Please have farmers and the Agriculture Lead check these words in the pilot
// and change any that do not sound natural.

function w(key, text, say = text) {
  return { key, text, say };
}

export const WORDS = {
  // Talk to me
  voiceOn: w("voice.on", "Talk to me: on", "The phone will talk to you now. Touch any picture, it will tell you what it is."),
  voiceOff: w("voice.off", "Talk to me: off", "Touch here and the phone will talk to you."),
  voiceSwitch: w("voice.switch", "Talk to me", "Touch here and the phone will talk to you."),
  hearThis: w("voice.hear", "Hear it", "Listen."),

  // Getting in
  welcomeTitle: w("welcome.title", "Keep your farm records on your phone", "Welcome. This app can keep your farm work in your phone, even when network not there."),
  newAccount: w("welcome.new", "I am new", "I am new. Make my account."),
  haveAccount: w("welcome.have", "I have an account", "I already have account."),
  phoneNumber: w("login.phone", "Your phone number", "Put your phone number."),
  pin: w("login.pin", "Your PIN", "Put your secret number, your PIN."),
  goIn: w("login.go", "Enter", "Enter"),
  forgotPin: w("login.forgot", "I forgot my PIN", "I forget my PIN. Help me."),
  notYou: w("login.notyou", "Not me", "This is not me. Use another phone number."),
  wrongPin: w("login.wrong", "Wrong PIN", "That PIN is not correct. Try it again."),
  waitPlease: w("login.wait", "Please wait", "You try too many times. Wait small, then try again."),
  enterPinToSend: w("login.send", "Enter your PIN to send your records", "Network come back. Put your PIN one time so your work can go on the internet."),

  // Number pad
  deleteDigit: w("pad.delete", "Delete", "Take the last number out."),
  clearAll: w("pad.clear", "Clear", "Clear all of it."),

  // Main menu
  navHome: w("nav.home", "Home", "Go home."),
  navFarms: w("nav.farms", "My farms", "See your farms."),
  navRecords: w("nav.records", "My work", "See all the work you did."),
  navMe: w("nav.me", "Me", "Your name and your PIN."),

  // Home
  hello: (name) => w(null, `Hello, ${name}`, `Hello ${name}. How you doing?`),
  recordWork: w("home.record", "Record today's work", "Touch here to put the work you do on the farm."),
  addFarm: w("home.addfarm", "Add farm", "Add new farm."),
  seeWork: w("home.seework", "See my work", "See all the work you did before."),
  recentWork: w("home.recent", "Recent work", "This is the work you did lately."),
  noWorkYet: w("home.nowork", "No work yet", "You never put any work yet. Touch the green button to put your first work."),
  farmsCount: (count) => w(null, `${count} ${count === 1 ? "farm" : "farms"}`, `You get ${count} ${count === 1 ? "farm" : "farms"}.`),
  workCount: (count) => w(null, `${count} work`, `You put ${count} work.`),
  onPhoneCount: (count) => w(null, `${count} on phone`, count > 0 ? `${count} work still on your phone, waiting for network.` : "All your work gone on the internet. It safe."),

  // Network
  noNetwork: w("net.none", "No network", "Network not there. No problem. Your work will stay on your phone and go later."),
  allSent: w("net.sent", "All sent", "All your work gone on the internet. It safe."),
  sending: w("net.sending", "Sending", "Sending your work now."),

  // Record work
  recordTitle: w("record.title", "Record work", "Touch the pictures to show the work you did. You do not need to write."),
  whichFarm: w("record.farm", "Which farm?", "Which farm you work on?"),
  whatWork: w("record.what", "What work did you do?", "What work you do? Touch the picture."),
  when: w("record.when", "When?", "When you do the work?"),
  today: w("record.today", "Today", "Today."),
  yesterday: w("record.yesterday", "Yesterday", "Yesterday."),
  otherDay: w("record.otherday", "Pick a day", "Another day. Choose the day."),
  howMuch: w("record.howmuch", "Amount?", "Amount? You can leave it if you do not know."),
  more: w("record.more", "More", "Put one more."),
  less: w("record.less", "Less", "Take one away."),
  whatUsed: w("record.used", "What did you use?", "What you use for the work? Touch the picture."),
  howItGo: w("record.how", "How did it go?", "How the work go? Touch the one that is true."),
  writeMyself: w("record.write", "Write it myself", "Write it yourself, or ask somebody to write it for you."),
  save: w("record.save", "Save", "Save it."),
  saved: w("record.saved", "Saved", "Your work saved on your phone."),
  savedSending: w("record.savedsend", "Saved. Sending now.", "Your work saved. It going on the internet now."),

  // Record status pictures
  statusPending: w("status.pending", "On phone", "This one on your phone. It will go when network come."),
  statusSyncing: w("status.syncing", "Sending", "This one going now."),
  statusSynced: w("status.synced", "Sent", "This one gone on the internet. It safe, even if the phone lost."),
  statusFailed: w("status.failed", "Needs help", "This one get problem. Ask somebody to help you."),

  // Farms
  farmTitle: w("farm.title", "Add your farm", "Tell the phone about your farm. Touch the pictures."),
  whatFarm: w("farm.what", "What kind of farm?", "What kind of farm you get?"),
  whatGrow: w("farm.grow", "What do you grow or raise?", "What you grow, or what animal you raise? Touch all the ones you get."),
  farmName: w("farm.name", "Farm name", "What you call this farm? Touch one."),
  ownName: w("farm.ownname", "Other name", "Give it another name. Ask somebody to write it."),
  where: w("farm.where", "Where is the farm?", "Where the farm is?"),
  samePlace: w("farm.same", "Where I live", "The farm is in the same place you live."),
  otherPlace: w("farm.other", "Somewhere else", "The farm is in another place."),
  saveFarm: w("farm.save", "Save farm", "Save the farm."),
  whatGrowCrop: w("farm.growcrop", "What do you grow?", "What crops you grow on this farm? Touch all the ones you get."),
  whatRaise: w("farm.raise", "What animals do you raise?", "What animals you raise on this farm? Touch all the ones you get."),
  whatGrowBoth: w("farm.growboth", "What do you grow or raise?", "What you grow, or what animal you raise on this farm? Touch all the ones you get."),
  productionTitle: w("production.title", "Production", "What the animals give, like eggs and milk."),
  addProduction: w("production.add", "Add production", "Put what the animals give today."),

  // Me
  signOut: w("me.signout", "Sign out", "Go out of the app."),
  changePin: w("me.changepin", "Change PIN", "Change your secret number.")
};

// Spoken words for the activity types (labels.js keeps the icons).
export const ACTIVITY_WORDS = {
  land_preparation: w("activity.land_preparation", "Land clearing", "Brushing and clearing the land."),
  planting: w("activity.planting", "Planting", "Planting."),
  watering: w("activity.watering", "Watering", "Giving water."),
  fertilizer_application: w("activity.fertilizer", "Fertilizer", "Putting fertilizer."),
  pesticide_application: w("activity.pesticide", "Spraying", "Spraying medicine for bugs."),
  weeding: w("activity.weeding", "Weeding", "Cleaning the grass. Weeding."),
  feeding: w("activity.feeding", "Feeding", "Feeding the animals."),
  vaccination: w("activity.vaccination", "Animal medicine", "Giving medicine to the animals."),
  cleaning: w("activity.cleaning", "Cleaning", "Cleaning the pen."),
  monitoring: w("activity.monitoring", "Crop check", "Look at the crop: how it growing, bugs or sickness."),
  breeding: w("activity.breeding", "Breeding", "Breeding the animals to get young ones."),
  health_check: w("activity.health", "Health check", "Checking if the animals are healthy."),
  production: w("activity.production", "Production", "What the animals give, like eggs and milk."),
  other: w("activity.other", "Other work", "Other work.")
};

export const FARM_TYPE_WORDS = {
  crop_farming: w("farmtype.crops", "Crop farm", "Crop farm, for rice, cassava, pepper and other crops."),
  livestock: w("farmtype.livestock", "Animal farm", "Animal farm, for goat, pig, cow and other animals."),
  poultry: w("farmtype.poultry", "Poultry farm", "Poultry farm, for chicken and duck."),
  mixed_farming: w("farmtype.mixed", "Mixed farm", "Mixed farm, crops and animals together."),
  other: w("farmtype.other", "Other farm", "Another kind of farm.")
};

// The three kinds of farm a farmer chooses from (lib/farmTypes.js).
export const FARM_CATEGORY_WORDS = {
  crop: w("farmcategory.crop", "Crop farm", "Crop farm. Crops only."),
  animal: w("farmcategory.animal", "Animal farm", "Animal farm. Animals only."),
  mixed: w("farmcategory.mixed", "Mixed farm", "Mixed farm. Crops and animals together.")
};

export const UNIT_WORDS = {
  bags: w("unit.bags", "Bags", "Bags."),
  kg: w("unit.kg", "Kilo", "Kilo."),
  buckets: w("unit.buckets", "Buckets", "Buckets."),
  litres: w("unit.litres", "Litres", "Litres, like gallon."),
  stems: w("unit.stems", "Sticks", "Sticks or stems."),
  eggs: w("unit.eggs", "Eggs", "Eggs."),
  birds: w("unit.birds", "Birds", "Birds, chicken or duck."),
  packs: w("unit.packs", "Packs", "Packs.")
};

// Crops and animals people grow and raise in Liberia, as pictures. All
// pictures in the app come from one icon set (lucide), bundled with the app
// so they work offline and look the same on every phone.
export const CROPS = [
  { value: "Rice", Icon: Wheat, ...w("crop.rice", "Rice", "Rice.") },
  { value: "Cassava", Icon: Carrot, ...w("crop.cassava", "Cassava", "Cassava.") },
  { value: "Pepper", Icon: Flame, ...w("crop.pepper", "Pepper", "Pepper.") },
  { value: "Bitter ball", Icon: Cherry, ...w("crop.bitterball", "Bitter ball", "Bitter ball.") },
  { value: "Corn", Icon: Popcorn, ...w("crop.corn", "Corn", "Corn.") },
  { value: "Plantain", Icon: Banana, ...w("crop.plantain", "Plantain", "Plantain and banana.") },
  { value: "Palm", Icon: TreePalm, ...w("crop.palm", "Palm", "Palm.") },
  { value: "Cocoa", Icon: Cookie, ...w("crop.cocoa", "Cocoa", "Cocoa.") },
  { value: "Coffee", Icon: Coffee, ...w("crop.coffee", "Coffee", "Coffee.") },
  { value: "Rubber", Icon: TreeDeciduous, ...w("crop.rubber", "Rubber", "Rubber.") },
  { value: "Groundnut", Icon: Nut, ...w("crop.groundnut", "Groundnut", "Groundnut.") },
  { value: "Greens", Icon: LeafyGreen, ...w("crop.greens", "Greens", "Potato greens and cassava leaf.") },
  { value: "Sugarcane", Icon: Shrub, ...w("crop.sugarcane", "Sugarcane", "Sugarcane.") },
  { value: "Cucumber", Icon: Salad, ...w("crop.cucumber", "Cucumber", "Cucumber.") },
  { value: "Watermelon", Icon: Citrus, ...w("crop.watermelon", "Watermelon", "Watermelon.") }
];

export const ANIMALS = [
  { value: "Chicken", Icon: Bird, ...w("animal.chicken", "Chicken", "Chicken.") },
  { value: "Duck", Icon: Feather, ...w("animal.duck", "Duck", "Duck.") },
  { value: "Goat", Icon: PawPrint, ...w("animal.goat", "Goat", "Goat.") },
  { value: "Sheep", Icon: Cloud, ...w("animal.sheep", "Sheep", "Sheep.") },
  { value: "Pig", Icon: Ham, ...w("animal.pig", "Pig", "Pig.") },
  { value: "Cow", Icon: Beef, ...w("animal.cow", "Cow", "Cow.") },
  { value: "Fish", Icon: Fish, ...w("animal.fish", "Fish", "Fish pond.") },
  { value: "Rabbit", Icon: Rabbit, ...w("animal.rabbit", "Rabbit", "Rabbit.") }
];

// Things animals give that are sold (not the animals themselves). They are
// offered when an animal farm records production or a sale, never when
// choosing what a farm raises.
export const ANIMAL_PRODUCTS = [
  { value: "Eggs", Icon: Egg, ...w("product.eggs", "Eggs", "Eggs.") },
  { value: "Milk", Icon: Milk, ...w("product.milk", "Milk", "Milk.") },
  { value: "Meat", Icon: Drumstick, ...w("product.meat", "Meat", "Meat.") },
  { value: "Weight gain", Icon: Weight, ...w("product.weight", "Weight gain", "Weight gain, the animal growing bigger.") },
  { value: "Manure", Icon: Recycle, ...w("product.manure", "Manure", "Manure, animal dung for the soil.") }
];

export const BIRDS = ["Chicken", "Duck"];

export function growChoices(farmType) {
  if (farmType === "crop_farming") return CROPS;
  if (farmType === "poultry") return ANIMALS.filter((item) => BIRDS.includes(item.value));
  if (farmType === "mixed_farming" || farmType === "other") return [...CROPS, ...ANIMALS];
  return ANIMALS;
}

// What can be chosen for each of the three kinds of farm.
export function growChoicesForCategory(category) {
  if (category === "crop") return CROPS;
  if (category === "animal") return ANIMALS;
  return [...CROPS, ...ANIMALS];
}

// A farm with only chickens and ducks keeps the poultry type; any other
// animal makes it a livestock farm.
export function animalFarmType(grown = []) {
  const known = grown.filter(Boolean);
  return known.length > 0 && known.every((item) => BIRDS.includes(item)) ? "poultry" : "livestock";
}

// Suggested farm names, so nobody has to type one.
export function farmNameChoices(firstGrow) {
  const names = [];
  if (firstGrow) names.push(w(null, `${firstGrow} farm`, `${firstGrow} farm.`));
  names.push(
    w("farmname.swamp", "Swamp farm", "Swamp farm, the low land with water."),
    w("farmname.upland", "Upland farm", "Upland farm, the high land."),
    w("farmname.house", "Home garden", "The garden by the house."),
    w("farmname.bush", "Bush farm", "The farm in the bush."),
    w("farmname.pen", "Animal pen", "The animal pen.")
  );
  return names;
}

// What the farmer used, as pictures, depending on the work.
const INPUTS = {
  seeds: { Icon: Bean, ...w("input.seeds", "Seeds", "Seeds.") },
  riceSeed: { Icon: Wheat, ...w("input.riceseed", "Rice seed", "Rice seed.") },
  cassavaSticks: { Icon: Carrot, ...w("input.cassavasticks", "Cassava sticks", "Cassava sticks.") },
  cornSeed: { Icon: Popcorn, ...w("input.cornseed", "Corn seed", "Corn seed.") },
  suckers: { Icon: Banana, ...w("input.suckers", "Plantain suckers", "Plantain suckers.") },
  npk: { Icon: FlaskConical, ...w("input.npk", "NPK", "N P K fertilizer.") },
  urea: { Icon: FlaskRound, ...w("input.urea", "Urea", "Urea fertilizer.") },
  dung: { Icon: Recycle, ...w("input.dung", "Chicken dung", "Chicken dung.") },
  rottenLeaves: { Icon: Leaf, ...w("input.compost", "Compost", "Rotten leaves, compost.") },
  bugMedicine: { Icon: SprayCan, ...w("input.bugmedicine", "Pesticide", "Medicine for bugs.") },
  grassMedicine: { Icon: Shrub, ...w("input.grassmedicine", "Weed killer", "Medicine for grass.") },
  water: { Icon: Droplet, ...w("input.water", "Water", "Water.") },
  feed: { Icon: Utensils, ...w("input.feed", "Feed", "Animal feed.") },
  corn: { Icon: Popcorn, ...w("input.corn", "Corn", "Corn.") },
  riceBran: { Icon: Wheat, ...w("input.ricebran", "Rice bran", "Rice bran.") },
  leftover: { Icon: Soup, ...w("input.leftover", "Leftover food", "Leftover food.") },
  grass: { Icon: Leaf, ...w("input.grass", "Grass", "Grass.") },
  vaccine: { Icon: Syringe, ...w("input.vaccine", "Vaccine", "Injection, vaccine.") },
  medicine: { Icon: Pill, ...w("input.medicine", "Medicine", "Medicine.") },
  cutlass: { Icon: Slice, ...w("input.cutlass", "Cutlass", "Cutlass.") },
  hoe: { Icon: Shovel, ...w("input.hoe", "Hoe", "Hoe.") },
  fire: { Icon: Flame, ...w("input.fire", "Fire", "Burning the bush.") },
  broom: { Icon: Brush, ...w("input.broom", "Broom", "Broom.") }
};

const INPUTS_BY_ACTIVITY = {
  land_preparation: ["cutlass", "hoe", "fire"],
  planting: ["riceSeed", "cassavaSticks", "cornSeed", "suckers", "seeds"],
  watering: ["water"],
  fertilizer_application: ["npk", "urea", "dung", "rottenLeaves"],
  pesticide_application: ["bugMedicine", "grassMedicine"],
  weeding: ["cutlass", "hoe", "grassMedicine"],
  feeding: ["feed", "corn", "riceBran", "leftover", "grass"],
  vaccination: ["vaccine", "medicine"],
  cleaning: ["broom", "water"],
  breeding: ["feed", "medicine"],
  health_check: ["medicine", "vaccine"],
  production: ["feed", "water"],
  other: []
};

export function inputChoices(activityType) {
  return (INPUTS_BY_ACTIVITY[activityType] || []).map((name) => ({
    value: INPUTS[name].text,
    ...INPUTS[name]
  }));
}

// Short sentences the farmer can tap instead of writing. Tapped ones are joined
// into the record's description.
const PHRASES = {
  finished: { Icon: CircleCheck, ...w("phrase.finished", "All done", "I finish all of it.") },
  notFinished: { Icon: Hourglass, ...w("phrase.notfinished", "Not finished", "Some still left to do.") },
  rain: { Icon: CloudRain, ...w("phrase.rain", "Rain stopped work", "Rain stop the work.") },
  kuu: { Icon: Users, ...w("phrase.kuu", "Kuu group helped", "My kuu people help me.") },
  looksFine: { Icon: ThumbsUp, ...w("phrase.fine", "Looks good", "It looking fine.") },
  notFine: { Icon: ThumbsDown, ...w("phrase.notfine", "Does not look good", "It not looking fine.") },
  bugs: { Icon: Bug, ...w("phrase.bugs", "Pests on it", "Bugs eating it.") },
  swamp: { Icon: Droplets, ...w("phrase.swamp", "In the swamp", "In the swamp.") },
  upland: { Icon: Mountain, ...w("phrase.upland", "On the upland", "On the upland.") },
  sick: { Icon: Thermometer, ...w("phrase.sick", "Some are sick", "Some animals sick.") },
  died: { Icon: TriangleAlert, ...w("phrase.died", "Some died", "Some animals die.") },
  eating: { Icon: Utensils, ...w("phrase.eating", "Eating well", "The animals eating fine.") },
  plenty: { Icon: Layers, ...w("phrase.plenty", "Good amount", "Plenty came.") },
  small: { Icon: Minus, ...w("phrase.small", "Small amount", "Small came.") }
};

const CROP_PHRASES = ["finished", "notFinished", "looksFine", "notFine", "bugs", "rain", "kuu"];
const ANIMAL_PHRASES = ["eating", "sick", "died", "finished"];
const PHRASES_BY_ACTIVITY = {
  land_preparation: ["finished", "notFinished", "swamp", "upland", "kuu", "rain"],
  planting: ["finished", "notFinished", "swamp", "upland", "kuu", "rain"],
  watering: CROP_PHRASES,
  fertilizer_application: CROP_PHRASES,
  pesticide_application: ["bugs", "finished", "looksFine", "notFine"],
  weeding: CROP_PHRASES,
  feeding: ANIMAL_PHRASES,
  vaccination: ANIMAL_PHRASES,
  cleaning: ["finished", "sick", "died"],
  breeding: ["finished", "eating", "sick", "died"],
  health_check: ["eating", "sick", "died", "finished"],
  production: ["plenty", "small", "finished"],
  other: ["finished", "notFinished", "looksFine", "notFine", "kuu", "rain"]
};

export function phraseChoices(activityType) {
  return (PHRASES_BY_ACTIVITY[activityType] || PHRASES_BY_ACTIVITY.other).map((name) => ({
    value: PHRASES[name].text,
    ...PHRASES[name]
  }));
}

const DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
export function digitWord(digit) {
  return DIGITS[Number(digit)] || String(digit);
}

// ---------- Phase 2: shared phone, harvest, quality, money, passport, group ----------

Object.assign(WORDS, {
  // Shared phone
  whoIsUsing: w("profiles.who", "Who is using the phone?", "Who is using the phone? Touch your name."),
  addPerson: w("profiles.add", "Add another person", "Add another person to this phone."),
  switchPerson: w("profiles.switch", "Change person", "Give the phone to another person."),
  removePerson: w("profiles.remove", "Remove me from this phone", "Take your name off this phone."),
  putYourPin: (name) => w(null, `${name}, put your PIN`, `${name}, put your secret PIN.`),

  // Farm size
  farmSize: w("farm.size", "How big is the farm?", "How big is the farm? You can leave it if you do not know."),
  dontKnow: w("farm.dontknow", "I don't know", "I don't know."),

  // Harvest
  harvestTitle: w("harvest.title", "My harvest", "Your harvest. All the crops you brought from the farm."),
  addHarvest: w("harvest.add", "Harvest", "Put the crop you brought from the farm."),
  whatCrop: w("harvest.crop", "What did you harvest?", "What crop you harvest? Touch the picture."),
  harvestHowMuch: w("harvest.howmuch", "Amount did you get?", "Amount you get? Touch plus to add."),
  whereKept: w("harvest.where", "Where is it stored?", "Where you keep it? You can leave it."),
  inStore: w("harvest.instore", "In store", "You still have all of it."),
  partSold: w("harvest.partsold", "Some sold", "You sold some. Some still left."),
  soldOut: w("harvest.soldout", "All sold", "You sold all of it."),
  left: w("harvest.left", "Left", "Amount still left."),
  noHarvest: w("harvest.none", "No harvest yet", "You never put any harvest yet."),

  // Quality
  checkQuality: w("quality.title", "Quality check", "Check if the crop good. Touch yes for each one that is true."),
  grade: w("quality.grade", "Grade", "The grade, how good it is."),

  // Passport
  passport: w("passport.title", "Harvest Passport", "Harvest passport. When you show this code, the buyer can see where your crop come from."),
  passportOn: w("passport.on", "Buyers can see it", "Buyers can scan the code and see where the crop come from."),
  passportOff: w("passport.off", "Hidden", "Nobody can see it. Touch to show buyers."),
  showBuyers: w("passport.show", "Let buyers see it", "Let buyers see where the crop come from."),

  // Money
  moneyTitle: w("money.title", "My money", "Your money. What you sell, what you spend, and what you keep."),
  sell: w("money.sell", "What I sell", "You sell something."),
  spend: w("money.spend", "What I spend", "You spend money for the farm."),
  sold: w("money.sold", "Sold", "Money from what you sold."),
  received: w("money.received", "Income", "Income. The money you already get in your hand."),
  owed: w("money.owed", "Owed to me", "Money people still owe you."),
  spent: w("money.spent", "Spent", "Money you spend for the farm."),
  totalSales: w("money.totalsales", "Total sales", "Total sales. What all your sales are worth."),
  totalIncome: w("money.totalincome", "Total income", "Total income. The money you already get in your hand."),
  totalExpenses: w("money.totalexpenses", "Total expenses", "Total expenses. The money you spend for the farm."),
  profit: w("money.profit", "Profit", "Profit. What you keep. Your income, take away what you spend."),
  loss: w("money.loss", "Loss", "You spend more than you get."),
  whoBuy: w("money.whobuy", "Who bought it?", "Who buy it? Touch one, or leave it."),
  pricePerOne: w("money.priceeach", "Price for each one", "Amount for each one?"),
  totalMoney: w("money.total", "Total price", "All the money together."),
  moneyType: w("money.type", "Which money?", "Liberian dollars or US dollars?"),
  didTheyPay: w("money.paid", "Did they pay?", "They pay you the money?"),
  paidAll: w("money.paidall", "Paid all", "They pay all the money."),
  paidSome: w("money.paidsome", "Paid some", "They pay some. Some still owe."),
  paidNone: w("money.paidnone", "Not paid yet", "They not pay yet."),
  addPayment: w("money.addpay", "Add payment", "Put the money they pay you."),
  spentOn: w("money.spenton", "What did you spend on?", "What you spend the money on? Touch the picture."),
  howMuchMoney: w("money.howmuch", "Amount money?", "Amount money? Use the numbers."),
  thisMonth: w("money.month", "This month", "This month."),
  thisYear: w("money.year", "This year", "This year."),
  allTime: w("money.all", "All time", "All the time."),

  // Group
  groupTitle: w("group.title", "My group", "Your farmer group, your cooperative."),
  joinGroup: w("group.join", "Join a group", "Join a group. Put the group code."),
  groupCode: w("group.code", "Group code", "The group code. Ask your group leader."),
  noGroup: w("group.none", "No group yet", "You are not in any group yet."),
  groupTotal: w("group.total", "Whole group", "What all the group did together."),
  myPart: w("group.mine", "My share", "What you did.")
});

export const RECORD_KIND_WORDS = {
  productions: w("kind.production", "Crop or animals", "A crop you planted or animals you keep."),
  animalEvents: w("kind.animalevent", "Animal count", "Animals born, bought, died or sold."),
  harvests: w("kind.harvest", "Harvest", "Harvest."),
  inspections: w("kind.inspection", "Quality check", "Quality check."),
  buyers: w("kind.buyer", "Buyer", "Buyer."),
  sales: w("kind.sale", "Sale", "Sale, what you sold."),
  payments: w("kind.payment", "Money paid", "Money they paid you."),
  expenses: w("kind.expense", "Money spent", "Money you spend.")
};

export const SIZE_UNITS = [
  { value: "acres", Icon: Grid2x2, ...w("size.acres", "Acres", "Acres.") },
  { value: "hectares", Icon: Grid2x2, ...w("size.hectares", "Hectares", "Hectares.") },
  { value: "lots", Icon: Grid2x2, ...w("size.lots", "Lots", "Lots.") },
  { value: "square_meters", Icon: Grid2x2, ...w("size.sqm", "Square meters", "Square meters.") }
];

export const HARVEST_UNITS = [
  { value: "bags", Icon: ShoppingBag, ...w("hunit.bags", "Bags", "Bags.") },
  { value: "kg", Icon: Weight, ...w("hunit.kg", "Kilo", "Kilo.") },
  { value: "buckets", Icon: PaintBucket, ...w("hunit.buckets", "Buckets", "Buckets.") },
  { value: "tins", Icon: Container, ...w("hunit.tins", "Tins", "Tins.") },
  { value: "bunches", Icon: Grape, ...w("hunit.bunches", "Bunches", "Bunches.") },
  { value: "pieces", Icon: Hash, ...w("hunit.pieces", "Pieces", "Pieces, one one.") },
  { value: "birds", Icon: Bird, ...w("hunit.birds", "Birds", "Birds.") },
  { value: "eggs", Icon: Egg, ...w("hunit.eggs", "Eggs", "Eggs.") },
  { value: "litres", Icon: Droplet, ...w("hunit.litres", "Litres", "Litres, like gallon.") }
];

export const STORAGE_PLACES = [
  { value: "House", Icon: House, ...w("store.house", "In the house", "In the house.") },
  { value: "Store room", Icon: Warehouse, ...w("store.room", "Store room", "Store room.") },
  { value: "Kitchen loft", Icon: CookingPot, ...w("store.loft", "Kitchen loft", "On top of the kitchen fire.") },
  { value: "Group store", Icon: Store, ...w("store.group", "Group store", "The group store.") },
  { value: "Farm", Icon: Fence, ...w("store.farm", "On the farm", "Still on the farm.") }
];

// Simple checks anybody can do by looking and smelling.
export const QUALITY_CHECKS = [
  { value: "dry", Icon: Sun, ...w("check.dry", "Dry", "It dry well?") },
  { value: "clean", Icon: Sparkles, ...w("check.clean", "Clean", "It clean, no dirt and no stones?") },
  { value: "no_pests", Icon: BugOff, ...w("check.nopests", "No bugs", "No bugs inside?") },
  { value: "no_mold", Icon: ShieldCheck, ...w("check.nomold", "No mold", "No rotten or mold?") },
  { value: "sorted", Icon: ListFilter, ...w("check.sorted", "Sorted", "The bad ones taken out?") },
  { value: "good_smell", Icon: Wind, ...w("check.smell", "Smells good", "It smell good?") }
];

export const GRADES = {
  A: { Icon: Award, ...w("grade.a", "Grade A", "Grade A. Very good.") },
  B: { Icon: Award, ...w("grade.b", "Grade B", "Grade B. Good.") },
  C: { Icon: Award, ...w("grade.c", "Grade C", "Grade C. Not too good.") },
  rejected: { Icon: CircleX, ...w("grade.rejected", "Rejected", "Not good. Can't sell like this.") }
};

// Suggested grade from the checks the farmer answered. A check that was not
// answered (skipped) does not count against the crop:
//   every answered check yes → A, one no → B, two no → C, three or more no → not good.
// Nothing answered yet → no suggestion (null).
export function suggestGrade(checks = {}) {
  const answered = QUALITY_CHECKS.filter((item) => checks[item.value] === true || checks[item.value] === false);
  if (answered.length === 0) return null;
  const misses = answered.filter((item) => checks[item.value] === false).length;
  if (misses === 0) return "A";
  if (misses === 1) return "B";
  if (misses === 2) return "C";
  return "rejected";
}

export const BUYER_TYPES = [
  { value: "market_woman", Icon: Store, ...w("buyer.marketwoman", "Market woman", "Market woman.") },
  { value: "trader", Icon: Briefcase, ...w("buyer.trader", "Trader", "Trader, business man.") },
  { value: "cooperative", Icon: Users, ...w("buyer.coop", "My group", "Your farmer group.") },
  { value: "company", Icon: Building2, ...w("buyer.company", "Company", "Company.") },
  { value: "neighbor", Icon: House, ...w("buyer.neighbor", "Neighbor", "Neighbor, somebody in the town.") },
  { value: "other", Icon: UserRound, ...w("buyer.other", "Someone else", "Somebody else.") }
];

export const PAYMENT_METHODS = [
  { value: "cash", Icon: Banknote, ...w("pay.cash", "Cash", "Cash money.") },
  { value: "mobile_money", Icon: Smartphone, ...w("pay.mobile", "Mobile money", "Mobile money.") },
  { value: "bank", Icon: Landmark, ...w("pay.bank", "Bank", "Bank.") },
  { value: "other", Icon: ArrowRightLeft, ...w("pay.other", "Other way", "Another way.") }
];

export const EXPENSE_CATEGORIES = [
  { value: "seeds", Icon: Bean, ...w("spend.seeds", "Seeds", "Seeds.") },
  { value: "fertilizer", Icon: FlaskConical, ...w("spend.fertilizer", "Fertilizer", "Fertilizer.") },
  { value: "pesticide", Icon: SprayCan, ...w("spend.pesticide", "Pesticide", "Medicine for bugs or grass.") },
  { value: "labour", Icon: HardHat, ...w("spend.labour", "Workers", "Paying people to work.") },
  { value: "tools", Icon: Hammer, ...w("spend.tools", "Tools", "Tools, like cutlass and hoe.") },
  { value: "transport", Icon: Truck, ...w("spend.transport", "Transport", "Transport, car or keke.") },
  { value: "feed", Icon: Utensils, ...w("spend.feed", "Animal feed", "Animal feed.") },
  { value: "medicine", Icon: Syringe, ...w("spend.medicine", "Animal medicine", "Animal medicine.") },
  { value: "veterinary", Icon: Thermometer, ...w("spend.vet", "Vet visit", "Vet visit, the animal doctor.") },
  { value: "land", Icon: LandPlot, ...w("spend.land", "Land", "Land rent.") },
  { value: "other", Icon: CircleEllipsis, ...w("spend.other", "Other", "Other things.") }
];

const CROP_EXPENSES = new Set(["seeds", "fertilizer", "pesticide", "labour", "tools", "transport", "land", "other"]);
const ANIMAL_EXPENSES = new Set(["feed", "medicine", "veterinary", "labour", "tools", "transport", "land", "other"]);

// The costs that make sense for a kind of farm ("crop", "animal" or "mixed").
export function expenseCategoriesForCategory(category) {
  if (category === "crop") return EXPENSE_CATEGORIES.filter((item) => CROP_EXPENSES.has(item.value));
  if (category === "animal") return EXPENSE_CATEGORIES.filter((item) => ANIMAL_EXPENSES.has(item.value));
  return EXPENSE_CATEGORIES;
}

export const CURRENCIES = [
  { value: "LRD", Icon: Banknote, ...w("money.lrd", "Liberian dollars", "Liberian dollars.") },
  { value: "USD", Icon: Banknote, ...w("money.usd", "US dollars", "US dollars.") }
];

export function optionFor(list, value) {
  return list.find((item) => item.value === value) || null;
}

// Picture for a crop or animal name. Older farms say "Layer chickens" or
// "Goats", so match whole words, not only the exact name a new farm uses.
function findGrow(name) {
  const text = String(name || "").trim().toLowerCase();
  if (!text) return null;
  const all = [...CROPS, ...ANIMALS, ...ANIMAL_PRODUCTS];
  const exact = all.find((item) => item.value.toLowerCase() === text);
  if (exact) return exact;
  const tokens = text.replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean);
  return (
    all.find((item) => {
      const word = item.value.toLowerCase();
      const forms = [word, `${word}s`];
      if (word.endsWith("y")) forms.push(`${word.slice(0, -1)}ies`);
      if (word.endsWith("sh") || word.endsWith("ch")) forms.push(`${word}es`);
      return tokens.some((token) => forms.includes(token));
    }) || null
  );
}

// Animals the picture list does not name ("guinea fowl", "cattle") still get
// the animal picture, never the crop one.
const ANIMAL_WORDS =
  /\b(chickens?|ducks?|fowls?|birds?|goats?|sheep|pigs?|cows?|cattle|rabbits?|fish(es)?|snails?|bees?|animals?|livestock|poultry|herds?|flocks?)\b/i;

export function growIcon(name) {
  return findGrow(name)?.Icon || (ANIMAL_WORDS.test(String(name || "")) ? PawPrint : Sprout);
}

export function growOption(name) {
  const found = findGrow(name);
  if (found) return found;
  const animal = ANIMAL_WORDS.test(String(name || ""));
  return { value: name, Icon: animal ? PawPrint : Sprout, key: null, text: name, say: `${name}.` };
}

export function unitText(value) {
  return optionFor(HARVEST_UNITS, value)?.text || value || "";
}

WORDS.navMoney = w("nav.money", "Money", "Your money. What you sell and what you spend.");
WORDS.navHarvest = w("nav.harvest", "Harvest", "Your harvest.");

// ---------- Crop plantings and animal groups (the guide's production records) ----------

Object.assign(WORDS, {
  cropsHere: w("prod.crops", "Crops on this farm", "The crops you planted on this farm."),
  animalsHere: w("prod.animals", "Animals on this farm", "The animals you keep on this farm."),
  startCrop: w("prod.startcrop", "Plant a crop", "Put a crop you planted."),
  addAnimals: w("prod.addanimals", "Add animals", "Put animals you keep."),
  whichCrop: w("prod.whichcrop", "Which crop?", "What crop you plant? Touch the picture."),
  whichAnimal: w("prod.whichanimal", "Which animals?", "What animals? Touch the picture."),
  plantedOn: w("prod.plantedon", "Planting date", "When you plant it?"),
  startedOn: w("prod.startedon", "Start date", "When the animals come to the farm?"),
  howPlanted: w("prod.howplanted", "Planting method", "How you plant it? Touch one."),
  seedFrom: w("prod.seedfrom", "Seed source", "Where the seed come from? Touch one."),
  animalsFrom: w("prod.animalsfrom", "Where did they come from?", "Where the animals come from? Touch one."),
  howBig: w("prod.howbig", "Area planted", "How big is the place you plant? You can leave it."),
  howManyAnimals: w("prod.howmany", "How many animals?", "How many animals you get now?"),
  howOld: w("prod.howold", "Age", "Are they young or grown?"),
  whichPlot: w("prod.plot", "Which part of the farm?", "Which place on the farm? Touch one, or leave it."),
  countNow: w("prod.countnow", "Number now", "How many animals you get now."),
  finished: w("prod.finished", "Finished", "This one is finished."),
  markFinished: w("prod.markfinished", "Mark as finished", "Touch here when this crop is harvested and done, or the animals are all gone."),
  forWhich: w("prod.forwhich", "For which crop or animals?", "For which crop or animals? Touch one, or leave it."),
  manureFrom: w("prod.manurefrom", "Manure from my animals?", "Is the dung from your own animals? Touch which ones."),
  leftoversFrom: w("prod.leftoversfrom", "Leftovers from my crops?", "Is the feed from your own crops? Touch which one."),
  howMany: w("prod.howmanyevent", "How many?", "How many? Touch plus."),
  whyDied: w("prod.whydied", "Cause of death", "What killed them? Touch one, or leave it.")
});

export const CROP_METHODS = [
  { value: "seeds", Icon: Bean, ...w("method.seeds", "Seeds", "Seeds.") },
  { value: "seedlings", Icon: Sprout, ...w("method.seedlings", "Seedlings", "Small plants, seedlings.") },
  { value: "cuttings", Icon: Slice, ...w("method.cuttings", "Sticks", "Sticks, like cassava sticks.") },
  { value: "suckers", Icon: Banana, ...w("method.suckers", "Suckers", "Suckers, like plantain.") },
  { value: "other", Icon: CircleEllipsis, ...w("method.other", "Other way", "Another way.") }
];

export const SEED_SOURCES = [
  { value: "own", Icon: House, ...w("source.own", "My own", "From my own farm.") },
  { value: "bought", Icon: ShoppingCart, ...w("source.bought", "Bought", "I bought it.") },
  { value: "given", Icon: Gift, ...w("source.given", "Given to me", "Somebody gave it to me.") },
  { value: "group", Icon: Users, ...w("source.group", "From my group", "From my farmer group.") }
];

export const ANIMAL_SOURCES = [
  { value: "bought", Icon: ShoppingCart, ...w("source.boughtanimals", "Bought", "I bought them.") },
  { value: "born", Icon: Baby, ...w("source.born", "Born here", "They were born here.") },
  { value: "given", Icon: Gift, ...w("source.givenanimals", "Given to me", "Somebody gave them to me.") },
  { value: "group", Icon: Users, ...w("source.group", "From my group", "From my farmer group.") }
];

export const AGE_GROUPS = [
  { value: "young", Icon: Baby, ...w("age.young", "Young", "Young ones.") },
  { value: "grown", Icon: PawPrint, ...w("age.grown", "Grown", "Grown ones.") },
  { value: "mixed", Icon: Layers, ...w("age.mixed", "Both", "Young and grown together.") }
];

// Suggested names for the place on the farm, so nobody has to type.
export const PLOT_CHOICES = [
  w("plot.upland", "Upland", "Upland, the high land."),
  w("plot.swamp", "Swamp", "Swamp, the low land with water."),
  w("plot.garden", "Garden", "The garden by the house."),
  w("plot.bush", "Bush", "In the bush.")
];

// What can change an animal group's count. "in" adds, "out" takes away.
export const ANIMAL_EVENTS = [
  { value: "born", direction: "in", Icon: Baby, ...w("animal.born", "Born", "Animals born.") },
  { value: "bought", direction: "in", Icon: ShoppingCart, ...w("animal.bought", "Bought", "Animals you bought.") },
  { value: "given_in", direction: "in", Icon: Gift, ...w("animal.givenin", "Given to me", "Animals somebody gave you.") },
  { value: "died", direction: "out", Icon: HeartCrack, ...w("animal.died", "Died", "Animals that died.") },
  { value: "sold", direction: "out", Icon: HandCoins, ...w("animal.sold", "Sold", "Animals you sold.") },
  { value: "eaten", direction: "out", Icon: Drumstick, ...w("animal.eaten", "Eaten at home", "Animals you ate at home.") },
  { value: "given_out", direction: "out", Icon: HandHeart, ...w("animal.givenout", "Given away", "Animals you gave to somebody.") }
];

export const DEATH_CAUSES = [
  { value: "sickness", Icon: Thermometer, ...w("cause.sickness", "Sickness", "Sickness.") },
  { value: "accident", Icon: TriangleAlert, ...w("cause.accident", "Accident", "Accident.") },
  { value: "predator", Icon: PawPrint, ...w("cause.predator", "Predator", "A wild animal or snake.") },
  { value: "weather", Icon: CloudRain, ...w("cause.weather", "Weather", "Rain, cold or hot weather.") },
  { value: "unknown", Icon: CircleHelp, ...w("cause.unknown", "I don't know", "I don't know.") },
  { value: "other", Icon: CircleEllipsis, ...w("cause.other", "Other", "Something else.") }
];

// ---------- Crop and animal details from the production record guide ----------

Object.assign(WORDS, {
  growthStage: w("detail.growth", "How is the crop growing?", "How the crop growing? Touch the one you see."),
  pests: w("detail.pests", "Any pests?", "You see any pests, any bugs on the crop? You can leave it."),
  diseases: w("detail.diseases", "Any sickness on the crop?", "You see any sickness on the crop? You can leave it."),
  fieldNote: w("detail.fieldnote", "What did you see on the farm?", "What you see on the farm? You can write it."),
  feedSchedule: w("detail.feedschedule", "How often do you feed?", "How many times a day you feed the animals?"),
  animalDisease: w("detail.animaldisease", "What sickness?", "What sickness the animals get? You can leave it."),
  symptoms: w("detail.symptoms", "What signs do you see?", "What signs you see on the animals? You can write it."),
  treatment: w("detail.treatment", "What treatment did you give?", "What medicine or treatment you give? You can write it."),
  vetVisit: w("detail.vet", "Did the vet come?", "The animal doctor, the vet, did they come? You can leave it."),
  pregnancy: w("detail.pregnant", "Is she pregnant?", "The female, she pregnant?"),
  spacing: w("detail.spacing", "Spacing", "How far apart you plant them? Like 70 by 30 centimetre."),
  tagNumber: w("detail.tag", "Tag or ID number", "The tag or ID number on the animal. You can leave it."),
  maleFemale: w("detail.malefemale", "Male and female", "How many male, how many female? You can leave it."),
  male: w("detail.male", "Male", "Male."),
  female: w("detail.female", "Female", "Female.")
});

export const GROWTH_STAGES = [
  { value: "seedling", Icon: Sprout, ...w("stage.seedling", "Just planted", "Just planted, small young plant.") },
  { value: "growing", Icon: Leaf, ...w("stage.growing", "Growing", "The plant growing, getting bigger.") },
  { value: "flowering", Icon: Cherry, ...w("stage.flowering", "Flowering", "The plant get flower.") },
  { value: "fruiting", Icon: Citrus, ...w("stage.fruiting", "Fruiting", "The plant get fruit now.") },
  { value: "ready", Icon: CircleCheck, ...w("stage.ready", "Ready to harvest", "The crop ready to harvest.") }
];

export const FEED_SCHEDULES = [
  { value: "once_a_day", Icon: Clock, ...w("feed.once", "Once a day", "One time a day.") },
  { value: "twice_a_day", Icon: Clock, ...w("feed.twice", "Two times a day", "Two times a day, morning and evening.") },
  { value: "three_times_a_day", Icon: Clock, ...w("feed.three", "Three times a day", "Three times a day.") },
  { value: "all_day", Icon: Clock, ...w("feed.allday", "All day", "Feed stay there all day.") },
  { value: "other", Icon: CircleEllipsis, ...w("feed.other", "Other way", "Another way.") }
];

export const PREGNANCY_OPTIONS = [
  { value: "pregnant", Icon: Baby, ...w("pregnant.yes", "Pregnant", "She pregnant.") },
  { value: "not_pregnant", Icon: CircleX, ...w("pregnant.no", "Not pregnant", "She not pregnant.") },
  { value: "not_sure", Icon: CircleHelp, ...w("pregnant.notsure", "Not sure", "You not sure.") }
];

// ---------- The farmer's report (summary, saved as PDF or CSV) ----------

Object.assign(WORDS, {
  reportTitle: w("report.title", "My farm report", "Your farm report. Your money, harvest, animals and work, for the time you choose."),
  reportOpen: w("report.open", "My farm report", "See your farm report, and save it as PDF or Excel."),
  reportWhen: w("report.when", "Which time?", "Which time you want? Touch one."),
  reportFarms: w("report.farms", "Which farm?", "All your farms, or one farm? Touch one."),
  reportSavePdf: w("report.pdf", "Save as PDF", "Save the report as PDF, to print or send."),
  reportSaveCsv: w("report.csv", "Save as CSV (Excel)", "Save the report for Excel or Google Sheets."),
  reportShare: w("report.share", "Share", "Send the report, like on WhatsApp."),
  reportFrom: w("report.from", "First day", "The first day."),
  reportTo: w("report.to", "Last day", "The last day.")
});

// ---------- Messages and Compare seasons ----------

Object.assign(WORDS, {
  messagesTitle: w(null, "Messages", "Your messages. News from the Ministry and your group, and small reminders about your farm."),
  messagesNone: w(null, "No messages yet", "No message yet. When the Ministry or your group send news, it will show here."),
  messagesNew: w(null, "New", "These ones are new."),
  messagesEarlier: w(null, "Earlier", "These ones you saw before."),
  messagesAllRead: w(null, "Mark all as read", "Mark all the messages as read."),
  messagesOffline: w(null, "No network. These are the messages you last opened.", "Network not there. These the messages you saw last time."),
  messagesSms: w(null, "Also send important messages by SMS", "Send big news to my phone by text message too."),
  compareTitle: w(null, "Compare seasons", "See this season next to the season before. Did you harvest more? Did you keep more money?"),
  compareOpen: w(null, "Compare seasons", "See this season next to the one before."),
  compareNothingBefore: w(
    null,
    "Nothing recorded in the time before yet. Keep recording, and next season you will see the difference.",
    "Nothing in the time before yet. Keep putting your work, and next season you will see the difference."
  ),
  compareNothing: w(null, "No records in these two periods yet", "Nothing to compare yet. Put your harvests, sales and costs first.")
});

// ---------- Buyer requests ("Contact this farmer") ----------

Object.assign(WORDS, {
  requestsTitle: w(null, "Buyer requests", "Buyer requests. People who scanned your Harvest Passport and want to buy."),
  requestsOpen: w(null, "Buyer requests", "See the buyers who want your crops."),
  requestsNone: w(null, "No buyer requests yet", "No buyer asked yet. Turn on the Harvest Passport for your harvest, so buyers can scan it."),
  requestCall: w(null, "Call", "Call this buyer."),
  requestShare: w(null, "Share my number", "Send my phone number to this buyer by text message."),
  requestDecline: w(null, "Not now", "Say no to this buyer. They will not be told.")
});

// ---------- Market ----------

Object.assign(WORDS, {
  pricesTitle: w(null, "Market prices", "Market prices. What other farmers sold their crops for lately. It help you to set a fair price."),
  pricesOpen: w(null, "Market prices", "See what crops are selling for."),
  marketOpen: w(null, "Harvests for sale", "See harvests for sale from farmers.")
});
