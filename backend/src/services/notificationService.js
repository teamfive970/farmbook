import { query, withTransaction } from "../config/database.js";
import { writeAudit } from "../lib/audit.js";
import { isDemoAdmin } from "../lib/demoAccess.js";
import { COUNTIES } from "../lib/constants.js";
import { badRequest, notFound } from "../lib/errors.js";
import { sendSms, smsAvailable } from "../lib/sms.js";
import { requireEnum, requireReason, requireString, requireUuid } from "../lib/validation.js";

// ---------------------------------------------------------------------------
// The farmer's inbox
// ---------------------------------------------------------------------------

const INBOX_LIMIT = 60;
const NO_WORK_DAYS = 3;
const OWED_AFTER_DAYS = 7;
const MAX_OWED_REMINDERS = 5;
const PASSPORT_WINDOW_DAYS = 90;

const CURRENCY_LABEL = { LRD: "L$", USD: "US$" };

function money(amount, currency) {
  const value = Number(amount || 0);
  const shown = Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${CURRENCY_LABEL[currency] || ""}${shown}`;
}

function dayText(value) {
  const day = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  });
}

function serialize(row) {
  return {
    id: row.id,
    kind: row.kind,
    topic: row.topic,
    title: row.title,
    body: row.body,
    link: row.link,
    createdAt: row.created_at,
    readAt: row.read_at
  };
}

// Adds a notification unless one with the same key is already in the inbox.
export async function addNotification(farmerId, item, run = query) {
  await run(
    `INSERT INTO notifications (farmer_id, kind, topic, title, body, link, dedupe_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (farmer_id, dedupe_key) DO NOTHING`,
    [farmerId, item.kind || "system", item.topic, item.title, item.body, item.link || null, item.key || null]
  );
}

// Unread reminders whose reason has gone (the sale was paid, the passport was
// turned on, new work was recorded) are taken away, so the inbox never nags
// about something already done. Read ones stay as history.
async function dropStale(farmerId, prefix, keepKeys) {
  await query(
    `DELETE FROM notifications
     WHERE farmer_id = $1 AND kind = 'reminder' AND read_at IS NULL
       AND dedupe_key LIKE $2 AND NOT (dedupe_key = ANY($3::text[]))`,
    [farmerId, `${prefix}%`, keepKeys]
  );
}

async function remindNoWork(farmerId) {
  const { rows } = await query(
    `SELECT
       EXISTS (SELECT 1 FROM farms WHERE farmer_id = $1) AS has_farm,
       f.created_at::date AS joined_on,
       GREATEST(
         (SELECT max(activity_date) FROM farm_activities WHERE farmer_id = $1 AND deleted_at IS NULL),
         (SELECT max(harvest_date) FROM harvests WHERE farmer_id = $1 AND deleted_at IS NULL),
         (SELECT max(sale_date) FROM sales WHERE farmer_id = $1 AND deleted_at IS NULL),
         (SELECT max(expense_date) FROM expenses WHERE farmer_id = $1 AND deleted_at IS NULL)
       ) AS last_day,
       CURRENT_DATE AS today
     FROM farmers f WHERE f.id = $1`,
    [farmerId]
  );
  const row = rows[0];
  if (!row?.has_farm) return dropStale(farmerId, "no_work:", []);
  const since = row.last_day || row.joined_on;
  const days = Math.floor((new Date(row.today) - new Date(since)) / 86_400_000);
  if (days < NO_WORK_DAYS) return dropStale(farmerId, "no_work:", []);
  const key = `no_work:${row.last_day ? String(row.last_day).slice(0, 10) : "none"}`;
  await dropStale(farmerId, "no_work:", [key]);
  await addNotification(farmerId, {
    kind: "reminder",
    topic: "no_work",
    key,
    title: row.last_day ? `No farm work recorded for ${days} days` : "Record your first farm work",
    body: row.last_day
      ? `Your last record was on ${dayText(row.last_day)}. Record today's work so your farm book stays complete.`
      : "Tap Record today's work to start your farm book. It takes a few taps.",
    link: "/app/record"
  });
}

