import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getFailedRecords, getQueue, requestPersistentStorage } from "../lib/localStore.js";
import {
  flushQueue,
  removeActivityEverywhere,
  removeRecordEverywhere,
  retryRecord,
  saveNewRecord,
  saveRecordChanges,
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
    setPendingCount(
      queue.length + failed.activities.length + failed.farms.length + failed.records.length
    );
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

  // Keep the farmer's records even when the phone runs low on space.
  useEffect(() => {
    if (user?.role === "farmer") requestPersistentStorage();
  }, [user?.id, user?.role]);

  // Paused sends (weak signal, busy server) are retried on their own: every
  // minute while something is waiting, and whenever the app is opened again.
  const syncRef = useRef(syncNow);
  syncRef.current = syncNow;
  useEffect(() => {
    if (!user || !token) return undefined;
    const tryAgain = async () => {
      if (!navigator.onLine) return;
      const queue = await getQueue(user.id).catch(() => []);
      if (queue.length > 0) syncRef.current();
    };
    const timer = window.setInterval(tryAgain, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tryAgain();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, token]);

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
      },
      // Harvests, quality checks, buyers, sales, payments, expenses.
      async createRecord(kind, payload) {
        const record = await saveNewRecord(user.id, kind, payload);
        bump();
        await refreshPending();
        if (online) syncNow();
        return record;
      },
      async updateRecord(record, changes) {
        const updated = await saveRecordChanges(user.id, record, changes);
        bump();
        await refreshPending();
        if (online) syncNow();
        return updated;
      },
      async deleteRecord(record) {
        await removeRecordEverywhere(user.id, record);
        bump();
        await refreshPending();
        if (online) syncNow();
      },
      async retryRecord(record) {
        await retryRecord(user.id, record);
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
