import { Activity, ClipboardList, RefreshCw, Sprout, UserCheck, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorBanner, PageLoading, buttonClass } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { api } from "../../lib/api.js";
import { formatDate, formatPhone, initials } from "../../lib/format.js";

export default function AdminDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api.get("/api/admin/dashboard", { token });
      setData(result);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <PageLoading label="Loading overview…" />;

  const metrics = data?.metrics || {};

  const cards = [
    { label: "Total farmers", value: metrics.totalFarmers, Icon: Users, tone: "bg-primary-soft text-primary" },
    { label: "Active farmers", value: metrics.activeFarmers, Icon: UserCheck, tone: "bg-success/10 text-success" },
    { label: "New this month", value: metrics.farmersThisMonth, Icon: UserPlus, tone: "bg-sky-100 text-sky-700" },
    { label: "Farms", value: metrics.totalFarms, Icon: Sprout, tone: "bg-emerald-100 text-emerald-700" },
    { label: "Activity records", value: metrics.totalActivities, Icon: ClipboardList, tone: "bg-amber-100 text-amber-700" },
    { label: "Records this week", value: metrics.activitiesThisWeek, Icon: Activity, tone: "bg-indigo-100 text-indigo-700" }
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Overview</h1>
          <p className="mt-1 text-sm text-ink-soft">
            A live view of farmers and farm records in Minders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className={buttonClass("secondary", "sm")}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <Link to="/admin/farmers" className={buttonClass("primary", "sm")}>
            View farmers
          </Link>
        </div>
      </div>

      <ErrorBanner message={error} />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map(({ label, value, Icon, tone }) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-card">
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
              <Icon size={18} />
            </span>
            <p className="mt-3 text-2xl font-bold text-ink">{value ?? 0}</p>
            <p className="mt-0.5 text-xs font-medium text-ink-soft">{label}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Recently registered farmers</h2>
          <Link to="/admin/farmers" className="text-xs font-semibold text-primary hover:underline">
            See all
          </Link>
        </div>
        {data?.recentFarmers?.length ? (
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            {data.recentFarmers.map((farmer, index) => (
              <Link
                key={farmer.id}
                to={`/admin/farmers/${farmer.id}`}
                className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-canvas ${
                  index > 0 ? "border-t border-line/70" : ""
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-dark">
                  {initials(farmer.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{farmer.fullName}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {formatPhone(farmer.phoneNumber)} · {farmer.county}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-ink-soft">
                    {farmer.farmCount} {farmer.farmCount === 1 ? "farm" : "farms"}
                  </p>
                  <p className="text-[11px] text-ink-soft">{formatDate(farmer.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white/70 px-6 py-10 text-center text-sm text-ink-soft">
            No farmers have registered yet.
          </div>
        )}
      </section>
    </div>
  );
}
