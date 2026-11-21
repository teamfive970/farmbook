import { pool, withTransaction } from "../src/config/database.js";
import { hashPin, hashSecret } from "../src/lib/pin.js";

const DEMO_PHONE = "+231770000001";
const DEMO_PIN = "123456";
const DEMO_ANSWER = "goat";
const EXTRA_FARMERS = 40;
// Extra farmers start at +231 77 000 0010 so they never collide with the
// administrator's phone number (+231 77 000 0002).
const EXTRA_PHONE_START = 10;

const FIRST_NAMES = [
  "Grace", "Joseph", "Martha", "Samuel", "Esther", "Prince", "Comfort", "Emmanuel",
  "Rebecca", "Isaac", "Blessing", "Daniel", "Alice", "Moses", "Patience", "Abraham",
  "Jeneba", "Peter", "Hawa", "Solomon"
];

const LAST_NAMES = [
  "Johnson", "Kollie", "Kamara", "Toe", "Sackor", "Gbarbea", "Mensah", "Dolo",
  "Kpadeh", "Sumo", "Mulbah", "Tarr", "Baysah", "Wleh", "Zinnah", "Flomo"
];

const LOCATIONS = [
  { county: "Bong", district: "Gbarnga", community: "Gbarnga" },
  { county: "Montserrado", district: "Paynesville", community: "Duport Road" },
  { county: "Nimba", district: "Saclepea", community: "Saclepea Town" },
  { county: "Lofa", district: "Voinjama", community: "Voinjama" },
  { county: "Margibi", district: "Kakata", community: "Kakata" },
  { county: "Grand Bassa", district: "Buchanan", community: "Buchanan" },
  { county: "Bomi", district: "Tubmanburg", community: "Tubmanburg" },
  { county: "Maryland", district: "Harper", community: "Harper" },
  { county: "Sinoe", district: "Greenville", community: "Greenville" },
  { county: "Gbarpolu", district: "Bopolu", community: "Bopolu" }];

const FARM_BLUEPRINTS = [
  {
    farmName: "Rice Field",
    farmType: "crop_farming",
    mainCropOrLivestock: "Rice",
    description: "Lowland rice field worked with the family.",
    activities: [
      { type: "planting", description: "Planted rice seedlings on the lowland field.", input: "Rice seedlings", quantity: 30, unit: "bunches" },
      { type: "weeding", description: "Weeded the field before the rains.", input: null, quantity: null, unit: null },
      { type: "fertilizer_application", description: "Applied fertilizer to the rice field.", input: "NPK 15-15-15", quantity: 25, unit: "kg" }
    ]
  },
  {
    farmName: "Cassava Farm",
    farmType: "crop_farming",
    mainCropOrLivestock: "Cassava",
    description: "Upland cassava plot behind the house.",
    activities: [
      { type: "land_preparation", description: "Cleared and prepared the land.", input: null, quantity: null, unit: null },
      { type: "planting", description: "Planted cassava cuttings.", input: "Cassava cuttings", quantity: 40, unit: "stems" }
    ]
  },
  {
    farmName: "Poultry Pen",
    farmType: "poultry",
    mainCropOrLivestock: "Layer chickens",
    description: "Small poultry pen for layer chickens.",
    activities: [
      { type: "feeding", description: "Fed the chickens in the morning.", input: "Layer feed", quantity: 5, unit: "kg" },
      { type: "cleaning", description: "Cleaned the poultry pen.", input: null, quantity: null, unit: null }
    ]
  },
  {
    farmName: "Goat Farm",
    farmType: "livestock",
    mainCropOrLivestock: "Goats",
    description: "Goat herd kept near the compound.",
    activities: [
      { type: "feeding", description: "Took the goats to graze.", input: null, quantity: null, unit: null },
      { type: "vaccination", description: "Vaccinated the goats.", input: "PPR vaccine", quantity: 12, unit: "doses" }
    ]
  },
  {
    farmName: "Mixed Farm",
    farmType: "mixed_farming",
    mainCropOrLivestock: "Cassava and chickens",
    description: "Vegetables, cassava and a few chickens.",
    activities: [
      { type: "planting", description: "Planted vegetables in the kitchen garden.", input: "Pepper seedlings", quantity: 60, unit: "seedlings" },
      { type: "watering", description: "Watered the vegetable beds.", input: null, quantity: null, unit: null },
      { type: "feeding", description: "Fed the chickens.", input: "Feed", quantity: 3, unit: "kg" }
    ]
  }
];

function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function demoPhone(index) {
  return `+23177000${String(index).padStart(4, "0")}`;
}

