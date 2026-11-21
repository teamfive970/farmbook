import { CircleCheck, CloudOff, CloudUpload, LogIn, RefreshCw, Sprout, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  StatusChip,
  SyncPictureKey
} from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { activityMeta, activitySummary, farmMeta } from "../../lib/labels.js";
import {
  getActivity,
  getCachedFarm,
  getFailedRecords,
  getLocalRecord,
  getQueue
} from "../../lib/localStore.js";
import { recordPath } from "../../lib/recordLinks.js";
import { RECORD_KIND_WORDS } from "../../lib/words.js";

function operationLabel(kind, entity) {
  if (entity === "farm") {
    return kind === "create" ? "New farm" : "Farm details changed";
  }
  if (kind === "create") return "New record";
  if (kind === "update") return "Edited record";
  return "Delete record";
}

export default function SyncStatus() {
  const { user, needsOnlineSignIn } = useAuth();
  const { online, pendingCount, syncing, syncNow, version, retryActivity, retryFarm, retryRecord, deleteRecord } =
    useSync();
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [retryingKey, setRetryingKey] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [operations, failed] = await Promise.all([
        getQueue(user.id),
        getFailedRecords(user.id)
      ]);
      const queued = new Set(operations.map((operation) => operation.clientId));
      const items = [];

      for (const operation of operations) {
        if (operation.entity === "record") {
          items.push({
            key: operation.clientId,
            entity: "record",
            resource: operation.resource,
            kind: operation.kind,
            record: await getLocalRecord(user.id, operation.clientId)
          });
          continue;
        }
        const isFarm = operation.entity === "farm";
        items.push({
          key: operation.clientId,
          entity: isFarm ? "farm" : "activity",
          kind: operation.kind,
          record: isFarm
            ? await getCachedFarm(user.id, operation.farmId)
            : await getActivity(user.id, operation.clientId)
        });
      }

      for (const farm of failed.farms) {
        if (queued.has(farm.clientId)) continue;
        items.push({
          key: farm.id,
          entity: "farm",
          kind: farm.id.startsWith("local-") ? "create" : "update",
          record: farm
        });
      }

      for (const activity of failed.activities) {
        if (queued.has(activity.clientId)) continue;
        items.push({
          key: activity.clientId,
          entity: "activity",
          kind: activity.id ? "update" : "create",
          record: activity
        });
      }

      for (const record of failed.records) {
        if (queued.has(record.clientId)) continue;
        items.push({
          key: record.clientId,
          entity: "record",
          resource: record.kind,
          kind: record.id ? "update" : "create",
          record
        });
      }

      if (active) setEntries(items);
    })();
    return () => {
      active = false;
    };
  }, [user.id, version]);

  async function handleRetry(entry) {
    setRetryingKey(entry.key);
    try {
      if (entry.entity === "farm") {
        await retryFarm(entry.record);
      } else if (entry.entity === "record") {
        await retryRecord(entry.record);
      } else {
        await retryActivity(entry.record);
      }
      toast.info("Trying to save this again.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRetryingKey(null);
    }
  }

  const waiting = entries.filter((entry) => entry.record?.syncStatus !== "failed");
  const attention = entries.filter((entry) => entry.record?.syncStatus === "failed");

  return (
    <div>
      <PageHeader
        title="My saved records"
        subtitle="Where your farms and records are kept."
        backTo="/app/profile"
      />

      <div
        className={`rounded-2xl border px-4 py-4 ${
          needsOnlineSignIn || !online
            ? "border-warning/30 bg-warning/10"
            : "border-success/25 bg-success/5"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              needsOnlineSignIn || !online
                ? "bg-white text-amber-600"
                : "bg-white text-success"
            }`}
          >
            {needsOnlineSignIn ? (
              <LogIn size={20} />
            ) : online ? (
              <CircleCheck size={20} />
            ) : (
              <CloudOff size={20} />
            )}
          </span>
          <div>
            <p
              className={`text-sm font-bold ${
                needsOnlineSignIn || !online ? "text-amber-800" : "text-success"
              }`}
            >
              {needsOnlineSignIn
                ? "Saved on this phone"
                : online
                  ? "Network is on"
                  : "No network"}
            </p>
            <p
              className={`text-xs ${
                needsOnlineSignIn || !online ? "text-amber-800/80" : "text-success/80"
              }`}
            >
              {needsOnlineSignIn
                ? "Your records are safe here. Enter your PIN once when there is network to send them."
                : online
                  ? pendingCount > 0
                    ? `${pendingCount} ${pendingCount === 1 ? "item is" : "items are"} on this phone. They are being sent on their own.`
                    : "Everything is sent online."
                  : "Everything is safe on this phone. It will be sent on its own when there is network."}
            </p>
          </div>
        </div>
        {needsOnlineSignIn ? (
          <Button className="mt-4 w-full" onClick={() => navigate("/login")}>
            <LogIn size={16} /> Enter PIN to send
          </Button>
        ) : (
          <Button
            className="mt-4 w-full"
            onClick={syncNow}
            loading={syncing}
            disabled={!online || pendingCount === 0}
          >
            <RefreshCw size={16} /> Send now
          </Button>
        )}
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-3 text-sm font-bold text-ink">What the pictures mean</h2>
        <SyncPictureKey />
      </section>

      {attention.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-bold text-ink">Needs help</h2>
          <div className="space-y-3">
            {attention.map((entry) => (
              <SyncEntry
                key={`failed-${entry.key}`}
                entry={entry}
                busy={retryingKey === entry.key}
                onRetry={() => handleRetry(entry)}
                onDelete={entry.entity === "record" && entry.record ? () => setDeleting(entry) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold text-ink">On this phone, waiting to send</h2>
        {waiting.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title="Everything is sent"
            description="Records you save with no network will show here until they are sent."
          />
        ) : (
          <div className="space-y-3">
            {waiting.map((entry) => (
              <SyncEntry key={entry.key} entry={entry} />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this record?"
        message="It will be taken off this phone and will not be sent."
        confirmLabel="Delete"
        onConfirm={async () => {
          const entry = deleting;
          setDeleting(null);
          try {
            await deleteRecord(entry.record);
            toast.success("Deleted.");
          } catch (error) {
            toast.error(error.message);
          }
        }}
        onCancel={() => setDeleting(null)}
      />

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-card">
        <h2 className="text-sm font-bold text-ink">How saving works</h2>
        <ol className="mt-3 space-y-2 text-xs leading-relaxed text-ink-soft">
          <li className="flex gap-2">
            <span className="font-bold text-primary">1.</span>
            Every farm and record is saved on this phone first.
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary">2.</span>
            When you have internet, Minders sends it to your account.
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary">3.</span>
            If something fails, it is marked "Needs attention" so you can try again.
          </li>
        </ol>
      </section>
    </div>
  );
}

function SyncEntry({ entry, busy = false, onRetry, onDelete }) {
  const { record, entity, kind } = entry;
  if (entity === "record") return <RecordEntry entry={entry} busy={busy} onRetry={onRetry} onDelete={onDelete} />;
  const isFarm = entity === "farm";
  const meta = isFarm
    ? record
      ? farmMeta(record.farmType)
      : null
    : record
      ? activityMeta(record.activityType)
      : null;
  const Icon = isFarm ? Sprout : meta?.Icon || CloudUpload;
  const title = isFarm
    ? record?.farmName || "New farm"
    : kind === "delete"
      ? "Deleted activity"
      : record ? activitySummary(record) : "Farm activity";

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            meta?.tone || "bg-slate-100 text-slate-600"
          }`}
        >
          {!isFarm && kind === "delete" ? <Trash2 size={18} /> : <Icon size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-semibold text-ink">{title}</p>
            <StatusChip status={record?.syncStatus || "pending"} />
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {operationLabel(kind, entity)}
            {" · "}
            {isFarm ? meta?.label || "Farm" : record?.farmName || "Farm"}
          </p>
          {record?.syncStatus === "failed" && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-danger">{record.syncError || "Could not be saved."}</p>
              {onRetry && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRetry}
                  loading={busy}
                >
                  Try again
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecordEntry({ entry, busy = false, onRetry, onDelete }) {
  const { record, resource, kind } = entry;
  const words = RECORD_KIND_WORDS[resource];
  const detail = record
    ? record.crop || record.name || record.category || (record.amount ? String(record.amount) : "")
    : "";
  const fix = record?.syncFix;
  const parentPath = fix?.action === "parent" ? recordPath(fix.kind, { clientId: fix.clientId, id: fix.id }) : null;
  const openPath = recordPath(resource, record);
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card" data-say={words?.say}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">
            {kind === "delete" ? "Deleted " : ""}
            {words?.text || "Record"}
            {detail ? ` · ${detail}` : ""}
          </p>
          <p className="mt-1 text-xs text-ink-soft">{operationLabel(kind, "record")}</p>
        </div>
        <StatusChip status={record?.syncStatus || "pending"} />
      </div>
      {record?.syncStatus !== "failed" && record?.syncNote && (
        <p className="mt-2 text-xs text-ink-soft">{record.syncNote}</p>
      )}
      {record?.syncStatus === "failed" && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-danger" data-say={record.syncError || "Could not be saved."}>
            {record.syncError || "Could not be saved."}
          </p>
          <div className="flex flex-wrap gap-2">
            {parentPath ? (
              <Link to={parentPath} className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-xs font-bold text-white">
                Fix the {fix.label} first
              </Link>
            ) : openPath ? (
              <Link to={openPath} className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-xs font-bold text-white">
                Open it
              </Link>
            ) : null}
            {onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry} loading={busy}>
                Try again
              </Button>
            )}
            {onDelete && (
              <Button variant="secondary" size="sm" className="text-danger" onClick={onDelete}>
                <Trash2 size={14} /> Delete it
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
