import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getFailedRecords, getQueue } from "../lib/localStore.js";
import {
  flushQueue,
  removeActivityEverywhere,
  retryActivityRecord,
  retryFailedFarm,
  saveActivityChanges,
  saveFarmChanges,
  saveNewActivity,
  saveNewFarm
} from "../lib/syncEngine.js";
import { useAuth } from "./AuthContext.jsx";

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const { user, token } = useAuth();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [version, setVersion] = useState(0);
  const running = useRef(false);

  const bump = useCallback(() => setVersion((value) => value + 1), []);

  const refreshPending = useCallback(async () => {
    if (!user) {
      setPendingCount(0);
      return;
    }
    const [queue, failed] = await Promise.all([getQueue(user.id), getFailedRecords(user.id)]);
    setPendingCount(queue.length + failed.activities.length + failed.farms.length);
  }, [user]);

  const syncNow = useCallback(async () => {
    if (!user || !token || running.current) return;
    running.current = true;
    setSyncing(true);
    try {
      await flushQueue(user.id, token, bump);
    } catch {
      // Network problems leave the queue intact for the next attempt.
    } finally {
      running.current = false;
      setSyncing(false);
      await refreshPending();
      bump();
    }
  }, [user, token, refreshPending, bump]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending, version]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (online && user && token) syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, user?.id, token]);

  const value = useMemo(
    () => ({
      online,
      pendingCount,
      syncing,
      version,
      syncNow,
      async createActivity(payload, farmName) {
        const record = await saveNewActivity(user.id, payload, farmName);
        bump();
        await refreshPending();
        if (online) syncNow();
        return record;
      },
      async updateActivity(record, changes) {
        const updated = await saveActivityChanges(user.id, record, changes);
        bump();
        await refreshPending();
        if (online) syncNow();
        return updated;
      },
      async deleteActivity(record) {
        await removeActivityEverywhere(user.id, record);
        bump();
        await refreshPending();
        if (online) syncNow();
      },
      async retryActivity(record) {
        await retryActivityRecord(user.id, record);
        bump();
        await refreshPending();
        if (online) syncNow();
      },
      async createFarm(payload) {
        const farm = await saveNewFarm(user.id, payload);
        bump();
        await refreshPending();
        if (online) syncNow();
        return farm;
      },
      async updateFarm(farm, changes) {
        const updated = await saveFarmChanges(user.id, farm, changes);
        bump();
        await refreshPending();
        if (online) syncNow();
        return updated;
      },
      async retryFarm(farm) {
        await retryFailedFarm(user.id, farm);
        bump();
        await refreshPending();
        if (online) syncNow();
      }
    }),
    [online, pendingCount, syncing, version, syncNow, refreshPending, bump, user]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used inside SyncProvider");
  return context;
}
