import { query } from "../config/database.js";

// One writer for every admin action, so no route forgets the reason, the
// address the request came from, or the browser that made it.
export function requestOrigin(req) {
  if (!req) return { ip: null, userAgent: null };
  const forwarded = req.headers?.["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) || req.ip || null;
  const agent = req.headers?.["user-agent"];
  return {
    ip: ip ? String(ip).slice(0, 100) : null,
    userAgent: typeof agent === "string" ? agent.slice(0, 300) : null
  };
}

export async function writeAudit({
  client = null,
  adminUserId,
  action,
  targetType,
  targetId = null,
  metadata = {},
  reason = null,
  req = null
}) {
  const run = client ? client.query.bind(client) : query;
  const { ip, userAgent } = requestOrigin(req);
  await run(
    `INSERT INTO audit_logs
      (admin_user_id, action, target_type, target_id, metadata, reason, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [adminUserId, action, targetType, targetId, JSON.stringify(metadata ?? {}), reason, ip, userAgent]
  );
}
