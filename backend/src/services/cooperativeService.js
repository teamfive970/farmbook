import crypto from "node:crypto";
import { query, withTransaction } from "../config/database.js";
import { COUNTIES } from "../lib/constants.js";
import { ApiError, badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { normalizePhone } from "../lib/phone.js";
import { writeAudit } from "../lib/audit.js";
import {
  optionalString,
  requireEnum,
  requireString,
  requireUuid
} from "../lib/validation.js";
import { moneyAndHarvestTotals } from "./reportService.js";
import { addNotification } from "./notificationService.js";

// Cooperatives (farmer groups). Admins create groups and manage members; a
// farmer can also join with the group's join code. A member marked "leader"
// sees each member's totals only after that member agreed to share them.
// Members' detailed records (individual sales, notes) are never shared, and
// admins only ever see the group total, never a member's own figures.

function joinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return `GRP-${code}`;
}

function serializeCooperative(row) {
  return {
    id: row.id,
    name: row.name,
    county: row.county,
    district: row.district,
    community: row.community,
    description: row.description,
    joinCode: row.join_code,
    status: row.status,
    memberCount: row.member_count === undefined ? undefined : Number(row.member_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function coopFields(body, { partial }) {
  const fields = {};
  if (!partial || body.name !== undefined) {
    fields.name = requireString(body.name, "name", { min: 2, max: 120, label: "Group name" });
  }
  if (!partial || body.county !== undefined) fields.county = requireEnum(body.county, COUNTIES, "county", "county");
  if (!partial || body.district !== undefined) {
    fields.district = optionalString(body.district, "district", { max: 120, label: "District" });
  }
  if (!partial || body.community !== undefined) {
    fields.community = optionalString(body.community, "community", { max: 120, label: "Community" });
  }
  if (!partial || body.description !== undefined) {
    fields.description = optionalString(body.description, "description", { max: 1000 });
  }
  if (partial && body.status !== undefined) {
    fields.status = requireEnum(body.status, ["active", "inactive"], "status", "status");
  }
  return fields;
}

const SELECT_COOP = `
  SELECT c.*,
    (SELECT count(*) FROM cooperative_members m
      WHERE m.cooperative_id = c.id AND m.status = 'active') AS member_count
  FROM cooperatives c`;

// ---------- Admin ----------

export async function adminListCooperatives(adminAuth, req) {
  const { rows } = await query(`${SELECT_COOP} ORDER BY c.name`);
  await writeAudit({
    adminUserId: adminAuth.userId,
    action: "cooperative.list_viewed",
    targetType: "cooperative",
    metadata: { resultCount: rows.length },
    req
  });
  return { items: rows.map(serializeCooperative) };
}

export async function adminCreateCooperative(adminAuth, req, body = {}) {
  const fields = coopFields(body, { partial: false });
  return withTransaction(async (client) => {
    let row;
    for (let attempt = 0; attempt < 5 && !row; attempt += 1) {
      const result = await client.query(
        `INSERT INTO cooperatives (name, county, district, community, description, join_code, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (join_code) DO NOTHING RETURNING *`,
        [fields.name, fields.county, fields.district, fields.community, fields.description, joinCode(), adminAuth.userId]
      );
      row = result.rows[0];
    }
    if (!row) throw new ApiError(500, "INTERNAL_ERROR", "Could not create a join code. Try again.");
    await writeAudit({
      client,
      adminUserId: adminAuth.userId,
      action: "cooperative.created",
      targetType: "cooperative",
      targetId: row.id,
      metadata: { name: row.name },
      req
    });
    return { cooperative: serializeCooperative({ ...row, member_count: 0 }) };
  });
}

export async function adminUpdateCooperative(adminAuth, req, id, body = {}) {
  requireUuid(id, "id", "group");
  const fields = coopFields(body, { partial: true });
  const entries = Object.entries(fields);
  if (entries.length === 0) throw badRequest("Provide at least one field to update.");
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE cooperatives SET ${entries.map(([column], index) => `${column} = $${index + 1}`).join(", ")},
         updated_at = now()
       WHERE id = $${entries.length + 1} RETURNING id`,
      [...entries.map(([, value]) => value), id]
    );
    if (!rows[0]) throw notFound("Group not found.");
    await writeAudit({
      client,
      adminUserId: adminAuth.userId,
      action: "cooperative.updated",
      targetType: "cooperative",
      targetId: id,
      metadata: { fields: Object.keys(fields) },
      req
    });
  });
  return adminGetCooperative(adminAuth, req, id);
}

async function memberRows(cooperativeId) {
  const { rows } = await query(
    `SELECT f.id, f.full_name, f.county, f.community, m.role, m.joined_at, m.consent_at,
            (SELECT COALESCE(sum(total_amount), 0) FROM sales s
              WHERE s.farmer_id = f.id AND s.deleted_at IS NULL AND s.currency = 'LRD') AS sold_lrd,
            (SELECT COALESCE(sum(total_amount), 0) FROM sales s
              WHERE s.farmer_id = f.id AND s.deleted_at IS NULL AND s.currency = 'USD') AS sold_usd
     FROM cooperative_members m JOIN farmers f ON f.id = m.farmer_id
     WHERE m.cooperative_id = $1 AND m.status = 'active'
     ORDER BY m.role DESC, f.full_name`,
    [cooperativeId]
  );
  return rows;
}

// Admins see who is in the group, never a member's own sales or phone number.
function serializeAdminMember(row) {
  return {
    farmerId: row.id,
    fullName: row.full_name,
    role: row.role,
    joinedAt: row.joined_at,
    sharesTotals: Boolean(row.consent_at)
  };
}

// Leaders only see totals for members who agreed at join time.
function serializeLeaderMember(row) {
  const member = serializeAdminMember(row);
  if (!row.consent_at) return member;
  return {
    ...member,
    county: row.county,
    community: row.community,
    sold: { LRD: Number(row.sold_lrd), USD: Number(row.sold_usd) }
  };
}

export async function adminGetCooperative(adminAuth, req, id, params = {}) {
  requireUuid(id, "id", "group");
  const { rows } = await query(`${SELECT_COOP} WHERE c.id = $1`, [id]);
  if (!rows[0]) throw notFound("Group not found.");
  const members = await memberRows(id);
  const totals = await moneyAndHarvestTotals(
    members.map((member) => member.id),
    params
  );

  await writeAudit({
    adminUserId: adminAuth.userId,
    action: "cooperative.viewed",
    targetType: "cooperative",
    targetId: id,
    metadata: { memberCount: members.length },
    req
  });

  return {
    cooperative: serializeCooperative(rows[0]),
    members: members.map(serializeAdminMember),
    totals
  };
}

export async function adminAddMember(adminAuth, req, cooperativeId, body = {}) {
  requireUuid(cooperativeId, "id", "group");
  let farmerId = body.farmerId;
  if (farmerId) requireUuid(farmerId, "farmerId", "farmer");
  else {
    const phone = normalizePhone(body.phoneNumber);
    if (!phone) {
      throw badRequest("Enter the farmer's phone number, for example 077 000 0000.", { field: "phoneNumber" });
    }
    const { rows } = await query("SELECT id FROM farmers WHERE phone_number = $1", [phone]);
    if (!rows[0]) throw notFound("No farmer has this phone number. The farmer must register first.");
    farmerId = rows[0].id;
  }
  const role = body.role ? requireEnum(body.role, ["member", "leader"], "role", "role") : "member";
  return withTransaction(async (client) => {
    const coop = await client.query("SELECT id FROM cooperatives WHERE id = $1", [cooperativeId]);
    if (!coop.rows[0]) throw notFound("Group not found.");
    const farmer = await client.query("SELECT id FROM farmers WHERE id = $1", [farmerId]);
    if (!farmer.rows[0]) throw notFound("Farmer not found.");
    // An admin-added member has not agreed to share totals yet; their own
    // figures stay hidden until they agree in the app.
    await client.query(
      `INSERT INTO cooperative_members (cooperative_id, farmer_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (cooperative_id, farmer_id)
       DO UPDATE SET status = 'active', role = EXCLUDED.role, updated_at = now()`,
      [cooperativeId, farmerId, role]
    );
    await writeAudit({
      client,
      adminUserId: adminAuth.userId,
      action: "cooperative.member_added",
      targetType: "cooperative",
      targetId: cooperativeId,
      metadata: { farmerId, role },
      req
    });
    return { message: "Farmer added to the group." };
  });
}

export async function adminSetMemberRole(adminAuth, req, cooperativeId, farmerId, body = {}) {
  requireUuid(cooperativeId, "id", "group");
  requireUuid(farmerId, "farmerId", "farmer");
  const role = requireEnum(body.role, ["member", "leader"], "role", "role");
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE cooperative_members SET role = $1, updated_at = now()
       WHERE cooperative_id = $2 AND farmer_id = $3 AND status = 'active' RETURNING farmer_id`,
      [role, cooperativeId, farmerId]
    );
    if (!rows[0]) throw notFound("This farmer is not in the group.");
    await writeAudit({
      client,
      adminUserId: adminAuth.userId,
      action: "cooperative.member_role",
      targetType: "cooperative",
      targetId: cooperativeId,
      metadata: { farmerId, role },
      req
    });
    return { message: role === "leader" ? "Farmer is now a group leader." : "Farmer is now a member." };
  });
}

export async function adminRemoveMember(adminAuth, req, cooperativeId, farmerId) {
  requireUuid(cooperativeId, "id", "group");
  requireUuid(farmerId, "farmerId", "farmer");
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE cooperative_members SET status = 'left', role = 'member', updated_at = now()
       WHERE cooperative_id = $1 AND farmer_id = $2 AND status = 'active' RETURNING farmer_id`,
      [cooperativeId, farmerId]
    );
    if (!rows[0]) throw notFound("This farmer is not in the group.");
    await writeAudit({
      client,
      adminUserId: adminAuth.userId,
      action: "cooperative.member_removed",
      targetType: "cooperative",
      targetId: cooperativeId,
      metadata: { farmerId },
      req
    });
    return { message: "Farmer removed from the group." };
  });
}

// ---------- Farmer ----------

export async function myCooperatives(farmerId) {
  const { rows } = await query(
    `SELECT c.*, m.role, m.consent_at,
       (SELECT count(*) FROM cooperative_members x
         WHERE x.cooperative_id = c.id AND x.status = 'active') AS member_count
     FROM cooperative_members m JOIN cooperatives c ON c.id = m.cooperative_id
     WHERE m.farmer_id = $1 AND m.status = 'active' AND c.status = 'active'
     ORDER BY c.name`,
    [farmerId]
  );
  return {
    items: rows.map((row) => {
      const coop = serializeCooperative(row);
      // Only leaders need the join code to invite people.
      if (row.role !== "leader") delete coop.joinCode;
      return { ...coop, myRole: row.role, myConsent: Boolean(row.consent_at) };
    })
  };
}

export async function joinCooperative(farmerId, body = {}) {
  const code = requireString(body.joinCode, "joinCode", { max: 20, label: "Group code" })
    .toUpperCase()
    .replace(/\s+/g, "");
  if (body.consent !== true) {
    throw badRequest(
      "Agree to share your sales totals with the group before joining.",
      { field: "consent" }
    );
  }
  const normalized = code.startsWith("GRP-") ? code : `GRP-${code}`;
  const { rows } = await query("SELECT * FROM cooperatives WHERE join_code = $1 AND status = 'active'", [
    normalized
  ]);
  if (!rows[0]) throw notFound("No group has this code. Check the code and try again.");
  const existing = await query(
    "SELECT status FROM cooperative_members WHERE cooperative_id = $1 AND farmer_id = $2",
    [rows[0].id, farmerId]
  );
  if (existing.rows[0]?.status === "active") throw conflict("You are already in this group.");
  await query(
    `INSERT INTO cooperative_members (cooperative_id, farmer_id, role, consent_at)
     VALUES ($1, $2, 'member', now())
     ON CONFLICT (cooperative_id, farmer_id) DO UPDATE
       SET status = 'active', role = 'member', consent_at = now(), updated_at = now()`,
    [rows[0].id, farmerId]
  );
  await addNotification(farmerId, {
    kind: "system",
    topic: "group_joined",
    key: `joined:${rows[0].id}`,
    title: `You joined ${rows[0].name}`,
    body: "Messages from your group will show here. You can see the group's totals under My group.",
    link: `/app/group/${rows[0].id}`
  }).catch(() => {});
  const coop = serializeCooperative(rows[0]);
  delete coop.joinCode;
  return {
    cooperative: { ...coop, myRole: "member", myConsent: true },
    message: `You joined ${rows[0].name}.`
  };
}

export async function setConsent(farmerId, cooperativeId, consent) {
  requireUuid(cooperativeId, "id", "group");
  if (typeof consent !== "boolean") {
    throw badRequest("Choose whether to share your totals.", { field: "consent" });
  }
  const { rows } = await query(
    `UPDATE cooperative_members
     SET consent_at = CASE WHEN $1 THEN now() ELSE NULL END, updated_at = now()
     WHERE cooperative_id = $2 AND farmer_id = $3 AND status = 'active'
     RETURNING consent_at`,
    [consent, cooperativeId, farmerId]
  );
  if (!rows[0]) throw notFound("You are not in this group.");
  return {
    myConsent: Boolean(rows[0].consent_at),
    message: consent
      ? "Your totals are now shared with group leaders."
      : "Your totals are private again."
  };
}

export async function leaveCooperative(farmerId, cooperativeId) {
  requireUuid(cooperativeId, "id", "group");
  const { rows } = await query(
    `UPDATE cooperative_members SET status = 'left', role = 'member', consent_at = NULL, updated_at = now()
     WHERE cooperative_id = $1 AND farmer_id = $2 AND status = 'active' RETURNING farmer_id`,
    [cooperativeId, farmerId]
  );
  if (!rows[0]) throw notFound("You are not in this group.");
  return { message: "You left the group." };
}

export async function cooperativeDashboard(farmerId, cooperativeId, params = {}) {
  requireUuid(cooperativeId, "id", "group");
  const membership = await query(
    `SELECT m.role, m.consent_at FROM cooperative_members m JOIN cooperatives c ON c.id = m.cooperative_id
     WHERE m.cooperative_id = $1 AND m.farmer_id = $2 AND m.status = 'active' AND c.status = 'active'`,
    [cooperativeId, farmerId]
  );
  if (!membership.rows[0]) throw forbidden("You are not in this group.");
  const isLeader = membership.rows[0].role === "leader";

  const { rows } = await query(`${SELECT_COOP} WHERE c.id = $1`, [cooperativeId]);
  const members = await memberRows(cooperativeId);
  const coop = serializeCooperative(rows[0]);
  if (!isLeader) delete coop.joinCode;

  return {
    cooperative: coop,
    myRole: membership.rows[0].role,
    myConsent: Boolean(membership.rows[0].consent_at),
    leaders: members
      .filter((member) => member.role === "leader")
      .map((member) => ({ fullName: member.full_name, community: member.community })),
    groupTotals: await moneyAndHarvestTotals(
      members.map((member) => member.id),
      params
    ),
    myTotals: await moneyAndHarvestTotals(farmerId, params),
    // Leaders see each member's totals only when that member agreed. Detailed
    // records and contact details are never shared.
    members: isLeader ? members.map(serializeLeaderMember) : undefined
  };
}
