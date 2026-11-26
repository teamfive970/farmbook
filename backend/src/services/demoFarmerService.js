import { query } from "../config/database.js";
import { hashPin } from "../lib/pin.js";
import { createFarm } from "./farmService.js";
import { createRecord } from "./resourceService.js";

// Demo farmers for the IVR simulator's demo mode (so anyone, like a judge,
// can try a call without touching a real farmer's records).
//
// - Their phone numbers start +231000, which no Liberian phone has and the
//   app and USSD won't accept, so a real farmer can never sign in as one or
//   be blocked from registering by one.
// - They are marked is_demo, and everything that counts farmers (the
//   Ministry dashboard, market prices, messages and SMS to farmers) leaves
//   them out.
// - Their PIN is public on purpose (IVR_DEMO_PIN, default 1234).

export const DEMO_FARMERS = [
  {
    phone: "+231000000901",
    name: "Musu Demo",
    county: "Bong",
    district: "Jorquelleh",
    community: "Gbarnga",
    farm: { name: "Musu's demo farm", type: "crop_farming", crops: ["Rice", "Cassava", "Pepper"] },
    harvest: { crop: "Rice", quantity: 20, unit: "bags" }
  },
  {
    phone: "+231000000902",
    name: "Kollie Demo",
    county: "Nimba",
    district: "Sanniquellie-Mahn",
    community: "Sanniquellie",
    farm: { name: "Kollie's demo farm", type: "mixed_farming", crops: ["Cassava", "Plantain", "Chicken"] },
    harvest: { crop: "Cassava", quantity: 30, unit: "bags" }
  }
];

export const demoPin = () => (/^\d{4,6}$/.test(process.env.IVR_DEMO_PIN || "") ? process.env.IVR_DEMO_PIN : "1234");

function todayMinus(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

// Makes the demo farmers if they are missing, and keeps their PIN as set.
export async function ensureDemoFarmers() {
  const pinHash = await hashPin(demoPin());
  for (const demo of DEMO_FARMERS) {
    const existing = await query("SELECT id, is_demo FROM farmers WHERE phone_number = $1", [demo.phone]);
    if (existing.rows[0] && !existing.rows[0].is_demo) continue; // never take over a real account
    let farmerId = existing.rows[0]?.id;
    if (!farmerId) {
      const { rows } = await query(
        `INSERT INTO farmers (full_name, phone_number, county, district, community, pin_hash, status, is_demo)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', true)
         ON CONFLICT (phone_number) DO NOTHING RETURNING id`,
        [demo.name, demo.phone, demo.county, demo.district, demo.community, pinHash]
      );
      farmerId = rows[0]?.id;
      if (!farmerId) continue;
    } else {
      await query(
        "UPDATE farmers SET pin_hash = $2, failed_login_count = 0, locked_until = NULL, status = 'active' WHERE id = $1",
        [farmerId, pinHash]
      );
    }
    const farmClientId = `demo-farm-${demo.phone.slice(-3)}`;
    await createFarm(farmerId, {
      clientId: farmClientId,
      farmName: demo.farm.name,
      county: demo.county,
      district: demo.district,
      community: demo.community,
      farmType: demo.farm.type,
      crops: demo.farm.crops
    });
    // One harvest in store, so "Record a sale" has something to sell from.
    await createRecord("harvests", farmerId, {
      clientId: `demo-harvest-${demo.phone.slice(-3)}`,
      farmClientId,
      crop: demo.harvest.crop,
      quantity: demo.harvest.quantity,
      unit: demo.harvest.unit,
      harvestDate: todayMinus(7),
      notes: "Demo harvest for the IVR simulator"
    });
  }
}

export async function listDemoFarmers() {
  const { rows } = await query(
    `SELECT id, full_name, county, phone_number FROM farmers WHERE is_demo AND status = 'active'
     ORDER BY phone_number`
  );
  return rows.map((row) => ({ id: row.id, name: row.full_name, county: row.county, phone: row.phone_number }));
}
