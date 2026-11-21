import { api, ApiError } from "./api.js";
import {
  getLocalRecord,
  putLocalRecord,
  removeLocalRecord,
  replaceServerRecords
} from "./localStore.js";
import {
  cacheFarms,
  deleteCachedFarm,
  enqueueOperation,
  getActivities,
  getActivity,
  getCachedFarm,
  getFarmIdMap,
  getQueue,
  putActivity,
  removeActivity,
  removeQueueOperation,
  replaceServerActivities,
  setFarmIdMap,
  upsertCachedFarm
} from "./localStore.js";

function toLocal(record) {
  return { ...record, syncStatus: "synced", syncError: null };
}

// Problems that are not about the record itself: no signal, the session needs
// a PIN again, or the server is busy or down. The queue pauses and tries again
// later on its own; the farmer never has to press "retry" for these.
export function shouldPauseSync(error) {
  if (!(error instanceof ApiError)) return true;
  return (
    error.isNetworkError ||
    error.status === 401 ||
    error.status === 403 ||
    error.status === 408 ||
    error.status === 425 ||
    error.status === 429 ||
    error.status >= 500
  );
}

export function payloadFromRecord(record) {
  return {
    clientId: record.clientId,
    farmId: record.farmId,
    activityType: record.activityType,
    activityDate: record.activityDate,
    description: record.description,
    inputUsed: record.inputUsed ?? null,
    quantity: record.quantity ?? null,
    unit: record.unit ?? null,
    notes: record.notes ?? null
  };
}

export function farmPayload(record) {
  return {
    clientId: record.clientId,
    farmName: record.farmName,
    farmType: record.farmType,
    county: record.county,
    district: record.district,
    community: record.community,
    mainCropOrLivestock: record.mainCropOrLivestock ?? null,
    description: record.description ?? null
  };
}

export function isLocalFarmId(farmId) {
  return typeof farmId === "string" && farmId.startsWith("local-");
}

function localFarmId(clientId) {
  return `local-${clientId}`;
}

export async function refreshFarms(userId, token) {
  const { farms } = await api.get("/api/farms", { token });
  await cacheFarms(userId, farms);
  return farms;
}

// Downloads the farmer's whole history so every record stays readable offline.
// If any page fails, nothing on the phone is replaced.
export async function refreshActivities(userId, token) {
  const items = [];
  const pageSize = 50;
  let page = 1;
  for (;;) {
    const result = await api.get(`/api/activities?page=${page}&pageSize=${pageSize}`, { token });
    items.push(...result.items);
    if (result.items.length < pageSize || items.length >= result.pagination.total) break;
    page += 1;
  }
  return replaceServerActivities(userId, items);
}

export async function saveNewFarm(userId, payload) {
  const now = new Date().toISOString();
  const farm = {
    ...payload,
    id: localFarmId(payload.clientId),
    activityCount: 0,
    syncStatus: "pending",
    syncError: null,
    createdAt: now,
    updatedAt: now
  };
  await upsertCachedFarm(userId, farm);
  await enqueueOperation(userId, {
    clientId: payload.clientId,
    entity: "farm",
    kind: "create",
    farmId: farm.id,
    payload: farmPayload(farm),
    enqueuedAt: Date.now()
  });
  return farm;
}

export async function saveFarmChanges(userId, farm, changes) {
  const current = (await getCachedFarm(userId, farm.id)) || farm;
  const updated = {
    ...current,
    ...changes,
    syncStatus: "pending",
    syncError: null,
    updatedAt: new Date().toISOString()
  };
  await upsertCachedFarm(userId, updated);

  const key = current.clientId || current.id;
  if (isLocalFarmId(updated.id)) {
    // Still local: fold the changes into the pending create.
    await enqueueOperation(userId, {
      clientId: key,
      entity: "farm",
      kind: "create",
      farmId: updated.id,
      payload: farmPayload(updated),
      enqueuedAt: Date.now()
    });
  } else {
    const existing = (await getQueue(userId)).find(
      (operation) => operation.entity === "farm" && operation.clientId === key
    );
    const merged = { ...(existing?.payload?.changes || {}), ...changes };
    await enqueueOperation(userId, {
      clientId: key,
      entity: "farm",
      kind: "update",
      farmId: updated.id,
      payload: { id: current.id, changes: merged },
      enqueuedAt: existing?.enqueuedAt || Date.now()
    });
  }
  return updated;
}

