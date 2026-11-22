import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import {
  forgetOfflineLogin,
  normalizeIdentifier,
  offlineSignInAvailable,
  refreshOfflineProfile,
  rememberOfflineLogin,
  signInOffline
} from "../lib/offlineAuth.js";
import { clearGroupCaches } from "../lib/groupCache.js";
import { deleteLocalData, hasUnsentWork, moveLocalData } from "../lib/localStore.js";
import {
  createPendingRegistration,
  dropPendingRegistration,
  findPendingByPhone,
  getPendingRegistration,
  pendingUserFrom,
  registrationPayload,
  savePendingRegistration
} from "../lib/pendingRegistration.js";
import {
  clearUnlocked,
  dropProfile,
  isUnlocked,
  markUnlocked,
  profileList,
  readProfiles,
  saveProfile,
  setProfileToken
} from "../lib/profiles.js";

const STORAGE_KEY = "minders.session";

const AuthContext = createContext(null);

// Offline is a core feature: once a farmer has signed in on this phone they stay
// signed in, with or without a connection, until they choose to sign out.
//  * No connection or a server problem never signs anyone out.
//  * If the server says the session is no longer valid (PIN changed elsewhere,
//    PIN reset by a helper), a farmer keeps working offline with their saved
//    records; the app asks for the PIN only to send records online again.
//  * Only a deactivated account, or the farmer pressing Sign out, ends it.

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
  if (user?.role === "farmer") saveProfile(user, token, offline);
  try {
    if (user && (token || offline)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user, offline }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be full or blocked; the in-memory session still works.
  }
}

// Errors that mean "the server could not be reached or had a problem", not
// "your account is not valid". These must never end a farmer's session.
export function isServerUnavailable(error) {
  return (
    error instanceof ApiError &&
    (error.isNetworkError || error.status === 408 || error.status === 429 || error.status >= 500)
  );
}

// A number that already lives on this phone must not get a second local
// account; the farmer should sign in to the saved one instead.
function phoneSavedOnDevice(phoneNumber) {
  const key = normalizeIdentifier(phoneNumber);
  if (!key) return false;
  const saved = Object.values(readProfiles()).some(
    (profile) => normalizeIdentifier(profile.user?.phoneNumber) === key
  );
  return saved || Boolean(findPendingByPhone(phoneNumber));
}

