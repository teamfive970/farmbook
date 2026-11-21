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


// ---------- a season of harvests, sales and groups (for the admin charts) ----------

// Small deterministic random generator so every demo database looks the same.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const HARVEST_UNITS = { "Layer chickens": "eggs", Goats: "pieces" };
const PRICE_LRD = { bags: 3200, eggs: 25, pieces: 9000 };
const SIZE_BY_TYPE = {
  crop_farming: () => ({ unit: "acres", min: 1, max: 6 }),
  mixed_farming: () => ({ unit: "hectares", min: 0.5, max: 3 }),
  livestock: () => ({ unit: "lots", min: 1, max: 4 }),
  poultry: () => ({ unit: "lots", min: 1, max: 2 })
};
const EXTRA_ACTIVITY_TYPES = {
  crop_farming: ["land_preparation", "planting", "weeding", "fertilizer_application", "pesticide_application", "watering"],
  mixed_farming: ["planting", "watering", "feeding", "weeding"],
  livestock: ["feeding", "vaccination", "cleaning"],
  poultry: ["feeding", "cleaning", "vaccination"]
};
const BUYERS = [
  ["Ma Hawa", "market_woman"],
  ["Gbarnga Market Traders", "trader"],
  ["Old Road Wholesale", "company"],
  ["Neighbour Kollie", "neighbor"]
];
const DEMO_GROUPS = [
  { name: "Bong Rice Growers", county: "Bong", district: "Gbarnga", code: "GRP-DEMOBG" },
  { name: "Nimba Women Farmers Group", county: "Nimba", district: "Saclepea", code: "GRP-DEMONM" },
  { name: "Lofa Cassava Union", county: "Lofa", district: "Voinjama", code: "GRP-DEMOLF" },
  { name: "Margibi Poultry Association", county: "Margibi", district: "Kakata", code: "GRP-DEMOMG" }
];

function passportCode(rand) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "LR-";
  for (let i = 0; i < 10; i += 1) code += alphabet[Math.floor(rand() * alphabet.length)];
  return code;
}

