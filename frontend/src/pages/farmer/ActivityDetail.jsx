import { AlertTriangle, ClipboardList, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  PageLoading,
  StatusChip,
  buttonClass
} from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { formatFullDate, formatDateTime } from "../../lib/format.js";
import { activityMeta } from "../../lib/labels.js";
import { getActivity } from "../../lib/localStore.js";
import { refreshActivities } from "../../lib/syncEngine.js";

function DetailRow({ label, children }) {
  return (
    <div className="border-t border-line/70 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
      <div className="mt-1 text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}

export default function ActivityDetail() {
  const { clientId } = useParams();
  const { user, token } = useAuth();
  const { online, version, retryActivity, deleteActivity, syncing } = useSync();
  const navigate = useNavigate();
  const toast = useToast();

  const [record, setRecord] = useState(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      let item = await getActivity(user.id, clientId);
      if (!item && token && navigator.onLine) {
        try {
          await refreshActivities(user.id, token);
          item = await getActivity(user.id, clientId);
        } catch {
          // handled by the empty state below
        }
      }
      if (active) setRecord(item || null);
    })();
    return () => {
      active = false;
    };
  }, [user.id, clientId, token, version]);

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteActivity(record);
      toast.success(
        online
          ? "Record deleted."
          : "Record removed from this phone. It will be deleted online when you reconnect."
      );
      navigate("/app/history", { replace: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  async function handleRetry() {
    try {
      await retryActivity(record);
      toast.info("Trying to save this record again.");
    } catch (error) {
      toast.error(error.message);
    }
  }

  if (record === undefined) return <PageLoading label="Loading record…" />;

  if (record === null) {
    return (
      <div>
        <PageHeader title="Record not found" backTo="/app/history" />
        <EmptyState
          icon={ClipboardList}
          title="This record is not available"
          description="It may have been deleted, or it is not saved on this phone."
          action={
            <Link to="/app/history" className={buttonClass("secondary", "md")}>
              Back to records
            </Link>
          }
        />
      </div>
    );
  }

  const meta = activityMeta(record.activityType);
  const quantityText =
    record.quantity !== null && record.quantity !== undefined
      ? `${record.quantity}${record.unit ? ` ${record.unit}` : ""}`
      : null;

  return (
    <div>
      <PageHeader title="Record details" backTo="/app/history" />

      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
            <meta.Icon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{meta.label}</p>
            <p className="mt-0.5 truncate text-sm text-ink-soft">{record.farmName || "Farm"}</p>
          </div>
          <StatusChip status={record.syncStatus} />
        </div>

        {record.syncStatus === "failed" ? (
          <div className="mt-4 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger">
            <p className="flex items-start gap-2 font-medium">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {record.syncError || "This record could not be saved to your account."}
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={handleRetry}>
              <RefreshCw size={14} /> Try again
            </Button>
          </div>
        ) : record.syncStatus === "synced" ? (
          <p className="mt-4 rounded-xl bg-success/5 px-4 py-3 text-sm text-success">
            Saved to your account.
          </p>
        ) : (
          <p className="mt-4 rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800">
            {syncing
              ? "Saving this record now…"
              : "Saved on this phone. It will sync when you have internet."}
          </p>
        )}

        <div className="mt-4">
          <DetailRow label="Date">{formatFullDate(record.activityDate)}</DetailRow>
          <DetailRow label="Description">{record.description}</DetailRow>
          {record.inputUsed && <DetailRow label="Input or material">{record.inputUsed}</DetailRow>}
          {quantityText && <DetailRow label="Quantity">{quantityText}</DetailRow>}
          {record.notes && <DetailRow label="Notes">{record.notes}</DetailRow>}
          {record.createdAt && (
            <DetailRow label="Recorded">Saved {formatDateTime(record.createdAt)}</DetailRow>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          to={`/app/activities/${record.clientId}/edit`}
          className={buttonClass("secondary", "md", "w-full")}
        >
          <Pencil size={15} /> Edit
        </Link>
        <Button variant="danger" size="md" className="w-full" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={15} /> Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this record?"
        message={
          online
            ? "This will remove the record from your account. This cannot be undone."
            : "This will remove the record from this phone now, and delete it online when you reconnect."
        }
        confirmLabel="Delete record"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
