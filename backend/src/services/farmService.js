import { query } from "../config/database.js";
import { COUNTIES, FARM_TYPES, SIZE_UNITS } from "../lib/constants.js";
import { badRequest, notFound } from "../lib/errors.js";
import {
  optionalEnum,
  optionalNumber,
  optionalString,
  requireEnum,
  requireString,
  requireUuid
} from "../lib/validation.js";

// What a farm grows or raises: a list such as ["Rice", "Cassava"]. Older
// phones send one text ("Rice, Cassava"), which is split the same way.
export function splitCrops(text) {
  return String(text || "")
    .split(/\s*(?:,|&|\/|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeCrops(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (typeof raw !== "string") throw badRequest("Each crop or animal must be a word.", { field: "crops" });
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) continue;
    if (name.length > 60) throw badRequest("A crop or animal name is too long.", { field: "crops" });
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name[0].toUpperCase() + name.slice(1));
  }
  if (out.length > 20) throw badRequest("Choose 20 crops or animals or fewer.", { field: "crops" });
  return out;
}

export function farmGrows(farm, crop) {
  const wanted = String(crop || "").trim().toLowerCase();
  return (farm.crops || []).some((item) => item.toLowerCase() === wanted);
}

// What animals give (eggs, milk, meat, weight gain, manure) can be recorded
// from any farm that keeps animals, as well as anything on the farm's own list.
export const ANIMAL_PRODUCTS = ["Eggs", "Milk", "Meat", "Weight gain", "Manure"];
const ANIMAL_FARM_TYPES = new Set(["livestock", "poultry", "mixed_farming", "other"]);

export function farmYields(farm, crop) {
  if (farmGrows(farm, crop)) return true;
  const wanted = String(crop || "").trim().toLowerCase();
  return ANIMAL_FARM_TYPES.has(farm.farm_type) && ANIMAL_PRODUCTS.some((item) => item.toLowerCase() === wanted);
}

