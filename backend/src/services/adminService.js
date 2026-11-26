import crypto from "node:crypto";
import { query, withTransaction } from "../config/database.js";
import { COUNTIES } from "../lib/constants.js";
import { decryptSecret, encryptSecret, encryptionAvailable } from "../lib/crypto.js";
import { ApiError, badRequest, conflict, notFound } from "../lib/errors.js";
import { maskPhone, normalizePhone } from "../lib/phone.js";
import { hashPin, hashSecret } from "../lib/pin.js";
import { isSecurityQuestionKey, normalizeSecurityAnswer } from "../lib/recovery.js";
import { hashAccessCode, normalizeAccessCode } from "../lib/tokens.js";
import { writeAudit } from "../lib/audit.js";
import {
  parsePagination,
  requireEnum,
  requirePin,
  requireReason,
  requireString,
  requireUuid
} from "../lib/validation.js";
import { requireAdminPin, serializeAdmin, verifyCurrentPin } from "./authService.js";

const SELECT_FARMER = `
  SELECT f.*,
    (SELECT count(*)::int FROM farms x WHERE x.farmer_id = f.id) AS farm_count,
    (SELECT count(*)::int FROM farm_activities a
      WHERE a.farmer_id = f.id AND a.deleted_at IS NULL) AS activity_count
  FROM farmers f`;

