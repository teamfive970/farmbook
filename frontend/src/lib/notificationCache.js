// The last copy of the farmer's inbox, kept on the phone so Messages still
// opens without network. Keyed per person, because one phone can be shared.

const PREFIX = "minders.inbox.";

function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function readInbox(userId, storage = defaultStorage()) {
  if (!storage || !userId) return null;
  try {
    const raw = JSON.parse(storage.getItem(`${PREFIX}${userId}`) || "null");
    return raw && Array.isArray(raw.notifications) ? raw : null;
  } catch {
    return null;
  }
}

export function writeInbox(userId, inbox, storage = defaultStorage(), now = Date.now()) {
  if (!storage || !userId || !inbox) return;
  try {
    storage.setItem(`${PREFIX}${userId}`, JSON.stringify({ ...inbox, savedAt: now }));
  } catch {
    // Storage full or blocked: the inbox still works online.
  }
}

export function clearInbox(userId, storage = defaultStorage()) {
  if (!storage || !userId) return;
  try {
    storage.removeItem(`${PREFIX}${userId}`);
  } catch {
    // ignore
  }
}

// Marks messages read in the saved copy, so the phone agrees with what the
// farmer just did even before the server answers.
export function markInboxRead(inbox, id = null, now = new Date().toISOString()) {
  if (!inbox) return inbox;
  const notifications = inbox.notifications.map((item) =>
    (id === null || item.id === id) && !item.readAt ? { ...item, readAt: now } : item
  );
  return { ...inbox, notifications, unreadCount: notifications.filter((item) => !item.readAt).length };
}
