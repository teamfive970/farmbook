// People who use this phone. A family or farmer group often shares one phone,
// so each farmer keeps their own session here and their own records in their
// own on-phone database (minders-<userId>). Switching person needs that
// person's PIN, checked on the phone so it works without network.

const PROFILES_KEY = "minders.profiles";
const UNLOCKED_KEY = "minders.unlocked";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(map) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(map));
  } catch {
    // Storage full or blocked: switching person will need a full sign-in.
  }
}

export function readProfiles() {
  return read();
}

export function profileList() {
  return Object.values(read()).sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
}

export function saveProfile(user, token, offline) {
  if (!user || user.role !== "farmer") return;
  const map = read();
  map[user.id] = {
    user,
    token: token || map[user.id]?.token || null,
    offline: Boolean(offline) && !token,
    lastUsedAt: Date.now()
  };
  if (offline && !token) map[user.id].token = null;
  write(map);
}

export function setProfileToken(userId, token) {
  const map = read();
  if (!map[userId]) return;
  map[userId].token = token || null;
  map[userId].offline = !token;
  write(map);
}

export function dropProfile(userId) {
  const map = read();
  delete map[userId];
  write(map);
}

// "Unlocked" lasts for this browser tab only. When the app is opened again on a
// phone shared by several people, it asks who is using it.
export function markUnlocked(userId) {
  try {
    sessionStorage.setItem(UNLOCKED_KEY, userId);
  } catch {
    // ignore
  }
}

export function clearUnlocked() {
  try {
    sessionStorage.removeItem(UNLOCKED_KEY);
  } catch {
    // ignore
  }
}

export function isUnlocked(userId) {
  try {
    return sessionStorage.getItem(UNLOCKED_KEY) === userId;
  } catch {
    return false;
  }
}

export function maskedPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 3 ? `••• ${digits.slice(-3)}` : "";
}
