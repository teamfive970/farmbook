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
  welcomeTitle: w("welcome.title", "Keep your farm work in your phone", "Welcome. This app can keep your farm work in your phone, even when network not there."),
  newAccount: w("welcome.new", "I am new", "I am new. Make my account."),
  haveAccount: w("welcome.have", "I have account", "I already have account. Let me go inside."),
  phoneNumber: w("login.phone", "Your phone number", "Put your phone number."),
  pin: w("login.pin", "Your PIN", "Put your secret number, your PIN."),
  goIn: w("login.go", "Go inside", "Go inside."),
  forgotPin: w("login.forgot", "I forget my PIN", "I forget my PIN. Help me."),
  notYou: w("login.notyou", "Not me", "This is not me. Use another phone number."),
  wrongPin: w("login.wrong", "PIN not correct", "That PIN is not correct. Try it again."),
  waitPlease: w("login.wait", "Wait small", "You try too many times. Wait small, then try again."),
  enterPinToSend: w("login.send", "Put your PIN to send your work", "Network come back. Put your PIN one time so your work can go on the internet."),

  // Number pad
  deleteDigit: w("pad.delete", "Take it out", "Take the last number out."),
  clearAll: w("pad.clear", "Clear", "Clear all of it."),

  // Main menu
  navHome: w("nav.home", "Home", "Go home."),
  navFarms: w("nav.farms", "My farms", "See your farms."),
  navRecords: w("nav.records", "My work", "See all the work you did."),
  navMe: w("nav.me", "Me", "Your name and your PIN."),

  // Home
  hello: (name) => w(null, `Hello, ${name}`, `Hello ${name}. How you doing?`),
  recordWork: w("home.record", "Put today work", "Touch here to put the work you do on the farm."),
  addFarm: w("home.addfarm", "Add farm", "Add new farm."),
  seeWork: w("home.seework", "See my work", "See all the work you did before."),
  recentWork: w("home.recent", "Work you did lately", "This is the work you did lately."),
  noWorkYet: w("home.nowork", "No work yet", "You never put any work yet. Touch the green button to put your first work."),
  farmsCount: (count) => w(null, `${count} ${count === 1 ? "farm" : "farms"}`, `You get ${count} ${count === 1 ? "farm" : "farms"}.`),
  workCount: (count) => w(null, `${count} work`, `You put ${count} work.`),
  onPhoneCount: (count) => w(null, `${count} on phone`, count > 0 ? `${count} work still on your phone, waiting for network.` : "All your work gone on the internet. It safe."),

  // Network
  noNetwork: w("net.none", "No network", "Network not there. No problem. Your work will stay on your phone and go later."),
  allSent: w("net.sent", "All sent", "All your work gone on the internet. It safe."),
  sending: w("net.sending", "Sending", "Sending your work now."),

  // Record work
  recordTitle: w("record.title", "Put your work", "Touch the pictures to show the work you did. You do not need to write."),
  whichFarm: w("record.farm", "Which farm?", "Which farm you work on?"),
  whatWork: w("record.what", "What work you do?", "What work you do? Touch the picture."),
  when: w("record.when", "When?", "When you do the work?"),
  today: w("record.today", "Today", "Today."),
  yesterday: w("record.yesterday", "Yesterday", "Yesterday."),
  otherDay: w("record.otherday", "Another day", "Another day. Choose the day."),
  howMuch: w("record.howmuch", "How much?", "How much? You can leave it if you do not know."),
  more: w("record.more", "More", "Put one more."),
  less: w("record.less", "Less", "Take one away."),
  whatUsed: w("record.used", "What you use?", "What you use for the work? Touch the picture."),
  howItGo: w("record.how", "How it go?", "How the work go? Touch the one that is true."),
  writeMyself: w("record.write", "Write it myself", "Write it yourself, or ask somebody to write it for you."),
  save: w("record.save", "Save", "Save it."),
  saved: w("record.saved", "It saved", "Your work saved on your phone."),
  savedSending: w("record.savedsend", "It saved. It going now.", "Your work saved. It going on the internet now."),

  // Record status pictures
  statusPending: w("status.pending", "On phone", "This one on your phone. It will go when network come."),
  statusSyncing: w("status.syncing", "Sending", "This one going now."),
  statusSynced: w("status.synced", "Sent", "This one gone on the internet. It safe, even if the phone lost."),
  statusFailed: w("status.failed", "Need help", "This one get problem. Ask somebody to help you."),

  // Farms
  farmTitle: w("farm.title", "Add your farm", "Tell the phone about your farm. Touch the pictures."),
  whatFarm: w("farm.what", "What you farm?", "What kind of farm you get?"),
  whatGrow: w("farm.grow", "What you grow or raise?", "What you grow, or what animal you raise? Touch all the ones you get."),
  farmName: w("farm.name", "Farm name", "What you call this farm? Touch one."),
  ownName: w("farm.ownname", "Another name", "Give it another name. Ask somebody to write it."),
  where: w("farm.where", "Where the farm is?", "Where the farm is?"),
  samePlace: w("farm.same", "Same place I live", "The farm is in the same place you live."),
  otherPlace: w("farm.other", "Another place", "The farm is in another place."),
  saveFarm: w("farm.save", "Save farm", "Save the farm."),

  // Me
  signOut: w("me.signout", "Go out", "Go out of the app."),
  changePin: w("me.changepin", "Change PIN", "Change your secret number.")
};

