import { Sprout } from "lucide-react";
import { WORDS } from "../../lib/words.js";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ActivityForm from "../../components/ActivityForm.jsx";
import { EmptyState, PageHeader, PageLoading, buttonClass } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { activityMeta } from "../../lib/labels.js";
import { farmSupportsActivity } from "../../lib/farmTypes.js";
import { newClientId } from "../../lib/format.js";

export default function RecordActivity() {
  const { user } = useAuth();
  const { online, createActivity } = useSync();
  const { farms, farmIdMap, records, loading } = useFarmerData();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const presetType = params.get("type") || "";
  const presetMeta = presetType ? activityMeta(presetType) : null;
  const typeNeedsFarm = presetMeta && presetMeta.category !== "any";
  const eligibleFarms = typeNeedsFarm
    ? farms.filter((farm) => farmSupportsActivity(farm.farmType, presetType))
    : farms;

  const presetProductionId = params.get("production") || "";
  const presetProduction = records.productions.find((item) => item.clientId === presetProductionId);
  const productionFarmId = farms.find((farm) => farm.clientId === presetProduction?.farmClientId)?.id || "";
  const presetFarmId = productionFarmId || params.get("farmId") || "";
  const lastFarmId = localStorage.getItem(`minders.lastFarm.${user.id}`) || "";
  const candidates = [farmIdMap[presetFarmId] || presetFarmId, farmIdMap[lastFarmId] || lastFarmId];
  const defaultFarmId = candidates.find((id) => eligibleFarms.some((farm) => farm.id === id)) || "";

  async function handleSubmit(payload) {
    setError("");
    setBusy(true);
    try {
      const farm = farms.find((item) => item.id === payload.farmId);
      await createActivity({ clientId: newClientId(), ...payload }, farm?.farmName || "Farm");
      localStorage.setItem(`minders.lastFarm.${user.id}`, payload.farmId);
      toast.success(
        online
          ? WORDS.savedSending.text
          : "Saved on your phone. It will be sent when you are online."
      );
      navigate(presetProduction ? `/app/productions/${presetProduction.clientId}` : "/app/history", { replace: true });
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
        <PageHeader title={WORDS.recordTitle.text} backTo="/app" say={{ say: "Add your farm first. Then you can put your work." }} />
        <EmptyState
          icon={Sprout}
          title="Add your farm first"
          description="Then you can put your work."
          action={
            <Link to="/app/farms/new" className={buttonClass("primary", "md")}>
              Add a farm
            </Link>
          }
        />
      </div>
    );
  }

  if (typeNeedsFarm && eligibleFarms.length === 0) {
    return (
      <div>
        <PageHeader title={presetMeta.label} backTo="/app" />
        <EmptyState
          icon={Sprout}
          title={`No ${presetMeta.category === "animal" ? "animal" : "crop"} farm yet`}
          description={
            presetMeta.category === "animal"
              ? "This work is for an animal farm. Add an animal farm first."
              : "This work is for a crop farm. Add a crop farm first."
          }
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
        title={presetMeta ? presetMeta.label : WORDS.recordTitle.text}
        subtitle="Tap the pictures. No typing needed."
        say={presetMeta?.words || WORDS.recordTitle}
        backTo="/app"
      />
      <ActivityForm
        farms={eligibleFarms}
        farmIdMap={farmIdMap}
        defaultFarmId={defaultFarmId}
        initial={presetType ? { activityType: presetType } : {}}
        productions={records.productions}
        defaultProductionId={presetProduction ? presetProduction.clientId : ""}
        onSubmit={handleSubmit}
        submitting={busy}
        error={error}
        offline={!online}
      />
    </div>
  );
}
