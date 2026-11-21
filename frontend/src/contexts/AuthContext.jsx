import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { rememberOfflineLogin, signInOffline } from "../lib/offlineAuth.js";

const STORAGE_KEY = "minders.session";

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null, offline: false };
    const parsed = JSON.parse(raw);
    return {
      token: parsed.token || null,
      user: parsed.user || null,
      offline: Boolean(parsed.offline) && !parsed.token
    };
  } catch {
    return { token: null, user: null, offline: false };
  }
}

function persistSession(token, user, offline) {
  if (user && (token || offline)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user, offline }));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }) {
  const [session] = useState(readStoredSession);
  const [token, setToken] = useState(session.token);
  const [user, setUserState] = useState(session.user);
  const [offline, setOffline] = useState(session.offline);
  const [checking, setChecking] = useState(Boolean(session.token));

  const applySession = useCallback((nextToken, nextUser, nextOffline = false) => {
    setToken(nextToken || null);
    setUserState(nextUser);
    setOffline(Boolean(nextOffline) && !nextToken);
    persistSession(nextToken || null, nextUser, Boolean(nextOffline) && !nextToken);
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setUserState(null);
    setOffline(false);
    persistSession(null, null, false);
  }, []);

  const setUser = useCallback(
    (nextUser) => {
      setUserState(nextUser);
      persistSession(token, nextUser, offline);
    },
    [token, offline]
  );

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return undefined;
    }
    let active = true;
    setChecking(true);
    api
      .get("/api/auth/me", { token })
      .then(({ user: freshUser }) => {
        if (!active) return;
        setUserState(freshUser);
        persistSession(token, freshUser);
      })
      .catch((error) => {
        if (!active) return;
        // Offline: keep the cached farmer signed in so records stay accessible.
        if (error instanceof ApiError && !error.isNetworkError) clearSession();
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [token, clearSession]);

  useEffect(() => {
    const handleExpired = () => clearSession();
    window.addEventListener("minders:session-expired", handleExpired);
    return () => window.removeEventListener("minders:session-expired", handleExpired);
  }, [clearSession]);

  const login = useCallback(
    async (identifier, pin) => {
      let result;
      try {
        result = await api.post("/api/auth/login", { identifier, pin });
      } catch (error) {
        if (!(error instanceof ApiError) || !error.isNetworkError) throw error;
        // No connection: verify against the PIN this phone remembers.
        const localUser = await signInOffline(identifier, pin);
        applySession(null, localUser, true);
        return localUser;
      }
      await rememberOfflineLogin(identifier, pin, result.user).catch(() => {});
      applySession(result.token, result.user);
      return result.user;    },
    [applySession]
  );

  const register = useCallback(
    async (payload) => {
      const result = await api.post("/api/auth/register", payload);
      await rememberOfflineLogin(payload.phoneNumber, payload.pin, result.user).catch(() => {});
      applySession(result.token, result.user);
      return result.user;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      if (token) await api.post("/api/auth/logout", undefined, { token });
    } catch {
      // Signing out must work even without a connection.
    }
    clearSession();
  }, [token, clearSession]);

  const value = useMemo(
    () => ({
      token,
      user,
      checking,
      offline,
      needsOnlineSignIn: Boolean(user) && !token,
      login,
      register,
      logout,
      clearSession,
      setUser,
      establishSession: applySession
    }),
    [token, user, checking, offline, login, register, logout, clearSession, setUser, applySession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
