import { ClipboardCopy, KeyRound, PauseCircle, PlayCircle, Sprout } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  Field,
  Modal,
  PageHeader,
  PageLoading,
  Select,
  TextInput
} from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { api } from "../../lib/api.js";
import { formatDate, formatFullDate, formatPhone, initials } from "../../lib/format.js";
import { COUNTIES, activityMeta, farmMeta } from "../../lib/labels.js";

export default function AdminFarmerDetail() {
  const { farmerId } = useParams();
  const { token } = useAuth();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPin, setResetPin] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [tempPin, setTempPin] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api.get(`/api/admin/farmers/${farmerId}`, { token });
      setData(result);
      setEdit({
        fullName: result.farmer.fullName,
        county: result.farmer.county,
        district: result.farmer.district,
        community: result.farmer.community
      });
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token, farmerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(event) {
    event.preventDefault();
    setEditError("");
    if (edit.fullName.trim().length < 2) return setEditError("Enter the farmer's full name.");
    if (!edit.county) return setEditError("Choose a county.");
    if (!edit.district.trim()) return setEditError("Enter the district.");
    if (!edit.community.trim()) return setEditError("Enter the community.");

    setEditBusy(true);
    try {
      const result = await api.patch(
        `/api/admin/farmers/${farmerId}`,
        {
          fullName: edit.fullName.trim(),
          county: edit.county,
          district: edit.district.trim(),
          community: edit.community.trim()
        },
        { token }
      );
      setData(result);
      toast.success("Farmer details updated.");
    } catch (requestError) {
      setEditError(requestError.message);
    } finally {
      setEditBusy(false);
    }
  }

  async function handleStatusChange() {
    const action = data.farmer.status === "active" ? "deactivate" : "reactivate";
    setStatusBusy(true);
    try {
      await api.post(`/api/admin/farmers/${farmerId}/${action}`, undefined, { token });
      toast.success(
        action === "deactivate" ? "Farmer account deactivated." : "Farmer account reactivated."
      );
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setStatusBusy(false);
      setConfirmStatus(false);
    }
  }

  async function handleResetPin(event) {
    event.preventDefault();
    setResetError("");
    if (!/^\d{4,6}$/.test(resetPin)) return setResetError("Enter your PIN.");
    setResetBusy(true);
    try {
      const result = await api.post(
        `/api/admin/farmers/${farmerId}/reset-pin`,
        { currentPin: resetPin },
        { token }
      );
      setTempPin(result.tempPin);
      setResetPin("");
      toast.success("Temporary PIN created.");
    } catch (requestError) {
      setResetError(requestError.message);
    } finally {
      setResetBusy(false);
    }
  }

  async function copyTempPin() {
    try {
      await navigator.clipboard.writeText(tempPin);
      toast.success("Temporary PIN copied.");
    } catch {
      toast.error("Could not copy. Write the PIN down instead.");
    }
  }

  if (loading && !data) return <PageLoading label="Loading farmer…" />;

  if (!data) {
    return (
      <div>
        <PageHeader title="Farmer not found" backTo="/admin/farmers" />
        <ErrorBanner message={error || "This farmer could not be loaded."} />
      </div>
    );
  }

  const { farmer, farms, recentActivities } = data;
  const active = farmer.status === "active";

  return (
    <div>
      <PageHeader
        title={farmer.fullName}
        subtitle={`${formatPhone(farmer.phoneNumber)} · ${farmer.county}`}
        backTo="/admin/farmers"
        action={
          <Button
            variant={active ? "secondary" : "primary"}
            size="sm"
            className={active ? "text-danger" : ""}
            onClick={() => setConfirmStatus(true)}
          >
            {active ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
            {active ? "Deactivate" : "Reactivate"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-lg font-bold text-primary-dark">
              {initials(farmer.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">{farmer.fullName}</p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  active ? "bg-success/10 text-success" : "bg-slate-100 text-slate-600"
                }`}
              >
                {active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Phone</dt>
              <dd className="font-medium text-ink">{formatPhone(farmer.phoneNumber)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">County</dt>
              <dd className="font-medium text-ink">{farmer.county}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">District</dt>
              <dd className="font-medium text-ink">{farmer.district}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Community</dt>
              <dd className="font-medium text-ink">{farmer.community}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Registered</dt>
              <dd className="font-medium text-ink">{formatDate(farmer.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">PIN recovery</dt>
              <dd className="font-medium text-ink">
                {farmer.hasSecurityQuestion ? "Question set" : "Not set"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-canvas px-3 py-2 text-center">
              <p className="text-lg font-bold text-ink">{farmer.farmCount}</p>
              <p className="text-[11px] text-ink-soft">Farms</p>
            </div>
            <div className="rounded-xl bg-canvas px-3 py-2 text-center">
              <p className="text-lg font-bold text-ink">{farmer.activityCount}</p>
              <p className="text-[11px] text-ink-soft">Records</p>
            </div>
          </div>

          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => {
              setResetOpen(true);
              setResetError("");
              setResetPin("");
              setTempPin("");
            }}
          >
            <KeyRound size={16} /> Reset farmer PIN
          </Button>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-sm font-bold text-ink">Edit farmer profile</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Admins can correct profile details. Farm and activity records stay owned by the farmer.
          </p>
          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <ErrorBanner message={editError} />
            <Field label="Full name" htmlFor="fullName">
              <TextInput
                id="fullName"
                value={edit.fullName}
                onChange={(event) =>
                  setEdit((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="County" htmlFor="county">
                <Select
                  id="county"
                  value={edit.county}
                  onChange={(event) =>
                    setEdit((current) => ({ ...current, county: event.target.value }))
                  }
                >
                  {COUNTIES.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="District" htmlFor="district">
                <TextInput
                  id="district"
                  value={edit.district}
                  onChange={(event) =>
                    setEdit((current) => ({ ...current, district: event.target.value }))
                  }
                />
              </Field>
              <Field label="Community" htmlFor="community">
                <TextInput
                  id="community"
                  value={edit.community}
                  onChange={(event) =>
                    setEdit((current) => ({ ...current, community: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={editBusy}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold text-ink">Farms</h2>
        {farms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white/70 px-6 py-8 text-center text-sm text-ink-soft">
            This farmer has not added any farms yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {farms.map((farm) => {
              const meta = farmMeta(farm.farmType);
              return (
                <div key={farm.id} className="rounded-2xl bg-white p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.tone}`}>
                      <meta.Icon size={19} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{farm.farmName}</p>
                      <p className="text-xs text-ink-soft">
                        {meta.label} · {farm.community}, {farm.county}
                      </p>
                      <p className="mt-1 text-[11px] text-primary">
                        {farm.activityCount} {farm.activityCount === 1 ? "record" : "records"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold text-ink">Recent activity</h2>
        {recentActivities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white/70 px-6 py-8 text-center text-sm text-ink-soft">
            No farm activities recorded yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            {recentActivities.map((activity, index) => {
              const meta = activityMeta(activity.activityType);
              return (
                <div
                  key={activity.id}
                  className={`flex items-start gap-3 px-4 py-3.5 ${
                    index > 0 ? "border-t border-line/70" : ""
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                    <meta.Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{meta.label}</p>
                    <p className="line-clamp-2 text-xs text-ink-soft">{activity.description}</p>
                    <p className="mt-0.5 text-[11px] text-ink-soft">
                      {activity.farmName} · {formatFullDate(activity.activityDate)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmStatus}
        title={active ? "Deactivate this farmer?" : "Reactivate this farmer?"}
        message={
          active
            ? "The farmer will be signed out and cannot sign in until reactivated. Their records are kept."
            : "The farmer will be able to sign in and record activities again."
        }
        confirmLabel={active ? "Deactivate account" : "Reactivate account"}
        tone={active ? "danger" : "primary"}
        busy={statusBusy}
        onConfirm={handleStatusChange}
        onCancel={() => setConfirmStatus(false)}
      />

      <Modal
        open={resetOpen}
        title="Reset farmer PIN"
        onClose={() => {
          setResetOpen(false);
          setTempPin("");
          setResetPin("");
        }}
        footer={
          tempPin ? (
            <Button
              onClick={() => {
                setResetOpen(false);
                setTempPin("");
              }}
            >
              Done
            </Button>
          ) : undefined
        }
      >
        {tempPin ? (
          <div>
            <p className="text-sm leading-relaxed text-ink-soft">
              Ask {farmer.fullName} to sign in with this temporary PIN and change it
              in Profile right away. All of their other devices have been signed out.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-3">
              <code className="flex-1 font-mono text-2xl font-bold tracking-[0.3em] text-ink">
                {tempPin}
              </code>
              <Button variant="secondary" size="sm" onClick={copyTempPin}>
                <ClipboardCopy size={15} /> Copy
              </Button>
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              It will not be shown again. This reset was recorded in the security log.
            </p>
          </div>
        ) : (
          <form onSubmit={handleResetPin} className="space-y-4">
            <ErrorBanner message={resetError} />
            <p className="text-sm leading-relaxed text-ink-soft">
              Use this when a farmer cannot sign in. Their records are not changed, but all of
              their phones will be signed out.
            </p>
            <Field
              label="Your PIN"
              htmlFor="resetAdminPin"
              hint="Your administrator PIN is required to confirm."
            >
              <TextInput
                id="resetAdminPin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={6}
                value={resetPin}
                onChange={(event) =>
                  setResetPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </Field>
            <Button type="submit" className="w-full" loading={resetBusy}>
              <KeyRound size={16} /> Create temporary PIN
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
