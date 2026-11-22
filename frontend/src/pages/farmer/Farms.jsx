import { CloudOff, Plus, Sprout } from "lucide-react";
import { WORDS } from "../../lib/words.js";
import { Link } from "react-router-dom";
import FarmCard from "../../components/FarmCard.jsx";
import { EmptyState, PageHeader, PageLoading, buttonClass } from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";

export default function Farms() {
  const { farms, activities, loading } = useFarmerData();
  const { online } = useSync();

  const activityCounts = activities.reduce((counts, activity) => {
    counts[activity.farmId] = (counts[activity.farmId] || 0) + 1;
    return counts;
  }, {});

  return (
    <div>
      <PageHeader
        title={WORDS.navFarms.text}
        subtitle="All your farms."
        say={WORDS.navFarms}
        action={
          <Link to="/app/farms/new" className={buttonClass("primary", "sm", "shrink-0")}>
            <Plus size={16} /> Add farm
          </Link>
        }
      />

      {!online && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-800">
          <CloudOff size={17} className="mt-0.5 shrink-0" />
          Showing farms saved on this phone. You can still add farms and record work; they will
          sync when you reconnect.
        </div>
      )}

      {loading ? (
        <PageLoading label="Loading your farms…" />
      ) : farms.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="No farms yet"
          description="Add your first farm so you can start recording activities."
          action={
            <Link to="/app/farms/new" className={buttonClass("primary", "md")}>
              <Plus size={16} /> Add your first farm
            </Link>
          }
        />
      ) : (
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
          {farms.map((farm) => (
            <FarmCard
              key={farm.id}
              farm={{
                ...farm,
                activityCount: activityCounts[farm.id] ?? farm.activityCount ?? 0
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
