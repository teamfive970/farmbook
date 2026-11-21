import { api, ApiError } from "./api.js";
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

export async function refreshActivities(userId, token) {
  const items = [];
  let page = 1;
  while (page <= 5) {
    const result = await api.get(`/api/activities?page=${page}&pageSize=50`, { token });
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.pagination.total) break;
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
    if (operation.entity !== "farm" && operation.payload?.farmId === localId) {
      await enqueueOperation(userId, {
        ...operation,
        payload: { ...operation.payload, farmId: serverFarm.id }
      });
    }
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
    await enqueueOperation(userId, {
      clientId: updated.clientId,
      kind: "update",
      payload: { id: current.id, changes },
      enqueuedAt: Date.now()
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
    if (
      error instanceof ApiError &&
      (error.isNetworkError || error.status === 401 || error.status === 403)
    ) {
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
      await putActivity(userId, toLocal(result.activity));
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
    if (
      error instanceof ApiError &&
      (error.isNetworkError || error.status === 401 || error.status === 403)
    ) {
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

    const activityOperations = (await getQueue(userId)).filter(
      (operation) => operation.entity !== "farm"
    );
    for (const operation of activityOperations) {
      if ((await flushActivityOperation(userId, operation, token, onChange)) === "halt") return;
    }
  } finally {
    flushing = false;
    onChange?.();
  }
}