// Spoken words for the activity types (labels.js keeps the icons).
export const ACTIVITY_WORDS = {
  land_preparation: w("activity.land_preparation", "Brushing", "Brushing and clearing the land."),
  planting: w("activity.planting", "Planting", "Planting."),
  watering: w("activity.watering", "Watering", "Giving water."),
  fertilizer_application: w("activity.fertilizer", "Fertilizer", "Putting fertilizer."),
  pesticide_application: w("activity.pesticide", "Spraying", "Spraying medicine for bugs."),
  weeding: w("activity.weeding", "Weeding", "Cleaning the grass. Weeding."),
  feeding: w("activity.feeding", "Feeding", "Feeding the animals."),
  vaccination: w("activity.vaccination", "Animal medicine", "Giving medicine to the animals."),
  cleaning: w("activity.cleaning", "Cleaning", "Cleaning the pen."),
  other: w("activity.other", "Other work", "Other work.")
};

export const FARM_TYPE_WORDS = {
  crop_farming: w("farmtype.crops", "Crops", "Crop farm, like rice, cassava and pepper."),
  livestock: w("farmtype.livestock", "Animals", "Animals, like goat, pig and cow."),
  poultry: w("farmtype.poultry", "Chicken", "Chicken and duck."),
  mixed_farming: w("farmtype.mixed", "Crops and animals", "Crops and animals together."),
  other: w("farmtype.other", "Other", "Another kind of farm.")
};

export const UNIT_WORDS = {
  bags: w("unit.bags", "Bags", "Bags."),
  kg: w("unit.kg", "Kilo", "Kilo."),
  buckets: w("unit.buckets", "Buckets", "Buckets."),
  litres: w("unit.litres", "Litres", "Litres, like gallon."),
  stems: w("unit.stems", "Sticks", "Sticks or stems."),
  birds: w("unit.birds", "Birds", "Birds, chicken or duck."),
  packs: w("unit.packs", "Packs", "Packs.")
};

// Crops and animals people grow and raise in Liberia, as pictures. Emoji are
// used because they are colourful, need no download and work offline.
export const CROPS = [
  { value: "Rice", emoji: "🌾", ...w("crop.rice", "Rice", "Rice.") },
  { value: "Cassava", emoji: "🍠", ...w("crop.cassava", "Cassava", "Cassava.") },
  { value: "Pepper", emoji: "🌶️", ...w("crop.pepper", "Pepper", "Pepper.") },
  { value: "Bitter ball", emoji: "🍆", ...w("crop.bitterball", "Bitter ball", "Bitter ball.") },
  { value: "Corn", emoji: "🌽", ...w("crop.corn", "Corn", "Corn.") },
  { value: "Plantain", emoji: "🍌", ...w("crop.plantain", "Plantain", "Plantain and banana.") },
  { value: "Palm", emoji: "🌴", ...w("crop.palm", "Palm", "Palm.") },
  { value: "Cocoa", emoji: "🍫", ...w("crop.cocoa", "Cocoa", "Cocoa.") },
  { value: "Coffee", emoji: "☕", ...w("crop.coffee", "Coffee", "Coffee.") },
  { value: "Rubber", emoji: "🌳", ...w("crop.rubber", "Rubber", "Rubber.") },
  { value: "Groundnut", emoji: "🥜", ...w("crop.groundnut", "Groundnut", "Groundnut.") },
  { value: "Greens", emoji: "🥬", ...w("crop.greens", "Greens", "Potato greens and cassava leaf.") },
  { value: "Sugarcane", emoji: "🎋", ...w("crop.sugarcane", "Sugarcane", "Sugarcane.") },
  { value: "Cucumber", emoji: "🥒", ...w("crop.cucumber", "Cucumber", "Cucumber.") },
  { value: "Watermelon", emoji: "🍉", ...w("crop.watermelon", "Watermelon", "Watermelon.") }
];

