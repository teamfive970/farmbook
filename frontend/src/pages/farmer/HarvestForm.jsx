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
import { farmMeta } from "../../lib/labels.js";
import { ANIMALS, CROPS, HARVEST_UNITS, STORAGE_PLACES, WORDS } from "../../lib/words.js";

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
        notes: existing.notes || ""
      });
      return;
    }
    if (loading && farms.length === 0) return;
    const wanted = params.get("farm");
    const farm =
      farms.find((item) => item.clientId === wanted || item.id === wanted) || farms[0] || null;
    setForm({
      farmClientId: farm?.clientId || "",
      crop: "",
      quantity: "",
      unit: "bags",
      harvestDate: todayInputValue(),
      storage: "",
      notes: ""
    });
  }, [editing, existing, farms, loading, params, form]);

  const farm = farms.find((item) => item.clientId === form?.farmClientId);
  // Crops this farm grows come first.
  const cropChoices = useMemo(() => {
    const all = [...CROPS, ...ANIMALS];
    const grown = String(farm?.mainCropOrLivestock || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const first = all.filter((item) => grown.includes(item.value.toLowerCase()));
    const rest = all.filter((item) => !grown.includes(item.value.toLowerCase()));
    return [...first, ...rest];
  }, [farm]);

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
    setForm((current) => ({ ...current, [field]: value ?? "" }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.farmClientId) return setError("Choose the farm.");
    if (!form.crop) return setError("Touch the crop you harvest.");
    if (form.quantity === "" || Number(form.quantity) <= 0) return setError("Touch plus to show how much you get.");
    const payload = {
      farmClientId: form.farmClientId,
      crop: form.crop,
      quantity: Number(form.quantity),
      unit: form.unit,
      harvestDate: form.harvestDate,
      storage: form.storage || null,
      notes: form.notes.trim() || null
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
        subtitle="Touch the pictures. You do not need to write."
        backTo={editing ? `/app/harvests/${clientId}` : "/app/harvests"}
        say={WORDS.addHarvest}
      />
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={error} />

        {farms.length > 1 && (
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

        <Section title={WORDS.whatCrop}>
          <PictureGrid items={cropChoices} value={form.crop} onChange={set("crop")} columns={4} />
        </Section>

        <Section title={WORDS.harvestHowMuch}>
          <QuantityStepper value={form.quantity} onChange={set("quantity")} label="How much" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {HARVEST_UNITS.map((unit) => (
              <ChoiceButton
                key={unit.value}
                words={unit}
                selected={form.unit === unit.value}
                onClick={() => set("unit")(unit.value)}
                className="flex-col gap-0.5 py-1 text-xs"
              >
                <span className="text-2xl" aria-hidden="true">
                  {unit.emoji}
                </span>
                {unit.text}
              </ChoiceButton>
            ))}
          </div>
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
