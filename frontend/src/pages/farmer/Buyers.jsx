import { ChevronRight, Handshake, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PictureGrid, Section } from "../../components/Choices.jsx";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  PageLoading,
  StatusChip,
  TextInput,
  buttonClass
} from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { formatDate, newClientId } from "../../lib/format.js";
import { ICONS } from "../../lib/icons.js";
import { formatMoney } from "../../lib/ledger.js";
import { BUYER_TYPES, optionFor } from "../../lib/words.js";
import { WORDS } from "../../lib/words.js";

function typeOf(buyer) {
  return optionFor(BUYER_TYPES, buyer?.buyerType) || BUYER_TYPES[BUYER_TYPES.length - 1];
}

// The people and businesses the farmer sells to: see what each bought,
// change a name or phone number, add one, or take one off.
export default function Buyers() {
  const { records, loading } = useFarmerData();
  const rows = useMemo(
    () =>
      records.buyers
        .map((buyer) => {
          const sales = records.sales.filter((sale) => sale.buyerClientId === buyer.clientId);
          const sold = { LRD: 0, USD: 0 };
          for (const sale of sales) sold[sale.currency] += Number(sale.totalAmount || 0);
          return { buyer, count: sales.length, sold };
        })
        .sort((a, b) => b.count - a.count || a.buyer.name.localeCompare(b.buyer.name)),
    [records]
  );

  if (loading && records.buyers.length === 0) return <PageLoading label="Opening your buyers…" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="My buyers"
        subtitle="The people who buy from you."
        backTo="/app/money"
        say={{ say: "The people who buy from you. Touch one to change it." }}
        action={
          <Link to="/app/money/buyers/new" className={buttonClass("primary", "sm")}>
            <Plus size={16} /> Add
          </Link>
        }
      />
      <Link
        to="/app/requests"
        data-say={WORDS.requestsOpen.say}
        className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card"
      >
        <Handshake size={22} className="text-primary" aria-hidden="true" />
        <span className="flex-1">
          <span className="block text-sm font-bold text-ink">{WORDS.requestsOpen.text}</span>
          <span className="block text-xs text-ink-soft">Buyers who scanned your Harvest Passport</span>
        </span>
        <ChevronRight size={18} className="text-ink-soft" aria-hidden="true" />
      </Link>
      {rows.length === 0 ? (
        <EmptyState
          icon={ICONS.buyer}
          title="No buyers yet"
          description="When you sell, choose who bought it. They will show here."
        />
      ) : (
        <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0 xl:grid-cols-3">
          {rows.map(({ buyer, count, sold }) => {
            const type = typeOf(buyer);
            return (
              <Link
                key={buyer.clientId}
                to={`/app/money/buyers/${buyer.clientId}`}
                data-say={`${buyer.name}. ${type.text}. Bought ${count} times.`}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-dark">
                  <type.Icon size={22} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-ink">{buyer.name}</p>
                  <p className="text-xs text-ink-soft">
                    {type.text} · bought {count} {count === 1 ? "time" : "times"}
                    {sold.LRD ? ` · ${formatMoney(sold.LRD, "LRD")}` : ""}
                    {sold.USD ? ` · ${formatMoney(sold.USD, "USD")}` : ""}
                  </p>
                </div>
                {buyer.syncStatus && buyer.syncStatus !== "synced" && <StatusChip status={buyer.syncStatus} showLabel={false} />}
                <ChevronRight size={18} className="text-ink-soft" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BuyerForm() {
  const { clientId } = useParams();
  const editing = Boolean(clientId);
  const { records, loading } = useFarmerData();
  const { createRecord, updateRecord, deleteRecord } = useSync();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = editing ? records.buyers.find((item) => item.clientId === clientId) : null;
  const [form, setForm] = useState(editing ? null : { name: "", buyerType: "market_woman", phoneNumber: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!form && existing) {
      setForm({ name: existing.name || "", buyerType: existing.buyerType || "other", phoneNumber: existing.phoneNumber || "" });
    }
  }, [existing, form]);

  if (editing && !existing) {
    return loading ? <PageLoading label="Opening…" /> : <PageHeader title="Buyer not found" backTo="/app/money/buyers" />;
  }
  if (!form) return <PageLoading label="Opening…" />;

  const sales = existing ? records.sales.filter((sale) => sale.buyerClientId === existing.clientId) : [];

  async function save() {
    setError("");
    const name = form.name.trim() || typeOf(form).text;
    const payload = { name, buyerType: form.buyerType, phoneNumber: form.phoneNumber.trim() || null };
    setBusy(true);
    try {
      if (editing) await updateRecord(existing, payload);
      else await createRecord("buyers", { clientId: newClientId(), ...payload });
      toast.success(editing ? "The buyer changed." : "The buyer is saved.");
      navigate("/app/money/buyers", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    try {
      await deleteRecord(existing);
      toast.success("The buyer is taken off.");
      navigate("/app/money/buyers", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="space-y-4 lg:mx-auto lg:max-w-2xl">
      <PageHeader title={editing ? "Change buyer" : "Add buyer"} backTo="/app/money/buyers" say={{ say: "Who is the buyer?" }} />
      <ErrorBanner message={error} />

      <Section title={{ text: "What kind of buyer?", say: "What kind of buyer? Touch the picture." }}>
        <PictureGrid
          items={BUYER_TYPES}
          value={form.buyerType}
          onChange={(value) => setForm((current) => ({ ...current, buyerType: value || "other" }))}
        />
      </Section>

      <Section>
        <Field label="Name" htmlFor="buyer-name" hint="somebody can write it">
          <TextInput
            id="buyer-name"
            value={form.name}
            maxLength={120}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>
        <Field label="Phone number" htmlFor="buyer-phone" hint="you can leave it" className="mt-4">
          <TextInput
            id="buyer-phone"
            type="tel"
            inputMode="tel"
            placeholder="077 000 0000"
            value={form.phoneNumber}
            onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))}
          />
        </Field>
      </Section>

      <Button size="lg" className="w-full text-lg" loading={busy} onClick={save}>
        Save
      </Button>

      {editing && sales.length > 0 && (
        <Section title={{ text: "What they bought", say: "What this buyer bought from you." }}>
          <div className="space-y-2">
            {sales.map((sale) => (
              <Link
                key={sale.clientId}
                to={`/app/money/sales/${sale.clientId}`}
                className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm"
              >
                <span>
                  {sale.crop} · {formatDate(sale.saleDate)}
                </span>
                <span className="font-bold">{formatMoney(sale.totalAmount, sale.currency)}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {editing && (
        <>
          <Button variant="secondary" className="w-full text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Take this buyer off
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            title="Take this buyer off?"
            message={
              sales.length > 0
                ? `Their ${sales.length} sale(s) stay in your money, without the buyer's name.`
                : "The buyer will be taken off your list."
            }
            confirmLabel="Take off"
            onConfirm={remove}
            onCancel={() => setConfirmDelete(false)}
          />
        </>
      )}
    </div>
  );
}
