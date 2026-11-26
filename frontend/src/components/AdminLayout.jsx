import { LayoutDashboard, LogOut, Megaphone, Network, PhoneCall, ScrollText, Settings, Users } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import Brand from "./Brand.jsx";

const NAV = [
  { to: "/admin", label: "Overview", Icon: LayoutDashboard, end: true },
  { to: "/admin/farmers", label: "Farmers", Icon: Users },
  { to: "/admin/cooperatives", label: "Cooperatives", Icon: Network },
  { to: "/admin/announcements", label: "Messages", Icon: Megaphone },
  { to: "/admin/audit", label: "Audit log", Icon: ScrollText },
  { to: "/admin/settings", label: "Settings", Icon: Settings },
  { to: "/ivr-simulator", label: "Voice simulator", Icon: PhoneCall }
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-line bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <Brand to="/admin" size="lg" />
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-dark">
            Admin
          </span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Admin navigation">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-xl px-3.5 text-base font-semibold transition ${
                  isActive
                    ? "bg-primary-soft text-primary-dark"
                    : "text-ink-soft hover:bg-canvas hover:text-primary"
                }`
              }
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user?.displayName}</p>
              <p className="text-[11px] text-ink-soft">Administrator</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-ink-soft hover:bg-canvas"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-white/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Brand to="/admin" />
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-dark">
                Admin
              </span>
            </div>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Admin navigation">
              {NAV.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
                      isActive ? "bg-primary-soft text-primary-dark" : "text-ink-soft hover:bg-canvas"
                    }`
                  }
                >
                  <Icon size={17} />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight text-ink">{user?.displayName}</p>
                <p className="text-[11px] text-ink-soft">Administrator</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-soft hover:bg-canvas"
                aria-label="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:pb-10 lg:max-w-none lg:px-8 lg:pb-14 lg:pt-8 xl:px-12">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Admin navigation"
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
                  isActive ? "text-primary" : "text-ink-soft"
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