// Phone numbers are never returned in clear by the admin API. A farmer's own
// session is the only place the full number should appear.
function serializeFarmerSummary(row, { detail = false } = {}) {
  const summary = {
    id: row.id,
    fullName: row.full_name,
    phoneNumber: maskPhone(row.phone_number),
    hasPhone: Boolean(row.phone_number),
    county: row.county,
    status: row.status,
    hasSecurityQuestion: Boolean(row.security_question),
    farmCount: row.farm_count === undefined ? undefined : Number(row.farm_count),
    activityCount: row.activity_count === undefined ? undefined : Number(row.activity_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (detail) {
    summary.district = row.district;
    summary.community = row.community;
  }
  return summary;
}

function safeAction(value, field = "action") {
  const text = requireString(value, field, { min: 3, max: 60 });
  if (!/^[a-z][a-z0-9_.]*$/.test(text)) {
    throw badRequest("Use a lowercase audit action name.", { field });
  }
  return text;
}

export async function getDashboard() {
  const { rows } = await query(
    `WITH demo AS (SELECT id FROM farmers WHERE is_demo)
     SELECT
      (SELECT count(*)::int FROM farmers WHERE NOT is_demo) AS total_farmers,
      (SELECT count(*)::int FROM farmers WHERE NOT is_demo AND status = 'active') AS active_farmers,
      (SELECT count(*)::int FROM farmers WHERE NOT is_demo AND created_at >= date_trunc('month', now())) AS farmers_this_month,
      (SELECT count(*)::int FROM farms WHERE farmer_id NOT IN (SELECT id FROM demo)) AS total_farms,
      (SELECT count(*)::int FROM farm_activities WHERE deleted_at IS NULL AND farmer_id NOT IN (SELECT id FROM demo)) AS total_activities,
      (SELECT count(*)::int FROM farm_activities
        WHERE deleted_at IS NULL AND created_at >= now() - interval '7 days'
          AND farmer_id NOT IN (SELECT id FROM demo)) AS activities_this_week,
      (SELECT count(*)::int FROM harvests WHERE deleted_at IS NULL AND farmer_id NOT IN (SELECT id FROM demo)) AS total_harvests,
      (SELECT count(*)::int FROM sales WHERE deleted_at IS NULL AND farmer_id NOT IN (SELECT id FROM demo)) AS total_sales,
      (SELECT count(*)::int FROM cooperatives WHERE status = 'active') AS total_cooperatives`
  );
  const metrics = rows[0];

  return {
    metrics: {
      totalFarmers: metrics.total_farmers,
      activeFarmers: metrics.active_farmers,
      farmersThisMonth: metrics.farmers_this_month,
      totalFarms: metrics.total_farms,
      totalActivities: metrics.total_activities,
      activitiesThisWeek: metrics.activities_this_week,
      totalHarvests: metrics.total_harvests,
      totalSales: metrics.total_sales,
      totalCooperatives: metrics.total_cooperatives
    }
  };
}

export async function listFarmers(adminAuth, req, params = {}) {
  const { page, pageSize, offset } = parsePagination(params);
  const conditions = [];
  const values = [];
  let searched = false;

  if (params.search !== undefined && params.search !== "") {
    const search = requireString(params.search, "search", { max: 80 });
    searched = true;
    values.push(`%${search}%`);
    conditions.push(`(f.full_name ILIKE $${values.length} OR f.phone_number ILIKE $${values.length})`);
  }
  const county = params.county ? requireEnum(params.county, COUNTIES, "county", "county") : null;
  if (county) {
    values.push(county);
    conditions.push(`f.county = $${values.length}`);
  }
  const status = params.status ? requireEnum(params.status, ["active", "inactive"], "status", "status") : null;
  if (status) {
    values.push(status);
    conditions.push(`f.status = $${values.length}`);
  }

  // Demo farmers (IVR simulator) are not real farmers.
  conditions.push("NOT f.is_demo");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countResult = await query(`SELECT count(*)::int AS total FROM farmers f ${where}`, values);
  const { rows } = await query(
    `${SELECT_FARMER} ${where}
     ORDER BY f.created_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset]
  );

  // The search text itself is not stored: it can contain a phone number.
  await writeAudit({
    adminUserId: adminAuth.userId,
    action: "farmer.list_viewed",
    targetType: "farmer",
    metadata: {
      searched,
      county: county || null,
      status: status || null,
      page,
      pageSize,
      resultCount: countResult.rows[0].total
    },
    req
  });

  return {
    items: rows.map((row) => serializeFarmerSummary(row)),
    pagination: { page, pageSize, total: countResult.rows[0].total }
  };
}

async function loadFarmerDetail(farmerId) {
  const farmerResult = await query(`${SELECT_FARMER} WHERE f.id = $1`, [farmerId]);
  if (!farmerResult.rows[0]) throw notFound("Farmer not found.");

  // Farm cards carry counts only. Farm descriptions, sizes, notes and daily
  // activities stay with the farmer and their chosen farm managers.
  const farmsResult = await query(
    `SELECT f.id, f.farm_name, f.farm_type, f.created_at,
      (SELECT count(*)::int FROM farm_activities a
        WHERE a.farm_id = f.id AND a.deleted_at IS NULL) AS activity_count
     FROM farms f WHERE f.farmer_id = $1 ORDER BY f.created_at DESC`,
    [farmerId]
  );
  const activityResult = await query(
    `SELECT a.activity_type, count(*)::int AS count
     FROM farm_activities a
     WHERE a.farmer_id = $1 AND a.deleted_at IS NULL
     GROUP BY a.activity_type
     ORDER BY count DESC, a.activity_type`,
    [farmerId]
  );

  return {
    farmer: serializeFarmerSummary(farmerResult.rows[0], { detail: true }),
    farms: farmsResult.rows.map((row) => ({
      id: row.id,
      farmName: row.farm_name,
      farmType: row.farm_type,
      activityCount: row.activity_count,
      createdAt: row.created_at
    })),
    activity: {
      total: activityResult.rows.reduce((sum, row) => sum + row.count, 0),
      byType: activityResult.rows.map((row) => ({ type: row.activity_type, count: row.count }))
    }
  };
}

export async function getFarmerDetail(adminAuth, req, farmerId, reason) {
  requireUuid(farmerId, "farmerId", "farmer");
  const why = requireReason(reason);

  const detail = await loadFarmerDetail(farmerId);
  await writeAudit({
    adminUserId: adminAuth.userId,
    action: "farmer.detail_viewed",
    targetType: "farmer",
    targetId: farmerId,
    metadata: { reason: why },
    reason: why,
    req
  });
  return detail;
}

export async function updateFarmer(adminAuth, req, farmerId, body = {}) {
  requireUuid(farmerId, "farmerId", "farmer");
  const fields = {};
  if (body.fullName !== undefined) {
    fields.full_name = requireString(body.fullName, "fullName", {
      min: 2,
      max: 120,
      label: "Full name"
    });
  }
  if (body.county !== undefined) fields.county = requireEnum(body.county, COUNTIES, "county", "county");
  if (body.district !== undefined) {
    fields.district = requireString(body.district, "district", { max: 120, label: "District" });
  }
  if (body.community !== undefined) {
    fields.community = requireString(body.community, "community", { max: 120, label: "Community" });
  }

  const entries = Object.entries(fields);
  if (entries.length === 0) throw badRequest("Provide at least one field to update.");

  const result = await withTransaction(async (client) => {
    const before = await client.query(
      "SELECT full_name, county, district, community FROM farmers WHERE id = $1 FOR UPDATE",
      [farmerId]
    );
    if (!before.rows[0]) throw notFound("Farmer not found.");
    const previous = before.rows[0];

    const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
    const values = entries.map(([, value]) => value);
    values.push(farmerId);
    const { rows } = await client.query(
      `UPDATE farmers SET ${assignments.join(", ")}, updated_at = now()
       WHERE id = $${values.length}
       RETURNING id`,
      values
    );
    if (!rows[0]) throw notFound("Farmer not found.");

    const changes = {};
    for (const [column, next] of entries) {
      const from = previous[column];
      if (from !== next) changes[column] = { from, to: next };
    }
    await writeAudit({
      client,
      adminUserId: adminAuth.userId,
      action: "farmer.updated",
      targetType: "farmer",
      targetId: farmerId,
      metadata: { changes },
      req
    });
    return rows[0];
  });

  return loadFarmerDetail(result.id);
}

export async function setFarmerStatus(adminAuth, req, farmerId, status) {
  requireUuid(farmerId, "farmerId", "farmer");
  requireEnum(status, ["active", "inactive"], "status", "status");

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE farmers SET status = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, full_name, phone_number, county, district, community, status, created_at, updated_at`,
      [status, farmerId]
    );
    if (!rows[0]) throw notFound("Farmer not found.");

    if (status === "inactive") {
      await client.query(
        "UPDATE sessions SET revoked_at = now() WHERE farmer_id = $1 AND revoked_at IS NULL",
        [farmerId]
      );
    }
    await writeAudit({
      client,
      adminUserId: adminAuth.userId,
      action: status === "inactive" ? "farmer.deactivated" : "farmer.reactivated",
      targetType: "farmer",
      targetId: farmerId,
      req
    });
    return rows[0];
  });

  return serializeFarmerSummary(result);
}

