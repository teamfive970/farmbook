import crypto from "node:crypto";
import { query } from "../config/database.js";
import {
  BUYER_TYPES,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  QUALITY_CHECKS,
  QUALITY_GRADES
} from "../lib/constants.js";
import { ApiError, badRequest, notFound } from "../lib/errors.js";
import { normalizePhone } from "../lib/phone.js";
import {
  optionalNumber,
  optionalString,
  parsePagination,
  requireDateString,
  requireEnum,
  requireString,
  requireUuid
} from "../lib/validation.js";

// One engine for every farmer-owned record that is made on the phone first:
// harvest batches, quality checks, buyers, sales, payments and expenses.
//
// Each resource is described below (fields, parent links, list filters) and
// gets the same behaviour:
//   * create is idempotent on client_id, so offline retries never duplicate;
//   * parents are referenced by their client_id (harvestClientId, …), so a
//     chain made offline syncs without remapping temporary ids;
//   * every read and write is scoped to the signed-in farmer;
//   * delete is soft, so a delete made offline cannot be undone by a retry.

function randomCode(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

// Unguessable public code for a harvest batch's QR passport (32^10 values).
export function newPassportCode() {
  return `LR-${randomCode(10)}`;
}

const text = (column, options = {}) => ({ kind: "string", column, ...options });
const choice = (column, values, options = {}) => ({ kind: "enum", column, values, ...options });
const number = (column, options = {}) => ({ kind: "number", column, ...options });
const date = (column, options = {}) => ({ kind: "date", column, ...options });
const flag = (column, options = {}) => ({ kind: "bool", column, ...options });

export const RESOURCES = {
  harvests: {
    table: "harvests",
    label: "harvest",
    dateColumn: "harvest_date",
    fields: {
      crop: text("crop", { required: true, max: 80, label: "Crop" }),
      harvestDate: date("harvest_date", { required: true, label: "harvest date" }),
      quantity: number("quantity", { required: true, max: 999999999, label: "Quantity" }),
      unit: text("unit", { required: true, max: 20, label: "Unit" }),
      storage: text("storage", { max: 120, label: "Storage place" }),
      notes: text("notes", { max: 1000, label: "Notes" }),
      passportPublic: flag("passport_public", { defaultValue: false })
    },
    refs: {
      farmClientId: {
        table: "farms",
        idColumn: "farm_id",
        clientColumn: "farm_client_id",
        required: true,
        softDelete: false,
        label: "farm"
      }
    },
    filters: ["farmClientId"],
    onInsert: () => ({ passport_code: newPassportCode() }),
    extra: (row) => ({ passportCode: row.passport_code })
  },

  inspections: {
    table: "quality_inspections",
    label: "quality check",
    dateColumn: "inspection_date",
    fields: {
      inspectionDate: date("inspection_date", { required: true, label: "check date" }),
      grade: choice("grade", QUALITY_GRADES, { required: true, label: "grade" }),
      checks: { kind: "checks", column: "checks", keys: QUALITY_CHECKS },
      moisturePercent: number("moisture_percent", { max: 100, label: "Moisture" }),
      inspector: text("inspector", { max: 120, label: "Checked by" }),
      notes: text("notes", { max: 1000, label: "Notes" })
    },
    refs: {
      harvestClientId: {
        table: "harvests",
        idColumn: "harvest_id",
        clientColumn: "harvest_client_id",
        required: true,
        softDelete: true,
        label: "harvest"
      }
    },
    filters: ["harvestClientId"]
  },

  buyers: {
    table: "buyers",
    label: "buyer",
    dateColumn: "created_at",
    fields: {
      name: text("name", { required: true, max: 120, label: "Buyer name" }),
      phoneNumber: { kind: "phone", column: "phone_number" },
      buyerType: choice("buyer_type", BUYER_TYPES, { defaultValue: "other", label: "buyer type" }),
      notes: text("notes", { max: 1000, label: "Notes" })
    },
    refs: {},
    filters: []
  },

  sales: {
    table: "sales",
    label: "sale",
    dateColumn: "sale_date",
    fields: {
      saleDate: date("sale_date", { required: true, label: "sale date" }),
      crop: text("crop", { required: true, max: 80, label: "Crop" }),
      quantity: number("quantity", { required: true, max: 999999999, label: "Quantity" }),
      unit: text("unit", { required: true, max: 20, label: "Unit" }),
      unitPrice: number("unit_price", { max: 999999999, label: "Price" }),
      totalAmount: number("total_amount", { max: 999999999999, label: "Total" }),
      currency: choice("currency", CURRENCIES, { required: true, label: "money type" }),
      notes: text("notes", { max: 1000, label: "Notes" })
    },
    refs: {
      harvestClientId: {
        table: "harvests",
        idColumn: "harvest_id",
        clientColumn: "harvest_client_id",
        softDelete: true,
        label: "harvest"
      },
      buyerClientId: {
        table: "buyers",
        idColumn: "buyer_id",
        clientColumn: "buyer_client_id",
        softDelete: true,
        label: "buyer"
      }
    },
    filters: ["harvestClientId", "buyerClientId"],
    // Total = quantity × price unless the farmer gave a total (a lump price).
    prepare(values, { existing }) {
      const quantity = values.quantity ?? (existing ? Number(existing.quantity) : null);
      const price = "unit_price" in values ? values.unit_price : existing?.unit_price ?? null;
      const totalGiven = "total_amount" in values && values.total_amount !== null;
      if (!totalGiven) {
        const priceChanged = "unit_price" in values || "quantity" in values;
        if (price !== null && price !== undefined && quantity !== null && (priceChanged || !existing)) {
          values.total_amount = Math.round(Number(price) * Number(quantity) * 100) / 100;
        } else if (!existing) {
          throw badRequest("Give the price for each one, or the total money.", { field: "totalAmount" });
        } else if ("total_amount" in values) {
          delete values.total_amount;
        }
      }
    }
  },

  payments: {
    table: "payments",
    label: "payment",
    dateColumn: "paid_date",
    fields: {
      amount: number("amount", { required: true, min: 0.01, max: 999999999999, label: "Amount" }),
      paidDate: date("paid_date", { required: true, label: "payment date" }),
      method: choice("method", PAYMENT_METHODS, { defaultValue: "cash", label: "payment method" }),
      notes: text("notes", { max: 1000, label: "Notes" })
    },
    refs: {
      saleClientId: {
        table: "sales",
        idColumn: "sale_id",
        clientColumn: "sale_client_id",
        required: true,
        softDelete: true,
        label: "sale"
      }
    },
    filters: ["saleClientId"]
  },

  expenses: {
    table: "expenses",
    label: "expense",
    dateColumn: "expense_date",
    fields: {
      expenseDate: date("expense_date", { required: true, label: "date" }),
      category: choice("category", EXPENSE_CATEGORIES, { required: true, label: "what you spent on" }),
      amount: number("amount", { required: true, min: 0.01, max: 999999999999, label: "Amount" }),
      currency: choice("currency", CURRENCIES, { required: true, label: "money type" }),
      notes: text("notes", { max: 1000, label: "Notes" })
    },
    refs: {
      farmClientId: {
        table: "farms",
        idColumn: "farm_id",
        clientColumn: "farm_client_id",
        softDelete: false,
        label: "farm"
      }
    },
    filters: ["farmClientId"]
  }
};

function resource(name) {
  const config = RESOURCES[name];
  if (!config) throw notFound();
  return config;
}

function parseField(spec, value, apiName) {
  const empty = value === undefined || value === null || value === "";
  switch (spec.kind) {
    case "string":
      return spec.required
        ? requireString(value, apiName, { max: spec.max, label: spec.label })
        : optionalString(value, apiName, { max: spec.max, label: spec.label });
    case "enum":
      if (empty && !spec.required) return spec.defaultValue ?? null;
      return requireEnum(value, spec.values, apiName, spec.label);
    case "number":
      if (empty && spec.required) {
        throw badRequest(`${spec.label} is required.`, { field: apiName });
      }
      return optionalNumber(value, apiName, {
        min: spec.min ?? 0,
        max: spec.max ?? 999999999,
        label: spec.label
      });
    case "date":
      if (empty && !spec.required) return null;
      return requireDateString(value, apiName, spec.label);
    case "bool":
      if (empty) return spec.defaultValue ?? false;
      if (typeof value !== "boolean") throw badRequest("Choose yes or no.", { field: apiName });
      return value;
    case "checks": {
      if (empty) return {};
      if (typeof value !== "object" || Array.isArray(value)) {
        throw badRequest("Quality checks are not valid.", { field: apiName });
      }
      const checks = {};
      for (const key of spec.keys) {
        if (value[key] !== undefined) checks[key] = Boolean(value[key]);
      }
      return checks;
    }
    case "phone": {
      if (empty) return null;
      const phone = normalizePhone(value);
      if (!phone) {
        throw badRequest("Enter a valid Liberian phone number, for example 077 000 0000.", {
          field: apiName
        });
      }
      return phone;
    }
    default:
      throw new Error(`Unknown field kind ${spec.kind}`);
  }
}

function collectFields(config, body, { partial }) {
  const values = {};
  for (const [apiName, spec] of Object.entries(config.fields)) {
    if (partial && body[apiName] === undefined) continue;
    const parsed = parseField(spec, body[apiName], apiName);
    values[spec.column] = spec.kind === "checks" ? JSON.stringify(parsed) : parsed;
  }
  return values;
}

async function resolveRefs(config, farmerId, body, { partial }) {
  const values = {};
  for (const [param, ref] of Object.entries(config.refs)) {
    const raw = body[param];
    const empty = raw === undefined || raw === null || raw === "";
    if (partial && raw === undefined) continue;
    if (empty) {
      if (ref.required) throw badRequest(`Choose the ${ref.label}.`, { field: param });
      values[ref.idColumn] = null;
      values[ref.clientColumn] = null;
      continue;
    }
    const clientId = requireString(raw, param, { max: 100, label: ref.label });
    const { rows } = await query(
      `SELECT id FROM ${ref.table}
       WHERE farmer_id = $1 AND client_id = $2 ${ref.softDelete ? "AND deleted_at IS NULL" : ""}`,
      [farmerId, clientId]
    );
    if (!rows[0]) {
      // The phone sends parents first; if one is missing it has not synced
      // yet (or was deleted). The phone will try again later.
      throw new ApiError(409, "PARENT_NOT_SYNCED", `The ${ref.label} for this record is not saved yet.`, {
        field: param
      });
    }
    values[ref.idColumn] = rows[0].id;
    values[ref.clientColumn] = clientId;
  }
  return values;
}

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

export function serializeRecord(name, row) {
  const config = resource(name);
  const out = { id: row.id, clientId: row.client_id };
  for (const [apiName, spec] of Object.entries(config.fields)) {
    const value = row[spec.column];
    if (spec.kind === "number") out[apiName] = toNumber(value);
    else if (spec.kind === "date") out[apiName] = value ? String(value).slice(0, 10) : null;
    else if (spec.kind === "checks") out[apiName] = value || {};
    else out[apiName] = value ?? null;
  }
  for (const [param, ref] of Object.entries(config.refs)) out[param] = row[ref.clientColumn] ?? null;
  Object.assign(out, config.extra ? config.extra(row) : {});
  out.createdAt = row.created_at;
  out.updatedAt = row.updated_at;
  return out;
}

export async function listRecords(name, farmerId, params = {}) {
  const config = resource(name);
  const { page, pageSize, offset } = parsePagination(params, { defaultPageSize: 50, maxPageSize: 100 });
  const conditions = ["farmer_id = $1", "deleted_at IS NULL"];
  const values = [farmerId];
  for (const param of config.filters) {
    if (params[param] === undefined || params[param] === "") continue;
    values.push(requireString(params[param], param, { max: 100 }));
    conditions.push(`${config.refs[param].clientColumn} = $${values.length}`);
  }
  if (config.dateColumn !== "created_at") {
    if (params.from) {
      values.push(requireDateString(params.from, "from", "start date"));
      conditions.push(`${config.dateColumn} >= $${values.length}`);
    }
    if (params.to) {
      values.push(requireDateString(params.to, "to", "end date"));
      conditions.push(`${config.dateColumn} <= $${values.length}`);
    }
  }
  const where = conditions.join(" AND ");
  const count = await query(`SELECT count(*)::int AS total FROM ${config.table} WHERE ${where}`, values);
  const { rows } = await query(
    `SELECT * FROM ${config.table} WHERE ${where}
     ORDER BY ${config.dateColumn} DESC, created_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset]
  );
  return {
    items: rows.map((row) => serializeRecord(name, row)),
    pagination: { page, pageSize, total: count.rows[0].total }
  };
}

async function findOwned(config, farmerId, id) {
  requireUuid(id, "id", config.label);
  const { rows } = await query(
    `SELECT * FROM ${config.table} WHERE id = $1 AND farmer_id = $2 AND deleted_at IS NULL`,
    [id, farmerId]
  );
  if (!rows[0]) throw notFound(`This ${config.label} was not found.`);
  return rows[0];
}

export async function getRecord(name, farmerId, id) {
  const config = resource(name);
  return serializeRecord(name, await findOwned(config, farmerId, id));
}

export async function createRecord(name, farmerId, body = {}) {
  const config = resource(name);
  const clientId = requireString(body.clientId, "clientId", { min: 8, max: 100, label: "Client record ID" });
  const values = collectFields(config, body, { partial: false });
  if (config.prepare) await config.prepare(values, { existing: null, body });
  const refs = await resolveRefs(config, farmerId, body, { partial: false });
  const row = {
    farmer_id: farmerId,
    client_id: clientId,
    ...values,
    ...refs,
    ...(config.onInsert ? config.onInsert() : {})
  };
  const columns = Object.keys(row);
  const { rows } = await query(
    `INSERT INTO ${config.table} (${columns.join(", ")})
     VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})
     ON CONFLICT (farmer_id, client_id) DO NOTHING
     RETURNING *`,
    columns.map((column) => row[column])
  );
  if (rows[0]) return { record: serializeRecord(name, rows[0]), created: true };

  // Already saved by an earlier attempt from the phone.
  const existing = await query(`SELECT * FROM ${config.table} WHERE farmer_id = $1 AND client_id = $2`, [
    farmerId,
    clientId
  ]);
  if (!existing.rows[0]) throw badRequest("This record could not be saved. Please try again.");
  return {
    record: serializeRecord(name, existing.rows[0]),
    created: false,
    deleted: Boolean(existing.rows[0].deleted_at)
  };
}

export async function updateRecord(name, farmerId, id, body = {}) {
  const config = resource(name);
  const existing = await findOwned(config, farmerId, id);
  const values = collectFields(config, body, { partial: true });
  if (config.prepare) await config.prepare(values, { existing, body });
  const refs = await resolveRefs(config, farmerId, body, { partial: true });
  const changes = { ...values, ...refs };
  const columns = Object.keys(changes);
  if (columns.length === 0) throw badRequest("Provide at least one field to update.");
  const { rows } = await query(
    `UPDATE ${config.table}
     SET ${columns.map((column, index) => `${column} = $${index + 1}`).join(", ")}, updated_at = now()
     WHERE id = $${columns.length + 1} AND farmer_id = $${columns.length + 2} AND deleted_at IS NULL
     RETURNING *`,
    [...columns.map((column) => changes[column]), id, farmerId]
  );
  if (!rows[0]) throw notFound(`This ${config.label} was not found.`);
  return serializeRecord(name, rows[0]);
}

export async function deleteRecord(name, farmerId, id) {
  const config = resource(name);
  requireUuid(id, "id", config.label);
  const { rows } = await query(
    `UPDATE ${config.table} SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND farmer_id = $2 AND deleted_at IS NULL RETURNING id`,
    [id, farmerId]
  );
  if (!rows[0]) throw notFound(`This ${config.label} was not found.`);
  return { message: "Deleted." };
}