export const ANIMALS = [
  { value: "Chicken", emoji: "🐔", ...w("animal.chicken", "Chicken", "Chicken.") },
  { value: "Duck", emoji: "🦆", ...w("animal.duck", "Duck", "Duck.") },
  { value: "Goat", emoji: "🐐", ...w("animal.goat", "Goat", "Goat.") },
  { value: "Sheep", emoji: "🐑", ...w("animal.sheep", "Sheep", "Sheep.") },
  { value: "Pig", emoji: "🐖", ...w("animal.pig", "Pig", "Pig.") },
  { value: "Cow", emoji: "🐄", ...w("animal.cow", "Cow", "Cow.") },
  { value: "Fish", emoji: "🐟", ...w("animal.fish", "Fish", "Fish pond.") },
  { value: "Rabbit", emoji: "🐇", ...w("animal.rabbit", "Rabbit", "Rabbit.") }
];

export function growChoices(farmType) {
  if (farmType === "crop_farming") return CROPS;
  if (farmType === "poultry") return ANIMALS.filter((item) => ["Chicken", "Duck"].includes(item.value));
  if (farmType === "livestock") return ANIMALS.filter((item) => !["Chicken", "Duck"].includes(item.value));
  return [...CROPS, ...ANIMALS];
}

// Suggested farm names, so nobody has to type one.
export function farmNameChoices(firstGrow) {
  const names = [];
  if (firstGrow) names.push(w(null, `${firstGrow} farm`, `${firstGrow} farm.`));
  names.push(
    w("farmname.swamp", "Swamp farm", "Swamp farm, the low land with water."),
    w("farmname.upland", "Upland farm", "Upland farm, the high land."),
    w("farmname.house", "Garden by the house", "The garden by the house."),
    w("farmname.bush", "Bush farm", "The farm in the bush."),
    w("farmname.pen", "Animal pen", "The animal pen.")
  );
  return names;
}

