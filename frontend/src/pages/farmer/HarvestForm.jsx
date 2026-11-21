import { ChevronDown, ChevronUp, PencilLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ChoiceButton,
  DateChoice,
  PictureGrid,
  QuantityStepper,
  Section
} from "../../components/Choices.jsx";
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  PageLoading,
  Textarea,
  buttonClass
} from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { newClientId, todayInputValue } from "../../lib/format.js";
import { ANIMAL_PRODUCT_NAMES, farmYields, yieldChoices } from "../../lib/farmCrops.js";
import { farmMeta } from "../../lib/labels.js";
import { batchStatus } from "../../lib/ledger.js";
import { ProductionChips } from "../../components/ActivityForm.jsx";
import { productionsForFarm } from "../../lib/production.js";
import { HARVEST_UNITS, STORAGE_PLACES, WORDS, growOption, unitText } from "../../lib/words.js";

// A crop planting gives that crop; an animal group gives eggs or milk.
function productionGives(production, crop) {
  if (!crop) return true;
  const wanted = String(crop).toLowerCase();
  if (production.productionKind === "crop") return production.name.toLowerCase() === wanted;
  return ANIMAL_PRODUCT_NAMES.some((name) => name.toLowerCase() === wanted);
}

// Put a harvest: one batch of a crop brought from a farm. Pictures only;
// a helper can add notes under "Write it myself".
export default function HarvestForm() {
  const { clientId } = useParams();
  const editing = Boolean(clientId);
  const [params] = useSearchParams();
  const { farms, records, loading } = useFarmerData();
  const { online, createRecord, updateRecord } = useSync();
  const navigate = useNavigate();
  const toast = useToast();

  const existing = editing ? records.harvests.find((item) => item.clientId === clientId) : null;
  const [form, setForm] = useState(null);
  const [showWrite, setShowWrite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (form) return;
    if (editing) {
      if (!existing) return;
      setForm({
        farmClientId: existing.farmClientId,
        crop: existing.crop,
        quantity: String(existing.quantity ?? ""),
        unit: existing.unit,
        harvestDate: existing.harvestDate,
        storage: existing.storage || "",
        notes: existing.notes || "",
        productionClientId: existing.productionClientId || ""
      });
      return;
    }
    if (loading && farms.length === 0) return;
    const production = records.productions.find((item) => item.clientId === params.get("production"));
    const wanted = production?.farmClientId || params.get("farm");
    const farm =
      farms.find((item) => item.clientId === wanted || item.id === wanted) || farms[0] || null;
    setForm({
      farmClientId: farm?.clientId || "",
      productionClientId: production?.clientId || "",
      crop: production?.productionKind === "crop" ? production.name : "",
      quantity: "",
      unit: "bags",
      harvestDate: todayInputValue(),
      storage: "",
      notes: ""
    });
  }, [editing, existing, farms, loading, params, form, records.productions]);

  const farm = farms.find((item) => item.clientId === form?.farmClientId);
  // Only what this farm grows or raises can be harvested from it.
  const cropChoices = useMemo(() => yieldChoices(farm).map((name) => growOption(name)), [farm]);
  // After selling from a batch, its crop, unit and farm stay as they are, and
  // it can't be made smaller than what was sold.
  const sold = existing ? batchStatus(existing, records.sales, records.inspections).sold : 0;
  const locked = sold > 0;
  // A harvest can say which planting (or which animal group, for eggs and
  // milk) it came from, so each one has its own record.
  const productionChoices = productionsForFarm(farm, records.productions).filter(
    (item) => item.status === "active" || item.clientId === form?.productionClientId
  );

  useEffect(() => {
    if (!form || !farm || !form.crop || locked) return;
    if (!farmYields(farm, form.crop)) setForm((current) => ({ ...current, crop: "" }));
  }, [farm, form, locked]);

  if (loading && !form) return <PageLoading label="Opening…" />;
  if (editing && !existing) {
    return (
      <div>
        <PageHeader title="Harvest not found" backTo="/app/harvests" />
        <p className="text-sm text-ink-soft">This harvest is not on this phone.</p>
      </div>
    );
  }
  if (!editing && farms.length === 0) {
    return (
      <div>
        <PageHeader title={WORDS.addHarvest.text} backTo="/app/harvests" />
        <EmptyState
          title="Add your farm first"
          description="Then you can put the harvest from it."
          action={
            <Link to="/app/farms/new" className={buttonClass("primary", "md")}>
              {WORDS.addFarm.text}
            </Link>
          }
        />
      </div>
    );
  }
  if (!form) return <PageLoading label="Opening…" />;

  const set = (field) => (value) => {
    setError("");
    setForm((current) => {
      const next = { ...current, [field]: value ?? "" };
      if (field === "farmClientId" && value !== current.farmClientId) next.productionClientId = "";
      if (field === "crop") {
        const chosen = records.productions.find((item) => item.clientId === current.productionClientId);
        if (chosen && !productionGives(chosen, value)) next.productionClientId = "";
      }
      return next;
    });
  };

  function chooseProduction(id) {
    setError("");
    setForm((current) => {
      if (current.productionClientId === id) return { ...current, productionClientId: "" };
      const chosen = records.productions.find((item) => item.clientId === id);
      const crop =
        chosen.productionKind === "crop" ? chosen.name : productionGives(chosen, current.crop) ? current.crop : "";
      return { ...current, productionClientId: id, crop };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.farmClientId) return setError("Choose the farm.");
    if (!form.crop) return setError("Choose the crop you harvested.");
    if (!locked && !farmYields(farm, form.crop)) return setError(`${form.crop} is not on this farm. Add it to the farm first.`);
    if (form.quantity === "" || Number(form.quantity) <= 0) return setError("Enter how much you harvested.");
    if (Number(form.quantity) < sold) {
      return setError(`You already sold ${sold} ${unitText(form.unit)} from this harvest. It can't be less than that.`);
    }
    const payload = {
      ...(locked ? {} : { farmClientId: form.farmClientId, crop: form.crop, unit: form.unit }),
      quantity: Number(form.quantity),
      harvestDate: form.harvestDate,
      storage: form.storage || null,
      notes: form.notes.trim() || null,
      ...(locked ? {} : { productionClientId: form.productionClientId || null })
    };
    setBusy(true);
    try {
      const record = editing
        ? await updateRecord(existing, payload)
        : await createRecord("harvests", { clientId: newClientId(), passportPublic: false, ...payload });
      toast.success(online ? WORDS.savedSending.text : WORDS.saved.say);
      navigate(`/app/harvests/${record.clientId}`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={editing ? "Change harvest" : WORDS.addHarvest.text}
        subtitle="Tap the pictures. No typing needed."
        backTo={editing ? `/app/harvests/${clientId}` : "/app/harvests"}
        say={WORDS.addHarvest}
      />
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={error} />

        {locked && (
          <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary-dark" data-say="You already sold from this harvest, so only how much, the day and where you keep it can change.">
            You already sold {sold} {unitText(form.unit)} from this harvest, so the farm, the crop and the unit stay
            the same.
          </p>
        )}

        {farms.length > 1 && !locked && (
          <Section title={WORDS.whichFarm}>
            <div className="grid grid-cols-2 gap-2">
              {farms.map((item) => {
                const meta = farmMeta(item.farmType);
                return (
                  <ChoiceButton
                    key={item.clientId || item.id}
                    words={{ say: item.farmName }}
                    selected={form.farmClientId === item.clientId}
                    onClick={() => set("farmClientId")(item.clientId)}
                    className="justify-start text-left"
                  >
                    <meta.Icon size={18} aria-hidden="true" /> {item.farmName}
                  </ChoiceButton>
                );
              })}
            </div>
          </Section>
        )}

        {!locked && (
          <Section title={WORDS.whatCrop}>
            {cropChoices.length > 0 ? (
              <>
                <p className="-mt-1 mb-2 text-xs text-ink-soft">What {farm?.farmName || "this farm"} grows or raises.</p>
                <PictureGrid items={cropChoices} value={form.crop} onChange={set("crop")} columns={4} />
              </>
            ) : (
              <div className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800" data-say="This farm has nothing on it yet. Add what you grow to the farm first.">
                <p>This farm has no crops or animals on it yet. Add what you grow, then put the harvest.</p>
                {farm && (
                  <Link to={`/app/farms/${farm.id}/edit`} className={`${buttonClass("primary", "sm")} mt-3`}>
                    Add what this farm grows
                  </Link>
                )}
              </div>
            )}
          </Section>
        )}

        {!locked && productionChoices.length > 0 && (
          <Section title={WORDS.forWhich} hint="you can leave it">
            <ProductionChips
              items={productionChoices}
              selected={form.productionClientId}
              onPick={chooseProduction}
            />
          </Section>
        )}

        <Section title={WORDS.harvestHowMuch}>
          <QuantityStepper value={form.quantity} onChange={set("quantity")} label="How much" />
          {locked ? (
            <p className="mt-2 text-sm text-ink-soft">
              In {unitText(form.unit)}. At least {sold}, because that much is sold.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {HARVEST_UNITS.map((unit) => (
                <ChoiceButton
                  key={unit.value}
                  words={unit}
                  selected={form.unit === unit.value}
                  onClick={() => set("unit")(unit.value)}
                  className="flex-col gap-0.5 py-1 text-xs"
                >
                  <unit.Icon size={22} aria-hidden="true" />
                  {unit.text}
                </ChoiceButton>
              ))}
            </div>
          )}
        </Section>

        <DateChoice value={form.harvestDate} onChange={set("harvestDate")} />

        <Section title={WORDS.whereKept} hint="you can leave it">
          <PictureGrid items={STORAGE_PLACES} value={form.storage} onChange={set("storage")} />
        </Section>

        <Section>
          <button
            type="button"
            onClick={() => setShowWrite((value) => !value)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={showWrite}
            data-say={WORDS.writeMyself.say}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-ink">
              <PencilLine size={20} className="text-ink-soft" aria-hidden="true" /> {WORDS.writeMyself.text}
            </span>
            {showWrite ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {showWrite && (
            <Field label="Things to remember" htmlFor="notes" className="mt-4">
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => set("notes")(event.target.value)}
                maxLength={1000}
              />
            </Field>
          )}
        </Section>

        <Button type="submit" size="lg" className="w-full text-lg" loading={busy} data-say={WORDS.save.say}>
          {WORDS.save.text}
        </Button>
      </form>
    </div>
  );
}
