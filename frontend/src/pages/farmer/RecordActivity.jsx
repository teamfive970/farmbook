import { Sprout } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ActivityForm from "../../components/ActivityForm.jsx";
import { EmptyState, PageHeader, PageLoading, buttonClass } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { newClientId } from "../../lib/format.js";

export default function RecordActivity() {
  const { user } = useAuth();
  const { online, createActivity } = useSync();
  const { farms, farmIdMap, loading } = useFarmerData();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const presetFarmId = params.get("farmId") || "";
  const lastFarmId = localStorage.getItem(`minders.lastFarm.${user.id}`) || "";
  const candidates = [farmIdMap[presetFarmId] || presetFarmId, farmIdMap[lastFarmId] || lastFarmId];
  const defaultFarmId = candidates.find((id) => farms.some((farm) => farm.id === id)) || "";

  async function handleSubmit(payload) {
    setError("");
    setBusy(true);
    try {
      const farm = farms.find((item) => item.id === payload.farmId);
      await createActivity({ clientId: newClientId(), ...payload }, farm?.farmName || "Farm");
      localStorage.setItem(`minders.lastFarm.${user.id}`, payload.farmId);
      toast.success(
        online
          ? "Record saved."
          : "Saved on this phone. It will sync when you have internet."
      );
      navigate("/app/history", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && farms.length === 0) return <PageLoading label="Loading your farms…" />;

  if (farms.length === 0) {
    return (
      <div>
        <PageHeader title="Record activity" backTo="/app" />
        <EmptyState
          icon={Sprout}
          title="Add a farm first"
          description="You need at least one farm before you can record an activity."
          action={
            <Link to="/app/farms/new" className={buttonClass("primary", "md")}>
              Add a farm
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Record activity"
        subtitle="Fill in what you did. It takes less than a minute."
        backTo="/app"
      />
      <ActivityForm
        farms={farms}
        farmIdMap={farmIdMap}
        defaultFarmId={defaultFarmId}
        onSubmit={handleSubmit}
        submitting={busy}
        error={error}
        offline={!online}
      />
    </div>
  );
}
