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
    description: row.description,
    size: row.size === null || row.size === undefined ? null : Number(row.size),
    sizeUnit: row.size_unit ?? null,
    activityCount: row.activity_count === undefined ? undefined : Number(row.activity_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const SELECT_FARM = `
  SELECT f.*,
    (SELECT count(*) FROM farm_activities a
      WHERE a.farm_id = f.id AND a.deleted_at IS NULL) AS activity_count
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
  if (!partial || body.mainCropOrLivestock !== undefined) {
    fields.main_crop_or_livestock = optionalString(body.mainCropOrLivestock, "mainCropOrLivestock", {
      max: 120,
      label: "Main crop or livestock"
    });
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
       main_crop_or_livestock, description, size, size_unit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      fields.size_unit
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

  const { rows } = await query(
    `UPDATE farms SET ${assignments.join(", ")}, updated_at = now()
     WHERE id = $${values.length - 1} AND farmer_id = $${values.length}
     RETURNING *`,
    values
  );
  if (!rows[0]) throw notFound("Farm not found.");
  return getFarm(farmerId, farmId);
}