async function remindOwed(farmerId) {
  const { rows } = await query(
    `SELECT s.id, s.client_id, s.crop, s.sale_date, s.total_amount, s.currency, b.name AS buyer,
       s.total_amount - COALESCE(sum(p.amount), 0) AS owed
     FROM sales s
     LEFT JOIN buyers b ON b.id = s.buyer_id
     LEFT JOIN payments p ON p.sale_id = s.id AND p.deleted_at IS NULL
     WHERE s.farmer_id = $1 AND s.deleted_at IS NULL
       AND s.sale_date <= CURRENT_DATE - $2::int
     GROUP BY s.id, b.name
     HAVING s.total_amount - COALESCE(sum(p.amount), 0) > 0
     ORDER BY s.sale_date DESC`,
    [farmerId, OWED_AFTER_DAYS]
  );
  const keys = rows.map((row) => `owed:${row.id}`);
  await dropStale(farmerId, "owed:", keys);
  for (const row of rows.slice(0, MAX_OWED_REMINDERS)) {
    const who = row.buyer ? `${row.buyer} still owes you` : "You are still owed";
    await addNotification(farmerId, {
      kind: "reminder",
      topic: "money_owed",
      key: `owed:${row.id}`,
      title: `${money(row.owed, row.currency)} still owed for ${row.crop}`,
      body: `${who} ${money(row.owed, row.currency)} from the sale on ${dayText(row.sale_date)}. Record the payment when it comes.`,
      link: `/app/money/sales/${encodeURIComponent(row.client_id)}`
    });
  }
}

async function remindPassport(farmerId) {
  const { rows } = await query(
    `SELECT h.id, h.client_id, h.crop, h.harvest_date, latest.grade
     FROM harvests h
     JOIN LATERAL (
       SELECT grade FROM quality_inspections q
       WHERE q.harvest_id = h.id AND q.deleted_at IS NULL
       ORDER BY q.inspection_date DESC, q.created_at DESC LIMIT 1
     ) latest ON true
     WHERE h.farmer_id = $1 AND h.deleted_at IS NULL AND h.passport_public = false
       AND latest.grade IN ('A', 'B')
       AND h.harvest_date >= CURRENT_DATE - $2::int
     ORDER BY h.harvest_date DESC
     LIMIT 3`,
    [farmerId, PASSPORT_WINDOW_DAYS]
  );
  const keys = rows.map((row) => `passport:${row.id}`);
  await dropStale(farmerId, "passport:", keys);
  for (const row of rows) {
    await addNotification(farmerId, {
      kind: "reminder",
      topic: "passport",
      key: `passport:${row.id}`,
      title: `Grade ${row.grade} ${row.crop}: share it with buyers`,
      body: `Your ${row.crop} from ${dayText(row.harvest_date)} passed its quality check. Turn on its Harvest Passport so buyers can scan where and how it was grown.`,
      link: `/app/harvests/${encodeURIComponent(row.client_id)}`
    });
  }
}

const lastWorkedOut = new Map();
const REMINDER_INTERVAL_MS = 60_000;

// Works out the farmer's reminders from their records. Cheap queries, so it
// runs whenever the inbox is opened; the unread-count poll runs it at most
// once a minute per farmer.
export async function refreshReminders(farmerId, { throttle = false } = {}) {
  const now = Date.now();
  if (throttle && now - (lastWorkedOut.get(farmerId) || 0) < REMINDER_INTERVAL_MS) return;
  lastWorkedOut.set(farmerId, now);
  await addNotification(farmerId, {
    kind: "system",
    topic: "welcome",
    key: "welcome",
    title: "Welcome to FarmBok",
    body: "Messages from the Ministry and your group, and reminders about your farm, will show here.",
    link: null
  });
  await remindNoWork(farmerId);
  await remindOwed(farmerId);
  await remindPassport(farmerId);
}

async function unreadCount(farmerId) {
  const { rows } = await query(
    "SELECT count(*)::int AS n FROM notifications WHERE farmer_id = $1 AND read_at IS NULL",
    [farmerId]
  );
  return rows[0].n;
}

export async function listNotifications(farmerId) {
  await refreshReminders(farmerId);
  const [{ rows }, settings] = await Promise.all([
    query(
      `SELECT * FROM notifications WHERE farmer_id = $1
       ORDER BY created_at DESC, id DESC LIMIT $2`,
      [farmerId, INBOX_LIMIT]
    ),
    query("SELECT notify_sms, price_sms FROM farmers WHERE id = $1", [farmerId])
  ]);
  return {
    notifications: rows.map(serialize),
    unreadCount: await unreadCount(farmerId),
    settings: { sms: settings.rows[0]?.notify_sms ?? true, priceSms: settings.rows[0]?.price_sms ?? false }
  };
}

export async function getUnreadCount(farmerId) {
  await refreshReminders(farmerId, { throttle: true });
  return { unreadCount: await unreadCount(farmerId) };
}