// What the farmer used, as pictures, depending on the work.
const INPUTS = {
  seeds: { emoji: "🌱", ...w("input.seeds", "Seeds", "Seeds.") },
  riceSeed: { emoji: "🌾", ...w("input.riceseed", "Rice seed", "Rice seed.") },
  cassavaSticks: { emoji: "🍠", ...w("input.cassavasticks", "Cassava sticks", "Cassava sticks.") },
  cornSeed: { emoji: "🌽", ...w("input.cornseed", "Corn seed", "Corn seed.") },
  suckers: { emoji: "🍌", ...w("input.suckers", "Plantain suckers", "Plantain suckers.") },
  npk: { emoji: "🧪", ...w("input.npk", "NPK", "N P K fertilizer.") },
  urea: { emoji: "🧪", ...w("input.urea", "Urea", "Urea fertilizer.") },
  dung: { emoji: "🐔", ...w("input.dung", "Chicken dung", "Chicken dung.") },
  rottenLeaves: { emoji: "🍂", ...w("input.compost", "Rotten leaves", "Rotten leaves, compost.") },
  bugMedicine: { emoji: "🐛", ...w("input.bugmedicine", "Bug medicine", "Medicine for bugs.") },
  grassMedicine: { emoji: "🌿", ...w("input.grassmedicine", "Grass medicine", "Medicine for grass.") },
  water: { emoji: "💧", ...w("input.water", "Water", "Water.") },
  feed: { emoji: "🌾", ...w("input.feed", "Feed", "Animal feed.") },
  corn: { emoji: "🌽", ...w("input.corn", "Corn", "Corn.") },
  riceBran: { emoji: "🍚", ...w("input.ricebran", "Rice bran", "Rice bran.") },
  leftover: { emoji: "🍲", ...w("input.leftover", "Leftover food", "Leftover food.") },
  grass: { emoji: "🌿", ...w("input.grass", "Grass", "Grass.") },
  vaccine: { emoji: "💉", ...w("input.vaccine", "Injection", "Injection, vaccine.") },
  medicine: { emoji: "💊", ...w("input.medicine", "Medicine", "Medicine.") },
  cutlass: { emoji: "🔪", ...w("input.cutlass", "Cutlass", "Cutlass.") },
  hoe: { emoji: "⛏️", ...w("input.hoe", "Hoe", "Hoe.") },
  fire: { emoji: "🔥", ...w("input.fire", "Fire", "Burning the bush.") },
  broom: { emoji: "🧹", ...w("input.broom", "Broom", "Broom.") }
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
  finished: { emoji: "✅", ...w("phrase.finished", "I finish all", "I finish all of it.") },
  notFinished: { emoji: "⏳", ...w("phrase.notfinished", "Some still left", "Some still left to do.") },
  rain: { emoji: "🌧️", ...w("phrase.rain", "Rain stop the work", "Rain stop the work.") },
  kuu: { emoji: "👥", ...w("phrase.kuu", "Kuu help me", "My kuu people help me.") },
  looksFine: { emoji: "👍", ...w("phrase.fine", "It looking fine", "It looking fine.") },
  notFine: { emoji: "👎", ...w("phrase.notfine", "It not looking fine", "It not looking fine.") },
  bugs: { emoji: "🐛", ...w("phrase.bugs", "Bugs eating it", "Bugs eating it.") },
  swamp: { emoji: "💧", ...w("phrase.swamp", "In the swamp", "In the swamp.") },
  upland: { emoji: "⛰️", ...w("phrase.upland", "On the upland", "On the upland.") },
  sick: { emoji: "🤒", ...w("phrase.sick", "Some animals sick", "Some animals sick.") },
  died: { emoji: "⚠️", ...w("phrase.died", "Some animals die", "Some animals die.") },
  eating: { emoji: "😋", ...w("phrase.eating", "They eating fine", "The animals eating fine.") }
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
  removePerson: w("profiles.remove", "Take me off this phone", "Take your name off this phone."),
  putYourPin: (name) => w(null, `${name}, put your PIN`, `${name}, put your secret PIN.`),

  // Farm size
  farmSize: w("farm.size", "How big is the farm?", "How big is the farm? You can leave it if you do not know."),
  dontKnow: w("farm.dontknow", "I don't know", "I don't know."),

  // Harvest
  harvestTitle: w("harvest.title", "My harvest", "Your harvest. All the crops you brought from the farm."),
  addHarvest: w("harvest.add", "Put harvest", "Put the crop you brought from the farm."),
  whatCrop: w("harvest.crop", "What you harvest?", "What crop you harvest? Touch the picture."),
  harvestHowMuch: w("harvest.howmuch", "How much you get?", "How much you get? Touch plus to add."),
  whereKept: w("harvest.where", "Where you keep it?", "Where you keep it? You can leave it."),
  inStore: w("harvest.instore", "Still have it", "You still have all of it."),
  partSold: w("harvest.partsold", "Some sold", "You sold some. Some still left."),
  soldOut: w("harvest.soldout", "All sold", "You sold all of it."),
  left: w("harvest.left", "Left", "How much still left."),
  noHarvest: w("harvest.none", "No harvest yet", "You never put any harvest yet."),

  // Quality
  checkQuality: w("quality.title", "Check if it good", "Check if the crop good. Touch yes for each one that is true."),
  grade: w("quality.grade", "Grade", "The grade, how good it is."),

  // Passport
  passport: w("passport.title", "Harvest Passport", "Harvest passport. When you show this code, the buyer can see where your crop come from."),
  passportOn: w("passport.on", "Buyers can see it", "Buyers can scan the code and see where the crop come from."),
  passportOff: w("passport.off", "Hidden", "Nobody can see it. Touch to show buyers."),
  showBuyers: w("passport.show", "Let buyers see it", "Let buyers see where the crop come from."),

  // Money
  moneyTitle: w("money.title", "My money", "Your money. What you sell, what you spend, and what you keep."),
  sell: w("money.sell", "I sell something", "You sell something."),
  spend: w("money.spend", "I spend money", "You spend money for the farm."),
  sold: w("money.sold", "Sold", "Money from what you sold."),
  received: w("money.received", "Money in hand", "Money you already get in your hand."),
  owed: w("money.owed", "People owe me", "Money people still owe you."),
  spent: w("money.spent", "I spend", "Money you spend for the farm."),
  profit: w("money.profit", "What I keep", "What you keep. Money in hand, take away what you spend."),
  loss: w("money.loss", "I lost", "You spend more than you get."),
  whoBuy: w("money.whobuy", "Who buy it?", "Who buy it? Touch one, or leave it."),
  pricePerOne: w("money.priceeach", "Price for each one", "How much for each one?"),
  totalMoney: w("money.total", "All the money", "All the money together."),
  moneyType: w("money.type", "Which money?", "Liberian dollars or US dollars?"),
  didTheyPay: w("money.paid", "They pay you?", "They pay you the money?"),
  paidAll: w("money.paidall", "Pay all", "They pay all the money."),
  paidSome: w("money.paidsome", "Pay some", "They pay some. Some still owe."),
  paidNone: w("money.paidnone", "Not pay yet", "They not pay yet."),
  addPayment: w("money.addpay", "They pay me", "Put the money they pay you."),
  spentOn: w("money.spenton", "What you spend on?", "What you spend the money on? Touch the picture."),
  howMuchMoney: w("money.howmuch", "How much money?", "How much money? Use the numbers."),
  thisMonth: w("money.month", "This month", "This month."),
  thisYear: w("money.year", "This year", "This year."),
  allTime: w("money.all", "All the time", "All the time."),

  // Group
  groupTitle: w("group.title", "My group", "Your farmer group, your cooperative."),
  joinGroup: w("group.join", "Join a group", "Join a group. Put the group code."),
  groupCode: w("group.code", "Group code", "The group code. Ask your group leader."),
  noGroup: w("group.none", "No group yet", "You are not in any group yet."),
  groupTotal: w("group.total", "All the group", "What all the group did together."),
  myPart: w("group.mine", "My part", "What you did.")
});