// Full phone numbers are only released after a PIN check and a written reason.
export async function revealFarmerPhone(adminAuth, req, farmerId, body = {}) {
  requireUuid(farmerId, "farmerId", "farmer");
  const why = requireReason(body.reason);
  const currentPin = requirePin(body.currentPin, "currentPin", "Current PIN");
  await verifyCurrentPin("admin", adminAuth.userId, currentPin);

  const { rows } = await query("SELECT phone_number FROM farmers WHERE id = $1", [farmerId]);
  if (!rows[0]) throw notFound("Farmer not found.");
  if (!rows[0].phone_number) throw notFound("This farmer has no phone number on file.");

  await writeAudit({
    adminUserId: adminAuth.userId,
    action: "farmer.phone_revealed",
    targetType: "farmer",
    targetId: farmerId,
    metadata: { phone: maskPhone(rows[0].phone_number) },
    reason: why,
    req
  });

  return { phoneNumber: rows[0].phone_number, reason: why };
}

export async function listAuditLog(adminAuth, req, params = {}) {
  const { page, pageSize, offset } = parsePagination(params);
  const conditions = [];
  const values = [];
  const action = params.action ? safeAction(params.action) : null;
  if (action) {
    values.push(action);
    conditions.push(`a.action = $${values.length}`);
  }
  const targetType = params.targetType
    ? safeAction(params.targetType, "targetType").replace(/\./g, "_")
    : null;
  if (targetType) {
    values.push(targetType);
    conditions.push(`a.target_type = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Recorded first, so the viewer's own use shows up in this same page.
  await writeAudit({
    adminUserId: adminAuth.userId,
    action: "audit.viewed",
    targetType: "audit_log",
    metadata: { action, targetType, page },
    req
  });

  const countResult = await query(`SELECT count(*)::int AS total FROM audit_logs a ${where}`, values);
  const { rows } = await query(
    `SELECT a.id, a.action, a.target_type, a.target_id, a.metadata, a.reason,
            a.ip_address, a.user_agent, a.created_at, au.display_name AS admin_name
     FROM audit_logs a
     JOIN admin_users au ON au.id = a.admin_user_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, offset]
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      reason: row.reason,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: row.metadata,
      adminName: row.admin_name,
      createdAt: row.created_at
    })),
    pagination: { page, pageSize, total: countResult.rows[0].total }
  };
}

