import { openDB } from "idb";

const connections = new Map();

function dbFor(userId) {
  if (!connections.has(userId)) {
    connections.set(
      userId,
      openDB(`minders-${userId}`, 1, {
        upgrade(db) {
          db.createObjectStore("activities", { keyPath: "clientId" });
          db.createObjectStore("queue", { keyPath: "clientId" });
          db.createObjectStore("farms", { keyPath: "id" });
          db.createObjectStore("meta");
        }
      })
    );
  }
  return connections.get(userId);
}

export function sortActivities(list) {
  return [...list].sort((a, b) => {
    if (a.activityDate !== b.activityDate) {
      return String(b.activityDate).localeCompare(String(a.activityDate));
    }
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

export async function getCachedFarms(userId) {
  const farms = await (await dbFor(userId)).getAll("farms");
  return farms.sort((a, b) => String(a.farmName).localeCompare(String(b.farmName)));
}

export async function getCachedFarm(userId, farmId) {
  return (await dbFor(userId)).get("farms", farmId);
}

// Replaces cached server farms while keeping farms that still need to sync.
export async function cacheFarms(userId, serverFarms) {
  const db = await dbFor(userId);
  const tx = db.transaction("farms", "readwrite");
  const existing = await tx.store.getAll();
  const serverClientIds = new Set(serverFarms.map((farm) => farm.clientId).filter(Boolean));
  const localOnly = existing.filter(
    (farm) =>
      farm.syncStatus &&
      farm.syncStatus !== "synced" &&
      !(farm.clientId && serverClientIds.has(farm.clientId))
  );
  await tx.store.clear();
  for (const farm of serverFarms) {
    await tx.store.put({ ...farm, syncStatus: "synced", syncError: null });
  }
  for (const farm of localOnly) {
    await tx.store.put(farm);
  }
  await tx.done;
  return getCachedFarms(userId);
}

export async function upsertCachedFarm(userId, farm) {
  const db = await dbFor(userId);
  await db.put("farms", farm);
}

export async function deleteCachedFarm(userId, farmId) {
  const db = await dbFor(userId);
  await db.delete("farms", farmId);
}

export async function getActivities(userId) {
  const items = await (await dbFor(userId)).getAll("activities");
  return sortActivities(items);
}

export async function getActivity(userId, clientId) {
  return (await dbFor(userId)).get("activities", clientId);
}

export async function putActivity(userId, record) {
  const db = await dbFor(userId);
  await db.put("activities", record);
  return record;
}

export async function removeActivity(userId, clientId) {
  const db = await dbFor(userId);
  await db.delete("activities", clientId);
}

// Replaces cached server records while keeping unsynced local records.
export async function replaceServerActivities(userId, serverItems) {
  const db = await dbFor(userId);
  const tx = db.transaction("activities", "readwrite");
  const existing = await tx.store.getAll();
  const unsynced = existing.filter((item) => item.syncStatus !== "synced");
  await tx.store.clear();
  for (const item of serverItems) {
    await tx.store.put({ ...item, syncStatus: "synced", syncError: null });
  }
  for (const item of unsynced) {
    await tx.store.put(item);
  }
  await tx.done;
  const merged = await db.getAll("activities");
  return sortActivities(merged);
}

export async function getQueue(userId) {
  const operations = await (await dbFor(userId)).getAll("queue");
  return operations.sort((a, b) => a.enqueuedAt - b.enqueuedAt);
}

export async function enqueueOperation(userId, operation) {
  const db = await dbFor(userId);
  await db.put("queue", operation);
}

export async function removeQueueOperation(userId, clientId) {
  const db = await dbFor(userId);
  await db.delete("queue", clientId);
}

export async function getMeta(userId, key) {
  return (await dbFor(userId)).get("meta", key);
}

export async function setMeta(userId, key, value) {
  const db = await dbFor(userId);
  await db.put("meta", value, key);
}

// Maps temporary offline farm IDs (`local-…`) to the server ID after sync.
export async function getFarmIdMap(userId) {
  return (await getMeta(userId, "farmIdMap")) || {};
}

export async function setFarmIdMap(userId, map) {
  await setMeta(userId, "farmIdMap", map);
}

export async function getFailedRecords(userId) {
  const [activities, farms] = await Promise.all([
    getActivities(userId),
    getCachedFarms(userId)
  ]);
  return {
    activities: activities.filter((item) => item.syncStatus === "failed"),
    farms: farms.filter((farm) => farm.syncStatus === "failed")
  };
}
