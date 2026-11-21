# Voice clips for "Talk to me"

When "Talk to me" is on, the app speaks words out loud. For each phrase it:

1. plays a **recorded clip** from this folder, if `manifest.json` lists one, or
2. reads the phrase with the phone's own voice (simple Liberian English, read slowly; a
   Nigerian or Ghanaian English voice is used if the phone has one).

Phones have no voice for Kpelle, Bassa, Mano, Gio, Kru, Lorma or Vai, so the only way to
speak those languages, or to sound truly Liberian, is to **record real people**.
Recordings work offline: the app saves them on the phone after the first visit.

## How to add recordings

1. Record each phrase below on any phone (voice recorder app). Speak slowly and clearly.
   A trusted voice from the community (an extension officer or a respected elder) works best.
2. Save each as a short `.mp3` file named after its clip name, e.g. `activity.planting.mp3`.
   For a local language, use a sub-folder, e.g. `kpelle/activity.planting.mp3`.
3. Put the files in this folder and list them in `manifest.json`:

```json
{
  "language": "Kpelle",
  "clips": {
    "activity.planting": "kpelle/activity.planting.mp3",
    "record.save": "kpelle/record.save.mp3"
  }
}
```

Any phrase without a clip keeps using the phone's voice, so you can record a few at a time.
Start with the most-used ones: the `activity.*`, `record.*`, `status.*`, `nav.*` and
`login.*` phrases.

Some phrases contain the farmer's name or a number (the greeting, "You get 3 farms"). These
always use the phone's voice.

## Recording checklist

The text comes from `src/lib/words.js`. If you change words there, update this list.
Please check every phrase with farmers in the pilot and change any that do not sound right.