export const RECORD_KIND_WORDS = {
  harvests: w("kind.harvest", "Harvest", "Harvest."),
  inspections: w("kind.inspection", "Quality check", "Quality check."),
  buyers: w("kind.buyer", "Buyer", "Buyer."),
  sales: w("kind.sale", "Sale", "Sale, what you sold."),
  payments: w("kind.payment", "Money paid", "Money they paid you."),
  expenses: w("kind.expense", "Money spent", "Money you spend.")
};

export const SIZE_UNITS = [
  { value: "acres", emoji: "🟩", ...w("size.acres", "Acres", "Acres.") },
  { value: "hectares", emoji: "🟫", ...w("size.hectares", "Hectares", "Hectares.") },
  { value: "lots", emoji: "🏡", ...w("size.lots", "Lots", "Lots.") },
  { value: "square_meters", emoji: "📏", ...w("size.sqm", "Square meters", "Square meters.") }
];

export const HARVEST_UNITS = [
  { value: "bags", emoji: "🛍️", ...w("hunit.bags", "Bags", "Bags.") },
  { value: "kg", emoji: "⚖️", ...w("hunit.kg", "Kilo", "Kilo.") },
  { value: "buckets", emoji: "🧺", ...w("hunit.buckets", "Buckets", "Buckets.") },
  { value: "tins", emoji: "🥫", ...w("hunit.tins", "Tins", "Tins.") },
  { value: "bunches", emoji: "🍌", ...w("hunit.bunches", "Bunches", "Bunches.") },
  { value: "pieces", emoji: "🔢", ...w("hunit.pieces", "Pieces", "Pieces, one one.") },
  { value: "birds", emoji: "🐔", ...w("hunit.birds", "Birds", "Birds.") },
  { value: "eggs", emoji: "🥚", ...w("hunit.eggs", "Eggs", "Eggs.") },
  { value: "litres", emoji: "💧", ...w("hunit.litres", "Litres", "Litres, like gallon.") }
];

export const STORAGE_PLACES = [
  { value: "House", emoji: "🏠", ...w("store.house", "In the house", "In the house.") },
  { value: "Store room", emoji: "🏚️", ...w("store.room", "Store room", "Store room.") },
  { value: "Kitchen loft", emoji: "🔥", ...w("store.loft", "Kitchen top", "On top of the kitchen fire.") },
  { value: "Group store", emoji: "🏬", ...w("store.group", "Group store", "The group store.") },
  { value: "Farm", emoji: "🌾", ...w("store.farm", "On the farm", "Still on the farm.") }
];

