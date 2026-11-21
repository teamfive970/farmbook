import { ClipboardList, CloudOff, CloudUpload, MapPin, Pencil, Plus, Sprout } from "lucide-react";
import { WORDS } from "../../lib/words.js";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ActivityItem from "../../components/ActivityItem.jsx";
import {
  Button,
  EmptyState,
  PageHeader,
  PageLoading,
  StatusChip,
  buttonClass
} from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { farmMeta, formatFarmSize } from "../../lib/labels.js";

export default function FarmDetail() {
  const { farmId } = useParams();
  const { farms, activities, farmIdMap, loading } = useFarmerData();
  const { online, retryFarm } = useSync();
  const navigate = useNavigate();

  const resolvedFarmId = farmIdMap[farmId] || farmId;
  const farm = farms.find((item) => item.id === resolvedFarmId);

  useEffect(() => {
    if (farmId !== resolvedFarmId) {
      navigate(`/app/farms/${resolvedFarmId}`, { replace: true });
    }
  }, [farmId, resolvedFarmId, navigate]);

  if (loading && !farm) return <PageLoading label="Loading farm…" />;

  if (!farm) {
    return (
      <div>
        <PageHeader title="Farm not found" backTo="/app/farms" />
        <EmptyState
          icon={Sprout}
          title="This farm is not available"
          description="It may have been added on another device. Reconnect and try again."
          action={
            <Link to="/app/farms" className={buttonClass("secondary", "md")}>
              Back to my farms
            </Link>
          }
        />
      </div>
    );
  }

  const meta = farmMeta(farm.farmType);
  const farmActivities = activities.filter((activity) => activity.farmId === farm.id);
  const syncStatus = farm.syncStatus || "synced";

  return (
    <div>
      <PageHeader
        title={farm.farmName}
        subtitle={`${meta.label} · ${farmActivities.length} ${
          farmActivities.length === 1 ? "record" : "records"
        }`}
        backTo="/app/farms"
        action={
          <Link to={`/app/farms/${farm.id}/edit`} className={buttonClass("secondary", "sm", "shrink-0")}>
            <Pencil size={14} /> Edit
          </Link>
        }
      />

      {syncStatus !== "synced" && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${
            syncStatus === "failed"
              ? "border-danger/25 bg-danger/5"
              : "border-warning/30 bg-warning/10"
          }`}
        >
          <span className="mt-0.5 shrink-0">
            {syncStatus === "failed" ? (
              <CloudOff size={18} className="text-danger" />
            ) : (
              <CloudUpload size={18} className="text-amber-700" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={syncStatus} />
            </div>
            <p
              className={`mt-1 text-xs leading-snug ${
                syncStatus === "failed" ? "text-danger" : "text-amber-800/90"
              }`}
            >
              {syncStatus === "failed"
                ? farm.syncError || "This farm could not be saved to your account."
                : online
                  ? "This farm is being sent to your account."
                  : "This farm is saved on this phone. It will sync when you have internet."}
            </p>
            {syncStatus === "failed" && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => retryFarm(farm)}
              >
                Try again
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
            <meta.Icon size={22} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-ink">{meta.label}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
              <MapPin size={14} className="shrink-0" />
              {farm.community}, {farm.district}, {farm.county}
            </p>
            {formatFarmSize(farm) && (
              <p className="mt-1 text-sm font-semibold text-ink" data-say={`The farm is ${formatFarmSize(farm)}.`}>
                📐 {formatFarmSize(farm)}
              </p>
            )}
          </div>
        </div>

        {farm.mainCropOrLivestock && (
          <div className="mt-4 rounded-xl bg-primary-soft/60 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-dark/70">
              Main crop or livestock
            </p>
            <p className="mt-0.5 text-sm font-medium text-primary-dark">{farm.mainCropOrLivestock}</p>
          </div>
        )}

        {farm.description && (
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">{farm.description}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to={`/app/harvests/new?farm=${encodeURIComponent(farm.clientId || farm.id)}`}
            data-say={WORDS.addHarvest.say}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-amber-100 px-3 text-sm font-bold text-amber-900"
          >
            🧺 {WORDS.addHarvest.text}
          </Link>
          <Link
            to={`/app/money/spend?farm=${encodeURIComponent(farm.clientId || farm.id)}`}
            data-say={WORDS.spend.say}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 text-sm font-bold text-rose-900"
          >
            💸 {WORDS.spend.text}
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link to={`/app/record?farmId=${farm.id}`} className={buttonClass("primary", "md", "w-full")}>
          <Plus size={16} /> Record activity
        </Link>
        <Link to="/app/history" className={buttonClass("secondary", "md", "w-full")}>
          <ClipboardList size={16} /> All records
        </Link>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold text-ink">Recent work on this farm</h2>
        {farmActivities.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No activity yet"
            description="Record the first activity for this farm."
            action={
              <Link to={`/app/record?farmId=${farm.id}`} className={buttonClass("primary", "md")}>
                <Plus size={16} /> Record activity
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {farmActivities.slice(0, 10).map((activity) => (
              <ActivityItem key={activity.clientId} activity={activity} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
