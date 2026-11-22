import { deleteDB, openDB } from "idb";

const connections = new Map();

function dbFor(userId) {
  if (!connections.has(userId)) {
    connections.set(
      userId,
      openDB(`minders-${userId}`, 2, {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            db.createObjectStore("activities", { keyPath: "clientId" });
            db.createObjectStore("queue", { keyPath: "clientId" });
            db.createObjectStore("farms", { keyPath: "id" });
            db.createObjectStore("meta");
          }
          // v2: harvests, quality checks, buyers, sales, payments, expenses.
          if (oldVersion < 2) {
            const records = db.createObjectStore("records", { keyPath: "clientId" });
            records.createIndex("kind", "kind");
          }
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
// A farm with unsent edits keeps its local version so the farmer's change does
// not seem to disappear; a new local farm the server already has (it synced but
// the reply was lost) is replaced by the server copy.
export async function cacheFarms(userId, serverFarms) {
  const db = await dbFor(userId);
  const tx = db.transaction("farms", "readwrite");
  const existing = await tx.store.getAll();
  const serverIds = new Set(serverFarms.map((farm) => farm.id));
  const serverClientIds = new Set(serverFarms.map((farm) => farm.clientId).filter(Boolean));
  const keepLocal = existing.filter((farm) => {
    if (!farm.syncStatus || farm.syncStatus === "synced") return false;
    const isLocalCreate = typeof farm.id === "string" && farm.id.startsWith("local-");
    if (isLocalCreate) return !(farm.clientId && serverClientIds.has(farm.clientId));
    return true;
  });
  const keptIds = new Set(keepLocal.map((farm) => farm.id));
  await tx.store.clear();
  for (const farm of serverFarms) {
    if (keptIds.has(farm.id)) continue;
    await tx.store.put({ ...farm, syncStatus: "synced", syncError: null });
  }
  for (const farm of keepLocal) {
    // A pending edit to a farm the server no longer returns is dropped.
    if (!farm.id.startsWith("local-") && !serverIds.has(farm.id)) continue;
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
// Records with a delete still waiting to be sent stay hidden, so a deleted
// record does not come back after a refresh.
export async function replaceServerActivities(userId, serverItems) {
  const db = await dbFor(userId);
  const pendingDeletes = new Set(
    (await db.getAll("queue"))
      .filter((operation) => operation.kind === "delete" && !operation.entity)
      .map((operation) => operation.clientId)
  );
  const tx = db.transaction("activities", "readwrite");
  const existing = await tx.store.getAll();
  const unsynced = existing.filter((item) => item.syncStatus !== "synced");
  const unsyncedIds = new Set(unsynced.map((item) => item.clientId));
  await tx.store.clear();
  for (const item of serverItems) {
    if (pendingDeletes.has(item.clientId) || unsyncedIds.has(item.clientId)) continue;
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
  const [activities, farms, records] = await Promise.all([
    getActivities(userId),
    getCachedFarms(userId),
    getAllRecords(userId)
  ]);
  return {
    activities: activities.filter((item) => item.syncStatus === "failed"),
    farms: farms.filter((farm) => farm.syncStatus === "failed"),
    records: records.filter((record) => record.syncStatus === "failed")
  };
}

// ---------- Harvests, quality checks, buyers, sales, payments, expenses ----------
// One store; each item has `kind` (the API resource name) and `clientId`.

export async function getAllRecords(userId) {
  return (await dbFor(userId)).getAll("records");
}

export async function getRecordsByKind(userId, kind) {
  return (await dbFor(userId)).getAllFromIndex("records", "kind", kind);
}

export async function getLocalRecord(userId, clientId) {
  return (await dbFor(userId)).get("records", clientId);
}

export async function putLocalRecord(userId, record) {
  await (await dbFor(userId)).put("records", record);
  return record;
}

export async function removeLocalRecord(userId, clientId) {
  await (await dbFor(userId)).delete("records", clientId);
}

// Replaces one kind's server copies, keeping anything not yet sent and
// hiding records whose delete is still waiting in the queue.
export async function replaceServerRecords(userId, kind, serverItems) {
  const db = await dbFor(userId);
  const pendingDeletes = new Set(
    (await db.getAll("queue"))
      .filter((operation) => operation.kind === "delete")
      .map((operation) => operation.clientId)
  );
  const tx = db.transaction("records", "readwrite");
  const existing = await tx.store.index("kind").getAll(kind);
  const unsynced = existing.filter((item) => item.syncStatus && item.syncStatus !== "synced");
  const unsyncedIds = new Set(unsynced.map((item) => item.clientId));
  for (const item of existing) {
    if (!unsyncedIds.has(item.clientId)) await tx.store.delete(item.clientId);
  }
  for (const item of serverItems) {
    if (pendingDeletes.has(item.clientId) || unsyncedIds.has(item.clientId)) continue;
    await tx.store.put({ ...item, kind, syncStatus: "synced", syncError: null });
  }
  await tx.done;
}

// Asks the browser to keep FarmBok's saved records even when the phone is low on
// space. Without this, Android may clear an unused site's storage. Safe to call
// repeatedly; returns whether storage is persistent.
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// True while this person still has farms, work or money records that have not
// reached the server (queued, sending or failed).
export async function hasUnsentWork(userId) {
  const db = await dbFor(userId);
  if ((await db.count("queue")) > 0) return true;
  const stores = ["activities", "farms", "records"];
  for (const store of stores) {
    const items = await db.getAll(store);
    if (items.some((item) => item.syncStatus && item.syncStatus !== "synced")) return true;
  }
  return false;
}

// Moves the work of an account made offline onto the real account once the
// server accepts it. Both databases use the same stores, so each record and
// each queued operation is copied as it is; the old database is removed only
// after the copy finishes.
export async function moveLocalData(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;
  const stores = ["activities", "queue", "farms", "meta", "records"];
  const source = await openDB(`minders-${fromId}`);
  const target = await dbFor(toId);
  try {
    for (const store of stores) {
      if (!source.objectStoreNames.contains(store)) continue;
      if (store === "meta") {
        const [keys, values] = await Promise.all([
          source.getAllKeys("meta"),
          source.getAll("meta")
        ]);
        if (!keys.length) continue;
        const tx = target.transaction("meta", "readwrite");
        for (let index = 0; index < keys.length; index += 1) {
          await tx.store.put(values[index], keys[index]);
        }
        await tx.done;
        continue;
      }
      const items = await source.getAll(store);
      if (!items.length) continue;
      const tx = target.transaction(store, "readwrite");
      for (const item of items) await tx.store.put(item);
      await tx.done;
    }
  } finally {
    source.close();
    const cached = connections.get(fromId);
    if (cached) {
      (await cached).close();
      connections.delete(fromId);
    }
  }
  // Another tab may still hold the old database open. The copy is already
  // safe, so do not keep the farmer waiting on a blocked delete.
  await Promise.race([
    deleteDB(`minders-${fromId}`).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000))
  ]);
}

// Removes a person's records from this phone (their account and the copy on
// the server are not touched).
export async function deleteLocalData(userId) {
  const pending = connections.get(userId);
  if (pending) {
    (await pending).close();
    connections.delete(userId);
  }
  await deleteDB(`minders-${userId}`);
}
