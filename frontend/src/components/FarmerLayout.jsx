import { ClipboardList, CircleCheck, CloudOff, CloudUpload, House, Loader2, Sprout, UserRound } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import Brand from "./Brand.jsx";

const NAV = [
  { to: "/app", label: "Home", Icon: House, end: true },
  { to: "/app/farms", label: "My Farms", Icon: Sprout },
  { to: "/app/history", label: "Records", Icon: ClipboardList },
  { to: "/app/profile", label: "Profile", Icon: UserRound }
];

export default function FarmerLayout() {
  const { syncing, online, pendingCount } = useSync();
  const { needsOnlineSignIn } = useAuth();

  const syncState = syncing
    ? { label: "Saving", Icon: Loader2, tone: "bg-sky-50 text-sky-700" }
    : needsOnlineSignIn
      ? online
        ? { label: "Sign in to sync", Icon: CloudUpload, tone: "bg-warning/10 text-amber-700" }
        : { label: "Offline", Icon: CloudOff, tone: "bg-warning/10 text-amber-700" }
      : !online
        ? { label: "Offline", Icon: CloudOff, tone: "bg-warning/10 text-amber-700" }
        : pendingCount > 0
          ? { label: `${pendingCount} to sync`, Icon: CloudUpload, tone: "bg-warning/10 text-amber-700" }
          : { label: "Saved", Icon: CircleCheck, tone: "bg-success/10 text-success" };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Brand to="/app" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-primary-soft text-primary-dark"
                      : "text-ink-soft hover:bg-white hover:text-primary"
                  }`
                }
              >
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </nav>
          <Link
            to={needsOnlineSignIn && online ? "/login" : "/app/sync"}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ${syncState.tone}`}
            aria-label={`Sync status: ${syncState.label}`}
          >
            <syncState.Icon size={15} className={syncing ? "animate-spin" : ""} />
            {syncState.label}
          </Link>
        </div>
      </header>

      {needsOnlineSignIn && online && (
        <div className="border-b border-warning/30 bg-warning/10">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 md:px-6">
            <p className="text-xs font-medium leading-relaxed text-amber-900">
              You are back online. Sign in again to send the records saved on this phone to your
              account.
            </p>
            <Link
              to="/login"
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-amber-900 shadow-card hover:bg-amber-100"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-5 md:pb-12 md:pt-8">
        <Outlet />
      </main>

      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur safe-bottom md:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition ${
                  isActive ? "text-primary" : "text-ink-soft hover:text-primary"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
