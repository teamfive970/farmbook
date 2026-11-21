import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ActivityForm from "../../components/ActivityForm.jsx";
import { EmptyState, PageHeader, PageLoading, buttonClass } from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { getActivity } from "../../lib/localStore.js";
import { refreshActivities } from "../../lib/syncEngine.js";

export default function EditActivity() {
  const { clientId } = useParams();
  const { user, token } = useAuth();
  const { updateActivity, online, version } = useSync();
  const { farms, farmIdMap } = useFarmerData();
  const navigate = useNavigate();
  const toast = useToast();

  const [record, setRecord] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      let item = await getActivity(user.id, clientId);
      if (!item && token && navigator.onLine) {
        try {
          await refreshActivities(user.id, token);
          item = await getActivity(user.id, clientId);
        } catch {
          // fall through to the empty state
        }
      }
      if (active) setRecord(item || null);
    })();
    return () => {
      active = false;
    };
  }, [user.id, clientId, token, version]);

  async function handleSubmit(changes) {
    setError("");
    setBusy(true);
    try {
      const farm = farms.find((item) => item.id === changes.farmId);
      await updateActivity(record, { ...changes, farmName: farm?.farmName || record.farmName });
      toast.success(online ? "Record updated." : "Saved on this phone. It will sync later.");
      navigate(`/app/activities/${record.clientId}`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (record === undefined) return <PageLoading label="Loading record…" />;

  if (record === null) {
    return (
      <div>
        <PageHeader title="Record not found" backTo="/app/history" />
        <EmptyState
          title="This record is not available on this phone"
          description="Reconnect to load your records again."
          action={
            <Link to="/app/history" className={buttonClass("secondary", "md")}>
              Back to records
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Change the work"
        subtitle="Touch what you want to change, then save."
        say={{ key: "edit.title", say: "Change the work. Touch what you want to change, then save." }}
        backTo={`/app/activities/${record.clientId}`}
      />
      <ActivityForm
        farms={farms}
        farmIdMap={farmIdMap}
        initial={record}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        submitting={busy}
        error={error}
        offline={!online}
      />
    </div>
  );
}