export async function markRead(farmerId, id) {
  requireUuid(id, "id", "message");
  const { rowCount } = await query(
    `UPDATE notifications SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND farmer_id = $2`,
    [id, farmerId]
  );
  if (!rowCount) throw notFound("This message was not found.");
  return { unreadCount: await unreadCount(farmerId) };
}

export async function markAllRead(farmerId) {
  await query("UPDATE notifications SET read_at = now() WHERE farmer_id = $1 AND read_at IS NULL", [
    farmerId
  ]);
  return { unreadCount: 0 };
}

// sms: news and alerts by SMS. priceSms: the weekly market price text.
// Either or both can be sent.
export async function updateNotificationSettings(farmerId, body = {}) {
  const changes = {};
  for (const [field, column] of [
    ["sms", "notify_sms"],
    ["priceSms", "price_sms"]
  ]) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "boolean") throw badRequest("Choose on or off.", { field });
    changes[column] = body[field];
  }
  const columns = Object.keys(changes);
  if (!columns.length) throw badRequest("Choose on or off.", { field: "sms" });
  const sets = columns.map((column, index) => `${column} = $${index + 1}`).join(", ");
  const { rows } = await query(
    `UPDATE farmers SET ${sets}, updated_at = now() WHERE id = $${columns.length + 1}
     RETURNING notify_sms, price_sms`,
    [...columns.map((column) => changes[column]), farmerId]
  );
  return { settings: { sms: rows[0]?.notify_sms ?? true, priceSms: rows[0]?.price_sms ?? false } };
}

// ---------------------------------------------------------------------------
// Announcements (admin → farmers)
// ---------------------------------------------------------------------------

const AUDIENCE_TYPES = ["all", "county", "cooperative"];
const SMS_LIMIT = () => Number(process.env.ANNOUNCEMENT_SMS_LIMIT || 1000);

// The farmers an announcement reaches: active accounts only, and for a group,
// active members only, never demo farmers. Returns SQL that selects farmer ids, and its params.
function audienceSql(type, value) {
  if (type === "county") {
    return { sql: "SELECT id FROM farmers WHERE status = 'active' AND NOT is_demo AND county = $1", params: [value] };
  }
  if (type === "cooperative") {
    return {
      sql: `SELECT f.id FROM farmers f
            JOIN cooperative_members m ON m.farmer_id = f.id
            WHERE f.status = 'active' AND NOT f.is_demo AND m.status = 'active' AND m.cooperative_id = $1`,
      params: [value]
    };
  }
  return { sql: "SELECT id FROM farmers WHERE status = 'active' AND NOT is_demo", params: [] };
}

async function resolveAudience(input = {}) {
  const type = requireEnum(input.type || "all", AUDIENCE_TYPES, "audience", "audience");
  if (type === "all") return { type, value: null, label: "All farmers" };
  if (type === "county") {
    const value = requireEnum(input.value, COUNTIES, "audienceValue", "county");
    return { type, value, label: `${value} County` };
  }
  const value = requireUuid(input.value, "audienceValue", "group");
  const { rows } = await query("SELECT name FROM cooperatives WHERE id = $1 AND status = 'active'", [value]);
  if (!rows[0]) throw notFound("This group was not found.");
  return { type, value, label: rows[0].name };
}

export async function previewAudience(input = {}) {
  const audience = await resolveAudience(input);
  const { sql, params } = audienceSql(audience.type, audience.value);
  const { rows } = await query(
    `SELECT count(*)::int AS farmers,
       count(*) FILTER (WHERE f.notify_sms)::int AS sms
     FROM farmers f WHERE f.id IN (${sql})`,
    params
  );
  return {
    audience: { type: audience.type, value: audience.value, label: audience.label },
    farmers: rows[0].farmers,
    smsFarmers: rows[0].sms,
    smsAvailable: smsAvailable()
  };
}

function serializeAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: { type: row.audience_type, value: row.audience_value, label: row.audience_label },
    sentBy: row.sent_by || null,
    sendSms: row.send_sms,
    recipients: row.recipient_count,
    readCount: Number(row.read_count || 0),
    sms: {
      status: row.sms_status,
      sent: row.sms_sent,
      failed: row.sms_failed,
      skipped: row.sms_skipped
    },
    createdAt: row.created_at
  };
}

export async function listAnnouncements() {
  const { rows } = await query(
    `SELECT a.*, u.display_name AS sent_by,
       (SELECT count(*) FROM notifications n WHERE n.announcement_id = a.id AND n.read_at IS NOT NULL) AS read_count
     FROM announcements a
     LEFT JOIN admin_users u ON u.id = a.admin_user_id
     ORDER BY a.created_at DESC
     LIMIT 50`
  );
  return { announcements: rows.map(serializeAnnouncement), smsAvailable: smsAvailable() };
}