// Simple checks anybody can do by looking and smelling.
export const QUALITY_CHECKS = [
  { value: "dry", emoji: "☀️", ...w("check.dry", "Dry", "It dry well?") },
  { value: "clean", emoji: "✨", ...w("check.clean", "Clean", "It clean, no dirt and no stones?") },
  { value: "no_pests", emoji: "🐛", ...w("check.nopests", "No bugs", "No bugs inside?") },
  { value: "no_mold", emoji: "🍄", ...w("check.nomold", "No rotten", "No rotten or mold?") },
  { value: "sorted", emoji: "🧺", ...w("check.sorted", "Sorted", "The bad ones taken out?") },
  { value: "good_smell", emoji: "👃", ...w("check.smell", "Smell good", "It smell good?") }
];

export const GRADES = {
  A: { emoji: "🥇", ...w("grade.a", "Grade A", "Grade A. Very good.") },
  B: { emoji: "🥈", ...w("grade.b", "Grade B", "Grade B. Good.") },
  C: { emoji: "🥉", ...w("grade.c", "Grade C", "Grade C. Not too good.") },
  rejected: { emoji: "❌", ...w("grade.rejected", "Not good", "Not good. Can't sell like this.") }
};

// Suggested grade from the checks: all yes → A, one no → B, two → C, more → not good.
export function suggestGrade(checks) {
  const misses = QUALITY_CHECKS.filter((item) => checks[item.value] !== true).length;
  if (misses === 0) return "A";
  if (misses === 1) return "B";
  if (misses === 2) return "C";
  return "rejected";
}

export const BUYER_TYPES = [
  { value: "market_woman", emoji: "👩🏾", ...w("buyer.marketwoman", "Market woman", "Market woman.") },
  { value: "trader", emoji: "🚚", ...w("buyer.trader", "Trader", "Trader, business man.") },
  { value: "cooperative", emoji: "👥", ...w("buyer.coop", "My group", "Your farmer group.") },
  { value: "company", emoji: "🏢", ...w("buyer.company", "Company", "Company.") },
  { value: "neighbor", emoji: "🏘️", ...w("buyer.neighbor", "Neighbor", "Neighbor, somebody in the town.") },
  { value: "other", emoji: "🙋🏾", ...w("buyer.other", "Somebody else", "Somebody else.") }
];

export const PAYMENT_METHODS = [
  { value: "cash", emoji: "💵", ...w("pay.cash", "Cash", "Cash money.") },
  { value: "mobile_money", emoji: "📱", ...w("pay.mobile", "Mobile money", "Mobile money.") },
  { value: "bank", emoji: "🏦", ...w("pay.bank", "Bank", "Bank.") },
  { value: "other", emoji: "🔁", ...w("pay.other", "Other way", "Another way.") }
];

export const EXPENSE_CATEGORIES = [
  { value: "seeds", emoji: "🌱", ...w("spend.seeds", "Seeds", "Seeds.") },
  { value: "fertilizer", emoji: "🧪", ...w("spend.fertilizer", "Fertilizer", "Fertilizer.") },
  { value: "pesticide", emoji: "🐛", ...w("spend.pesticide", "Bug medicine", "Medicine for bugs or grass.") },
  { value: "labour", emoji: "👷🏾", ...w("spend.labour", "Workers", "Paying people to work.") },
  { value: "tools", emoji: "🔪", ...w("spend.tools", "Tools", "Tools, like cutlass and hoe.") },
  { value: "transport", emoji: "🚕", ...w("spend.transport", "Transport", "Transport, car or keke.") },
  { value: "feed", emoji: "🌾", ...w("spend.feed", "Animal feed", "Animal feed.") },
  { value: "medicine", emoji: "💉", ...w("spend.medicine", "Animal medicine", "Animal medicine.") },
  { value: "land", emoji: "🗺️", ...w("spend.land", "Land", "Land rent.") },
  { value: "other", emoji: "🔁", ...w("spend.other", "Other things", "Other things.") }
];

export const CURRENCIES = [
  { value: "LRD", emoji: "🇱🇷", ...w("money.lrd", "Liberian dollars", "Liberian dollars.") },
  { value: "USD", emoji: "💲", ...w("money.usd", "US dollars", "US dollars.") }
];

export function optionFor(list, value) {
  return list.find((item) => item.value === value) || null;
}

export function growEmoji(name) {
  const found = [...CROPS, ...ANIMALS].find((item) => item.value.toLowerCase() === String(name || "").toLowerCase());
  return found?.emoji || "🧺";
}

export function unitText(value) {
  return optionFor(HARVEST_UNITS, value)?.text || value || "";
}

WORDS.navMoney = w("nav.money", "Money", "Your money. What you sell and what you spend.");
WORDS.navHarvest = w("nav.harvest", "Harvest", "Your harvest.");
