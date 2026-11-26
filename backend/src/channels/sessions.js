import { pool, query } from "../config/database.js";

// USSD sessions and phone calls, kept in Postgres (channel_sessions), so they
// survive a restart and work with more than one backend.
//
// Each step of a session runs under a lock on that session, so two copies of
// the same callback (a provider retry, a double tap in the simulator) are
// handled one after the other and the second sees what the first did.

const MINUTE = 60 * 1000;

// Idle time before a session expires. USSD screens time out on the phone
// after about 2-3 minutes anyway; calls get a little longer.
export function idleMs(channel) {
  const minutes = Number(channel === "ussd" ? process.env.USSD_SESSION_MINUTES : process.env.VOICE_SESSION_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : channel === "ussd" ? 5 : 10) * MINUTE;
}
// No session lasts longer than this, however active.
const MAX_MS = 30 * MINUTE;

function serialize(row) {
  return {
    id: row.id,
    channel: row.channel,
    provider: row.provider,
    sessionKey: row.session_key,
    phone: row.phone_number,
    farmerId: row.farmer_id,
    language: row.language,
    authenticated: Boolean(row.authenticated_at),
    state: row.state || {},
    steps: row.steps,
    isDemo: row.is_demo,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    endedAt: row.ended_at,
    endedReason: row.ended_reason
  };
}

export function isOver(session, now = Date.now()) {
  return Boolean(session.endedAt) || new Date(session.expiresAt).getTime() <= now;
}

// Runs fn(client) holding a lock on this session.
export async function withSessionLock(channel, provider, sessionKey, fn) {
  const client = await pool.connect();
  const lockKey = `channel:${channel}:${provider}:${sessionKey}`;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockKey]);
    return await fn();
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]).catch(() => {});
    client.release();
  }
}

// The session for this key, made if it is new.
// Returns { session, created }.
export async function openSession({ channel, provider, sessionKey, phone = null, isDemo = false }) {
  const inserted = await query(
    `INSERT INTO channel_sessions (channel, provider, session_key, phone_number, is_demo, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + ($6::int * interval '1 millisecond'))
     ON CONFLICT (channel, provider, session_key) DO NOTHING
     RETURNING *`,
    [channel, provider, sessionKey, phone, isDemo, idleMs(channel)]
  );
  if (inserted.rows[0]) return { session: serialize(inserted.rows[0]), created: true };
  const { rows } = await query(
    "SELECT * FROM channel_sessions WHERE channel = $1 AND provider = $2 AND session_key = $3",
    [channel, provider, sessionKey]
  );
  return { session: serialize(rows[0]), created: false };
}

export async function findSession(channel, provider, sessionKey) {
  const { rows } = await query(
    "SELECT * FROM channel_sessions WHERE channel = $1 AND provider = $2 AND session_key = $3",
    [channel, provider, sessionKey]
  );
  return rows[0] ? serialize(rows[0]) : null;
}

// Saves what changed and moves the expiry on (never past 30 minutes).
export async function saveSession(session, changes = {}) {
  const { rows } = await query(
    `UPDATE channel_sessions SET
       farmer_id = COALESCE($2, farmer_id),
       language = COALESCE($3, language),
       authenticated_at = CASE WHEN $4::boolean AND authenticated_at IS NULL THEN now() ELSE authenticated_at END,
       state = COALESCE($5::jsonb, state),
       steps = COALESCE($6, steps),
       updated_at = now(),
       expires_at = LEAST(now() + ($7::int * interval '1 millisecond'), created_at + ($8::int * interval '1 millisecond'))
     WHERE id = $1
     RETURNING *`,
    [
      session.id,
      changes.farmerId ?? null,
      changes.language ?? null,
      Boolean(changes.authenticated),
      changes.state ? JSON.stringify(changes.state) : null,
      changes.steps ?? null,
      idleMs(session.channel),
      MAX_MS
    ]
  );
  return serialize(rows[0]);
}

export async function endSession(session, reason) {
  const { rows } = await query(
    `UPDATE channel_sessions SET ended_at = COALESCE(ended_at, now()), ended_reason = COALESCE(ended_reason, $2),
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [session.id, String(reason || "ended").slice(0, 40)]
  );
  return rows[0] ? serialize(rows[0]) : session;
}

// Old sessions are only needed for a while (call history, support).
export async function deleteOldSessions(days = 30) {
  const { rowCount } = await query(
    "DELETE FROM channel_sessions WHERE created_at < now() - ($1::int * interval '1 day')",
    [days]
  );
  return rowCount;
}

// A line in the server log for each step, without PINs or full numbers.
export function logStep(session, { input, screen, pinStep = false }) {
  if (process.env.NODE_ENV === "test" || process.env.CHANNEL_LOG === "off") return;
  const phone = session.phone ? `${String(session.phone).slice(0, 6)}***${String(session.phone).slice(-2)}` : null;
  console.info(
    JSON.stringify({
      at: new Date().toISOString(),
      channel: session.channel,
      provider: session.provider,
      session: session.id,
      demo: session.isDemo || undefined,
      phone,
      step: session.steps,
      input: input === undefined ? undefined : pinStep ? "[pin]" : String(input).slice(0, 20),
      prompt: screen?.id,
      end: screen?.end || undefined
    })
  );
}
