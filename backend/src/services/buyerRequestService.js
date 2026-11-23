import { query } from "../config/database.js";
import { badRequest, notFound } from "../lib/errors.js";
import { formatPhone, normalizePhone } from "../lib/phone.js";
import { sendSms, smsAvailable } from "../lib/sms.js";
import { firstNameOnly } from "../lib/text.js";
import { requireUuid } from "../lib/validation.js";
import { addNotification } from "./notificationService.js";

// "Contact this farmer" on the Harvest Passport.
//
// A buyer leaves their name and number; the farmer is told in the app (and by
// SMS if they allow it) and chooses what to do. The farmer's own number is
// never given out unless the farmer taps "Share my number".

const REPEAT_HOURS = 24;
const MAX_NEW_PER_BATCH_PER_DAY = 20;

function text(value, field, label, { min = 0, max }) {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (min === 0) return null;
    throw badRequest(`${label} is needed.`, { field });
  }
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (clean.length < min) throw badRequest(`${label} is too short.`, { field });
  if (clean.length > max) throw badRequest(`${label} is too long (${max} letters at most).`, { field });
  return clean;
}

// Liberian numbers become +231…; buyers from abroad may give +<country><number>.
export function normalizeBuyerPhone(value) {
  const liberian = normalizePhone(typeof value === "string" ? value : "");
  if (liberian) return liberian;
  const compact = typeof value === "string" ? value.replace(/[\s().-]/g, "") : "";
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

function serialize(row) {
  return {
    id: row.id,
    status: row.status,
    crop: row.crop,
    passportCode: row.passport_code,
    harvestClientId: row.harvest_client_id || null,
    harvestDate: row.harvest_date || null,
    unit: row.unit || null,
    buyer: {
      name: row.buyer_name,
      phone: row.buyer_phone,
      phoneDisplay: formatPhone(row.buyer_phone),
      organization: row.buyer_org
    },
    quantityWanted: row.quantity_wanted === null ? null : Number(row.quantity_wanted),
    message: row.message,
    createdAt: row.created_at,
    respondedAt: row.responded_at
  };
}

function textFarmer(phone, message) {
  if (!smsAvailable() || !phone) return;
  sendSms(phone, message).catch((error) => console.error("Buyer request SMS failed:", error.message));
}

// Public: a buyer on the passport page.
export async function createBuyerRequest(code, body = {}) {
  const passportCode = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!/^LR-[A-Z0-9]{10}$/.test(passportCode)) throw badRequest("This passport code is not valid.");
  // Bots fill every box; people never see this one.
  if (body.website) return { request: { status: "new" }, message: "Sent." };

  const name = text(body.name, "name", "Your name", { min: 2, max: 80 });
  const phone = normalizeBuyerPhone(body.phone);
  if (!phone) {
    throw badRequest("Enter a phone number the farmer can call, e.g. 0770 123 456 or +233 24 123 4567.", {
      field: "phone"
    });
  }
  const organization = text(body.organization, "organization", "Company or market", { max: 80 });
  const message = text(body.message, "message", "Message", { max: 300 });
  let quantityWanted = null;
  if (body.quantityWanted !== undefined && body.quantityWanted !== null && body.quantityWanted !== "") {
    quantityWanted = Number(body.quantityWanted);
    if (!Number.isFinite(quantityWanted) || quantityWanted <= 0 || quantityWanted > 1e9) {
      throw badRequest("Quantity must be a number above 0.", { field: "quantityWanted" });
    }
  }

  const { rows } = await query(
    `SELECT h.id, h.farmer_id, h.crop, h.unit, h.harvest_date, fr.phone_number, fr.notify_sms
     FROM harvests h JOIN farmers fr ON fr.id = h.farmer_id
     WHERE h.passport_code = $1 AND h.passport_public = true AND h.deleted_at IS NULL AND fr.status = 'active'`,
    [passportCode]
  );
  const harvest = rows[0];
  if (!harvest) throw notFound("This Harvest Passport is not available.");

  // The same buyer asking again soon updates their request instead of adding one.
  const repeat = await query(
    `SELECT id FROM buyer_requests
     WHERE harvest_id = $1 AND buyer_phone = $2 AND created_at > now() - make_interval(hours => $3)
     ORDER BY created_at DESC LIMIT 1`,
    [harvest.id, phone, REPEAT_HOURS]
  );
  if (repeat.rows[0]) {
    await query(
      `UPDATE buyer_requests SET buyer_name = $2, buyer_org = $3, message = COALESCE($4, message),
         quantity_wanted = COALESCE($5, quantity_wanted), updated_at = now()
       WHERE id = $1`,
      [repeat.rows[0].id, name, organization, message, quantityWanted]
    );
    return {
      request: { status: "new" },
      message: "Your request is already with the farmer. They will call you if they are interested."
    };
  }

  const busy = await query(
    `SELECT count(*)::int AS n FROM buyer_requests WHERE harvest_id = $1 AND created_at > now() - interval '1 day'`,
    [harvest.id]
  );
  if (busy.rows[0].n >= MAX_NEW_PER_BATCH_PER_DAY) {
    throw badRequest("This farmer has many requests today. Please try again tomorrow.");
  }

  const inserted = await query(
    `INSERT INTO buyer_requests
       (farmer_id, harvest_id, passport_code, crop, buyer_name, buyer_phone, buyer_org, quantity_wanted, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [harvest.farmer_id, harvest.id, passportCode, harvest.crop, name, phone, organization, quantityWanted, message]
  );
  const who = organization ? `${name} (${organization})` : name;
  await addNotification(harvest.farmer_id, {
    kind: "system",
    topic: "buyer_request",
    key: `buyer_request:${inserted.rows[0].id}`,
    title: `A buyer wants your ${harvest.crop}`,
    body: `${who} scanned your Harvest Passport${quantityWanted ? ` and wants ${quantityWanted} ${harvest.unit}` : ""}. Open it to call them back or share your number.`,
    link: "/app/requests"
  });
  if (harvest.notify_sms) {
    textFarmer(
      harvest.phone_number,
      `FarmBok: ${name} wants to buy your ${harvest.crop}. Open FarmBok, Buyer requests, to answer.`
    );
  }
  return {
    request: { id: inserted.rows[0].id, status: "new" },
    message: "Sent. The farmer will see your request and call you if they are interested."
  };
}

// The farmer's side.
export async function listBuyerRequests(farmerId) {
  const { rows } = await query(
    `SELECT r.*, h.client_id AS harvest_client_id, h.harvest_date, h.unit
     FROM buyer_requests r JOIN harvests h ON h.id = r.harvest_id
     WHERE r.farmer_id = $1
     ORDER BY (r.status = 'new') DESC, r.created_at DESC
     LIMIT 100`,
    [farmerId]
  );
  return {
    requests: rows.map(serialize),
    newCount: rows.filter((row) => row.status === "new").length,
    smsAvailable: smsAvailable()
  };
}

async function ownRequest(farmerId, id) {
  requireUuid(id, "id", "request");
  const { rows } = await query(
    `SELECT r.*, fr.phone_number AS farmer_phone, fr.full_name AS farmer_name
     FROM buyer_requests r JOIN farmers fr ON fr.id = r.farmer_id
     WHERE r.id = $1 AND r.farmer_id = $2`,
    [id, farmerId]
  );
  if (!rows[0]) throw notFound("This buyer request was not found.");
  return rows[0];
}

export async function shareNumber(farmerId, id) {
  const request = await ownRequest(farmerId, id);
  await query(
    "UPDATE buyer_requests SET status = 'shared', responded_at = now(), updated_at = now() WHERE id = $1",
    [request.id]
  );
  let smsSent = false;
  if (smsAvailable()) {
    try {
      await sendSms(
        request.buyer_phone,
        `FarmBok: ${firstNameOnly(request.farmer_name)}, the farmer for ${request.crop} (${request.passport_code}), answered you. Call or text: ${formatPhone(request.farmer_phone)}`
      );
      smsSent = true;
    } catch (error) {
      console.error("Share-number SMS failed:", error.message);
    }
  }
  return {
    status: "shared",
    smsSent,
    message: smsSent
      ? "Your number was sent to the buyer by SMS."
      : "SMS is not working now. Call the buyer to give them your number."
  };
}

export async function declineRequest(farmerId, id) {
  const request = await ownRequest(farmerId, id);
  await query(
    "UPDATE buyer_requests SET status = 'declined', responded_at = now(), updated_at = now() WHERE id = $1",
    [request.id]
  );
  return { status: "declined" };
}

// When the farmer calls the buyer from the app, the request counts as answered.
export async function markCalled(farmerId, id) {
  const request = await ownRequest(farmerId, id);
  if (request.status === "new") {
    await query(
      "UPDATE buyer_requests SET status = 'shared', responded_at = now(), updated_at = now() WHERE id = $1",
      [request.id]
    );
  }
  return { status: request.status === "new" ? "shared" : request.status };
}
