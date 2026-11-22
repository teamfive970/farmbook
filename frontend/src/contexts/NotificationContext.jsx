import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { readInbox } from "../lib/notificationCache.js";
import { useAuth } from "./AuthContext.jsx";
import { useSync } from "./SyncContext.jsx";

// How many unread messages the farmer has, for the bell. Asks the server
// every two minutes while online and whenever the app comes back to the
// front; without network it shows the count from the last saved inbox.
const NotificationContext = createContext({ unread: 0, setUnread: () => {}, refresh: () => {} });

const POLL_MS = 120_000;

export function NotificationProvider({ children }) {
  const { user, token } = useAuth();
  const { online } = useSync();
  const userId = user?.id;
  const canAsk = Boolean(userId && token && online && !user?.pendingRegistration);
  const [unread, setUnread] = useState(() => readInbox(userId)?.unreadCount || 0);

  useEffect(() => {
    setUnread(readInbox(userId)?.unreadCount || 0);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!canAsk) return;
    try {
      const result = await api.get("/api/notifications/unread-count", { token });
      setUnread(Number(result?.unreadCount) || 0);
    } catch {
      // Keep the last number; the next poll tries again.
    }
  }, [canAsk, token]);

  useEffect(() => {
    if (!canAsk) return undefined;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onShow = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [canAsk, refresh]);

  const value = useMemo(() => ({ unread, setUnread, refresh }), [unread, refresh]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationContext);
}
