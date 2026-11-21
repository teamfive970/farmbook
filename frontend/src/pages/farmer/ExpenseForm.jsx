import { ChevronDown, ChevronUp, PencilLine, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChoiceButton, DateChoice, MoneyPad, PictureGrid, Section } from "../../components/Choices.jsx";
import { Button, ConfirmDialog, ErrorBanner, Field, PageHeader, PageLoading, Textarea } from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { newClientId, todayInputValue } from "../../lib/format.js";
import { formatMoney } from "../../lib/ledger.js";
import { CURRENCIES, EXPENSE_CATEGORIES, WORDS } from "../../lib/words.js";

// "I spend money": what for (pictures), how much (number keys), which farm.
// Also used to change or delete a spending (/app/money/spend/:clientId).
export default function ExpenseForm() {
  const { clientId } = useParams();
  const [params] = useSearchParams();
  const { farms, records, loading } = useFarmerData();
  const { createRecord, updateRecord, deleteRecord, online } = useSync();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = clientId ? records.expenses.find((item) => item.clientId === clientId) : null;

  const [form, setForm] = useState(null);
  const [showWrite, setShowWrite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (form) return;
    if (clientId) {
      if (!existing) return;
      setForm({
        category: existing.category,
        amount: String(Math.round(existing.amount)),
        currency: existing.currency,
        farmClientId: existing.farmClientId || "",
        expenseDate: existing.expenseDate,
        notes: existing.notes || ""
      });
      return;
    }
    const wanted = params.get("farm");
    const farm = farms.find((item) => item.clientId === wanted || item.id === wanted);
    setForm({
      category: "",
      amount: "",
      currency: "LRD",
      farmClientId: farm?.clientId || "",
      expenseDate: todayInputValue(),
      notes: ""
    });
  }, [clientId, existing, farms, params, form]);

  if (!form) {
    if (clientId && !existing && !loading) return <PageHeader title="Not found" backTo="/app/money" />;
    return <PageLoading label="Opening…" />;
  }

  const set = (field) => (value) => {
    setError("");
    setForm((current) => ({ ...current, [field]: value ?? "" }));
  };

  async function save() {
    if (!form.category) return setError("Touch what you spend the money on.");
    if (Number(form.amount || 0) <= 0) return setError("Put the money with the numbers.");
    const payload = {
      category: form.category,
      amount: Number(form.amount),
      currency: form.currency,
      farmClientId: form.farmClientId || null,
      expenseDate: form.expenseDate,
      notes: form.notes.trim() || null
    };
    setBusy(true);
    try {
      if (existing) await updateRecord(existing, payload);
      else await createRecord("expenses", { clientId: newClientId(), ...payload });
      toast.success(`You spend ${formatMoney(payload.amount, payload.currency)}. ${online ? "" : WORDS.saved.say}`);
      navigate("/app/money", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={WORDS.spend.text} subtitle="Touch the pictures and the numbers." backTo="/app/money" say={WORDS.spend} />
      <ErrorBanner message={error} />

      <Section title={WORDS.spentOn}>
        <PictureGrid items={EXPENSE_CATEGORIES} value={form.category} onChange={set("category")} />
      </Section>

      <Section title={WORDS.moneyType}>
        <div className="grid grid-cols-2 gap-2">
          {CURRENCIES.map((item) => (
            <ChoiceButton key={item.value} words={item} selected={form.currency === item.value} onClick={() => set("currency")(item.value)}>
              <span aria-hidden="true">{item.emoji}</span> {item.text}
            </ChoiceButton>
          ))}
        </div>
      </Section>

      <Section title={WORDS.howMuchMoney}>
        <MoneyPad value={form.amount} onChange={set("amount")} currency={form.currency} />
      </Section>

      {farms.length > 0 && (
        <Section title={WORDS.whichFarm} hint="you can leave it">
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton
              words={{ say: "All my farms." }}
              selected={!form.farmClientId}
              onClick={() => set("farmClientId")("")}
            >
              All my farms
            </ChoiceButton>
            {farms.map((farm) => (
              <ChoiceButton
                key={farm.clientId || farm.id}
                words={{ say: farm.farmName }}
                selected={form.farmClientId === farm.clientId}
                onClick={() => set("farmClientId")(farm.clientId)}
              >
                {farm.farmName}
              </ChoiceButton>
            ))}
          </div>
        </Section>
      )}

      <DateChoice value={form.expenseDate} onChange={set("expenseDate")} />

      <Section>
        <button
          type="button"
          onClick={() => setShowWrite((value) => !value)}
          className="flex w-full items-center justify-between text-left"
          data-say={WORDS.writeMyself.say}
        >
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <PencilLine size={20} className="text-ink-soft" aria-hidden="true" /> {WORDS.writeMyself.text}
          </span>
          {showWrite ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {showWrite && (
          <Field label="Things to remember" htmlFor="notes" className="mt-4">
            <Textarea id="notes" value={form.notes} onChange={(event) => set("notes")(event.target.value)} maxLength={1000} />
          </Field>
        )}
      </Section>

      <Button size="lg" className="w-full text-lg" loading={busy} onClick={save} data-say={WORDS.save.say}>
        💸 {WORDS.save.text}
      </Button>

      {existing && (
        <>
          <Button variant="secondary" className="w-full text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Delete
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            title="Delete this spending?"
            message="It will be taken out of your money."
            confirmLabel="Delete"
            onConfirm={async () => {
              await deleteRecord(existing);
              navigate("/app/money", { replace: true });
            }}
            onCancel={() => setConfirmDelete(false)}
          />
        </>
      )}
    </div>
  );
}