// Rotates admin credentials. Every change requires the current PIN and is audited.
export async function rotateAdminCredentials(adminAuth, req, body = {}) {
  const currentPin = requirePin(body.currentPin, "currentPin", "Current PIN");

  const updates = {};
  if (body.newPin !== undefined) {
    const newPin = requireAdminPin(requirePin(body.newPin, "newPin", "New PIN"));
    if (body.confirmPin !== undefined && body.confirmPin !== newPin) {
      throw badRequest("The new PIN and confirmation do not match.", { field: "confirmPin" });
    }
    if (newPin === currentPin) {
      throw badRequest("Choose a different PIN from your current one.", { field: "newPin" });
    }
    updates.pin_hash = await hashPin(newPin);
  }
  if (body.newAccessCode !== undefined) {
    const normalized = normalizeAccessCode(body.newAccessCode);
    if (!normalized) {
      throw badRequest("Access codes must be 6 to 40 letters, numbers or dashes.", {
        field: "newAccessCode"
      });
    }
    updates.access_code_hash = hashAccessCode(normalized);
    updates.access_code_ciphertext = encryptSecret(normalized);
  }
  if (body.securityQuestion !== undefined) {
    if (!isSecurityQuestionKey(body.securityQuestion)) {
      throw badRequest("Choose one of the recovery questions.", { field: "securityQuestion" });
    }
    const answer = normalizeSecurityAnswer(body.securityAnswer);
    if (!answer) {
      throw badRequest("Enter an answer for your recovery question.", { field: "securityAnswer" });
    }
    updates.security_question = body.securityQuestion;
    updates.security_answer_hash = await hashSecret(answer);
  } else if (body.securityAnswer !== undefined && body.securityAnswer !== "") {
    throw badRequest("Choose a recovery question for your answer.", {
      field: "securityQuestion"
    });
  }
  if (body.phoneNumber !== undefined) {
    if (body.phoneNumber === "" || body.phoneNumber === null) {
      updates.phone_number = null;
    } else {
      const phone = normalizePhone(body.phoneNumber);
      if (!phone) {
        throw badRequest("Enter a valid Liberian phone number, for example 077 000 0000.", {
          field: "phoneNumber"
        });
      }
      updates.phone_number = phone;
    }
  }

  const entries = Object.entries(updates);
  if (entries.length === 0) throw badRequest("Choose at least one credential to update.");

  // Checked before the transaction so a wrong PIN is still counted toward the
  // lock (a rolled-back transaction would forget it).
  await verifyCurrentPin("admin", adminAuth.userId, currentPin);

  try {
    return await withTransaction(async (client) => {
      const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
      const values = entries.map(([, value]) => value);
      values.push(adminAuth.userId);
      const updated = await client.query(
        `UPDATE admin_users SET ${assignments.join(", ")}, updated_at = now()
         WHERE id = $${values.length}
         RETURNING id, display_name, phone_number, status, security_question,
           access_code_ciphertext, created_at`,
        values
      );

      if (updates.pin_hash) {
        await client.query(
          `UPDATE sessions SET revoked_at = now()
           WHERE admin_user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
          [adminAuth.userId, adminAuth.sessionId]
        );
      }
      await writeAudit({
        client,
        adminUserId: adminAuth.userId,
        action: "admin.credentials_updated",
        targetType: "admin_user",
        targetId: adminAuth.userId,
        metadata: {
          changed: [
            ...new Set(
              entries.map(([column]) => {
                if (column === "pin_hash") return "pin";
                if (column === "access_code_hash" || column === "access_code_ciphertext") {
                  return "accessCode";
                }
                if (column.startsWith("security_")) return "securityQuestion";
                return "phoneNumber";
              })
            )
          ]
        },
        req
      });
      return serializeAdmin(updated.rows[0]);
    });
  } catch (error) {
    if (error?.code === "23505") {
      throw conflict("That access code or phone number is already in use.");
    }
    throw error;
  }
}

export async function revealAdminAccessCode(adminAuth, req, body = {}) {
  const currentPin = requirePin(body.currentPin, "currentPin", "Current PIN");
  await verifyCurrentPin("admin", adminAuth.userId, currentPin);
  const { rows } = await query(
    "SELECT access_code_ciphertext FROM admin_users WHERE id = $1",
    [adminAuth.userId]
  );
  if (!rows[0]) throw notFound("Admin not found.");
  if (!encryptionAvailable()) {
    throw new ApiError(
      503,
      "REVEAL_NOT_CONFIGURED",
      "Secure access-code reveal is not configured on this server. Replace your access code to continue in hash-only mode."
    );
  }
  const accessCode = decryptSecret(rows[0].access_code_ciphertext);
  if (!accessCode) {
    throw new ApiError(
      409,
      "ACCESS_CODE_NOT_REVEALABLE",
      "This access code was issued before secure reveal was enabled. Replace it in Settings to turn on reveal."
    );
  }

  await writeAudit({
    adminUserId: adminAuth.userId,
    action: "admin.access_code_revealed",
    targetType: "admin_user",
    targetId: adminAuth.userId,
    req
  });

  return { accessCode };
}

export async function resetFarmerPin(adminAuth, req, farmerId, body = {}) {
  requireUuid(farmerId, "farmerId", "farmer");
  const currentPin = requirePin(body.currentPin, "currentPin", "Current PIN");
  const tempPin = String(crypto.randomInt(100000, 1000000));
  const pinHash = await hashPin(tempPin);
  await verifyCurrentPin("admin", adminAuth.userId, currentPin);

  await withTransaction(async (client) => {
    // A helper reset also unlocks the farmer if they were waiting after wrong PINs.
    const updated = await client.query(
      `UPDATE farmers
       SET pin_hash = $1, updated_at = now(),
           failed_login_count = 0, locked_until = NULL,
           recovery_failed_count = 0, recovery_locked_until = NULL
       WHERE id = $2 RETURNING id`,
      [pinHash, farmerId]
    );
    if (!updated.rows[0]) throw notFound("Farmer not found.");

    await client.query(
      "UPDATE sessions SET revoked_at = now() WHERE farmer_id = $1 AND revoked_at IS NULL",
      [farmerId]
    );
    await client.query(
      "UPDATE recovery_otps SET used_at = now() WHERE farmer_id = $1 AND used_at IS NULL",
      [farmerId]
    );
    await writeAudit({
      client,
      adminUserId: adminAuth.userId,
      action: "farmer.pin_reset",
      targetType: "farmer",
      targetId: farmerId,
      req
    });
  });

  return {
    tempPin,
    message: "Temporary PIN created. Give it to the farmer and ask them to change it after signing in."
  };
}
