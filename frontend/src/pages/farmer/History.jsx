import { ClipboardList, Filter, Plus, SlidersHorizontal, X } from "lucide-react";
import { WORDS } from "../../lib/words.js";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ActivityItem from "../../components/ActivityItem.jsx";
import { Button, EmptyState, PageHeader, PageLoading, Select, buttonClass } from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { formatDate, todayInputValue } from "../../lib/format.js";
import { activityTypesForFarm } from "../../lib/farmTypes.js";
import { ACTIVITY_TYPES } from "../../lib/labels.js";

const EMPTY_FILTERS = { farmId: "", type: "", from: "", to: "" };

export default function History() {
  const { activities, farms, loading } = useFarmerData();
  const { pendingCount } = useSync();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const selectedFarm = farms.find((farm) => farm.id === filters.farmId);
  const baseTypes = selectedFarm ? activityTypesForFarm(selectedFarm.farmType) : ACTIVITY_TYPES;
  const currentType = ACTIVITY_TYPES.find((type) => type.value === filters.type);
  const typeChoices =
    currentType && !baseTypes.some((type) => type.value === currentType.value)
      ? [...baseTypes, currentType]
      : baseTypes;

  const filtered = useMemo(
    () =>
      activities.filter((activity) => {
        if (filters.farmId && activity.farmId !== filters.farmId) return false;
        if (filters.type && activity.activityType !== filters.type) return false;
        if (filters.from && activity.activityDate < filters.from) return false;
        if (filters.to && activity.activityDate > filters.to) return false;
        return true;
      }),
    [activities, filters]
  );

  const groups = useMemo(() => {
    const result = [];
    for (const activity of filtered) {
      const label = formatDate(activity.activityDate);
      const last = result[result.length - 1];
      if (last && last.label === label) last.items.push(activity);
      else result.push({ label, items: [activity] });
    }
    return result;
  }, [filtered]);

  function updateFilter(field) {
    return (event) => {
      const value = event.target.value;
      setFilters((current) => {
        const next = { ...current, [field]: value };
        if (field === "farmId") {
          const farm = farms.find((item) => item.id === value);
          if (farm && next.type && !activityTypesForFarm(farm.farmType).some((type) => type.value === next.type)) {
            next.type = "";
          }
        }
        return next;
      });
    };
  }

  return (
    <div>
      <PageHeader
        title={WORDS.navRecords.text}
        subtitle="All the work you did. The newest one on top."
        say={WORDS.navRecords}
        action={
          <Link to="/app/record" className={buttonClass("primary", "sm", "shrink-0")}>
            <Plus size={16} /> Record
          </Link>
        }
      />

      {pendingCount > 0 && (
        <Link
          to="/app/sync"
          className="mb-4 block rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-medium text-amber-800"
        >
          {pendingCount} {pendingCount === 1 ? "record is" : "records are"} waiting to sync. Tap to
          review.
        </Link>
      )}

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowFilters((value) => !value)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeFilters > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] text-white">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="mb-5 space-y-3 rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Filter size={15} /> Narrow your records
            </p>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>
          <Select aria-label="Filter by farm" value={filters.farmId} onChange={updateFilter("farmId")}>
            <option value="">All farms</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.farmName}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by activity type" value={filters.type} onChange={updateFilter("type")}>
            <option value="">All activity types</option>
            {typeChoices.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-soft">From</span>
              <input
                type="date"
                value={filters.from}
                max={todayInputValue()}
                onChange={updateFilter("from")}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-soft">To</span>
              <input
                type="date"
                value={filters.to}
                max={todayInputValue()}
                onChange={updateFilter("to")}
                className="input"
              />
            </label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowFilters(false)}
          >
            Done
          </Button>
        </div>
      )}

      {loading && activities.length === 0 ? (
        <PageLoading label="Loading your records…" />
      ) : activities.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No records yet"
          description="When you record farm work, it will appear here."
          action={
            <Link to="/app/record" className={buttonClass("primary", "md")}>
              <Plus size={16} /> Record activity
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No records match these filters"
          description="Try a different farm, activity type or date."
          action={
            <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {activeFilters > 0 && (
            <p className="text-xs font-medium text-ink-soft">
              Showing {filtered.length} of {activities.length} records.
            </p>
          )}
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
                {group.label}
              </h2>
              <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                {group.items.map((activity) => (
                  <ActivityItem key={activity.clientId} activity={activity} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