| Clip name (key) | Shown on screen | What to say |
|---|---|---|
| `voice.on` | Talk to me: on | The phone will talk to you now. Touch any picture, it will tell you what it is. |
| `voice.off` | Talk to me: off | Touch here and the phone will talk to you. |
| `voice.switch` | Talk to me | Touch here and the phone will talk to you. |
| `voice.hear` | Hear it | Listen. |
| `welcome.title` | Keep your farm work in your phone | Welcome. This app can keep your farm work in your phone, even when network not there. |
| `welcome.new` | I am new | I am new. Make my account. |
| `welcome.have` | I have account | I already have account. Let me go inside. |
| `login.phone` | Your phone number | Put your phone number. |
| `login.pin` | Your PIN | Put your secret number, your PIN. |
| `login.go` | Go inside | Go inside. |
| `login.forgot` | I forget my PIN | I forget my PIN. Help me. |
| `login.notyou` | Not me | This is not me. Use another phone number. |
| `login.wrong` | PIN not correct | That PIN is not correct. Try it again. |
| `login.wait` | Wait small | You try too many times. Wait small, then try again. |
| `login.send` | Put your PIN to send your work | Network come back. Put your PIN one time so your work can go on the internet. |
| `pad.delete` | Take it out | Take the last number out. |
| `pad.clear` | Clear | Clear all of it. |
| `nav.home` | Home | Go home. |
| `nav.farms` | My farms | See your farms. |
| `nav.records` | My work | See all the work you did. |
| `nav.me` | Me | Your name and your PIN. |
| `home.record` | Put today work | Touch here to put the work you do on the farm. |
| `home.addfarm` | Add farm | Add new farm. |
| `home.seework` | See my work | See all the work you did before. |
| `home.recent` | Work you did lately | This is the work you did lately. |
| `home.nowork` | No work yet | You never put any work yet. Touch the green button to put your first work. |
| `net.none` | No network | Network not there. No problem. Your work will stay on your phone and go later. |
| `net.sent` | All sent | All your work gone on the internet. It safe. |
| `net.sending` | Sending | Sending your work now. |
| `record.title` | Put your work | Touch the pictures to show the work you did. You do not need to write. |
| `record.farm` | Which farm? | Which farm you work on? |
| `record.what` | What work you do? | What work you do? Touch the picture. |
| `record.when` | When? | When you do the work? |
| `record.today` | Today | Today. |
| `record.yesterday` | Yesterday | Yesterday. |
| `record.otherday` | Another day | Another day. Choose the day. |
| `record.howmuch` | How much? | How much? You can leave it if you do not know. |
| `record.more` | More | Put one more. |
| `record.less` | Less | Take one away. |
| `record.used` | What you use? | What you use for the work? Touch the picture. |
| `record.how` | How it go? | How the work go? Touch the one that is true. |
| `record.write` | Write it myself | Write it yourself, or ask somebody to write it for you. |
| `record.save` | Save | Save it. |
| `record.saved` | It saved | Your work saved on your phone. |
| `record.savedsend` | It saved. It going now. | Your work saved. It going on the internet now. |
| `status.pending` | On phone | This one on your phone. It will go when network come. |
| `status.syncing` | Sending | This one going now. |
| `status.synced` | Sent | This one gone on the internet. It safe, even if the phone lost. |
| `status.failed` | Need help | This one get problem. Ask somebody to help you. |
| `farm.title` | Add your farm | Tell the phone about your farm. Touch the pictures. |
| `farm.what` | What you farm? | What kind of farm you get? |
| `farm.grow` | What you grow or raise? | What you grow, or what animal you raise? Touch all the ones you get. |
| `farm.name` | Farm name | What you call this farm? Touch one. |
| `farm.ownname` | Another name | Give it another name. Ask somebody to write it. |
| `farm.where` | Where the farm is? | Where the farm is? |
| `farm.same` | Same place I live | The farm is in the same place you live. |
| `farm.other` | Another place | The farm is in another place. |
| `farm.save` | Save farm | Save the farm. |
| `me.signout` | Go out | Go out of the app. |
| `me.changepin` | Change PIN | Change your secret number. |
| `profiles.who` | Who is using the phone? | Who is using the phone? Touch your name. |
| `profiles.add` | Add another person | Add another person to this phone. |
| `profiles.switch` | Change person | Give the phone to another person. |
| `profiles.remove` | Take me off this phone | Take your name off this phone. |
| `farm.size` | How big is the farm? | How big is the farm? You can leave it if you do not know. |
| `farm.dontknow` | I don't know | I don't know. |
| `harvest.title` | My harvest | Your harvest. All the crops you brought from the farm. |
| `harvest.add` | Put harvest | Put the crop you brought from the farm. |
| `harvest.crop` | What you harvest? | What crop you harvest? Touch the picture. |
| `harvest.howmuch` | How much you get? | How much you get? Touch plus to add. |
| `harvest.where` | Where you keep it? | Where you keep it? You can leave it. |
| `harvest.instore` | Still have it | You still have all of it. |
| `harvest.partsold` | Some sold | You sold some. Some still left. |
| `harvest.soldout` | All sold | You sold all of it. |
| `harvest.left` | Left | How much still left. |
| `harvest.none` | No harvest yet | You never put any harvest yet. |
| `quality.title` | Check if it good | Check if the crop good. Touch yes for each one that is true. |
| `quality.grade` | Grade | The grade, how good it is. |
| `passport.title` | Harvest Passport | Harvest passport. When you show this code, the buyer can see where your crop come from. |
| `passport.on` | Buyers can see it | Buyers can scan the code and see where the crop come from. |
| `passport.off` | Hidden | Nobody can see it. Touch to show buyers. |
| `passport.show` | Let buyers see it | Let buyers see where the crop come from. |
| `money.title` | My money | Your money. What you sell, what you spend, and what you keep. |
| `money.sell` | I sell something | You sell something. |
| `money.spend` | I spend money | You spend money for the farm. |
| `money.sold` | Sold | Money from what you sold. |
| `money.received` | Money in hand | Money you already get in your hand. |
| `money.owed` | People owe me | Money people still owe you. |
| `money.spent` | I spend | Money you spend for the farm. |
| `money.profit` | What I keep | What you keep. Money in hand, take away what you spend. |
| `money.loss` | I lost | You spend more than you get. |
| `money.whobuy` | Who buy it? | Who buy it? Touch one, or leave it. |
| `money.priceeach` | Price for each one | How much for each one? |
| `money.total` | All the money | All the money together. |
| `money.type` | Which money? | Liberian dollars or US dollars? |
| `money.paid` | They pay you? | They pay you the money? |
| `money.paidall` | Pay all | They pay all the money. |
| `money.paidsome` | Pay some | They pay some. Some still owe. |
| `money.paidnone` | Not pay yet | They not pay yet. |
| `money.addpay` | They pay me | Put the money they pay you. |
| `money.spenton` | What you spend on? | What you spend the money on? Touch the picture. |
| `money.howmuch` | How much money? | How much money? Use the numbers. |
| `money.month` | This month | This month. |
| `money.year` | This year | This year. |
| `money.all` | All the time | All the time. |
| `group.title` | My group | Your farmer group, your cooperative. |
| `group.join` | Join a group | Join a group. Put the group code. |
| `group.code` | Group code | The group code. Ask your group leader. |
| `group.none` | No group yet | You are not in any group yet. |
| `group.total` | All the group | What all the group did together. |
| `group.mine` | My part | What you did. |
| `nav.money` | Money | Your money. What you sell and what you spend. |
| `nav.harvest` | Harvest | Your harvest. |
| `activity.land_preparation` | Brushing | Brushing and clearing the land. |
| `activity.planting` | Planting | Planting. |
| `activity.watering` | Watering | Giving water. |
| `activity.fertilizer` | Fertilizer | Putting fertilizer. |
| `activity.pesticide` | Spraying | Spraying medicine for bugs. |
| `activity.weeding` | Weeding | Cleaning the grass. Weeding. |
| `activity.feeding` | Feeding | Feeding the animals. |
| `activity.vaccination` | Animal medicine | Giving medicine to the animals. |
| `activity.cleaning` | Cleaning | Cleaning the pen. |
| `activity.other` | Other work | Other work. |
| `farmtype.crops` | Crops | Crop farm, like rice, cassava and pepper. |
| `farmtype.livestock` | Animals | Animals, like goat, pig and cow. |
| `farmtype.poultry` | Chicken | Chicken and duck. |
| `farmtype.mixed` | Crops and animals | Crops and animals together. |
| `farmtype.other` | Other | Another kind of farm. |
| `unit.bags` | Bags | Bags. |
| `unit.kg` | Kilo | Kilo. |
| `unit.buckets` | Buckets | Buckets. |
| `unit.litres` | Litres | Litres, like gallon. |
| `unit.stems` | Sticks | Sticks or stems. |
| `unit.birds` | Birds | Birds, chicken or duck. |
| `unit.packs` | Packs | Packs. |
| `kind.harvest` | Harvest | Harvest. |
| `kind.inspection` | Quality check | Quality check. |
| `kind.buyer` | Buyer | Buyer. |
| `kind.sale` | Sale | Sale, what you sold. |
| `kind.payment` | Money paid | Money they paid you. |
| `kind.expense` | Money spent | Money you spend. |
| `grade.a` | Grade A | Grade A. Very good. |
| `grade.b` | Grade B | Grade B. Good. |
| `grade.c` | Grade C | Grade C. Not too good. |
| `grade.rejected` | Not good | Not good. Can't sell like this. |
| `crop.rice` | Rice | Rice. |
| `crop.cassava` | Cassava | Cassava. |
| `crop.pepper` | Pepper | Pepper. |
| `crop.bitterball` | Bitter ball | Bitter ball. |
| `crop.corn` | Corn | Corn. |
| `crop.plantain` | Plantain | Plantain and banana. |
| `crop.palm` | Palm | Palm. |
| `crop.cocoa` | Cocoa | Cocoa. |
| `crop.coffee` | Coffee | Coffee. |
| `crop.rubber` | Rubber | Rubber. |
| `crop.groundnut` | Groundnut | Groundnut. |
| `crop.greens` | Greens | Potato greens and cassava leaf. |
| `crop.sugarcane` | Sugarcane | Sugarcane. |
| `crop.cucumber` | Cucumber | Cucumber. |
| `crop.watermelon` | Watermelon | Watermelon. |
| `animal.chicken` | Chicken | Chicken. |
| `animal.duck` | Duck | Duck. |
| `animal.goat` | Goat | Goat. |
| `animal.sheep` | Sheep | Sheep. |
| `animal.pig` | Pig | Pig. |
| `animal.cow` | Cow | Cow. |
| `animal.fish` | Fish | Fish pond. |
| `animal.rabbit` | Rabbit | Rabbit. |
| `size.acres` | Acres | Acres. |
| `size.hectares` | Hectares | Hectares. |
| `size.lots` | Lots | Lots. |
| `size.sqm` | Square meters | Square meters. |
| `hunit.bags` | Bags | Bags. |
| `hunit.kg` | Kilo | Kilo. |
| `hunit.buckets` | Buckets | Buckets. |
| `hunit.tins` | Tins | Tins. |
| `hunit.bunches` | Bunches | Bunches. |
| `hunit.pieces` | Pieces | Pieces, one one. |
| `hunit.birds` | Birds | Birds. |
| `hunit.eggs` | Eggs | Eggs. |
| `hunit.litres` | Litres | Litres, like gallon. |
| `store.house` | In the house | In the house. |
| `store.room` | Store room | Store room. |
| `store.loft` | Kitchen top | On top of the kitchen fire. |
| `store.group` | Group store | The group store. |
| `store.farm` | On the farm | Still on the farm. |
| `check.dry` | Dry | It dry well? |
| `check.clean` | Clean | It clean, no dirt and no stones? |
| `check.nopests` | No bugs | No bugs inside? |
| `check.nomold` | No rotten | No rotten or mold? |
| `check.sorted` | Sorted | The bad ones taken out? |
| `check.smell` | Smell good | It smell good? |
| `buyer.marketwoman` | Market woman | Market woman. |
| `buyer.trader` | Trader | Trader, business man. |
| `buyer.coop` | My group | Your farmer group. |
| `buyer.company` | Company | Company. |
| `buyer.neighbor` | Neighbor | Neighbor, somebody in the town. |
| `buyer.other` | Somebody else | Somebody else. |
| `pay.cash` | Cash | Cash money. |
| `pay.mobile` | Mobile money | Mobile money. |
| `pay.bank` | Bank | Bank. |
| `pay.other` | Other way | Another way. |
| `spend.seeds` | Seeds | Seeds. |
| `spend.fertilizer` | Fertilizer | Fertilizer. |
| `spend.pesticide` | Bug medicine | Medicine for bugs or grass. |
| `spend.labour` | Workers | Paying people to work. |
| `spend.tools` | Tools | Tools, like cutlass and hoe. |
| `spend.transport` | Transport | Transport, car or keke. |
| `spend.feed` | Animal feed | Animal feed. |
| `spend.medicine` | Animal medicine | Animal medicine. |
| `spend.land` | Land | Land rent. |
| `spend.other` | Other things | Other things. |
| `money.lrd` | Liberian dollars | Liberian dollars. |
| `money.usd` | US dollars | US dollars. |
| `farmname.swamp` | Swamp farm | Swamp farm, the low land with water. |
| `farmname.upland` | Upland farm | Upland farm, the high land. |
| `farmname.house` | Garden by the house | The garden by the house. |
| `farmname.bush` | Bush farm | The farm in the bush. |
| `farmname.pen` | Animal pen | The animal pen. |
| `input.cutlass` | Cutlass | Cutlass. |
| `input.hoe` | Hoe | Hoe. |
| `input.fire` | Fire | Burning the bush. |
| `phrase.finished` | I finish all | I finish all of it. |
| `phrase.notfinished` | Some still left | Some still left to do. |
| `phrase.swamp` | In the swamp | In the swamp. |
| `phrase.upland` | On the upland | On the upland. |
| `phrase.kuu` | Kuu help me | My kuu people help me. |
| `phrase.rain` | Rain stop the work | Rain stop the work. |
| `input.riceseed` | Rice seed | Rice seed. |
| `input.cassavasticks` | Cassava sticks | Cassava sticks. |
| `input.cornseed` | Corn seed | Corn seed. |
| `input.suckers` | Plantain suckers | Plantain suckers. |
| `input.seeds` | Seeds | Seeds. |
| `input.water` | Water | Water. |
| `phrase.fine` | It looking fine | It looking fine. |
| `phrase.notfine` | It not looking fine | It not looking fine. |
| `phrase.bugs` | Bugs eating it | Bugs eating it. |
| `input.npk` | NPK | N P K fertilizer. |
| `input.urea` | Urea | Urea fertilizer. |
| `input.dung` | Chicken dung | Chicken dung. |
| `input.compost` | Rotten leaves | Rotten leaves, compost. |
| `input.bugmedicine` | Bug medicine | Medicine for bugs. |
| `input.grassmedicine` | Grass medicine | Medicine for grass. |
| `input.feed` | Feed | Animal feed. |
| `input.corn` | Corn | Corn. |
| `input.ricebran` | Rice bran | Rice bran. |
| `input.leftover` | Leftover food | Leftover food. |
| `input.grass` | Grass | Grass. |
| `phrase.eating` | They eating fine | The animals eating fine. |
| `phrase.sick` | Some animals sick | Some animals sick. |
| `phrase.died` | Some animals die | Some animals die. |
| `input.vaccine` | Injection | Injection, vaccine. |
| `input.medicine` | Medicine | Medicine. |
| `input.broom` | Broom | Broom. |
