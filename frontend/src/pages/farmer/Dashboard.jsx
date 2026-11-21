import {
  ArrowRight,
  ClipboardList,
  ClipboardPlus,
  CloudOff,
  CloudUpload,
  Plus,
  Sprout
} from "lucide-react";
import { Link } from "react-router-dom";
import ActivityItem from "../../components/ActivityItem.jsx";
import { EmptyState, PageLoading } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { firstName, greeting } from "../../lib/format.js";

export default function Dashboard() {
  const { user, needsOnlineSignIn } = useAuth();
  const { online, pendingCount, syncing, syncNow } = useSync();
  const { activities, farms, loading } = useFarmerData();

  if (loading && activities.length === 0 && farms.length === 0) {
    return <PageLoading label="Opening your farm records…" />;
  }

  const recent = activities.slice(0, 3);
  const waiting =
    activities.filter((item) => item.syncStatus !== "synced").length +
    farms.filter((farm) => farm.syncStatus && farm.syncStatus !== "synced").length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink-soft">{greeting()},</p>
        <h1 className="text-2xl font-bold text-ink">{firstName(user.fullName)}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {user.county} · {user.district}
        </p>
      </div>

      {needsOnlineSignIn ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
          <CloudUpload size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <p className="text-sm leading-snug text-amber-800">
            Your records are saved on this phone.{" "}
            <Link to="/login" className="font-semibold underline">
              Sign in
            </Link>{" "}
            when you have internet to send them to your account.
          </p>
        </div>
      ) : !online ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
          <CloudOff size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-800">You are offline</p>
            <p className="mt-0.5 text-xs leading-snug text-amber-800/80">
              New farms and records are saved on this phone and will sync when you have internet.
            </p>
          </div>
        </div>
      ) : pendingCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <CloudUpload size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <p className="text-sm font-medium text-amber-800">
              {pendingCount} {pendingCount === 1 ? "record is" : "records are"} waiting to sync.
            </p>
          </div>
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm disabled:opacity-60"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-medium text-success">
          All your farms and records are saved to your account.
        </div>
      )}

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-white shadow-float">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
          <ClipboardPlus size={16} /> Daily field entry
        </div>
        <h2 className="mt-2 text-xl font-bold leading-tight">Record farm work</h2>
        <p className="mt-1 text-sm leading-snug text-white/80">
          Log planting, feeding, weeding or any other activity in seconds.
        </p>
        <Link
          to="/app/record"
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-primary-dark transition hover:bg-primary-soft"
        >
          <Plus size={18} /> Record activity
        </Link>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <Link to="/app/farms" className="rounded-2xl bg-white p-4 shadow-card transition hover:-translate-y-0.5">
          <p className="text-xs font-medium text-ink-soft">Farms</p>
          <p className="mt-1 text-2xl font-bold text-ink">{farms.length}</p>
          <Sprout size={16} className="mt-2 text-primary" />
        </Link>
        <Link to="/app/history" className="rounded-2xl bg-white p-4 shadow-card transition hover:-translate-y-0.5">
          <p className="text-xs font-medium text-ink-soft">Records</p>
          <p className="mt-1 text-2xl font-bold text-ink">{activities.length}</p>
          <ClipboardList size={16} className="mt-2 text-primary" />
        </Link>
        <Link to="/app/sync" className="rounded-2xl bg-white p-4 shadow-card transition hover:-translate-y-0.5">
          <p className="text-xs font-medium text-ink-soft">Waiting</p>
          <p className={`mt-1 text-2xl font-bold ${waiting > 0 ? "text-amber-600" : "text-ink"}`}>
            {waiting}
          </p>
          <CloudUpload size={16} className={`mt-2 ${waiting > 0 ? "text-amber-500" : "text-primary"}`} />
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <Link
          to="/app/farms/new"
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card transition hover:border-primary/30"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Plus size={20} />
          </span>
          <span className="text-sm font-semibold text-ink">Add a farm</span>
        </Link>
        <Link
          to="/app/history"
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card transition hover:border-primary/30"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ClipboardList size={20} />
          </span>
          <span className="text-sm font-semibold text-ink">View history</span>
        </Link>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Recent farm work</h2>
          {activities.length > 0 && (
            <Link
              to="/app/history"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View all <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No records yet"
            description="Record your first farm activity and it will appear here."
            action={
              <Link
                to="/app/record"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                <Plus size={16} /> Record activity
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {recent.map((activity) => (
              <ActivityItem key={activity.clientId} activity={activity} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
