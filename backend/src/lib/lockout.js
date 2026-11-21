import { query } from "../config/database.js";
import { ApiError } from "./errors.js";

// Per-account protection against PIN and recovery-answer guessing.
// The first FREE_ATTEMPTS mistakes cost nothing. After that each further
// mistake locks the account for a short, growing wait (5, 10, 20 … minutes,
// at most one hour). Locks lift on their own so a farmer who mistypes is never
// stuck waiting for help; a correct PIN resets the count.
export const FREE_ATTEMPTS = 5;
const BASE_LOCK_SECONDS = 5 * 60;
const MAX_LOCK_SECONDS = 60 * 60;

const TABLES = { farmer: "farmers", admin: "admin_users" };
const KINDS = {
  login: { count: "failed_login_count", until: "locked_until" },
  recovery: { count: "recovery_failed_count", until: "recovery_locked_until" }
};

function columns(role, kind) {
  const table = TABLES[role];
  const cols = KINDS[kind];
  if (!table || !cols) throw new Error(`Unknown lockout target ${role}/${kind}`);
  return { table, ...cols };
}

export function lockedError(until) {
  const seconds = Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 1000));
  const minutes = Math.ceil(seconds / 60);
  return new ApiError(
    429,
    "ACCOUNT_LOCKED",
    `Too many wrong tries. Please wait ${minutes} ${minutes === 1 ? "minute" : "minutes"} and try again.`,
    { retryAfterSeconds: seconds }
  );
}

// Throws ACCOUNT_LOCKED while the account is in a waiting period.
export function assertNotLocked(account, kind = "login") {
  const until = account?.[KINDS[kind].until];
  if (until && new Date(until).getTime() > Date.now()) throw lockedError(until);
}

// Records one wrong attempt atomically and returns the new lock time (or null).
export async function recordFailure(role, accountId, kind = "login", client = null) {
  const { table, count, until } = columns(role, kind);
  const run = client ? client.query.bind(client) : query;
  const { rows } = await run(
    `UPDATE ${table}
     SET ${count} = ${count} + 1,
         ${until} = CASE
           WHEN ${count} + 1 >= $2
             THEN now() + make_interval(secs => LEAST($3::double precision,
               $4::double precision * power(2, ${count} + 1 - $2)))
           ELSE ${until}
         END
     WHERE id = $1
     RETURNING ${until} AS locked_until`,
    [accountId, FREE_ATTEMPTS, MAX_LOCK_SECONDS, BASE_LOCK_SECONDS]
  );
  return rows[0]?.locked_until || null;
}

export async function clearFailures(role, accountId, kinds = ["login"], client = null) {
  const table = TABLES[role];
  const assignments = kinds
    .map((kind) => `${KINDS[kind].count} = 0, ${KINDS[kind].until} = NULL`)
    .join(", ");
  const run = client ? client.query.bind(client) : query;
  await run(`UPDATE ${table} SET ${assignments} WHERE id = $1`, [accountId]);
}

// After a wrong guess: if this mistake started a lock, say so right away so the
// farmer sees the wait instead of a plain "wrong PIN".
export async function failAndThrow(role, accountId, kind, fallbackError) {
  const lockedUntil = await recordFailure(role, accountId, kind);
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) throw lockedError(lockedUntil);
  throw fallbackError;
}
