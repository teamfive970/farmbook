import { ChevronRight, Network, Plus, Star, UserMinus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Modal,
  PageHeader,
  PageLoading,
  Select,
  TextInput,
  Textarea
} from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { api } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { COUNTIES } from "../../lib/labels.js";
import { formatMoney } from "../../lib/ledger.js";

const EMPTY = { name: "", county: "", district: "", community: "", description: "" };

export default function AdminCooperatives() {
  const { token } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.get("/api/admin/cooperatives", { token });
      setItems(result.items);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const result = await api.post("/api/admin/cooperatives", form, { token });
      toast.success(`${result.cooperative.name} created. Join code ${result.cooperative.joinCode}.`);
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!items && !error) return <PageLoading label="Loading cooperatives…" />;

  return (
    <div>
      <PageHeader
        title="Cooperatives"
        subtitle="Farmer groups, their members and leaders."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> New cooperative
          </Button>
        }
      />
      <ErrorBanner message={error} />
      {items && items.length === 0 ? (
        <EmptyState icon={Network} title="No cooperatives yet" description="Create a group, then add farmers by phone number or share its join code." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(items || []).map((coop) => (
            <Link key={coop.id} to={`/admin/cooperatives/${coop.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Network size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{coop.name}</p>
                <p className="text-xs text-ink-soft">
                  {coop.memberCount} members · {coop.county}
                  {coop.district ? `, ${coop.district}` : ""} · <span className="font-mono">{coop.joinCode}</span>
                </p>
              </div>
              {coop.status !== "active" && <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px]">Inactive</span>}
              <ChevronRight size={18} className="text-ink-soft" />
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} title="New cooperative" onClose={() => setOpen(false)}>
        <form onSubmit={create} className="space-y-3">
          <ErrorBanner message={formError} />
          <Field label="Name" htmlFor="coop-name">
            <TextInput id="coop-name" value={form.name} onChange={update("name")} placeholder="e.g. Gbarnga Rice Farmers" />
          </Field>
          <Field label="County" htmlFor="coop-county">
            <Select id="coop-county" value={form.county} onChange={update("county")}>
              <option value="">Choose county</option>
              {COUNTIES.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="District" htmlFor="coop-district">
              <TextInput id="coop-district" value={form.district} onChange={update("district")} />
            </Field>
            <Field label="Community" htmlFor="coop-community">
              <TextInput id="coop-community" value={form.community} onChange={update("community")} />
            </Field>
          </div>
          <Field label="Description (optional)" htmlFor="coop-description">
            <Textarea id="coop-description" value={form.description} onChange={update("description")} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function MoneyRow({ label, money }) {
  return (
    <div className="rounded-xl bg-canvas p-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="text-sm font-bold text-ink">
        {formatMoney(money.LRD, "LRD")}
        {money.USD ? ` · ${formatMoney(money.USD, "USD")}` : ""}
      </p>
    </div>
  );
}

export function AdminCooperativeDetail() {
  const { cooperativeId } = useParams();
  const { token } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("member");
  const [addError, setAddError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get(`/api/admin/cooperatives/${cooperativeId}`, { token }));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [cooperativeId, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function addMember(event) {
    event.preventDefault();
    setBusy(true);
    setAddError("");
    try {
      const result = await api.post(`/api/admin/cooperatives/${cooperativeId}/members`, { phoneNumber: phone, role }, { token });
      toast.success(result.message);
      setPhone("");
      load();
    } catch (requestError) {
      setAddError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function setMemberRole(member, nextRole) {
    try {
      const result = await api.patch(
        `/api/admin/cooperatives/${cooperativeId}/members/${member.farmerId}`,
        { role: nextRole },
        { token }
      );
      toast.success(result.message);
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  }

  async function removeMember() {
    try {
      const result = await api.delete(`/api/admin/cooperatives/${cooperativeId}/members/${removing.farmerId}`, { token });
      toast.success(result.message);
      setRemoving(null);
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  }

  async function toggleStatus() {
    const next = data.cooperative.status === "active" ? "inactive" : "active";
    try {
      await api.patch(`/api/admin/cooperatives/${cooperativeId}`, { status: next }, { token });
      toast.success(next === "active" ? "Cooperative reactivated." : "Cooperative deactivated.");
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <PageLoading label="Loading cooperative…" />;
  const { cooperative, members, totals } = data;

  return (
    <div className="space-y-4">
      <PageHeader
        title={cooperative.name}
        subtitle={`${cooperative.memberCount} members · ${cooperative.county}${cooperative.district ? `, ${cooperative.district}` : ""}`}
        backTo="/admin/cooperatives"
        action={
          <Button variant="secondary" onClick={toggleStatus}>
            {cooperative.status === "active" ? "Deactivate" : "Reactivate"}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Join code</p>
          <p className="mt-1 font-mono text-2xl font-bold text-ink">{cooperative.joinCode}</p>
          <p className="mt-1 text-xs text-ink-soft">Farmers enter this in "My group" to join.</p>
        </Card>
        <Card className="lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Group totals</p>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            <MoneyRow label="Total sales" money={totals.money.sold} />
            <MoneyRow label="Total income" money={totals.money.received} />
            <MoneyRow label="Total expenses" money={totals.money.spent} />
            <MoneyRow label="Profit" money={totals.money.profit} />
          </div>
          {totals.harvest.length > 0 && (
            <p className="mt-3 text-sm text-ink">
              Harvest: {totals.harvest.map((row) => `${row.crop} ${row.quantity} ${row.unit}`).join(" · ")}
            </p>
          )}
          {Object.keys(totals.grades).length > 0 && (
            <p className="mt-1 text-sm text-ink-soft">
              Latest grades: {Object.entries(totals.grades).map(([grade, count]) => `${grade}: ${count}`).join(" · ")}
            </p>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-bold text-ink">Add a member</h2>
        <form onSubmit={addMember} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Farmer phone, e.g. 077 000 0000" inputMode="tel" />
          <Select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Role">
            <option value="member">Member</option>
            <option value="leader">Leader</option>
          </Select>
          <Button type="submit" loading={busy}>
            <UserPlus size={16} /> Add
          </Button>
        </form>
        <ErrorBanner message={addError} />
      </Card>

      <Card>
        <h2 className="text-sm font-bold text-ink">Members</h2>
        <p className="mt-1 text-xs text-ink-soft">
          A member's sales, harvests, farms and phone number stay private. Only the group total
          above is shown.
        </p>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No members yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink-soft">
                <tr>
                  <th className="py-2 pr-3">Farmer</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Shares totals</th>
                  <th className="py-2 pr-3">Joined</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.farmerId} className="border-t border-line">
                    <td className="py-2 pr-3">
                      <Link to={`/admin/farmers/${member.farmerId}`} className="font-semibold text-primary hover:underline">
                        {member.fullName}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {member.role === "leader" ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          <Star size={10} /> Leader
                        </span>
                      ) : (
                        "Member"
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {member.sharesTotals ? "Yes, agreed at join" : "No, totals private"}
                    </td>
                    <td className="py-2 pr-3">{formatDate(member.joinedAt)}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setMemberRole(member, member.role === "leader" ? "member" : "leader")}
                        >
                          {member.role === "leader" ? "Make member" : "Make leader"}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setRemoving(member)} aria-label={`Remove ${member.fullName}`}>
                          <UserMinus size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this member?"
        message={`${removing?.fullName || ""} will leave the group. Their own records are not changed.`}
        confirmLabel="Remove"
        onConfirm={removeMember}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