export async function retryFailedFarm(userId, farm) {
  const pending = { ...farm, syncStatus: "pending", syncError: null };
  await upsertCachedFarm(userId, pending);

  const key = farm.clientId || farm.id;
  if (isLocalFarmId(farm.id)) {
    await enqueueOperation(userId, {
      clientId: key,
      entity: "farm",
      kind: "create",
      farmId: farm.id,
      payload: farmPayload(farm),
      enqueuedAt: Date.now()
    });
  } else {
    await enqueueOperation(userId, {
      clientId: key,
      entity: "farm",
      kind: "update",
      farmId: farm.id,
      payload: { id: farm.id, changes: farmPayload(farm) },
      enqueuedAt: Date.now()
    });
  }
  return pending;
}

// Swaps a temp farm for its server record and moves anything pointing at the temp ID.
async function rekeyFarm(userId, localId, serverFarm) {
  await deleteCachedFarm(userId, localId);
  await upsertCachedFarm(userId, toLocal(serverFarm));

  const activities = await getActivities(userId);
  for (const activity of activities) {
    if (activity.farmId === localId) {
      await putActivity(userId, {
        ...activity,
        farmId: serverFarm.id,
        farmName: serverFarm.farmName
      });
    }
  }

  const operations = await getQueue(userId);
  for (const operation of operations) {
    // Only work records point at farms by temporary id; newer records use the
    // farm's clientId, which never changes.
    if (operation.entity) continue;
    const payload = operation.payload || {};
    const pointsAtLocal = payload.farmId === localId;
    const changePointsAtLocal = payload.changes?.farmId === localId;
    if (!pointsAtLocal && !changePointsAtLocal) continue;
    await enqueueOperation(userId, {
      ...operation,
      payload: {
        ...payload,
        ...(pointsAtLocal ? { farmId: serverFarm.id } : {}),
        ...(changePointsAtLocal ? { changes: { ...payload.changes, farmId: serverFarm.id } } : {})
      }
    });
  }

  const map = await getFarmIdMap(userId);
  await setFarmIdMap(userId, { ...map, [localId]: serverFarm.id });
}

