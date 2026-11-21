import crypto from "node:crypto";
import { query, withTransaction } from "../config/database.js";
import {
  AGE_GROUPS,
  ANIMAL_ADD_EVENTS,
  ANIMAL_EVENT_TYPES,
  BUYER_TYPES,
  CROP_METHODS,
  CURRENCIES,
  DEATH_CAUSES,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PRODUCTION_KINDS,
  PRODUCTION_SOURCES,
  QUALITY_CHECKS,
  QUALITY_GRADES,
  SIZE_UNITS
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
import { ANIMAL_PRODUCTS, farmYields } from "./farmService.js";

// One engine for every farmer-owned record that is made on the phone first:
// harvest batches, quality checks, buyers, sales, payments and expenses.
//
// Each resource is described below (fields, parent links, list filters) and
// gets the same behaviour:
//   * create is idempotent on client_id, so offline retries never duplicate;
//   * parents are referenced by their client_id (harvestClientId, …), so a
//     chain made offline syncs without remapping temporary ids;
//   * every read and write is scoped to the signed-in farmer;
//   * delete is soft, so a delete made offline cannot be undone by a retry;
//   * every write runs in one transaction. Rules that depend on other rows
//     (not selling more than a harvest holds, not being paid more than a
//     sale is worth) lock the parent row first, so two phones syncing at the
//     same moment cannot both squeeze past the check.

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

const cents = (value) => Math.round(Number(value || 0) * 100);
const fromCents = (value) => value / 100;
const sameText = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

function formatAmount(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

async function soldFromHarvest(db, harvestId, { exceptSaleId = null, unit = null } = {}) {
  const { rows } = await db.query(
    `SELECT COALESCE(sum(quantity), 0) AS sold FROM sales
     WHERE harvest_id = $1 AND deleted_at IS NULL
       AND ($2::uuid IS NULL OR id <> $2) AND ($3::text IS NULL OR unit = $3)`,
    [harvestId, exceptSaleId, unit]
  );
  return Number(rows[0].sold);
}

async function paidOnSale(db, saleId, { exceptPaymentId = null } = {}) {
  const { rows } = await db.query(
    `SELECT COALESCE(sum(amount), 0) AS paid FROM payments
     WHERE sale_id = $1 AND deleted_at IS NULL AND ($2::uuid IS NULL OR id <> $2)`,
    [saleId, exceptPaymentId]
  );
  return Number(rows[0].paid);
}

const conflict409 = (code, message, details) => new ApiError(409, code, message, details);

// ---------- crop plantings and animal groups ----------

const CROP_FARM_TYPES = new Set(["crop_farming"]);
const ANIMAL_ONLY_FARM_TYPES = new Set(["livestock", "poultry"]);

// What a farm's type allows. A crop farm keeps crops, an animal farm keeps
// animals, a mixed (or "other") farm keeps both. Changing the farm to mixed
// opens the other kind; old records are never touched.
function farmAllowsKind(farmType, kind) {
  if (kind === "animal") return !CROP_FARM_TYPES.has(farmType);
  return !ANIMAL_ONLY_FARM_TYPES.has(farmType);
}

async function animalCount(db, productionId, { exceptEventId = null } = {}) {
  const { rows } = await db.query(
    `SELECT p.start_count,
       COALESCE(sum(e.quantity) FILTER (WHERE e.event_type = ANY($2)), 0) AS added,
       COALESCE(sum(e.quantity) FILTER (WHERE NOT (e.event_type = ANY($2))), 0) AS removed
     FROM productions p
     LEFT JOIN animal_events e ON e.production_id = p.id AND e.deleted_at IS NULL
       AND ($3::uuid IS NULL OR e.id <> $3)
     WHERE p.id = $1
     GROUP BY p.start_count`,
    [productionId, ANIMAL_ADD_EVENTS, exceptEventId]
  );
  const row = rows[0] || { start_count: 0, added: 0, removed: 0 };
  return Number(row.start_count || 0) + Number(row.added) - Number(row.removed);
}

// The planting or group a record names, locked for the length of the write.
async function productionFor(db, farmerId, productionId) {
  if (!productionId) return null;
  const { rows } = await db.query(
    "SELECT * FROM productions WHERE id = $1 AND farmer_id = $2 AND deleted_at IS NULL FOR UPDATE",
    [productionId, farmerId]
  );
  if (!rows[0]) {
    throw new ApiError(409, "PARENT_NOT_SYNCED", "The planting or animal group for this record is not saved yet.", {
      field: "productionClientId"
    });
  }
  return rows[0];
}

const productionRef = {
  table: "productions",
  idColumn: "production_id",
  clientColumn: "production_client_id",
  softDelete: true,
  label: "planting or animal group"
};

const text = (column, options = {}) => ({ kind: "string", column, ...options });
const choice = (column, values, options = {}) => ({ kind: "enum", column, values, ...options });
const number = (column, options = {}) => ({ kind: "number", column, ...options });
const integer = (column, options = {}) => ({ kind: "int", column, ...options });
const date = (column, options = {}) => ({ kind: "date", column, ...options });
const flag = (column, options = {}) => ({ kind: "bool", column, ...options });

export const RESOURCES = {
  // A crop planting or an animal group on a farm (the guide's production
  // record). Everything else can point at one.
  productions: {
    table: "productions",
    label: "planting or animal group",
    dateColumn: "start_date",
    fields: {
      // Not "kind": the phone already uses that word for the record type.
      productionKind: choice("kind", PRODUCTION_KINDS, { required: true, label: "crop or animals" }),
      name: text("name", { required: true, max: 80, label: "Crop or animal" }),
      variety: text("variety", { max: 80, label: "Variety or breed" }),
      label: text("label", { max: 80, label: "Name" }),
      plot: text("plot", { max: 80, label: "Plot" }),
      area: number("area", { max: 100000, label: "Size" }),
      areaUnit: choice("area_unit", SIZE_UNITS, { label: "size unit" }),
      startDate: date("start_date", { required: true, label: "start date" }),
      source: choice("source", PRODUCTION_SOURCES, { label: "where it came from" }),
      method: choice("method", CROP_METHODS, { label: "how it was planted" }),
      startCount: integer("start_count", { max: 1000000, label: "Number of animals" }),
      ageGroup: choice("age_group", AGE_GROUPS, { label: "age" }),
      status: choice("status", ["active", "finished"], { defaultValue: "active", label: "status" }),
      endDate: date("end_date", { label: "end date" }),
      notes: text("notes", { max: 1000, label: "Notes" })
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

    async guard(db, { values, refs, existing }) {
      const farmId = refs.farm_id ?? existing?.farm_id;
      const kind = values.kind ?? existing?.kind;
      const name = values.name ?? existing?.name;
      if (existing && "kind" in values && values.kind !== existing.kind) {
        throw badRequest("A crop planting can't become an animal group. Start a new one.", { field: "productionKind" });
      }
      const { rows } = await db.query("SELECT farm_type, farm_name, crops FROM farms WHERE id = $1 FOR UPDATE", [farmId]);
      const farm = rows[0];
      if (!existing || "farm_id" in refs) {
        if (!farmAllowsKind(farm.farm_type, kind)) {
          throw badRequest(
            kind === "animal"
              ? `"${farm.farm_name}" is a crop farm. Change it to a mixed farm to keep animals there.`
              : `"${farm.farm_name}" is an animal farm. Change it to a mixed farm to plant crops there.`,
            { field: "productionKind", reason: "FARM_TYPE" }
          );
        }
      }
      // Keep the farm's list of what it grows in step, so harvests work.
      if (name && !(farm.crops || []).some((item) => sameText(item, name))) {
        await db.query("UPDATE farms SET crops = array_append(crops, $2), updated_at = now() WHERE id = $1", [
          farmId,
          name.trim()
        ]);
      }
      if (kind === "animal") {
        if (!existing && (values.start_count === null || values.start_count === undefined)) values.start_count = 0;
        if (existing && "start_count" in values) {
          const others = (await animalCount(db, existing.id)) - Number(existing.start_count || 0);
          if (Number(values.start_count || 0) + others < 0) {
            throw conflict409("NOT_ENOUGH_ANIMALS", "Some of these animals were already sold, eaten or lost. The start number can't be that small.", {
              field: "startCount"
            });
          }
        }
      } else {
        values.start_count = null;
      }
    },

    // A planting or group with harvests, sales or count changes can't be
    // deleted (mark it finished instead). Work and costs just lose the link.
    async beforeDelete(db, row) {
      const { rows } = await db.query(
        `SELECT
           (SELECT count(*)::int FROM harvests WHERE production_id = $1 AND deleted_at IS NULL)
         + (SELECT count(*)::int FROM sales WHERE production_id = $1 AND deleted_at IS NULL)
         + (SELECT count(*)::int FROM animal_events WHERE production_id = $1 AND deleted_at IS NULL) AS linked`,
        [row.id]
      );
      if (rows[0].linked > 0) {
        throw conflict409(
          "PRODUCTION_HAS_RECORDS",
          "This has harvests, sales or animal records. Mark it finished instead, so nothing is lost.",
          { linked: rows[0].linked }
        );
      }
      for (const table of ["farm_activities", "expenses"]) {
        await db.query(
          `UPDATE ${table} SET production_id = NULL, production_client_id = NULL, updated_at = now() WHERE production_id = $1`,
          [row.id]
        );
      }
      await db.query(
        `UPDATE farm_activities SET source_production_id = NULL, source_production_client_id = NULL, updated_at = now()
         WHERE source_production_id = $1`,
        [row.id]
      );
    }
  },

  // A change to an animal group's count: born, bought, given in, died (with
  // the cause), sold, eaten, given out. A group can never go below zero.
  animalEvents: {
    table: "animal_events",
    label: "animal record",
    dateColumn: "event_date",
    fields: {
      eventType: choice("event_type", ANIMAL_EVENT_TYPES, { required: true, label: "what happened" }),
      quantity: integer("quantity", { required: true, min: 1, max: 1000000, label: "How many" }),
      eventDate: date("event_date", { required: true, label: "date" }),
      cause: choice("cause", DEATH_CAUSES, { label: "cause" }),
      notes: text("notes", { max: 1000, label: "Notes" })
    },
    refs: {
      productionClientId: { ...productionRef, required: true, label: "animal group" }
    },
    filters: ["productionClientId"],

    async guard(db, { farmerId, values, refs, existing }) {
      const productionId = refs.production_id ?? existing?.production_id;
      const production = await productionFor(db, farmerId, productionId);
      if (production.kind !== "animal") {
        throw badRequest("Births, buying and deaths are for animal groups.", { field: "productionClientId" });
      }
      const type = values.event_type ?? existing?.event_type;
      const quantity = values.quantity ?? existing?.quantity;
      if (type === "died") values.cause = values.cause ?? existing?.cause ?? "unknown";
      else if ("event_type" in values) values.cause = null;
      const count = await animalCount(db, production.id, { exceptEventId: existing?.id ?? null });
      const after = ANIMAL_ADD_EVENTS.includes(type) ? count + quantity : count - quantity;
      if (after < 0) {
        throw conflict409(
          "NOT_ENOUGH_ANIMALS",
          count > 0 ? `Only ${count} ${production.name} in this group.` : `No ${production.name} left in this group.`,
          { field: "quantity", count }
        );
      }
    },

    // Taking back a birth or a purchase can't leave fewer than zero.
    async beforeDelete(db, row) {
      if (!ANIMAL_ADD_EVENTS.includes(row.event_type)) return;
      await db.query("SELECT id FROM productions WHERE id = $1 FOR UPDATE", [row.production_id]);
      const count = await animalCount(db, row.production_id);
      if (count - row.quantity < 0) {
        throw conflict409(
          "NOT_ENOUGH_ANIMALS",
          "Some of these animals were already sold, eaten or lost, so this can't be taken off.",
          { count }
        );
      }
    }
  },

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
      },
      // The crop planting it came from, or the animal group that gave the
      // eggs or milk (optional).
      productionClientId: productionRef
    },
    filters: ["farmClientId", "productionClientId"],
    onInsert: () => ({ passport_code: newPassportCode() }),
    extra: (row) => ({ passportCode: row.passport_code }),

    // A harvest can only be of something the farm grows, and can't shrink
    // below (or change crop/unit after) what was already sold from it.
    async guard(db, { farmerId, values, refs, existing }) {
      const farmId = refs.farm_id ?? existing?.farm_id;
      const crop = values.crop ?? existing?.crop;
      const productionId = "production_id" in refs ? refs.production_id : existing?.production_id ?? null;
      if (productionId && ("production_id" in refs || "crop" in values || "farm_id" in refs)) {
        const production = await productionFor(db, farmerId, productionId);
        if (production.farm_id !== farmId) {
          throw badRequest("This planting or animal group is on another farm.", { field: "productionClientId" });
        }
        const fromCrop = production.kind === "crop" && sameText(production.name, crop);
        const fromAnimals =
          production.kind === "animal" && ANIMAL_PRODUCTS.some((item) => sameText(item, crop));
        if (!fromCrop && !fromAnimals) {
          throw badRequest(
            production.kind === "crop"
              ? `This planting is ${production.name}, so the harvest must be ${production.name}.`
              : `From ${production.name} you can put eggs or milk.`,
            { field: "crop" }
          );
        }
      }
      const cropChanged = !existing || ("crop" in values && !sameText(values.crop, existing.crop));
      const farmChanged = !existing || ("farm_id" in refs && refs.farm_id !== existing.farm_id);
      if (cropChanged || farmChanged) {
        const farm = await db.query("SELECT farm_name, farm_type, crops FROM farms WHERE id = $1", [farmId]);
        if (!farm.rows[0] || !farmYields(farm.rows[0], crop)) {
          throw badRequest(
            `${crop} is not on the farm "${farm.rows[0]?.farm_name || "farm"}". Add it to the farm first, then put the harvest.`,
            { field: "crop", reason: "CROP_NOT_ON_FARM" }
          );
        }
      }
      if (!existing) return;
      const sold = await soldFromHarvest(db, existing.id);
      if (sold <= 0) return;
      const unitChanged = "unit" in values && values.unit !== existing.unit;
      if (cropChanged || farmChanged || unitChanged) {
        throw conflict409(
          "HARVEST_HAS_SALES",
          "You already sold from this harvest, so the crop, the unit and the farm can't change.",
          { sold }
        );
      }
      if ("quantity" in values && cents(values.quantity) < cents(sold)) {
        throw conflict409(
          "BELOW_SOLD",
          `You already sold ${formatAmount(sold)} ${existing.unit} from this harvest. It can't be less than that.`,
          { field: "quantity", sold }
        );
      }
    },

    // A batch with sales can't be deleted (the sales would point at nothing).
    // Its quality checks go with it.
    async beforeDelete(db, row) {
      const sales = await db.query(
        "SELECT count(*)::int AS count FROM sales WHERE harvest_id = $1 AND deleted_at IS NULL",
        [row.id]
      );
      if (sales.rows[0].count > 0) {
        throw conflict409(
          "HARVEST_HAS_SALES",
          `You sold from this harvest ${sales.rows[0].count} time(s). Delete those sales first, then delete the harvest.`,
          { sales: sales.rows[0].count }
        );
      }
      await db.query(
        `UPDATE quality_inspections SET deleted_at = now(), updated_at = now()
         WHERE harvest_id = $1 AND deleted_at IS NULL`,
        [row.id]
      );
      // Costs for the batch stay (the money was really spent), on its farm.
      await db.query(
        `UPDATE expenses SET harvest_id = NULL, harvest_client_id = NULL, updated_at = now()
         WHERE harvest_id = $1 AND deleted_at IS NULL`,
        [row.id]
      );
    }
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
      // Taken from the harvest when the sale is from a harvest batch.
      crop: text("crop", { max: 80, label: "Crop" }),
      quantity: number("quantity", { required: true, min: 0.01, max: 999999999, label: "Quantity" }),
      unit: text("unit", { max: 20, label: "Unit" }),
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
      },
      // Selling animals from a group, or a crop or product from a planting or
      // group without a harvest batch. From a batch, it comes from the batch.
      productionClientId: productionRef
    },
    filters: ["harvestClientId", "buyerClientId", "productionClientId"],

    // From a harvest: crop and unit come from the batch, and the batch can't
    // be over-sold. Never less than what the buyer already paid.
    async guard(db, { farmerId, values, refs, existing }) {
      const harvestId = "harvest_id" in refs ? refs.harvest_id : existing?.harvest_id ?? null;
      const quantity = values.quantity ?? (existing ? Number(existing.quantity) : null);
      if (harvestId) {
        const { rows } = await db.query(
          "SELECT * FROM harvests WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
          [harvestId]
        );
        const harvest = rows[0];
        if (!harvest) {
          throw new ApiError(409, "PARENT_NOT_SYNCED", "The harvest for this sale is not saved yet.", {
            field: "harvestClientId"
          });
        }
        values.crop = harvest.crop;
        values.unit = harvest.unit;
        // The sale belongs to the batch's planting or group.
        refs.production_id = harvest.production_id;
        refs.production_client_id = harvest.production_client_id;
        const otherSold = await soldFromHarvest(db, harvestId, { exceptSaleId: existing?.id ?? null });
        const left = Math.max(fromCents(cents(harvest.quantity) - cents(otherSold)), 0);
        if (cents(quantity) > cents(left)) {
          throw conflict409(
            "OVERSOLD",
            left > 0
              ? `Only ${formatAmount(left)} ${harvest.unit} of ${harvest.crop} left in this harvest.`
              : `Nothing left in this harvest. All of it is sold.`,
            { field: "quantity", left }
          );
        }
      } else {
        const productionId = "production_id" in refs ? refs.production_id : existing?.production_id ?? null;
        if (productionId && "production_id" in refs) await productionFor(db, farmerId, productionId);
        const crop = values.crop ?? existing?.crop;
        const unit = values.unit ?? existing?.unit;
        if (!crop) throw badRequest("Say what you sold.", { field: "crop" });
        if (!unit) throw badRequest("Choose the unit, like bags or kilo.", { field: "unit" });
      }
    },

    // Checked after the total is worked out (see prepare).
    async afterPrepare(db, { values, existing }) {
      if (!existing) return;
      const paid = await paidOnSale(db, existing.id);
      if (paid <= 0) return;
      if ("currency" in values && values.currency !== existing.currency) {
        throw conflict409("SALE_HAS_PAYMENTS", "Money was already paid for this sale, so the money type can't change.", {
          field: "currency"
        });
      }
      const total = values.total_amount ?? Number(existing.total_amount);
      if (cents(total) < cents(paid)) {
        throw conflict409(
          "BELOW_PAID",
          `The buyer already paid ${formatAmount(paid)} ${existing.currency}. The sale can't be less than that.`,
          { field: "totalAmount", paid }
        );
      }
    },

    // Its payments go with it.
    async beforeDelete(db, row) {
      await db.query(
        "UPDATE payments SET deleted_at = now(), updated_at = now() WHERE sale_id = $1 AND deleted_at IS NULL",
        [row.id]
      );
    },

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
    filters: ["saleClientId"],

    // Never more than what is still owed on the sale.
    async guard(db, { values, refs, existing }) {
      const saleId = refs.sale_id ?? existing?.sale_id;
      const { rows } = await db.query("SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [saleId]);
      const sale = rows[0];
      if (!sale) {
        throw new ApiError(409, "PARENT_NOT_SYNCED", "The sale for this payment is not saved yet.", {
          field: "saleClientId"
        });
      }
      const others = await paidOnSale(db, sale.id, { exceptPaymentId: existing?.id ?? null });
      const owed = Math.max(fromCents(cents(sale.total_amount) - cents(others)), 0);
      const amount = values.amount ?? Number(existing.amount);
      if (cents(amount) > cents(owed)) {
        throw conflict409(
          "OVERPAID",
          owed > 0
            ? `The buyer only has ${formatAmount(owed)} ${sale.currency} left to pay on this sale.`
            : "This sale is already paid in full.",
          { field: "amount", owed }
        );
      }
    }
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
      },
      // Optional: the harvest batch this cost was for (migration 005), so a
      // batch can show its own profit.
      harvestClientId: {
        table: "harvests",
        idColumn: "harvest_id",
        clientColumn: "harvest_client_id",
        softDelete: true,
        label: "harvest"
      },
      // Or the planting or animal group it was for (seed for the cassava,
      // feed for the chickens).
      productionClientId: productionRef
    },
    filters: ["farmClientId", "harvestClientId", "productionClientId"],

    // A cost for a batch or a planting/group belongs to its farm, so batch,
    // planting and farm money always agree.
    async guard(db, { farmerId, refs, existing }) {
      const harvestId = "harvest_id" in refs ? refs.harvest_id : existing?.harvest_id ?? null;
      let farmFromParent = null;
      let productionId = "production_id" in refs ? refs.production_id : existing?.production_id ?? null;
      if (harvestId) {
        const { rows } = await db.query(
          `SELECT farm_id, farm_client_id, production_id, production_client_id FROM harvests
           WHERE id = $1 AND farmer_id = $2 AND deleted_at IS NULL`,
          [harvestId, farmerId]
        );
        if (!rows[0]) {
          throw new ApiError(409, "PARENT_NOT_SYNCED", "The harvest for this cost is not saved yet.", {
            field: "harvestClientId"
          });
        }
        farmFromParent = rows[0];
        if (rows[0].production_id && !productionId) {
          productionId = rows[0].production_id;
          refs.production_id = rows[0].production_id;
          refs.production_client_id = rows[0].production_client_id;
        }
      }
      if (productionId) {
        const production = await productionFor(db, farmerId, productionId);
        if (farmFromParent && farmFromParent.farm_id !== production.farm_id) {
          throw badRequest("This harvest is from another planting or group.", { field: "productionClientId" });
        }
        farmFromParent = farmFromParent || { farm_id: production.farm_id, farm_client_id: production.farm_client_id };
      }
      if (!farmFromParent) return;
      const farmId = "farm_id" in refs ? refs.farm_id : existing?.farm_id ?? null;
      if (farmId && farmId !== farmFromParent.farm_id) {
        throw badRequest("This harvest is from another farm. Choose the farm of the harvest.", {
          field: "farmClientId"
        });
      }
      refs.farm_id = farmFromParent.farm_id;
      refs.farm_client_id = farmFromParent.farm_client_id;
    }
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
    case "int": {
      if (empty && spec.required) throw badRequest(`${spec.label} is required.`, { field: apiName });
      if (empty) return spec.defaultValue ?? null;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < (spec.min ?? 0) || parsed > (spec.max ?? 1000000)) {
        throw badRequest(`${spec.label} must be a whole number.`, { field: apiName });
      }
      return parsed;
    }
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