export function serializeFarm(row) {
  return {
    id: row.id,
    clientId: row.client_id ?? null,
    farmerId: row.farmer_id,
    farmName: row.farm_name,
    county: row.county,
    district: row.district,
    community: row.community,
    farmType: row.farm_type,
    mainCropOrLivestock: row.main_crop_or_livestock,
    crops: Array.isArray(row.crops) ? row.crops : [],
    description: row.description,
    size: row.size === null || row.size === undefined ? null : Number(row.size),
    sizeUnit: row.size_unit ?? null,
    location:
      row.latitude === null || row.latitude === undefined
        ? null
        : {
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            accuracy: row.location_accuracy_m ?? null,
            savedAt: row.location_saved_at ?? null
          },
    showOnMap: Boolean(row.show_on_map),
    activityCount: row.activity_count === undefined ? undefined : Number(row.activity_count),
    // When the farm changed from crop to animal or mixed (records are kept).
    typeChanges: Array.isArray(row.type_changes)
      ? row.type_changes.map((item) => ({ fromType: item.from_type, toType: item.to_type, changedAt: item.changed_at }))
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const SELECT_FARM = `
  SELECT f.*,
    (SELECT count(*) FROM farm_activities a
      WHERE a.farm_id = f.id AND a.deleted_at IS NULL) AS activity_count,
    (SELECT COALESCE(json_agg(json_build_object('from_type', c.from_type, 'to_type', c.to_type, 'changed_at', c.changed_at)
        ORDER BY c.changed_at), '[]'::json)
      FROM farm_type_changes c WHERE c.farm_id = f.id) AS type_changes
  FROM farms f`;

export async function listFarms(farmerId) {
  const { rows } = await query(
    `${SELECT_FARM} WHERE f.farmer_id = $1 ORDER BY f.created_at DESC`,
    [farmerId]
  );
  return rows.map(serializeFarm);
}

export async function getFarm(farmerId, farmId) {
  requireUuid(farmId, "farmId", "farm");
  const { rows } = await query(`${SELECT_FARM} WHERE f.id = $1 AND f.farmer_id = $2`, [
    farmId,
    farmerId
  ]);
  if (!rows[0]) throw notFound("Farm not found.");
  return serializeFarm(rows[0]);
}

function farmFields(body, { partial = false } = {}) {
  const fields = {};

  if (!partial || body.farmName !== undefined) {
    fields.farm_name = requireString(body.farmName, "farmName", {
      max: 120,
      label: "Farm name"
    });
  }
  if (!partial || body.county !== undefined) {
    fields.county = requireEnum(body.county, COUNTIES, "county", "county");
  }
  if (!partial || body.district !== undefined) {
    fields.district = requireString(body.district, "district", { max: 120, label: "District" });
  }
  if (!partial || body.community !== undefined) {
    fields.community = requireString(body.community, "community", {
      max: 120,
      label: "Community"
    });
  }
  if (!partial || body.farmType !== undefined) {
    fields.farm_type = requireEnum(body.farmType, FARM_TYPES, "farmType", "farm type");
  }
  // Crops: the list wins; the old single text is still accepted.
  if (body.crops !== undefined && body.crops !== null) {
    if (!Array.isArray(body.crops)) throw badRequest("Crops must be a list.", { field: "crops" });
    fields.crops = normalizeCrops(body.crops);
    fields.main_crop_or_livestock = fields.crops.join(", ").slice(0, 120) || null;
  } else if (!partial || body.mainCropOrLivestock !== undefined) {
    fields.main_crop_or_livestock = optionalString(body.mainCropOrLivestock, "mainCropOrLivestock", {
      max: 120,
      label: "Main crop or livestock"
    });
    fields.crops = normalizeCrops(splitCrops(fields.main_crop_or_livestock));
  }
  if (!partial || body.description !== undefined) {
    fields.description = optionalString(body.description, "description", { max: 1000 });
  }
  // Farm size is optional. A size needs a unit, and a unit needs a size.
  if (!partial || body.size !== undefined) {
    fields.size = optionalNumber(body.size, "size", { min: 0, max: 100000, label: "Farm size" });
  }
  if (!partial || body.sizeUnit !== undefined) {
    fields.size_unit = optionalEnum(body.sizeUnit, SIZE_UNITS, "sizeUnit", "size unit");
  }
  if (fields.size !== undefined && fields.size !== null && !fields.size_unit && !partial) {
    throw badRequest("Choose acres, hectares or lots for the farm size.", { field: "sizeUnit" });
  }
  if (fields.size === null && fields.size_unit) fields.size_unit = null;
  // GPS point, saved on the farm. null clears it.
  if (body.location !== undefined) {
    if (body.location === null) {
      Object.assign(fields, { latitude: null, longitude: null, location_accuracy_m: null, location_saved_at: null });
    } else {
      const { latitude, longitude, accuracy, savedAt } = body.location || {};
      const lat = Number(latitude);
      const lon = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        throw badRequest("The farm location is not valid.", { field: "location" });
      }
      // Liberia and a little around it; a point far away is a phone mistake.
      if (lat < 3.5 || lat > 9.5 || lon < -12.5 || lon > -6.5) {
        throw badRequest("This location is not in Liberia. Save it while you are on the farm.", { field: "location" });
      }
      const acc = Number(accuracy);
      const when = savedAt ? new Date(savedAt) : new Date();
      Object.assign(fields, {
        latitude: Math.round(lat * 1e6) / 1e6,
        longitude: Math.round(lon * 1e6) / 1e6,
        location_accuracy_m: Number.isFinite(acc) && acc >= 0 ? Math.min(Math.round(acc), 100000) : null,
        location_saved_at: Number.isNaN(when.getTime()) ? new Date() : when
      });
    }
  }
  if (body.showOnMap !== undefined) {
    if (typeof body.showOnMap !== "boolean") throw badRequest("Choose on or off.", { field: "showOnMap" });
    fields.show_on_map = body.showOnMap;
  }
  return fields;
}

export async function createFarm(farmerId, body = {}) {
  const fields = farmFields(body);
  const clientId = body.clientId
    ? requireString(body.clientId, "clientId", {
        min: 8,
        max: 100,
        label: "Client record ID"
      })
    : null;

  const { rows } = await query(
    `INSERT INTO farms
      (farmer_id, client_id, farm_name, county, district, community, farm_type,
       main_crop_or_livestock, description, size, size_unit, crops,
       latitude, longitude, location_accuracy_m, location_saved_at, show_on_map)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (farmer_id, client_id) DO NOTHING
     RETURNING *`,
    [
      farmerId,
      clientId,
      fields.farm_name,
      fields.county,
      fields.district,
      fields.community,
      fields.farm_type,
      fields.main_crop_or_livestock,
      fields.description,
      fields.size,
      fields.size_unit,
      fields.crops,
      fields.latitude ?? null,
      fields.longitude ?? null,
      fields.location_accuracy_m ?? null,
      fields.location_saved_at ?? null,
      fields.show_on_map ?? false
    ]
  );
  if (rows[0]) {
    return { farm: serializeFarm({ ...rows[0], activity_count: 0 }), created: true };
  }

  const existing = await query(`${SELECT_FARM} WHERE f.farmer_id = $1 AND f.client_id = $2`, [
    farmerId,
    clientId
  ]);
  if (existing.rows[0]) {
    return { farm: serializeFarm(existing.rows[0]), created: false };
  }
  throw badRequest("This farm could not be saved. Please try again.");
}

export async function updateFarm(farmerId, farmId, body = {}) {
  requireUuid(farmId, "farmId", "farm");
  const fields = farmFields(body, { partial: true });
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    throw badRequest("Provide at least one field to update.");
  }
  const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
  const values = entries.map(([, value]) => value);
  values.push(farmId, farmerId);

  const before = await query("SELECT farm_type FROM farms WHERE id = $1 AND farmer_id = $2", [farmId, farmerId]);
  const { rows } = await query(
    `UPDATE farms SET ${assignments.join(", ")}, updated_at = now()
     WHERE id = $${values.length - 1} AND farmer_id = $${values.length}
     RETURNING *`,
    values
  );
  if (!rows[0]) throw notFound("Farm not found.");
  // The guide: a farm can change type without losing anything. Old records
  // stay as they are; the change itself is written down.
  if (fields.farm_type && before.rows[0] && before.rows[0].farm_type !== fields.farm_type) {
    await query("INSERT INTO farm_type_changes (farm_id, farmer_id, from_type, to_type) VALUES ($1, $2, $3, $4)", [
      farmId,
      farmerId,
      before.rows[0].farm_type,
      fields.farm_type
    ]);
  }
  return getFarm(farmerId, farmId);
}