export async function saveNewActivity(userId, payload, farmName) {
  const record = {
    ...payload,
    farmName,
    syncStatus: "pending",
    syncError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await putActivity(userId, record);
  await enqueueOperation(userId, {
    clientId: payload.clientId,
    kind: "create",
    payload,
    enqueuedAt: Date.now()
  });
  return record;
}

export async function saveActivityChanges(userId, record, changes) {
  const current = (await getActivity(userId, record.clientId)) || record;
  const updated = {
    ...current,
    ...changes,
    syncStatus: "pending",
    syncError: null,
    updatedAt: new Date().toISOString()
  };
  await putActivity(userId, updated);

  if (!current.id) {
    await enqueueOperation(userId, {
      clientId: updated.clientId,
      kind: "create",
      payload: payloadFromRecord(updated),
      enqueuedAt: Date.now()
    });
  } else {
    // Merge with an edit that has not been sent yet, so no change is lost.
    const existing = (await getQueue(userId)).find(
      (operation) =>
        !operation.entity &&
        operation.clientId === updated.clientId &&
        operation.kind === "update"
    );
    await enqueueOperation(userId, {
      clientId: updated.clientId,
      kind: "update",
      payload: { id: current.id, changes: { ...(existing?.payload?.changes || {}), ...changes } },
      enqueuedAt: existing?.enqueuedAt || Date.now()
    });
  }
  return updated;
}

export async function removeActivityEverywhere(userId, record) {
  if (!record.id) {
    await removeActivity(userId, record.clientId);
    await removeQueueOperation(userId, record.clientId);
    return;
  }
  await removeActivity(userId, record.clientId);
  await enqueueOperation(userId, {
    clientId: record.clientId,
    kind: "delete",
    payload: { id: record.id },
    enqueuedAt: Date.now()
  });
}

export async function retryActivityRecord(userId, record) {
  const payload = payloadFromRecord(record);
  await putActivity(userId, { ...record, syncStatus: "pending", syncError: null });
  if (record.id) {
    await enqueueOperation(userId, {
      clientId: record.clientId,
      kind: "update",
      payload: { id: record.id, changes: payload },
      enqueuedAt: Date.now()
    });
  } else {
    await enqueueOperation(userId, {
      clientId: record.clientId,
      kind: "create",
      payload,
      enqueuedAt: Date.now()
    });
  }
}

let flushing = false;

async function flushFarmOperation(userId, operation, token, onChange) {
  const local = await getCachedFarm(userId, operation.farmId);
  if (local) {
    await upsertCachedFarm(userId, { ...local, syncStatus: "syncing" });
    onChange?.();
  }

  try {
    if (operation.kind === "create") {
      const result = await api.post("/api/farms", operation.payload, { token });
      await rekeyFarm(userId, operation.farmId, result.farm);
    } else {
      const result = await api.patch(
        `/api/farms/${operation.payload.id}`,
        operation.payload.changes,
        { token }
      );
      await upsertCachedFarm(userId, toLocal(result.farm));
    }
    await removeQueueOperation(userId, operation.clientId);
    return "synced";
  } catch (error) {
    if (shouldPauseSync(error)) {
      if (local) await upsertCachedFarm(userId, { ...local, syncStatus: "pending" });
      return "halt";
    }
    const message = error instanceof ApiError ? error.message : "This farm could not be saved.";
    if (local) {
      await upsertCachedFarm(userId, { ...local, syncStatus: "failed", syncError: message });
    }
    await removeQueueOperation(userId, operation.clientId);
    return "failed";
  } finally {
    onChange?.();
  }
}

async function flushActivityOperation(userId, operation, token, onChange) {
  const local = await getActivity(userId, operation.clientId);
  if (local) {
    await putActivity(userId, { ...local, syncStatus: "syncing" });
    onChange?.();
  }

  try {
    if (operation.kind === "create") {
      const result = await api.post("/api/activities", operation.payload, { token });
      if (result.deleted) {
        // This record was deleted after an earlier send; keep it deleted.
        await removeActivity(userId, operation.clientId);
      } else {
        await putActivity(userId, toLocal(result.activity));
      }
      await removeQueueOperation(userId, operation.clientId);
    } else if (operation.kind === "update") {
      const result = await api.patch(
        `/api/activities/${operation.payload.id}`,
        operation.payload.changes,
        { token }
      );
      await putActivity(userId, toLocal(result.activity));
      await removeQueueOperation(userId, operation.clientId);
    } else if (operation.kind === "delete") {
      try {
        await api.delete(`/api/activities/${operation.payload.id}`, { token });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
      }
      await removeActivity(userId, operation.clientId);
      await removeQueueOperation(userId, operation.clientId);
    }
    return "synced";
  } catch (error) {
    if (shouldPauseSync(error)) {
      if (local) await putActivity(userId, { ...local, syncStatus: "pending" });
      return "halt";
    }
    if (local) {
      const message = error instanceof ApiError ? error.message : "This record could not be saved.";
      await putActivity(userId, { ...local, syncStatus: "failed", syncError: message });
    }
    await removeQueueOperation(userId, operation.clientId);
    return "failed";
  } finally {
    onChange?.();
  }
}

export async function flushQueue(userId, token, onChange) {
  if (flushing) return;
  flushing = true;
  try {
    // Farms go first so activities created against a temp farm can be re-pointed.
    const farmOperations = (await getQueue(userId)).filter(
      (operation) => operation.entity === "farm"
    );
    for (const operation of farmOperations) {
      if ((await flushFarmOperation(userId, operation, token, onChange)) === "halt") return;
    }

    const activityOperations = (await getQueue(userId)).filter((operation) => !operation.entity);
    for (const operation of activityOperations) {
      if ((await flushActivityOperation(userId, operation, token, onChange)) === "halt") return;
    }

    // Harvests, buyers, quality checks, sales, payments, expenses: parents first.
    const recordOperations = (await getQueue(userId))
      .filter((operation) => operation.entity === "record")
      .sort(
        (a, b) =>
          RECORD_ORDER.indexOf(a.resource) - RECORD_ORDER.indexOf(b.resource) ||
          a.enqueuedAt - b.enqueuedAt
      );
    for (const operation of recordOperations) {
      if ((await flushRecordOperation(userId, operation, token, onChange)) === "halt") return;
    }
  } finally {
    flushing = false;
    onChange?.();
  }
}

// ---------- Harvests, quality checks, buyers, sales, payments, expenses ----------
// Saved on the phone first, then sent. They point at their parents by
// clientId (harvestClientId, saleClientId, farmClientId…), so nothing needs
// re-pointing after a parent syncs; the queue just sends parents first.

export const RECORD_ORDER = ["harvests", "buyers", "inspections", "sales", "payments", "expenses"];

export async function refreshRecords(userId, token) {
  for (const kind of RECORD_ORDER) {
    const items = [];
    let page = 1;
    for (;;) {
      const result = await api.get(`/api/${kind}?page=${page}&pageSize=100`, { token });
      items.push(...result.items);
      if (result.items.length < 100 || items.length >= result.pagination.total) break;
      page += 1;
    }
    await replaceServerRecords(userId, kind, items);
  }
}

function recordPayload(record) {
  const {
    id,
    kind,
    syncStatus,
    syncError,
    createdAt,
    updatedAt,
    passportCode,
    ...payload
  } = record;
  return payload;
}

export async function saveNewRecord(userId, kind, payload) {
  const now = new Date().toISOString();
  const record = {
    ...payload,
    kind,
    syncStatus: "pending",
    syncError: null,
    createdAt: now,
    updatedAt: now
  };
  await putLocalRecord(userId, record);
  await enqueueOperation(userId, {
    clientId: payload.clientId,
    entity: "record",
    resource: kind,
    kind: "create",
    payload: recordPayload(record),
    enqueuedAt: Date.now()
  });
  return record;
}

export async function saveRecordChanges(userId, record, changes) {
  const current = (await getLocalRecord(userId, record.clientId)) || record;
  const updated = {
    ...current,
    ...changes,
    syncStatus: "pending",
    syncError: null,
    updatedAt: new Date().toISOString()
  };
  await putLocalRecord(userId, updated);
  const existing = (await getQueue(userId)).find((operation) => operation.clientId === updated.clientId);
  if (!current.id) {
    // Not on the server yet: fold the change into the pending create.
    await enqueueOperation(userId, {
      clientId: updated.clientId,
      entity: "record",
      resource: updated.kind,
      kind: "create",
      payload: recordPayload(updated),
      enqueuedAt: existing?.enqueuedAt || Date.now()
    });
  } else {
    await enqueueOperation(userId, {
      clientId: updated.clientId,
      entity: "record",
      resource: updated.kind,
      kind: "update",
      payload: { id: current.id, changes: { ...(existing?.payload?.changes || {}), ...changes } },
      enqueuedAt: existing?.enqueuedAt || Date.now()
    });
  }
  return updated;
}

export async function removeRecordEverywhere(userId, record) {
  await removeLocalRecord(userId, record.clientId);
  if (!record.id) {
    await removeQueueOperation(userId, record.clientId);
    return;
  }
  await enqueueOperation(userId, {
    clientId: record.clientId,
    entity: "record",
    resource: record.kind,
    kind: "delete",
    payload: { id: record.id },
    enqueuedAt: Date.now()
  });
}

export async function retryRecord(userId, record) {
  await putLocalRecord(userId, { ...record, syncStatus: "pending", syncError: null });
  await enqueueOperation(userId, {
    clientId: record.clientId,
    entity: "record",
    resource: record.kind,
    kind: record.id ? "update" : "create",
    payload: record.id ? { id: record.id, changes: recordPayload(record) } : recordPayload(record),
    enqueuedAt: Date.now()
  });
}

async function flushRecordOperation(userId, operation, token, onChange) {
  const local = await getLocalRecord(userId, operation.clientId);
  const path = `/api/${operation.resource}`;
  if (local) {
    await putLocalRecord(userId, { ...local, syncStatus: "syncing" });
    onChange?.();
  }
  try {
    if (operation.kind === "create") {
      const result = await api.post(path, operation.payload, { token });
      if (result.deleted) await removeLocalRecord(userId, operation.clientId);
      else await putLocalRecord(userId, { ...result.record, kind: operation.resource, syncStatus: "synced", syncError: null });
    } else if (operation.kind === "update") {
      const result = await api.patch(`${path}/${operation.payload.id}`, operation.payload.changes, { token });
      await putLocalRecord(userId, { ...result.record, kind: operation.resource, syncStatus: "synced", syncError: null });
    } else {
      try {
        await api.delete(`${path}/${operation.payload.id}`, { token });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
      }
      await removeLocalRecord(userId, operation.clientId);
    }
    await removeQueueOperation(userId, operation.clientId);
    return "synced";
  } catch (error) {
    if (shouldPauseSync(error)) {
      if (local) await putLocalRecord(userId, { ...local, syncStatus: "pending" });
      return "halt";
    }
    // Its parent is not on the server yet (it may be waiting or need help).
    // Keep this one waiting and carry on with the rest.
    if (error instanceof ApiError && error.code === "PARENT_NOT_SYNCED") {
      if (local) await putLocalRecord(userId, { ...local, syncStatus: "pending" });
      return "waiting";
    }
    const message = error instanceof ApiError ? error.message : "This record could not be saved.";
    if (local) await putLocalRecord(userId, { ...local, syncStatus: "failed", syncError: message });
    await removeQueueOperation(userId, operation.clientId);
    return "failed";
  } finally {
    onChange?.();
  }
}
