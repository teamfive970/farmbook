import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { getActivities, getAllRecords, getCachedFarms, getFarmIdMap } from "../lib/localStore.js";
import { refreshActivities, refreshFarms, refreshRecords } from "../lib/syncEngine.js";

const EMPTY_RECORDS = {
  harvests: [],
  inspections: [],
  buyers: [],
  sales: [],
  payments: [],
  expenses: []
};

function groupRecords(list) {
  const grouped = { harvests: [], inspections: [], buyers: [], sales: [], payments: [], expenses: [] };
  for (const record of list) if (grouped[record.kind]) grouped[record.kind].push(record);
  const byDate = (field) => (a, b) =>
    String(b[field] || "").localeCompare(String(a[field] || "")) ||
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  grouped.harvests.sort(byDate("harvestDate"));
  grouped.inspections.sort(byDate("inspectionDate"));
  grouped.sales.sort(byDate("saleDate"));
  grouped.payments.sort(byDate("paidDate"));
  grouped.expenses.sort(byDate("expenseDate"));
  grouped.buyers.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return grouped;
}

export function useFarmerData() {
  const { user, token } = useAuth();
  const { online, version } = useSync();
  const [activities, setActivities] = useState([]);
  const [farms, setFarms] = useState([]);
  const [farmIdMap, setFarmIdMap] = useState({});
  const [records, setRecords] = useState(EMPTY_RECORDS);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState(null);

  const loadLocal = useCallback(async () => {
    if (!user) return;
    const [localActivities, cachedFarms, idMap, localRecords] = await Promise.all([
      getActivities(user.id),
      getCachedFarms(user.id),
      getFarmIdMap(user.id),
      getAllRecords(user.id)
    ]);
    setActivities(localActivities);
    setFarms(cachedFarms);
    setFarmIdMap(idMap);
    setRecords(groupRecords(localRecords));
    setLoading(false);
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user || !token || !online) return;
    try {
      await Promise.all([
        refreshFarms(user.id, token),
        refreshActivities(user.id, token),
        refreshRecords(user.id, token)
      ]);
      await loadLocal();
      setRefreshError(null);
    } catch (error) {
      setRefreshError(error);
    }
  }, [user, token, online, loadLocal]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) return;
      const [localActivities, cachedFarms, idMap, localRecords] = await Promise.all([
        getActivities(user.id),
        getCachedFarms(user.id),
        getFarmIdMap(user.id),
        getAllRecords(user.id)
      ]);
      if (!active) return;
      setActivities(localActivities);
      setFarms(cachedFarms);
      setFarmIdMap(idMap);
      setRecords(groupRecords(localRecords));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user, version]);

  const lastRefreshKey = useRef("");
  useEffect(() => {
    if (!user) return;
    const key = `${user.id}:${version}`;
    if (lastRefreshKey.current === key) return;
    lastRefreshKey.current = key;
    refresh();
  }, [refresh, version, user?.id]);

  return { activities, farms, farmIdMap, records, loading, refreshError, reload: refresh };
}