async function seedFarmer(client, farmer) {
  const existing = await client.query("SELECT id FROM farmers WHERE phone_number = $1", [
    farmer.phoneNumber
  ]);
  if (existing.rows[0]) return false;

  const inserted = await client.query(
    `INSERT INTO farmers (full_name, phone_number, county, district, community, pin_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      farmer.fullName,
      farmer.phoneNumber,
      farmer.location.county,
      farmer.location.district,
      farmer.location.community,
      farmer.pinHash,
      farmer.status
    ]
  );
  const farmerId = inserted.rows[0].id;

  for (const [farmIndex, blueprint] of farmer.farms.entries()) {
    const farm = await client.query(
      `INSERT INTO farms (farmer_id, client_id, farm_name, county, district, community,
         farm_type, main_crop_or_livestock, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        farmerId,
        `demo-farm-${farmer.index}-${farmIndex + 1}`,
        blueprint.farmName,
        farmer.location.county,
        farmer.location.district,
        farmer.location.community,
        blueprint.farmType,
        blueprint.mainCropOrLivestock,
        blueprint.description
      ]
    );
    const farmId = farm.rows[0].id;

    for (const [activityIndex, activity] of blueprint.activities.entries()) {
      await client.query(
        `INSERT INTO farm_activities
          (farmer_id, farm_id, client_id, activity_type, activity_date, description,
           input_used, quantity, unit, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          farmerId,
          farmId,
          `demo-activity-${farmer.index}-${farmIndex + 1}-${activityIndex + 1}`,
          activity.type,
          daysAgo(((farmer.index * 2 + activityIndex * 3) % 28) + 1),
          activity.description,
          activity.input,
          activity.quantity,
          activity.unit,
          null
        ]
      );
    }
  }

  return true;
}

function buildExtraFarmers(pinHash) {
  const farmers = [];
  for (let index = 1; index <= EXTRA_FARMERS; index += 1) {
    const blueprint = FARM_BLUEPRINTS[index % FARM_BLUEPRINTS.length];
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(index * 3) % LAST_NAMES.length];
    farmers.push({
      index: index + 1,
      fullName: `${firstName} ${lastName}`,
      phoneNumber: demoPhone(EXTRA_PHONE_START + index - 1),
      location: LOCATIONS[index % LOCATIONS.length],
      pinHash,
      status: index % 13 === 0 ? "inactive" : "active",
      farms: [
        { ...blueprint, farmName: `${firstName}'s ${blueprint.farmName}` }
      ]
    });
  }
  return farmers;
}

async function main() {
  if (!pool) {
    console.error("DATABASE_URL is not set. Copy backend/.env.example to backend/.env and configure it.");
    process.exitCode = 1;
    return;
  }

  const pinHash = await hashPin(DEMO_PIN);
  const answerHash = await hashSecret(DEMO_ANSWER);

  const result = await withTransaction(async (client) => {
    let created = 0;
    let skipped = 0;

    const existingDemo = await client.query(
      "SELECT id, security_question FROM farmers WHERE phone_number = $1",
      [DEMO_PHONE]
    );

    let demoFarmerId;
    if (existingDemo.rows[0]) {
      demoFarmerId = existingDemo.rows[0].id;
      skipped += 1;
      if (!existingDemo.rows[0].security_question) {
        await client.query(
          `UPDATE farmers
           SET security_question = 'first_farm_animal', security_answer_hash = $1
           WHERE id = $2`,
          [answerHash, demoFarmerId]
        );
      }
    } else {
      const farmer = await client.query(
        `INSERT INTO farmers
          (full_name, phone_number, county, district, community, pin_hash,
           security_question, security_answer_hash)
         VALUES ($1, $2, $3, $4, $5, $6, 'first_farm_animal', $7)
         RETURNING id`,
        ["James Kollie", DEMO_PHONE, "Bong", "Gbarnga", "Gbarnga", pinHash, answerHash]
      );
      demoFarmerId = farmer.rows[0].id;
      created += 1;

      const cropFarm = await client.query(
        `INSERT INTO farms (farmer_id, client_id, farm_name, county, district, community,
           farm_type, main_crop_or_livestock, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          demoFarmerId,
          "demo-farm-demo-1",
          "Green Valley Farm",
          "Bong",
          "Gbarnga",
          "Gbarnga",
          "crop_farming",
          "Cassava and rice",
          "Family farm near the Gbarnga road."
        ]
      );

      const poultryFarm = await client.query(
        `INSERT INTO farms (farmer_id, client_id, farm_name, county, district, community,
           farm_type, main_crop_or_livestock, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          demoFarmerId,
          "demo-farm-demo-2",
          "Hope Poultry Farm",
          "Bong",
          "Gbarnga",
          "Kpelleh Town",
          "poultry",
          "Layer chickens",
          "Small poultry pen behind the house."
        ]
      );

      await client.query(
        `INSERT INTO farm_activities
          (farmer_id, farm_id, client_id, activity_type, activity_date, description,
           input_used, quantity, unit, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          demoFarmerId,
          cropFarm.rows[0].id,
          "demo-activity-planting-001",
          "planting",
          daysAgo(3),
          "Planted cassava on the lower field.",
          "Cassava cuttings",
          40,
          "stems",
          "Second planting this season."
        ]
      );

      await client.query(
        `INSERT INTO farm_activities
          (farmer_id, farm_id, client_id, activity_type, activity_date, description,
           input_used, quantity, unit, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          demoFarmerId,
          poultryFarm.rows[0].id,
          "demo-activity-feeding-001",
          "feeding",
          daysAgo(1),
          "Fed the chickens in the morning.",
          "Layer feed",
          5,
          "kg",
          null
        ]
      );
    }

    for (const farmer of buildExtraFarmers(pinHash)) {
      if (await seedFarmer(client, farmer)) created += 1;
      else skipped += 1;
    }

    return { created, skipped };
  });

  console.log(`Demo data ready: ${result.created} farmers created, ${result.skipped} already existed.`);
  console.log(`  ${EXTRA_FARMERS + 1} demo farmers in total (enough to page through the admin list).`);
  console.log("  Farmer phone: +231 77 000 0001");
  console.log(`  Farmer PIN:   ${DEMO_PIN}`);
  console.log(`  Recovery question: first farm animal → ${DEMO_ANSWER}`);
  console.log(`  Extra farmers use ${demoPhone(EXTRA_PHONE_START)} to ${demoPhone(EXTRA_PHONE_START + EXTRA_FARMERS - 1)} with PIN ${DEMO_PIN}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool?.end());
