// The last copy of the farmer's groups and group dashboards, kept on the phone
// so the Group screen still shows something without network. Keyed per person,
// because one phone can be shared by several farmers.
//
// The copy is thrown away when it can no longer be right:
//   * the farmer joins a group  → the list of groups is out of date;
//   * the list of groups comes back without a group → that group's dashboard
//     is dropped (they left or were taken out);
//   * the server says "not found" or "no access" for a group → dropped;
//   * the person is taken off the phone → all their group copies go.

const PREFIX = "minders.group.";

function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function groupCacheKey(userId, name) {
  return `${PREFIX}${userId}.${name}`;
}

export function dashboardName(groupId) {
  return `dash.${groupId}`;
}

export function readGroupCache(userId, name, storage = defaultStorage()) {
  if (!storage) return null;
  try {
    const raw = JSON.parse(storage.getItem(groupCacheKey(userId, name)) || "null");
    if (!raw) return null;
    // Older copies were saved without the { savedAt, data } wrapper.
    return raw && typeof raw === "object" && "savedAt" in raw && "data" in raw ? raw.data : raw;
  } catch {
    return null;
  }
}

export function readGroupCacheTime(userId, name, storage = defaultStorage()) {
  if (!storage) return null;
  try {
    const raw = JSON.parse(storage.getItem(groupCacheKey(userId, name)) || "null");
    return raw?.savedAt || null;
  } catch {
    return null;
  }
}

export function writeGroupCache(userId, name, data, storage = defaultStorage(), now = Date.now()) {
  if (!storage) return;
  try {
    storage.setItem(groupCacheKey(userId, name), JSON.stringify({ savedAt: now, data }));
  } catch {
    // Storage full or blocked: the screen still works online.
  }
}

export function dropGroupCache(userId, name, storage = defaultStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(groupCacheKey(userId, name));
  } catch {
    // ignore
  }
}

function keysOf(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) keys.push(storage.key(index));
  return keys.filter(Boolean);
}

// Everything kept for one person (used when they are taken off the phone).
export function clearGroupCaches(userId, storage = defaultStorage()) {
  if (!storage) return;
  const prefix = `${PREFIX}${userId}.`;
  for (const key of keysOf(storage)) if (key.startsWith(prefix)) storage.removeItem(key);
}

// After the list of groups arrives: drop dashboards of groups not in it.
export function reconcileGroupCaches(userId, mine, storage = defaultStorage()) {
  if (!storage) return;
  const keep = new Set((mine?.items || []).map((group) => groupCacheKey(userId, dashboardName(group.id))));
  const prefix = `${PREFIX}${userId}.dash.`;
  for (const key of keysOf(storage)) {
    if (key.startsWith(prefix) && !keep.has(key)) storage.removeItem(key);
  }
}

// A group the server says this person can't see any more. Returns true when
// the copy was dropped, so the screen can say so.
export function forgetGroupOnError(userId, groupId, error, storage = defaultStorage()) {
  if (!error || (error.status !== 403 && error.status !== 404)) return false;
  dropGroupCache(userId, dashboardName(groupId), storage);
  dropGroupCache(userId, "mine", storage);
  return true;
}
