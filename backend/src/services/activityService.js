import { query } from "../config/database.js";
import { ACTIVITY_TYPES } from "../lib/constants.js";
import { badRequest, notFound } from "../lib/errors.js";
import {
  optionalEnum,
  optionalNumber,
  optionalString,
  parsePagination,
  requireDateString,
  requireEnum,
  requireString,
  requireUuid
} from "../lib/validation.js";

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function serializeActivity(row) {
  return {
    id: row.id,
    farmId: row.farm_id,
    farmName: row.farm_name ?? undefined,
    clientId: row.client_id,
    activityType: row.activity_type,
    activityDate: toDateOnly(row.activity_date),
    description: row.description,
    inputUsed: row.input_used,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const SELECT_BASE = `
  SELECT a.*, f.farm_name
  FROM farm_activities a
  JOIN farms f ON f.id = a.farm_id`;

export async function listActivities(farmerId, params = {}) {
  const { page, pageSize, offset } = parsePagination(params);
  const conditions = ["a.farmer_id = $1", "a.deleted_at IS NULL"];
  const values = [farmerId];

  if (params.farmId !== undefined && params.farmId !== "") {
    requireUuid(params.farmId, "farmId", "farm");
    values.push(params.farmId);
    conditions.push(`a.farm_id = $${values.length}`);
  }
  const activityType = optionalEnum(params.type, ACTIVITY_TYPES, "type", "activity type");
  if (activityType) {
    values.push(activityType);
    conditions.push(`a.activity_type = $${values.length}`);
  }
  if (params.from !== undefined && params.from !== "") {
    values.push(requireDateString(params.from, "from", "start date"));
    conditions.push(`a.activity_date >= $${values.length}`);
  }
  if (params.to !== undefined && params.to !== "") {
    values.push(requireDateString(params.to, "to", "end date"));
    conditions.push(`a.activity_date <= $${values.length}`);
  }

  const where = conditions.join(" AND ");
  const countResult = await query(
    `SELECT count(*)::int AS total FROM farm_activities a WHERE ${where}`,
    values
  );
  const { rows } = await query(
    `${SELECT_BASE} WHERE ${where}
     ORDER BY a.activity_date DESC, a.created_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset]
  );

  return {
    items: rows.map(serializeActivity),
    pagination: { page, pageSize, total: countResult.rows[0].total }
  };
}

export async function getActivity(farmerId, activityId) {
  requireUuid(activityId, "activityId", "activity");
  const { rows } = await query(
    `${SELECT_BASE} WHERE a.id = $1 AND a.farmer_id = $2 AND a.deleted_at IS NULL`,
    [activityId, farmerId]
  );
  if (!rows[0]) throw notFound("Activity not found.");
  return serializeActivity(rows[0]);
}

async function assertFarmOwned(farmerId, farmId) {
  const { rows } = await query("SELECT 1 FROM farms WHERE id = $1 AND farmer_id = $2", [
    farmId,
    farmerId
  ]);
  if (!rows[0]) throw notFound("Farm not found.");
}

function activityFields(body, { partial = false } = {}) {
  const fields = {};

  if (!partial || body.farmId !== undefined) {
    fields.farm_id = requireUuid(body.farmId, "farmId", "farm");
  }
  if (!partial || body.activityType !== undefined) {
    fields.activity_type = requireEnum(body.activityType, ACTIVITY_TYPES, "activityType", "activity type");
  }
  if (!partial || body.activityDate !== undefined) {
    fields.activity_date = requireDateString(body.activityDate, "activityDate", "activity date");
  }
  // Optional: a farmer can save a record with taps only. The app shows a
  // summary built from the activity type, amount and unit instead.
  if (!partial || body.description !== undefined) {
    fields.description = optionalString(body.description, "description", {
      max: 1000,
      label: "Activity description"
    });
  }
  if (!partial || body.inputUsed !== undefined) {
    fields.input_used = optionalString(body.inputUsed, "inputUsed", {
      max: 120,
      label: "Input or material"
    });
  }
  if (!partial || body.quantity !== undefined) {
    fields.quantity = optionalNumber(body.quantity, "quantity", { label: "Quantity" });
  }
  if (!partial || body.unit !== undefined) {
    fields.unit = optionalString(body.unit, "unit", { max: 20 });
  }
  if (!partial || body.notes !== undefined) {
    fields.notes = optionalString(body.notes, "notes", { max: 1000 });
  }
  return fields;
}

export async function createActivity(farmerId, body = {}) {
  const clientId = requireString(body.clientId, "clientId", { min: 8, max: 100, label: "Client record ID" });
  const fields = activityFields(body);
  await assertFarmOwned(farmerId, fields.farm_id);

  const { rows } = await query(
    `INSERT INTO farm_activities
      (farmer_id, farm_id, client_id, activity_type, activity_date, description,
       input_used, quantity, unit, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (farmer_id, client_id) DO NOTHING
     RETURNING *`,
    [
      farmerId,
      fields.farm_id,
      clientId,
      fields.activity_type,
      fields.activity_date,
      fields.description,
      fields.input_used,
      fields.quantity,
      fields.unit,
      fields.notes
    ]
  );

  if (rows[0]) {
    const farm = await query("SELECT farm_name FROM farms WHERE id = $1", [fields.farm_id]);
    return { activity: serializeActivity({ ...rows[0], farm_name: farm.rows[0]?.farm_name }), created: true };
  }

  const existing = await query(
    `${SELECT_BASE} WHERE a.farmer_id = $1 AND a.client_id = $2`,
    [farmerId, clientId]
  );
  if (!existing.rows[0]) throw badRequest("This record could not be saved. Please try again.");
  // A replay of a record that was later deleted must not bring it back.
  return {
    activity: serializeActivity(existing.rows[0]),
    created: false,
    deleted: Boolean(existing.rows[0].deleted_at)
  };
}

export async function updateActivity(farmerId, activityId, body = {}) {
  requireUuid(activityId, "activityId", "activity");
  const fields = activityFields(body, { partial: true });
  const entries = Object.entries(fields);
  if (entries.length === 0) throw badRequest("Provide at least one field to update.");
  if (fields.farm_id) await assertFarmOwned(farmerId, fields.farm_id);

  const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
  const values = entries.map(([, value]) => value);
  values.push(activityId, farmerId);

  const { rows } = await query(
    `UPDATE farm_activities
     SET ${assignments.join(", ")}, updated_at = now()
     WHERE id = $${values.length - 1} AND farmer_id = $${values.length} AND deleted_at IS NULL
     RETURNING id`,
    values
  );
  if (!rows[0]) throw notFound("Activity not found.");
  return getActivity(farmerId, activityId);
}

export async function deleteActivity(farmerId, activityId) {
  requireUuid(activityId, "activityId", "activity");
  const { rows } = await query(
    `UPDATE farm_activities SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND farmer_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [activityId, farmerId]
  );
  if (!rows[0]) throw notFound("Activity not found.");
  return { message: "Activity deleted." };
}
