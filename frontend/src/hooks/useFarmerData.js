import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { getActivities, getCachedFarms, getFarmIdMap } from "../lib/localStore.js";
import { refreshActivities, refreshFarms } from "../lib/syncEngine.js";

export function useFarmerData() {
  const { user, token } = useAuth();
  const { online, version } = useSync();
  const [activities, setActivities] = useState([]);
  const [farms, setFarms] = useState([]);
  const [farmIdMap, setFarmIdMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState(null);

  const loadLocal = useCallback(async () => {
    if (!user) return;
    const [localActivities, cachedFarms, idMap] = await Promise.all([
      getActivities(user.id),
      getCachedFarms(user.id),
      getFarmIdMap(user.id)
    ]);
    setActivities(localActivities);
    setFarms(cachedFarms);
    setFarmIdMap(idMap);
    setLoading(false);
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user || !token || !online) return;
    try {
      await Promise.all([refreshFarms(user.id, token), refreshActivities(user.id, token)]);
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
      const [localActivities, cachedFarms, idMap] = await Promise.all([
        getActivities(user.id),
        getCachedFarms(user.id),
        getFarmIdMap(user.id)
      ]);
      if (!active) return;
      setActivities(localActivities);
      setFarms(cachedFarms);
      setFarmIdMap(idMap);
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

  return { activities, farms, farmIdMap, loading, refreshError, reload: refresh };
}