async function resolveRefs(db, config, farmerId, body, { partial }) {
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
    const { rows } = await db.query(
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
    if (spec.kind === "number" || spec.kind === "int") out[apiName] = toNumber(value);
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

async function findOwned(db, config, farmerId, id, { lock = false } = {}) {
  requireUuid(id, "id", config.label);
  const { rows } = await db.query(
    `SELECT * FROM ${config.table} WHERE id = $1 AND farmer_id = $2 AND deleted_at IS NULL ${lock ? "FOR UPDATE" : ""}`,
    [id, farmerId]
  );
  if (!rows[0]) throw notFound(`This ${config.label} was not found.`);
  return rows[0];
}

export async function getRecord(name, farmerId, id) {
  const config = resource(name);
  return serializeRecord(name, await findOwned({ query }, config, farmerId, id));
}

async function existingByClientId(db, config, farmerId, clientId) {
  const { rows } = await db.query(`SELECT * FROM ${config.table} WHERE farmer_id = $1 AND client_id = $2`, [
    farmerId,
    clientId
  ]);
  return rows[0] || null;
}

function replay(name, row) {
  return { record: serializeRecord(name, row), created: false, deleted: Boolean(row.deleted_at) };
}

export async function createRecord(name, farmerId, body = {}) {
  const config = resource(name);
  const clientId = requireString(body.clientId, "clientId", { min: 8, max: 100, label: "Client record ID" });
  const values = collectFields(config, body, { partial: false });

  return withTransaction(async (db) => {
    // One record at a time per client id: if the phone's retry arrives while
    // the first send is still being saved, it waits and then sees it saved.
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${config.table}:${farmerId}:${clientId}`]);
    // A retry of something already saved returns it, before any rule is
    // checked again (it passed them the first time).
    const already = await existingByClientId(db, config, farmerId, clientId);
    if (already) return replay(name, already);

    const refs = await resolveRefs(db, config, farmerId, body, { partial: false });
    if (config.guard) await config.guard(db, { farmerId, values, refs, existing: null, body });
    if (config.prepare) await config.prepare(values, { existing: null, body });
    if (config.afterPrepare) await config.afterPrepare(db, { farmerId, values, refs, existing: null, body });

    const row = {
      farmer_id: farmerId,
      client_id: clientId,
      ...values,
      ...refs,
      ...(config.onInsert ? config.onInsert() : {})
    };
    const columns = Object.keys(row);
    const { rows } = await db.query(
      `INSERT INTO ${config.table} (${columns.join(", ")})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})
       ON CONFLICT (farmer_id, client_id) DO NOTHING
       RETURNING *`,
      columns.map((column) => row[column])
    );
    if (rows[0]) return { record: serializeRecord(name, rows[0]), created: true };

    // The same record arrived twice at the same moment; the other one won.
    const raced = await existingByClientId(db, config, farmerId, clientId);
    if (!raced) throw badRequest("This record could not be saved. Please try again.");
    return replay(name, raced);
  });
}

export async function updateRecord(name, farmerId, id, body = {}) {
  const config = resource(name);
  const values = collectFields(config, body, { partial: true });
  return withTransaction(async (db) => {
    const existing = await findOwned(db, config, farmerId, id, { lock: true });
    const refs = await resolveRefs(db, config, farmerId, body, { partial: true });
    if (config.guard) await config.guard(db, { farmerId, values, refs, existing, body });
    if (config.prepare) await config.prepare(values, { existing, body });
    if (config.afterPrepare) await config.afterPrepare(db, { farmerId, values, refs, existing, body });
    const changes = { ...values, ...refs };
    const columns = Object.keys(changes);
    if (columns.length === 0) throw badRequest("Provide at least one field to update.");
    const { rows } = await db.query(
      `UPDATE ${config.table}
       SET ${columns.map((column, index) => `${column} = $${index + 1}`).join(", ")}, updated_at = now()
       WHERE id = $${columns.length + 1} AND farmer_id = $${columns.length + 2} AND deleted_at IS NULL
       RETURNING *`,
      [...columns.map((column) => changes[column]), id, farmerId]
    );
    if (!rows[0]) throw notFound(`This ${config.label} was not found.`);
    return serializeRecord(name, rows[0]);
  });
}

export async function deleteRecord(name, farmerId, id) {
  const config = resource(name);
  requireUuid(id, "id", config.label);
  return withTransaction(async (db) => {
    const existing = await findOwned(db, config, farmerId, id, { lock: true });
    if (config.beforeDelete) await config.beforeDelete(db, existing);
    await db.query(
      `UPDATE ${config.table} SET deleted_at = now(), updated_at = now() WHERE id = $1 AND farmer_id = $2`,
      [id, farmerId]
    );
    return { message: "Deleted." };
  });
}