export function AuthProvider({ children }) {
  const [session] = useState(readStoredSession);
  const [token, setToken] = useState(session.token);
  const [user, setUserState] = useState(session.user);
  const [offline, setOffline] = useState(session.offline);
  const [checking, setChecking] = useState(Boolean(session.token));
  const [profiles, setProfiles] = useState(() => {
    if (session.user?.role === "farmer") saveProfile(session.user, session.token, session.offline);
    return profileList();
  });
  // Shared phone: with more than one person saved here, ask who is using it
  // each time the app is opened (a page reload in the same tab stays open).
  const [locked, setLocked] = useState(
    () =>
      session.user?.role === "farmer" &&
      profileList().length > 1 &&
      !isUnlocked(session.user.id)
  );
  const userRef = useRef(user);
  userRef.current = user;
  const refreshProfiles = useCallback(() => setProfiles(profileList()), []);

  const applySession = useCallback((nextToken, nextUser, nextOffline = false) => {
    const isOffline = Boolean(nextOffline) && !nextToken;
    setToken(nextToken || null);
    setUserState(nextUser);
    setOffline(isOffline);
    persistSession(nextToken || null, nextUser, isOffline);
    if (nextUser) markUnlocked(nextUser.id);
    setLocked(false);
    setProfiles(profileList());
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setUserState(null);
    setOffline(false);
    persistSession(null, null, false);
  }, []);

  // The server no longer accepts this phone's session. A farmer keeps their
  // profile and records and carries on offline; an admin must sign in again.
  const handleSessionRejected = useCallback(() => {
    const current = userRef.current;
    if (current?.role === "farmer") {
      setToken(null);
      setOffline(true);
      setProfileToken(current.id, null);
      persistSession(null, current, true);
    } else {
      clearSession();
    }
  }, [clearSession]);

  const handleAccountInactive = useCallback(() => {
    const current = userRef.current;
    if (current?.phoneNumber) forgetOfflineLogin(current.phoneNumber).catch(() => {});
    if (current) dropProfile(current.id);
    setProfiles(profileList());
    clearSession();
  }, [clearSession]);

  // ---------- Accounts made with no network ----------
  // The account lives only on this phone until the farmer sends it with the
  // PIN. No PIN and no recovery answer are stored; the offline verifier is
  // enough to check the PIN when the account is sent.

  const startPendingRegistration = useCallback(
    async (payload) => {
      if (!/^\d{4,6}$/.test(String(payload?.pin || ""))) {
        throw new ApiError(400, "INVALID_PIN", "Choose a PIN of 4 to 6 numbers.", {
          field: "pin"
        });
      }
      if (!offlineSignInAvailable()) {
        throw new ApiError(
          0,
          "OFFLINE_REGISTRATION_UNAVAILABLE",
          "This phone cannot save an account without a connection. Connect to the internet to make your account."
        );
      }
      if (phoneSavedOnDevice(payload.phoneNumber)) {
        throw new ApiError(
          409,
          "PHONE_SAVED_ON_PHONE",
          "This phone number is already saved on this phone. Sign in with it instead.",
          { field: "phoneNumber" }
        );
      }
      const record = createPendingRegistration({
        fullName: payload.fullName,
        phoneNumber: payload.phoneNumber,
        county: payload.county,
        district: payload.district,
        community: payload.community
      });
      const pendingUser = pendingUserFrom(record);
      try {
        savePendingRegistration(record);
        await rememberOfflineLogin(record.phoneNumber, payload.pin, pendingUser);
      } catch {
        dropPendingRegistration(record.id);
        throw new ApiError(
          0,
          "OFFLINE_REGISTRATION_UNAVAILABLE",
          "This phone cannot save an account without a connection. Connect to the internet to make your account."
        );
      }
      applySession(null, pendingUser, true);
      return pendingUser;
    },
    [applySession]
  );

  const finishPendingRegistration = useCallback(
    async (record, pin, nextToken, serverUser) => {
      try {
        await moveLocalData(record.id, serverUser.id);
      } catch {
        throw new ApiError(
          0,
          "LOCAL_MOVE_FAILED",
          "Your account was made, but the work on this phone could not be moved yet. Try sending it again."
        );
      }
      dropPendingRegistration(record.id);
      dropProfile(record.id);
      await rememberOfflineLogin(record.phoneNumber, pin, serverUser).catch(() => {});
      applySession(nextToken, serverUser);
      return serverUser;
    },
    [applySession]
  );

  // Used when the number already has an account and the farmer enters that
  // account's PIN. The server has the final say, so a PIN that opens the real
  // account is never blocked by the account made on this phone.
  const adoptPendingWithPin = useCallback(
    async (record, pin) => {
      const result = await api.post("/api/auth/login", {
        identifier: record.phoneNumber,
        pin
      });
      return finishPendingRegistration(record, pin, result.token, result.user);
    },
    [finishPendingRegistration]
  );

  // Sends a pending account. The PIN is checked against this phone's verifier
  // first, so another person holding the phone cannot send it with a new PIN.
  // If the number already has an account, it is adopted only when the same PIN
  // opens it; otherwise nothing is uploaded.
  const sendPendingRegistration = useCallback(
    async (pin, userId) => {
      const targetId = userId || userRef.current?.id;
      let record = targetId ? getPendingRegistration(targetId) : null;
      if (!record && userRef.current?.phoneNumber) {
        record = findPendingByPhone(userRef.current.phoneNumber);
      }
      if (!record) {
        throw new ApiError(
          404,
          "PENDING_NOT_FOUND",
          "This account is not saved on this phone any more."
        );
      }

      let pinMatchesPhone = true;
      try {
        await signInOffline(record.phoneNumber, pin);
      } catch (error) {
        // The PIN does not match the account made on this phone. It may be the
        // PIN of the account that already has this number; the server decides.
        if (!navigator.onLine || error.code !== "INVALID_CREDENTIALS") throw error;
        pinMatchesPhone = false;
      }
      if (!pinMatchesPhone) return adoptPendingWithPin(record, pin);

      let result;
      try {
        result = await api.post("/api/auth/register", registrationPayload(record, pin));
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error;
        let adopted;
        try {
          adopted = await api.post("/api/auth/login", {
            identifier: record.phoneNumber,
            pin
          });
        } catch (loginError) {
          if (
            loginError instanceof ApiError &&
            (loginError.status === 401 || loginError.code === "INVALID_CREDENTIALS")
          ) {
            throw new ApiError(
              409,
              "PHONE_TAKEN_DIFFERENT_PIN",
              "This phone number already has an account with a different PIN. Sign in with that account, or make your account with another number.",
              { field: "phoneNumber" }
            );
          }
          throw loginError;
        }
        return finishPendingRegistration(record, pin, adopted.token, adopted.user);
      }
      return finishPendingRegistration(record, pin, result.token, result.user);
    },
    [adoptPendingWithPin, finishPendingRegistration]
  );

  const setUser = useCallback(
    (nextUser) => {
      setUserState(nextUser);
      persistSession(token, nextUser, offline);
      if (nextUser?.role === "farmer") refreshOfflineProfile(nextUser).catch(() => {});
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
        persistSession(token, freshUser, false);
        if (freshUser?.role === "farmer") refreshOfflineProfile(freshUser).catch(() => {});
      })
      .catch(() => {
        // 401 and inactive accounts are handled by the global events below;
        // anything else (offline, server down) keeps the farmer signed in.
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    window.addEventListener("minders:session-expired", handleSessionRejected);
    window.addEventListener("minders:account-inactive", handleAccountInactive);
    return () => {
      window.removeEventListener("minders:session-expired", handleSessionRejected);
      window.removeEventListener("minders:account-inactive", handleAccountInactive);
    };
  }, [handleSessionRejected, handleAccountInactive]);

  const login = useCallback(
    async (identifier, pin) => {
      // Entering the PIN for an account that was made offline is how that
      // account is sent, once the phone has network again.
      const pending = findPendingByPhone(identifier);
      if (pending) {
        if (navigator.onLine) {
          try {
            return await sendPendingRegistration(pin, pending.id);
          } catch (error) {
            // The phone thinks it has network but the send could not go
            // through. The farmer still gets in and keeps working offline.
            if (!isServerUnavailable(error)) throw error;
          }
        }
        const localUser = await signInOffline(identifier, pin);
        applySession(null, localUser, true);
        return localUser;
      }
      let result;
      try {
        result = await api.post("/api/auth/login", { identifier, pin });
      } catch (error) {
        if (error instanceof ApiError && error.code === "ACCOUNT_INACTIVE") {
          await forgetOfflineLogin(identifier).catch(() => {});
          throw error;
        }
        // No connection or the server is having trouble: check the PIN this
        // phone remembers so the farmer can keep working.
        if (!isServerUnavailable(error) || error.code === "ACCOUNT_LOCKED") throw error;
        let localUser;
        try {
          localUser = await signInOffline(identifier, pin);
        } catch (offlineError) {
          // A phone that has never signed in should still see the server's
          // problem rather than an offline message when it is online.
          if (offlineError.code === "OFFLINE_SIGN_IN_UNAVAILABLE" && !error.isNetworkError) {
            throw error;
          }
          throw offlineError;
        }
        applySession(null, localUser, true);
        return localUser;
      }
      await rememberOfflineLogin(identifier, pin, result.user).catch(() => {});
      applySession(result.token, result.user);
      return result.user;
    },
    [applySession, sendPendingRegistration]
  );

  const register = useCallback(
    async (payload) => {
      let result;
      try {
        result = await api.post("/api/auth/register", payload);
      } catch (error) {
        // Only a phone with no connection falls back to a local account. A
        // server error must be shown, not turned into a second account.
        if (!(error instanceof ApiError) || !error.isNetworkError) throw error;
        return startPendingRegistration(payload);
      }
      await rememberOfflineLogin(payload.phoneNumber, payload.pin, result.user).catch(() => {});
      applySession(result.token, result.user);
      return result.user;
    },
    [applySession, startPendingRegistration]
  );

  const logout = useCallback(async () => {
    try {
      if (token) await api.post("/api/auth/logout", undefined, { token });
    } catch {
      // Signing out must work even without a connection.
    }
    // The offline PIN check is kept so the farmer can sign in again offline;
    // the saved session is not.
    if (userRef.current?.role === "farmer") setProfileToken(userRef.current.id, null);
    clearUnlocked();
    clearSession();
    setProfiles(profileList());
  }, [token, clearSession]);

  // ---------- Shared phone ----------

  // Hand the phone to someone else: the current person's session stays saved
  // (their PIN is needed to come back).
  const lock = useCallback(() => {
    clearUnlocked();
    setProfiles(profileList());
    setLocked(true);
  }, []);

  const unlockProfile = useCallback(
    async (userId, pin) => {
      const profile = readProfiles()[userId];
      if (!profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "This person is not saved on this phone.");
      const phone = profile.user.phoneNumber;
      if (profile.user.pendingRegistration) {
        if (navigator.onLine) {
          try {
            return await sendPendingRegistration(pin, userId);
          } catch (error) {
            if (!isServerUnavailable(error)) throw error;
          }
        }
        const localUser = await signInOffline(phone, pin);
        applySession(null, localUser, true);
        return localUser;
      }
      let localUser = null;
      try {
        localUser = await signInOffline(phone, pin);
      } catch (error) {
        // The phone has no PIN check for this person, or the PIN was changed on
        // another phone: ask the server when there is network.
        const canAskServer =
          navigator.onLine &&
          (error.code === "OFFLINE_SIGN_IN_UNAVAILABLE" || error.code === "INVALID_CREDENTIALS");
        if (!canAskServer) throw error;
        return login(phone, pin);
      }
      let nextToken = profile.token;
      if (!nextToken && navigator.onLine) {
        try {
          const result = await api.post("/api/auth/login", { identifier: phone, pin });
          nextToken = result.token;
          localUser = result.user;
          await rememberOfflineLogin(phone, pin, result.user).catch(() => {});
        } catch {
          // Keep going offline; the app asks for the PIN again to send work.
        }
      }
      const nextUser = { ...profile.user, ...localUser };
      applySession(nextToken || null, nextUser, !nextToken);
      return nextUser;
    },
    [applySession, login, sendPendingRegistration]
  );

  // Take a person off this phone. Refused while they still have work that
  // has not been sent, so nothing is lost.
  const removeProfile = useCallback(
    async (userId, pin) => {
      const profile = readProfiles()[userId];
      if (!profile) return;
      await signInOffline(profile.user.phoneNumber, pin);
      if (await hasUnsentWork(userId)) {
        throw new ApiError(
          409,
          "UNSENT_WORK",
          "Some of this person's work is still on the phone. Send it first, when network come."
        );
      }
      if (profile.token) {
        api.post("/api/auth/logout", undefined, { token: profile.token }).catch(() => {});
      }
      await forgetOfflineLogin(profile.user.phoneNumber).catch(() => {});
      await deleteLocalData(userId).catch(() => {});
      clearGroupCaches(userId);
      dropPendingRegistration(userId);
      dropProfile(userId);
      if (userRef.current?.id === userId) {
        clearUnlocked();
        clearSession();
      }
      refreshProfiles();
    },
    [clearSession, refreshProfiles]
  );

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
      establishSession: applySession,
      // Shared phone
      locked,
      profiles,
      lock,
      unlockProfile,
      removeProfile
    }),
    [
      token,
      user,
      checking,
      offline,
      login,
      register,
      logout,
      clearSession,
      setUser,
      applySession,
      locked,
      profiles,
      lock,
      unlockProfile,
      removeProfile
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