async function seedSeason(client) {
  const already = await client.query("SELECT 1 FROM harvests WHERE client_id LIKE 'demo-harvest-%' LIMIT 1");
  if (already.rows[0]) return false;
  const rand = seededRandom(20260401);

  const { rows: farmers } = await client.query(
    `SELECT id, county, district, created_at FROM farmers
     WHERE phone_number LIKE '+23177000%' ORDER BY phone_number`
  );

  // Spread registrations over the last year so the trend charts have a shape.
  // Records are only dated after the farmer joined.
  const ageDays = new Map();
  for (const [i, farmer] of farmers.entries()) {
    const age = i === 0 ? 350 : Math.floor(((farmers.length - i) / farmers.length) * 330 + rand() * 20) + 1;
    ageDays.set(farmer.id, age);
    await client.query(
      "UPDATE farmers SET created_at = now() - make_interval(days => $2) WHERE id = $1 AND created_at > now() - interval '2 days'",
      [farmer.id, age]
    );
  }
  const within = (farmerId, maxDays) => Math.floor(rand() * Math.min(maxDays, ageDays.get(farmerId) || maxDays)) + 1;

  let n = 0;
  for (const farmer of farmers) {
    const { rows: farms } = await client.query(
      "SELECT id, client_id, farm_type, main_crop_or_livestock, size FROM farms WHERE farmer_id = $1",
      [farmer.id]
    );
    const buyerIds = [];
    for (const [b, [name, type]] of BUYERS.entries()) {
      if (rand() < 0.5 && b > 0) continue;
      const buyer = await client.query(
        `INSERT INTO buyers (farmer_id, client_id, name, buyer_type) VALUES ($1, $2, $3, $4) RETURNING id, client_id`,
        [farmer.id, `demo-buyer-${farmer.id.slice(0, 8)}-${b}`, name, type]
      );
      buyerIds.push(buyer.rows[0]);
    }

    for (const farm of farms) {
      // Size (one farm in ten is left without a size, like real data).
      const sizeRule = SIZE_BY_TYPE[farm.farm_type]?.();
      if (sizeRule && farm.size === null && rand() > 0.1) {
        const size = Math.round((sizeRule.min + rand() * (sizeRule.max - sizeRule.min)) * 2) / 2;
        await client.query("UPDATE farms SET size = $2, size_unit = $3 WHERE id = $1", [farm.id, size, sizeRule.unit]);
      }

      // The farm's planting or animal group (the guide's production record).
      const isAnimalFarm = farm.farm_type === "livestock" || farm.farm_type === "poultry";
      const mainName = (farm.main_crop_or_livestock || "Rice").split(" and ")[0];
      n += 1;
      const productionClientId = `demo-production-${n}`;
      const startAge = within(farmer.id, 330) + 10;
      const production = await client.query(
        `INSERT INTO productions (farmer_id, client_id, farm_id, farm_client_id, kind, name, start_date, source, method, start_count, age_group)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [farmer.id, productionClientId, farm.id, farm.client_id, isAnimalFarm ? "animal" : "crop", mainName, daysAgo(startAge),
          rand() < 0.5 ? "own" : "bought", isAnimalFarm ? null : mainName === "Cassava" ? "cuttings" : "seeds",
          isAnimalFarm ? 10 + Math.floor(rand() * 40) : null, isAnimalFarm ? "young" : null]
      );
      const productionId = production.rows[0].id;
      if (isAnimalFarm) {
        for (const [eventType, quantity, cause] of [["born", 2 + Math.floor(rand() * 5), null], ["died", 1, rand() < 0.5 ? "sickness" : "predator"]]) {
          n += 1;
          await client.query(
            `INSERT INTO animal_events (farmer_id, client_id, production_id, production_client_id, event_type, quantity, event_date, cause)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [farmer.id, `demo-animal-${n}`, productionId, productionClientId, eventType, quantity, daysAgo(Math.max(1, startAge - 20)), cause]
          );
        }
      }

      // Work spread across the year.
      const types = EXTRA_ACTIVITY_TYPES[farm.farm_type] || ["feeding"];
      const count = 3 + Math.floor(rand() * 6);
      for (let a = 0; a < count; a += 1) {
        n += 1;
        await client.query(
          `INSERT INTO farm_activities (farmer_id, farm_id, client_id, activity_type, activity_date, description, production_id, production_client_id)
           VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)`,
          [farmer.id, farm.id, `demo-season-activity-${n}`, types[Math.floor(rand() * types.length)], daysAgo(within(farmer.id, 340)),
            productionId, productionClientId]
        );
      }

      // Harvests, quality checks, sales and payments.
      const crop = farm.main_crop_or_livestock || "Rice";
      const unit = HARVEST_UNITS[crop] || "bags";
      // Crops come from the planting; a chicken group gives eggs.
      const harvestCrop = unit === "eggs" ? "Eggs" : crop.split(" and ")[0];
      const linkHarvest = !isAnimalFarm || unit === "eggs";
      const harvestCount = 1 + Math.floor(rand() * 3);
      for (let h = 0; h < harvestCount; h += 1) {
        n += 1;
        const age = within(farmer.id, 300) + 4;
        const quantity =
          unit === "pieces" ? 2 + Math.floor(rand() * 6) : unit === "eggs" ? 150 + Math.floor(rand() * 600) : 5 + Math.floor(rand() * 40);
        const harvestClientId = `demo-harvest-${n}`;
        const harvest = await client.query(
          `INSERT INTO harvests (farmer_id, client_id, farm_id, farm_client_id, crop, harvest_date, quantity, unit, passport_code, passport_public,
             production_id, production_client_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
          [farmer.id, harvestClientId, farm.id, farm.client_id, harvestCrop, daysAgo(age), quantity, unit, passportCode(rand), rand() < 0.4,
            linkHarvest ? productionId : null, linkHarvest ? productionClientId : null]
        );
        const harvestId = harvest.rows[0].id;

        if (rand() < 0.7) {
          const roll = rand();
          const grade = roll < 0.45 ? "A" : roll < 0.8 ? "B" : roll < 0.95 ? "C" : "rejected";
          await client.query(
            `INSERT INTO quality_inspections (farmer_id, client_id, harvest_id, harvest_client_id, inspection_date, grade, checks)
             VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb)`,
            [farmer.id, `demo-check-${n}`, harvestId, harvestClientId, daysAgo(Math.max(1, age - 1)), grade]
          );
        }

        if (rand() < 0.8 && buyerIds.length) {
          const buyer = buyerIds[Math.floor(rand() * buyerIds.length)];
          const sold = Math.max(1, Math.floor(quantity * (0.4 + rand() * 0.6)));
          const usd = rand() < 0.15;
          const basePrice = PRICE_LRD[unit] || 3000;
          const unitPrice = usd
            ? Math.max(0.1, Math.round((basePrice / 190) * 100) / 100)
            : Math.round(basePrice * (0.8 + rand() * 0.4));
          const total = Math.round(sold * unitPrice * 100) / 100;
          const saleClientId = `demo-sale-${n}`;
          const sale = await client.query(
            `INSERT INTO sales (farmer_id, client_id, harvest_id, harvest_client_id, buyer_id, buyer_client_id,
               sale_date, crop, quantity, unit, unit_price, total_amount, currency, production_id, production_client_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
            [farmer.id, saleClientId, harvestId, harvestClientId, buyer.id, buyer.client_id, daysAgo(Math.max(1, age - 3)),
              harvestCrop, sold, unit, unitPrice, total, usd ? "USD" : "LRD",
              linkHarvest ? productionId : null, linkHarvest ? productionClientId : null]
          );
          const paidShare = rand() < 0.65 ? 1 : rand() < 0.5 ? 0.5 : 0;
          if (paidShare > 0) {
            await client.query(
              `INSERT INTO payments (farmer_id, client_id, sale_id, sale_client_id, amount, paid_date, method)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [farmer.id, `demo-pay-${n}`, sale.rows[0].id, saleClientId, Math.round(total * paidShare),
                daysAgo(Math.max(1, age - 4)), rand() < 0.3 ? "mobile_money" : "cash"]
            );
          }
        }
      }

      // Farm costs.
      const categories = farm.farm_type === "poultry" || farm.farm_type === "livestock"
        ? ["feed", "medicine", "labour", "transport"]
        : ["seeds", "fertilizer", "labour", "tools", "transport", "pesticide"];
      const costs = 2 + Math.floor(rand() * 4);
      for (let c = 0; c < costs; c += 1) {
        n += 1;
        const usd = rand() < 0.1;
        await client.query(
          `INSERT INTO expenses (farmer_id, client_id, farm_id, farm_client_id, expense_date, category, amount, currency)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [farmer.id, `demo-cost-${n}`, farm.id, farm.client_id, daysAgo(within(farmer.id, 330)),
            categories[Math.floor(rand() * categories.length)], usd ? 5 + Math.floor(rand() * 40) : 500 + Math.floor(rand() * 6000),
            usd ? "USD" : "LRD"]
        );
      }
    }
  }

  // Pretend each record reached the server on the day it happened, so the
  // engagement chart looks like a real pilot rather than "everyone today".
  await client.query(
    "UPDATE farm_activities SET created_at = activity_date + interval '18 hours' WHERE client_id LIKE 'demo-%' AND activity_date < now()::date"
  );
  for (const [table, column] of [["harvests", "harvest_date"], ["sales", "sale_date"], ["expenses", "expense_date"]]) {
    await client.query(
      `UPDATE ${table} SET created_at = ${column} + interval '18 hours' WHERE client_id LIKE 'demo-%' AND ${column} < now()::date`
    );
  }

  // Cooperatives with the demo farmers of each county as members.
  for (const group of DEMO_GROUPS) {
    const coop = await client.query(
      `INSERT INTO cooperatives (name, county, district, join_code, description)
       VALUES ($1, $2, $3, $4, 'Demo group') ON CONFLICT (join_code) DO NOTHING RETURNING id`,
      [group.name, group.county, group.district, group.code]
    );
    if (!coop.rows[0]) continue;
    const members = farmers.filter((f) => f.county === group.county);
    for (const [i, member] of members.entries()) {
      await client.query(
        `INSERT INTO cooperative_members (cooperative_id, farmer_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [coop.rows[0].id, member.id, i === 0 ? "leader" : "member"]
      );
    }
  }
  return true;
}

async function main() {
  // Demo accounts share a published PIN; never create them on a live server.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    console.error("Refusing to seed demo accounts with NODE_ENV=production.");
    process.exitCode = 1;
    return;
  }
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

    // Fill each demo farm's crop list from its main crop text (as migration 005 does).
    await client.query(
      `UPDATE farms f SET crops = COALESCE((
         SELECT array_agg(DISTINCT upper(left(trim(part), 1)) || substr(trim(part), 2))
         FROM regexp_split_to_table(f.main_crop_or_livestock, '\\s*(,|&|/|\\mand\\M)\\s*', 'i') AS part
         WHERE trim(part) <> ''), '{}')
       WHERE f.client_id LIKE 'demo-%' AND f.crops = '{}' AND f.main_crop_or_livestock IS NOT NULL`
    );
    const season = await seedSeason(client);
    return { created, skipped, season };
  });

  console.log(`Demo data ready: ${result.created} farmers created, ${result.skipped} already existed.`);
  console.log(
    result.season
      ? "  Added a year of harvests, quality checks, sales, payments, costs and 4 cooperatives for the admin charts."
      : "  Season data (harvests, sales, cooperatives) was already there."
  );
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
