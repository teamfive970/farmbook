import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { PageLoading } from "./ui.jsx";

export function PublicOnly() {
  const { user, offline } = useAuth();
  // An offline-only session may revisit /login to reconnect and sync.
  if (user && !offline) return <Navigate to={user.role === "admin" ? "/admin" : "/app"} replace />;
  return <Outlet />;
}

export default function RequireRole({ role }) {
  const { user, token, checking, offline } = useAuth();
  const location = useLocation();

  if (!user && checking) return <PageLoading label="Checking your account…" />;
  if (!user || (!token && !offline)) {
    return (
      <Navigate
        to={role === "admin" ? "/admin/login" : "/login"}
        replace
        state={{ from: location.pathname }}
      />
    );
  }
  if (user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/app"} replace />;
  }
  return <Outlet />;
}
