import { ChevronDown, ChevronUp, PencilLine, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChoiceButton, DateChoice, MoneyPad, PictureGrid, Section, moneyText } from "../../components/Choices.jsx";
import { Button, ConfirmDialog, ErrorBanner, Field, PageHeader, PageLoading, Textarea } from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { newClientId, todayInputValue } from "../../lib/format.js";
import { ICONS } from "../../lib/icons.js";
import { formatMoney } from "../../lib/ledger.js";
import { expenseCategoriesForFarm } from "../../lib/farmTypes.js";
import { ProductionChips } from "../../components/ActivityForm.jsx";
import { productionsForFarm } from "../../lib/production.js";
import { CURRENCIES, EXPENSE_CATEGORIES, WORDS, unitText } from "../../lib/words.js";

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
        // Keep cents (US dollars can have them).
        amount: moneyText(existing.amount),
        currency: existing.currency,
        farmClientId: existing.farmClientId || "",
        harvestClientId: existing.harvestClientId || "",
        productionClientId: existing.productionClientId || "",
        expenseDate: existing.expenseDate,
        notes: existing.notes || ""
      });
      return;
    }
    // Opened from a harvest ("cost for this harvest") or from a farm.
    const wantedHarvest = records.harvests.find((item) => item.clientId === params.get("harvest"));
    const wantedProduction = records.productions.find(
      (item) => item.clientId === (params.get("production") || wantedHarvest?.productionClientId)
    );
    const wanted = wantedHarvest?.farmClientId || wantedProduction?.farmClientId || params.get("farm");
    const farm = farms.find((item) => item.clientId === wanted || item.id === wanted);
    setForm({
      category: "",
      amount: "",
      currency: "LRD",
      farmClientId: farm?.clientId || "",
      harvestClientId: wantedHarvest?.clientId || "",
      productionClientId: wantedProduction?.clientId || "",
      expenseDate: todayInputValue(),
      notes: ""
    });
  }, [clientId, existing, farms, records.harvests, records.productions, params, form]);

  if (!form) {
    if (clientId && !existing && !loading) return <PageHeader title="Not found" backTo="/app/money" />;
    return <PageLoading label="Opening…" />;
  }

  const chosenFarm = farms.find((item) => item.clientId === form.farmClientId);
  // Costs that fit the chosen farm (seeds for crops, feed for animals…).
  const fitting = chosenFarm ? expenseCategoriesForFarm(chosenFarm.farmType) : EXPENSE_CATEGORIES;
  const categoryChoices =
    form.category && !fitting.some((item) => item.value === form.category)
      ? [...fitting, EXPENSE_CATEGORIES.find((item) => item.value === form.category)].filter(Boolean)
      : fitting;
  const farmProductions = productionsForFarm(chosenFarm, records.productions).filter(
    (item) => item.status === "active" || item.clientId === form.productionClientId
  );
  // With a planting or group chosen, only its harvests are offered.
  const farmBatches = chosenFarm
    ? records.harvests.filter(
        (item) =>
          item.farmClientId === chosenFarm.clientId &&
          (!form.productionClientId || item.productionClientId === form.productionClientId)
      )
    : [];
  const backTo = params.get("production") ? `/app/productions/${params.get("production")}` : "/app/money";

  const set = (field) => (value) => {
    setError("");
    setForm((current) => ({ ...current, [field]: value ?? "" }));
  };

  async function save() {
    if (!form.category) return setError("Choose what you spent the money on.");
    if (Number(form.amount || 0) <= 0) return setError("Enter the amount.");
    if (form.currency === "LRD" && !Number.isInteger(Number(form.amount))) {
      return setError("Liberian dollars have no cents. Remove the decimal point.");
    }
    const payload = {
      category: form.category,
      amount: Math.round(Number(form.amount) * 100) / 100,
      currency: form.currency,
      farmClientId: form.farmClientId || null,
      harvestClientId: form.harvestClientId || null,
      productionClientId: form.productionClientId || null,
      expenseDate: form.expenseDate,
      notes: form.notes.trim() || null
    };
    setBusy(true);
    try {
      if (existing) await updateRecord(existing, payload);
      else await createRecord("expenses", { clientId: newClientId(), ...payload });
      toast.success(`You spend ${formatMoney(payload.amount, payload.currency)}. ${online ? "" : WORDS.saved.say}`);
      navigate(backTo, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={WORDS.spend.text} subtitle="Tap the pictures and the numbers." backTo={backTo} say={WORDS.spend} />
      <ErrorBanner message={error} />

      <Section title={WORDS.spentOn}>
        <PictureGrid items={categoryChoices} value={form.category} onChange={set("category")} />
      </Section>

      <Section title={WORDS.moneyType}>
        <div className="grid grid-cols-2 gap-2">
          {CURRENCIES.map((item) => (
            <ChoiceButton
              key={item.value}
              words={item}
              selected={form.currency === item.value}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  currency: item.value,
                  // Liberian dollars are whole amounts: drop any cents.
                  amount: item.value === "LRD" ? String(current.amount).split(".")[0] : current.amount
                }))
              }
            >
              <item.Icon size={18} aria-hidden="true" /> {item.value === "USD" ? "US$" : "L$"} · {item.text}
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
              onClick={() =>
                setForm((current) => ({ ...current, farmClientId: "", harvestClientId: "", productionClientId: "" }))
              }
            >
              All my farms
            </ChoiceButton>
            {farms.map((farm) => (
              <ChoiceButton
                key={farm.clientId || farm.id}
                words={{ say: farm.farmName }}
                selected={form.farmClientId === farm.clientId}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    farmClientId: farm.clientId,
                    harvestClientId: current.farmClientId === farm.clientId ? current.harvestClientId : "",
                    productionClientId: current.farmClientId === farm.clientId ? current.productionClientId : ""
                  }))
                }
              >
                {farm.farmName}
              </ChoiceButton>
            ))}
          </div>
        </Section>
      )}

      {farmProductions.length > 0 && (
        <Section title={WORDS.forWhich} hint="you can leave it">
          <ProductionChips
            items={farmProductions}
            selected={form.productionClientId}
            onPick={(id) =>
              setForm((current) => {
                const productionClientId = current.productionClientId === id ? "" : id;
                const harvest = records.harvests.find((item) => item.clientId === current.harvestClientId);
                const keepHarvest = !productionClientId || harvest?.productionClientId === productionClientId;
                return { ...current, productionClientId, harvestClientId: keepHarvest ? current.harvestClientId : "" };
              })
            }
          />
        </Section>
      )}

      {farmBatches.length > 0 && (
        <Section
          title={{ text: "For which harvest?", say: "Was this money for one harvest? Touch it, or leave it." }}
          hint="you can leave it"
        >
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton
              words={{ say: "The whole farm." }}
              selected={!form.harvestClientId}
              onClick={() => set("harvestClientId")("")}
            >
              The whole farm
            </ChoiceButton>
            {farmBatches.map((harvest) => (
              <ChoiceButton
                key={harvest.clientId}
                words={{ say: `${harvest.crop} harvest of ${harvest.harvestDate}.` }}
                selected={form.harvestClientId === harvest.clientId}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    harvestClientId: harvest.clientId,
                    productionClientId: harvest.productionClientId || current.productionClientId
                  }))
                }
                className="flex-col gap-0 py-2"
              >
                {harvest.crop}
                <span className="text-xs font-normal">
                  {harvest.quantity} {unitText(harvest.unit)} · {harvest.harvestDate}
                </span>
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
        <ICONS.expense size={20} aria-hidden="true" /> {WORDS.save.text}
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
              navigate(backTo, { replace: true });
            }}
            onCancel={() => setConfirmDelete(false)}
          />
        </>
      )}
    </div>
  );
}