export function smsText(title, body) {
  const text = `FarmBok: ${title}. ${body}`.replace(/\s+/g, " ").trim();
  return text.length > 320 ? `${text.slice(0, 317)}...` : text;
}

const smsJobs = new Set();

// For tests: wait until every SMS job started so far has finished.
export async function waitForSmsJobs() {
  while (smsJobs.size) await Promise.allSettled([...smsJobs]);
}

async function deliverSms(announcementId, audience, message) {
  const { sql, params } = audienceSql(audience.type, audience.value);
  const { rows } = await query(
    `SELECT f.phone_number FROM farmers f WHERE f.id IN (${sql}) AND f.notify_sms ORDER BY f.created_at`,
    params
  );
  const limit = SMS_LIMIT();
  const targets = rows.slice(0, limit);
  let sent = 0;
  let failed = 0;
  // A few at a time, so a big county does not flood the SMS provider.
  for (let index = 0; index < targets.length; index += 5) {
    const batch = targets.slice(index, index + 5);
    const results = await Promise.allSettled(batch.map((row) => sendSms(row.phone_number, message)));
    for (const result of results) result.status === "fulfilled" ? (sent += 1) : (failed += 1);
  }
  const { rows: counted } = await query("SELECT recipient_count FROM announcements WHERE id = $1", [announcementId]);
  const skipped = Math.max((counted[0]?.recipient_count || 0) - sent - failed, 0);
  await query(
    `UPDATE announcements SET sms_status = 'done', sms_sent = $2, sms_failed = $3, sms_skipped = $4 WHERE id = $1`,
    [announcementId, sent, failed, skipped]
  );
}

export async function sendAnnouncement(auth, req, body = {}) {
  const title = requireString(body.title, "title", { min: 3, max: 80, label: "Title" });
  const text = requireString(body.body, "body", { min: 3, max: 500, label: "Message" });
  const audience = await resolveAudience(body.audience || {});
  // The shared tester login (lib/demoAccess.js) can try announcements, but
  // they stay in the app: no SMS that would cost money or reach real phones.
  const wantSms = body.sendSms === true && !(await isDemoAdmin(auth.userId));
  const reason = body.reason ? requireReason(body.reason) : null;
  const smsReady = smsAvailable();
  const smsStatus = !wantSms ? "none" : smsReady ? "sending" : "unavailable";

  const announcement = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO announcements
        (admin_user_id, title, body, audience_type, audience_value, audience_label, send_sms, sms_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [auth.userId, title, text, audience.type, audience.value, audience.label, wantSms, smsStatus]
    );
    const row = rows[0];
    const { sql, params } = audienceSql(audience.type, audience.value);
    const offset = params.length;
    const inserted = await client.query(
      `INSERT INTO notifications (farmer_id, kind, topic, title, body, link, announcement_id, dedupe_key)
       SELECT id, 'announcement', 'announcement', $${offset + 1}, $${offset + 2}, NULL, $${offset + 3}::uuid,
         $${offset + 4}::text
       FROM (${sql}) AS audience
       ON CONFLICT (farmer_id, dedupe_key) DO NOTHING`,
      [...params, title, text, row.id, `announcement:${row.id}`]
    );
    const updated = await client.query(
      "UPDATE announcements SET recipient_count = $2 WHERE id = $1 RETURNING *",
      [row.id, inserted.rowCount]
    );
    await writeAudit({
      client,
      adminUserId: auth.userId,
      action: "announcement_sent",
      targetType: "announcement",
      targetId: row.id,
      metadata: { audience: audience.label, recipients: inserted.rowCount, sms: wantSms },
      reason,
      req
    });
    return updated.rows[0];
  });

  if (smsStatus === "sending") {
    const job = deliverSms(announcement.id, audience, smsText(title, text))
      .catch(async (error) => {
        console.error("Announcement SMS failed:", error.message);
        await query("UPDATE announcements SET sms_status = 'done' WHERE id = $1", [announcement.id]).catch(() => {});
      })
      .finally(() => smsJobs.delete(job));
    smsJobs.add(job);
  }

  return {
    announcement: serializeAnnouncement({ ...announcement, read_count: 0 }),
    message:
      smsStatus === "unavailable"
        ? `Sent to ${announcement.recipient_count} farmers in the app. SMS is not set up on this server, so no SMS went out.`
        : `Sent to ${announcement.recipient_count} farmers.`
  };
}
