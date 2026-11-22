import { ChevronDown, ChevronUp, CircleCheck, Layers, Pencil, PencilLine, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ActivityItem from "../../components/ActivityItem.jsx";
import {
  ChoiceButton,
  CropIcon,
  DateChoice,
  MoneyPad,
  PictureGrid,
  QuantityStepper,
  Section
} from "../../components/Choices.jsx";
import {
  Button,
  ConfirmDialog,
  ErrorBanner,
  Field,
  PageHeader,
  PageLoading,
  Textarea,
  TextInput,
  buttonClass
} from "../../components/ui.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { ANIMAL_PRODUCT_NAMES, farmCrops } from "../../lib/farmCrops.js";
import { farmCategory, farmSupportsAnimals, farmSupportsCrops } from "../../lib/farmTypes.js";
import { formatDate, newClientId, todayInputValue } from "../../lib/format.js";
import { ICONS } from "../../lib/icons.js";
import { activityMeta } from "../../lib/labels.js";
import { formatMoney, productionMoney, sayMoney } from "../../lib/ledger.js";
import {
  ANIMAL_ADD_EVENTS,
  animalCount,
  animalTotals,
  eventsFor,
  linkedRecords,
  productionTitle
} from "../../lib/production.js";
import {
  AGE_GROUPS,
  ANIMAL_EVENTS,
  ANIMAL_SOURCES,
  ANIMALS,
  BIRDS,
  CROP_METHODS,
  CROPS,
  CURRENCIES,
  DEATH_CAUSES,
  PLOT_CHOICES,
  SEED_SOURCES,
  SIZE_UNITS,
  WORDS,
  growOption,
  optionFor,
  unitText
} from "../../lib/words.js";

// The guide's production records, kept simple: a farm has crop plantings
// and animal groups. Each one has its own work, harvests, costs and sales;
// an animal group also has its count (born, bought, died, sold…).

const PLOTS = PLOT_CHOICES.map((item) => ({ ...item, value: item.text }));

function writeToggle(open, setOpen) {
  return (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      className="flex w-full items-center justify-between text-left"
      aria-expanded={open}
      data-say={WORDS.writeMyself.say}
    >
      <span className="flex items-center gap-2 text-sm font-bold text-ink">
        <PencilLine size={20} className="text-ink-soft" aria-hidden="true" /> {WORDS.writeMyself.text}
      </span>
      {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
    </button>
  );
}

function allowsKind(farm, kind) {
  return kind === "animal" ? farmSupportsAnimals(farm?.farmType) : farmSupportsCrops(farm?.farmType);
}

// ---------------------------------------------------------------------------
// Plant a crop / Add animals (and change them)
// ---------------------------------------------------------------------------

export function ProductionForm() {
  const { farmId, clientId } = useParams();
  const editing = Boolean(clientId);
  const [params] = useSearchParams();
  const { farms, farmIdMap, records, activities, loading } = useFarmerData();
  const { online, createRecord, updateRecord, deleteRecord, updateFarm } = useSync();
  const navigate = useNavigate();
  const toast = useToast();

  const existing = editing ? records.productions.find((item) => item.clientId === clientId) : null;
  const farm = editing
    ? farms.find((item) => item.clientId === existing?.farmClientId)
    : farms.find((item) => item.id === (farmIdMap[farmId] || farmId) || item.clientId === farmId);

  const [form, setForm] = useState(null);
  const [showWrite, setShowWrite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (form) return;
    if (editing) {
      if (!existing) return;
      setForm({
        kind: existing.productionKind,
        name: existing.name,
        variety: existing.variety || "",
        label: existing.label || "",
        plot: existing.plot || "",
        area: existing.area === null || existing.area === undefined ? "" : String(existing.area),
        areaUnit: existing.areaUnit || "acres",
        spacing: existing.spacing || "",
        tagNumber: existing.tagNumber || "",
        startDate: existing.startDate,
        source: existing.source || "",
        method: existing.method || "",
        startCount: existing.startCount === null || existing.startCount === undefined ? "" : String(existing.startCount),
        ageGroup: existing.ageGroup || "",
        notes: existing.notes || ""
      });
      setShowWrite(Boolean(existing.variety || existing.label || existing.notes));
      return;
    }
    if (!farm) return;
    const wanted = params.get("kind");
    const kind =
      wanted === "crop" || wanted === "animal"
        ? wanted
        : farmCategory(farm.farmType) === "animal"
          ? "animal"
          : farmCategory(farm.farmType) === "crop"
            ? "crop"
            : "";
    setForm({
      kind,
      name: "",
      variety: "",
      label: "",
      plot: "",
      area: "",
      areaUnit: farm.sizeUnit || "acres",
      spacing: "",
      tagNumber: "",
      startDate: todayInputValue(),
      source: "",
      method: "",
      startCount: "",
      ageGroup: "",
      notes: ""
    });
  }, [editing, existing, farm, params, form]);

  if (!form) {
    if (!loading && ((editing && !existing) || (!editing && !farm))) {
      return (
        <div>
          <PageHeader title="Not found" backTo="/app/farms" />
          <p className="text-sm text-ink-soft">This record is not on this phone.</p>
        </div>
      );
    }
    return <PageLoading label="Opening…" />;
  }

  const set = (field) => (value) => {
    setError("");
    setForm((current) => ({ ...current, [field]: value ?? "" }));
  };
  const isAnimal = form.kind === "animal";
  const blocked = Boolean(form.kind) && !editing && !allowsKind(farm, form.kind);
  // What the farm already has comes first, so the farmer finds it fast.
  const base = isAnimal ? ANIMALS : CROPS;
  const own = farmCrops(farm)
    .filter((name) => !base.some((item) => item.value.toLowerCase() === name.toLowerCase()))
    .filter((name) => !ANIMAL_PRODUCT_NAMES.some((product) => product.toLowerCase() === name.toLowerCase()))
    .map((name) => growOption(name));
  const nameChoices = [...base, ...(isAnimal ? [] : own)];
  const backTo = editing ? `/app/productions/${clientId}` : `/app/farms/${farm?.id || ""}`;
  const linked = existing ? linkedRecords(existing, records, activities) : null;
  const hasRecords = linked ? linked.harvests.length + linked.sales.length + linked.events.length > 0 : false;

  async function makeMixed() {
    setBusy(true);
    try {
      await updateFarm(farm, { farmType: "mixed_farming" });
      toast.success(`${farm.farmName} is now a mixed farm. Nothing was lost.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(extra = {}) {
    if (!form.kind) return setError("Choose crop or animals.");
    if (!form.name.trim()) return setError(isAnimal ? "Choose the animals." : "Choose the crop.");
    if (!form.startDate) return setError("Choose the day.");
    if (form.startDate > todayInputValue()) return setError("That date is in the future. Choose another day.");
    if (isAnimal && !editing && !(Number(form.startCount) > 0)) {
      return setError("Enter how many animals.");
    }
    const payload = {
      ...(editing ? {} : { productionKind: form.kind, farmClientId: farm.clientId }),
      name: form.name.trim(),
      variety: form.variety.trim() || null,
      label: form.label.trim() || null,
      startDate: form.startDate,
      source: form.source || null,
      notes: form.notes.trim() || null,
      ...(isAnimal
        ? {
            startCount: Math.max(0, Math.round(Number(form.startCount || 0))),
            ageGroup: form.ageGroup || null,
            tagNumber: form.tagNumber.trim() || null
          }
        : {
            plot: form.plot || null,
            area: form.area === "" ? null : Number(form.area),
            areaUnit: form.area === "" ? null : form.areaUnit,
            spacing: form.spacing.trim() || null,
            method: form.method || null
          }),
      ...extra
    };
    setBusy(true);
    try {
      // The server adds the name to the farm's list; do the same on the
      // phone so harvests work before the network comes.
      if (farm && !farmCrops(farm).some((name) => name.toLowerCase() === payload.name.toLowerCase())) {
        await updateFarm(farm, { crops: [...farmCrops(farm), payload.name] });
      }
      const record = editing
        ? await updateRecord(existing, payload)
        : await createRecord("productions", { clientId: newClientId(), status: "active", ...payload });
      toast.success(online ? WORDS.savedSending.text : WORDS.saved.say);
      navigate(`/app/productions/${record.clientId}`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const title = editing
    ? `Change ${productionTitle(existing)}`
    : isAnimal
      ? WORDS.addAnimals.text
      : form.kind === "crop"
        ? WORDS.startCrop.text
        : "Crop or animals?";

  return (
    <div className="space-y-4 lg:mx-auto lg:max-w-4xl">
      <PageHeader
        title={title}
        subtitle={farm ? farm.farmName : undefined}
        backTo={backTo}
        say={isAnimal ? WORDS.addAnimals : WORDS.startCrop}
      />
      <ErrorBanner message={error} />

      {!editing && farmCategory(farm?.farmType) === "mixed" && (
        <Section title={{ text: "Crop or animals?", say: "Is it a crop or animals? Touch one." }}>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton words={WORDS.startCrop} selected={form.kind === "crop"} onClick={() => setForm({ ...form, kind: "crop", name: "" })}>
              <ICONS.planting size={20} aria-hidden="true" /> Crop
            </ChoiceButton>
            <ChoiceButton words={WORDS.addAnimals} selected={form.kind === "animal"} onClick={() => setForm({ ...form, kind: "animal", name: "" })}>
              <ICONS.animals size={20} aria-hidden="true" /> Animals
            </ChoiceButton>
          </div>
        </Section>
      )}

      {blocked ? (
        <div
          className="rounded-2xl bg-warning/10 p-4 text-sm text-amber-900"
          data-say={`${farm.farmName} is a ${isAnimal ? "crop" : "animal"} farm. Make it a mixed farm to keep both. Nothing you put before will be lost.`}
        >
          <p className="font-bold">
            {farm.farmName} is {isAnimal ? "a crop farm" : "an animal farm"}.
          </p>
          <p className="mt-1">
            To {isAnimal ? "keep animals" : "plant crops"} here too, make it a mixed farm. All your records stay, and
            the change is written down.
          </p>
          <Button className="mt-3" onClick={makeMixed} loading={busy}>
            <Layers size={16} aria-hidden="true" /> Make it a mixed farm
          </Button>
        </div>
      ) : (
        form.kind && (
          <>
            <Section title={isAnimal ? WORDS.whichAnimal : WORDS.whichCrop}>
              <PictureGrid items={nameChoices} value={form.name} onChange={set("name")} columns={4} />
            </Section>

            <DateChoice
              value={form.startDate}
              onChange={set("startDate")}
              title={isAnimal ? WORDS.startedOn : WORDS.plantedOn}
            />

            {isAnimal ? (
              <>
                <Section title={editing ? { text: "How many at the start?", say: "How many animals at the start?" } : WORDS.howManyAnimals}>
                  <QuantityStepper value={form.startCount} onChange={set("startCount")} label="How many animals" />
                  {editing && (
                    <p className="mt-2 text-xs text-ink-soft">
                      Born, bought, died and sold are put on the group page, not here.
                    </p>
                  )}
                </Section>
                <Section title={WORDS.animalsFrom} hint="you can leave it">
                  <PictureGrid items={ANIMAL_SOURCES} value={form.source} onChange={set("source")} columns={2} />
                </Section>
                <Section title={WORDS.howOld} hint="you can leave it">
                  <PictureGrid items={AGE_GROUPS} value={form.ageGroup} onChange={set("ageGroup")} />
                </Section>
                <Section title={WORDS.tagNumber} hint="you can leave it">
                  <TextInput
                    id="tagNumber"
                    value={form.tagNumber}
                    onChange={(event) => set("tagNumber")(event.target.value)}
                    placeholder="e.g. Tag 12, pen 3"
                    maxLength={60}
                  />
                </Section>
              </>
            ) : (
              <>
                <Section title={WORDS.howPlanted} hint="you can leave it">
                  <PictureGrid items={CROP_METHODS} value={form.method} onChange={set("method")} />
                </Section>
                <Section title={WORDS.seedFrom} hint="you can leave it">
                  <PictureGrid items={SEED_SOURCES} value={form.source} onChange={set("source")} columns={2} />
                </Section>
                <Section title={WORDS.whichPlot} hint="you can leave it">
                  <div className="grid grid-cols-2 gap-2">
                    {PLOTS.map((item) => (
                      <ChoiceButton
                        key={item.key}
                        words={item}
                        selected={form.plot === item.value}
                        onClick={() => set("plot")(form.plot === item.value ? "" : item.value)}
                      >
                        {item.text}
                      </ChoiceButton>
                    ))}
                  </div>
                </Section>
                <Section title={WORDS.howBig} hint="you can leave it">
                  <QuantityStepper value={form.area} onChange={set("area")} step={0.5} label="Size" />
                  {form.area !== "" && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {SIZE_UNITS.map((unit) => (
                        <ChoiceButton
                          key={unit.value}
                          words={unit}
                          selected={form.areaUnit === unit.value}
                          onClick={() => set("areaUnit")(unit.value)}
                        >
                          {unit.text}
                        </ChoiceButton>
                      ))}
                    </div>
                  )}
                </Section>
                <Section title={WORDS.spacing} hint="you can leave it">
                  <TextInput
                    id="spacing"
                    value={form.spacing}
                    onChange={(event) => set("spacing")(event.target.value)}
                    placeholder="e.g. 70 x 30 cm"
                    maxLength={60}
                  />
                </Section>
              </>
            )}

            <Section>
              {writeToggle(showWrite, setShowWrite)}
              {showWrite && (
                <div className="mt-4 space-y-4">
                  <Field label={isAnimal ? "Other animal (not in the pictures)" : "Other crop (not in the pictures)"} htmlFor="name">
                    <TextInput id="name" value={form.name} onChange={(event) => set("name")(event.target.value)} maxLength={80} />
                  </Field>
                  <Field label={isAnimal ? "Breed" : "Variety"} htmlFor="variety">
                    <TextInput
                      id="variety"
                      value={form.variety}
                      onChange={(event) => set("variety")(event.target.value)}
                      placeholder={isAnimal ? "e.g. Broiler, local" : "e.g. NERICA, local"}
                      maxLength={80}
                    />
                  </Field>
                  <Field label="Name to tell it apart" htmlFor="label">
                    <TextInput
                      id="label"
                      value={form.label}
                      onChange={(event) => set("label")(event.target.value)}
                      placeholder={isAnimal ? "e.g. Layers pen 2" : "e.g. Big swamp, 2026"}
                      maxLength={80}
                    />
                  </Field>
                  {!isAnimal && (
                    <Field label="Place on the farm" htmlFor="plot">
                      <TextInput id="plot" value={form.plot} onChange={(event) => set("plot")(event.target.value)} maxLength={80} />
                    </Field>
                  )}
                  <Field label="Things to remember" htmlFor="notes">
                    <Textarea id="notes" value={form.notes} onChange={(event) => set("notes")(event.target.value)} maxLength={1000} />
                  </Field>
                </div>
              )}
            </Section>

            <Button size="lg" className="w-full text-lg" loading={busy} onClick={() => save()} data-say={WORDS.save.say}>
              {WORDS.save.text}
            </Button>

            {editing && existing.status === "active" && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => save({ status: "finished", endDate: todayInputValue() })}
                data-say={WORDS.markFinished.say}
              >
                <CircleCheck size={16} aria-hidden="true" /> {WORDS.markFinished.text}
              </Button>
            )}
            {editing && existing.status === "finished" && (
              <Button variant="secondary" className="w-full" onClick={() => save({ status: "active", endDate: null })}>
                Not finished yet
              </Button>
            )}

            {editing && (
              <>
                <Button
                  variant="secondary"
                  className="w-full text-danger"
                  onClick={() =>
                    hasRecords
                      ? setError("This has harvests, sales or animal records. Mark it finished instead, so nothing is lost.")
                      : setConfirmDelete(true)
                  }
                >
                  <Trash2 size={16} /> Delete
                </Button>
                <ConfirmDialog
                  open={confirmDelete}
                  title="Delete this?"
                  message="Work and costs you put for it stay, but they will not point to it any more."
                  confirmLabel="Delete"
                  onConfirm={async () => {
                    await deleteRecord(existing);
                    navigate(farm ? `/app/farms/${farm.id}` : "/app/farms", { replace: true });
                  }}
                  onCancel={() => setConfirmDelete(false)}
                />
              </>
            )}
          </>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One planting or animal group: what it is, its money, what to do next
// ---------------------------------------------------------------------------

function ActionTile({ to, Icon, words, tone = "bg-canvas text-ink" }) {
  return (
    <Link
      to={to}
      data-say={words.say}
      className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2 text-center text-xs font-bold leading-tight ${tone}`}
    >
      <Icon size={24} aria-hidden="true" />
      {words.text}
    </Link>
  );
}

function workTile(type, productionId, tone) {
  const meta = activityMeta(type);
  return (
    <ActionTile
      key={type}
      to={`/app/record?type=${type}&production=${productionId}`}
      Icon={meta.Icon}
      words={{ text: meta.shortLabel, say: meta.words?.say || meta.label }}
      tone={tone || meta.tone}
    />
  );
}

export function ProductionDetail() {
  const { clientId } = useParams();
  const { farms, records, activities, loading } = useFarmerData();
  const production = records.productions.find((item) => item.clientId === clientId);
  const [showAll, setShowAll] = useState(false);

  const money = useMemo(
    () => productionMoney(records).filter((row) => row.productionClientId === clientId),
    [records, clientId]
  );

  if (!production) {
    if (loading) return <PageLoading label="Opening…" />;
    return (
      <div>
        <PageHeader title="Not found" backTo="/app/farms" />
        <p className="text-sm text-ink-soft">This record is not on this phone.</p>
      </div>
    );
  }

  const farm = farms.find((item) => item.clientId === production.farmClientId);
  const isAnimal = production.productionKind === "animal";
  const linked = linkedRecords(production, records, activities);
  const count = isAnimal ? animalCount(production, records.animalEvents) : null;
  const totals = isAnimal ? animalTotals(production, records.animalEvents) : null;
  const id = encodeURIComponent(production.clientId);
  const finished = production.status === "finished";
  const facts = isAnimal
    ? [
        [WORDS.startedOn.text, formatDate(production.startDate)],
        ["At the start", production.startCount],
        [WORDS.animalsFrom.text, optionFor(ANIMAL_SOURCES, production.source)?.text],
        [WORDS.howOld.text, optionFor(AGE_GROUPS, production.ageGroup)?.text],
        [WORDS.tagNumber.text, production.tagNumber],
        ["Breed", production.variety]
      ]
    : [
        [WORDS.plantedOn.text, formatDate(production.startDate)],
        [WORDS.howPlanted.text, optionFor(CROP_METHODS, production.method)?.text],
        [WORDS.seedFrom.text, optionFor(SEED_SOURCES, production.source)?.text],
        ["Place", production.plot],
        ["Size", production.area ? `${production.area} ${optionFor(SIZE_UNITS, production.areaUnit)?.text || ""}` : null],
        [WORDS.spacing.text, production.spacing],
        ["Variety", production.variety]
      ];
  const harvestWords = isAnimal
    ? { text: "Eggs, milk or meat", say: "Put what the animals give: eggs, milk, meat or manure." }
    : WORDS.addHarvest;

  return (
    <div className="space-y-4 desk-flow lg:grid lg:grid-cols-12 lg:items-start lg:gap-4 lg:space-y-0">
      <PageHeader
        className="lg:col-span-12 desk-span"
        title={productionTitle(production)}
        subtitle={`${farm?.farmName || "Farm"}${finished ? ` · ${WORDS.finished.text}` : ""}`}
        backTo={farm ? `/app/farms/${farm.id}` : "/app/farms"}
        say={{ say: `${productionTitle(production)} on ${farm?.farmName || "your farm"}.` }}
        action={
          <Link to={`/app/productions/${id}/edit`} className={buttonClass("secondary", "sm", "shrink-0")}>
            <Pencil size={14} /> Change
          </Link>
        }
      />

      <section className="rounded-2xl bg-white p-5 shadow-card lg:col-span-5">
        <div className="flex items-center gap-3">
          <CropIcon name={production.name} size={28} className="h-14 w-14" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-ink">{productionTitle(production)}</p>
            <p className="text-sm text-ink-soft">{isAnimal ? "Animal group" : "Crop planting"}</p>
          </div>
          {isAnimal && (
            <div className="text-right" data-say={`You have ${count} ${production.name} now.`}>
              <p className="text-3xl font-bold text-ink">{count}</p>
              <p className="text-xs text-ink-soft">{WORDS.countNow.text}</p>
            </div>
          )}
        </div>
        {isAnimal && (
          <div className="mt-4 grid grid-cols-4 gap-1.5 text-center">
            {ANIMAL_EVENTS.filter((item) => totals[item.value] > 0).map((item) => (
              <div key={item.value} className="rounded-xl bg-canvas px-1 py-2" data-say={`${item.text}: ${totals[item.value]}.`}>
                <item.Icon size={16} className={`mx-auto ${item.direction === "in" ? "text-success" : "text-rose-700"}`} aria-hidden="true" />
                <p className="text-sm font-bold text-ink">
                  {item.direction === "in" ? "+" : "−"}
                  {totals[item.value]}
                </p>
                <p className="text-[10px] leading-tight text-ink-soft">{item.text}</p>
              </div>
            ))}
          </div>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {facts
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] text-ink-soft">{label}</dt>
                <dd className="font-semibold text-ink">{value}</dd>
              </div>
            ))}
        </dl>
        {production.notes && <p className="mt-3 text-sm text-ink-soft">{production.notes}</p>}
      </section>

      {finished ? (
        <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-soft lg:col-span-7" data-say={WORDS.finished.say}>
          This one is finished{production.endDate ? ` (${formatDate(production.endDate)})` : ""}. Its records stay here.
        </p>
      ) : (
        <>
          {isAnimal && (
            <Section title={{ text: "Change in number", say: "Did the number of animals change? Choose what happened." }} className="lg:col-span-7">
              <div className="grid grid-cols-4 gap-2">
                {ANIMAL_EVENTS.map((item) => (
                  <ActionTile
                    key={item.value}
                    to={`/app/productions/${id}/animals/new?type=${item.value}`}
                    Icon={item.Icon}
                    words={item}
                    tone={item.direction === "in" ? "bg-success/10 text-success" : "bg-rose-50 text-rose-800"}
                  />
                ))}
              </div>
            </Section>
          )}
          <Section title={{ text: "Add a record", say: "What you want to put? Touch the picture." }} className="lg:col-span-7">
            <div className="grid grid-cols-3 gap-2">
              {isAnimal
                ? ["feeding", "health_check", "vaccination", "breeding", "cleaning"].map((type) => workTile(type, id))
                : ["planting", "weeding", "fertilizer_application", "monitoring"].map((type) => workTile(type, id))}
              {!isAnimal && (
                <ActionTile to={`/app/record?production=${id}`} Icon={ICONS.planting} words={{ text: "Other work", say: "Other work." }} />
              )}
              <ActionTile to={`/app/harvests/new?production=${id}`} Icon={isAnimal ? ICONS.production : ICONS.harvest} words={harvestWords} tone="bg-amber-100 text-amber-900" />
              <ActionTile to={`/app/money/spend?production=${id}`} Icon={ICONS.expense} words={WORDS.spend} tone="bg-rose-50 text-rose-900" />
              <ActionTile to={`/app/money/sell?production=${id}`} Icon={ICONS.sale} words={WORDS.sell} tone="bg-success/10 text-success" />
            </div>
          </Section>
        </>
      )}

      {money.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-card lg:col-span-5">
          <h2 className="text-sm font-bold text-ink" data-say="The money for this one.">
            Money for this one
          </h2>
          {money.map((row) => (
            <div key={row.currency} className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-canvas p-2.5" data-say={`Income ${sayMoney(row.income, row.currency)}.`}>
                <ICONS.income size={16} className="mx-auto text-ink-soft" aria-hidden="true" />
                <p className="text-[11px] text-ink-soft">{WORDS.totalIncome.text}</p>
                <p className="text-sm font-bold text-success">{formatMoney(row.income, row.currency)}</p>
              </div>
              <div className="rounded-xl bg-canvas p-2.5" data-say={`Costs ${sayMoney(row.spent, row.currency)}.`}>
                <ICONS.expense size={16} className="mx-auto text-ink-soft" aria-hidden="true" />
                <p className="text-[11px] text-ink-soft">{WORDS.totalExpenses.text}</p>
                <p className="text-sm font-bold text-rose-700">{formatMoney(row.spent, row.currency)}</p>
              </div>
              <div
                className={`rounded-xl p-2.5 ${row.profit >= 0 ? "bg-success/10" : "bg-danger/10"}`}
                data-say={`${row.profit >= 0 ? "Profit" : "Loss"} ${sayMoney(Math.abs(row.profit), row.currency)}.`}
              >
                {row.profit >= 0 ? (
                  <ICONS.profit size={16} className="mx-auto text-success" aria-hidden="true" />
                ) : (
                  <ICONS.loss size={16} className="mx-auto text-danger" aria-hidden="true" />
                )}
                <p className="text-[11px] text-ink-soft">{row.profit >= 0 ? WORDS.profit.text : WORDS.loss.text}</p>
                <p className={`text-sm font-bold ${row.profit >= 0 ? "text-success" : "text-danger"}`}>
                  {formatMoney(Math.abs(row.profit), row.currency)}
                </p>
              </div>
            </div>
          ))}
          <p className="mt-2 text-[11px] text-ink-soft">
            {money.map((row) => `Sales ${formatMoney(row.sold, row.currency)}`).join(" · ")}. Profit is income − costs.
          </p>
        </section>
      )}

      {linked.events.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-card lg:col-span-7">
          <h2 className="mb-2 text-sm font-bold text-ink">Number changes</h2>
          <ul className="divide-y divide-line">
            {linked.events.slice(0, showAll ? undefined : 6).map((event) => {
              const meta = optionFor(ANIMAL_EVENTS, event.eventType);
              const added = ANIMAL_ADD_EVENTS.includes(event.eventType);
              return (
                <li key={event.clientId}>
                  <Link to={`/app/animal-events/${event.clientId}`} className="flex items-center gap-3 py-2.5">
                    <meta.Icon size={18} className={added ? "text-success" : "text-rose-700"} aria-hidden="true" />
                    <span className="flex-1 text-sm font-semibold text-ink">
                      {meta.text}
                      {event.eventType === "died" && event.cause ? ` · ${optionFor(DEATH_CAUSES, event.cause)?.text}` : ""}
                      {event.eventType === "born" && (event.maleCount != null || event.femaleCount != null)
                        ? ` · ${event.maleCount ?? 0} ${WORDS.male.text.toLowerCase()}, ${event.femaleCount ?? 0} ${WORDS.female.text.toLowerCase()}`
                        : ""}
                    </span>
                    <span className={`text-sm font-bold ${added ? "text-success" : "text-rose-700"}`}>
                      {added ? "+" : "−"}
                      {event.quantity}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-right text-xs text-ink-soft">{formatDate(event.eventDate)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {linked.events.length > 6 && (
            <button type="button" className="mt-1 text-sm font-semibold text-primary" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show less" : `Show all ${linked.events.length}`}
            </button>
          )}
        </section>
      )}

      {linked.harvests.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-card lg:col-span-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
            <ICONS.harvest size={16} aria-hidden="true" /> Harvests
          </h2>
          <ul className="divide-y divide-line">
            {linked.harvests.map((harvest) => (
              <li key={harvest.clientId}>
                <Link to={`/app/harvests/${harvest.clientId}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1 font-semibold text-ink">{harvest.crop}</span>
                  <span className="font-bold text-ink">
                    {harvest.quantity} {unitText(harvest.unit)}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-right text-xs text-ink-soft">{formatDate(harvest.harvestDate)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {linked.activities.length > 0 && (
        <section className="lg:col-span-12 desk-span">
          <h2 className="mb-2 text-sm font-bold text-ink">Work done</h2>
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {linked.activities.slice(0, 10).map((activity) => (
              <ActivityItem key={activity.clientId} activity={activity} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Born / bought / died / sold / eaten / given: change an animal group's count
// ---------------------------------------------------------------------------

const YES_NO_PAID = [
  { value: "all", ...WORDS.paidAll },
  { value: "none", ...WORDS.paidNone }
];

export function AnimalEventForm() {
  const { clientId, eventId } = useParams();
  const editing = Boolean(eventId);
  const [params] = useSearchParams();
  const { records, loading } = useFarmerData();
  const { online, createRecord, updateRecord, deleteRecord } = useSync();
  const navigate = useNavigate();
  const toast = useToast();

  const existing = editing ? records.animalEvents.find((item) => item.clientId === eventId) : null;
  const productionId = editing ? existing?.productionClientId : clientId;
  const production = records.productions.find((item) => item.clientId === productionId);

  const [form, setForm] = useState(null);
  const [showWrite, setShowWrite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (form) return;
    if (editing) {
      if (!existing) return;
      setForm({
        eventType: existing.eventType,
        quantity: String(existing.quantity),
        eventDate: existing.eventDate,
        cause: existing.cause || "",
        maleCount: existing.maleCount === null || existing.maleCount === undefined ? "" : String(existing.maleCount),
        femaleCount:
          existing.femaleCount === null || existing.femaleCount === undefined ? "" : String(existing.femaleCount),
        notes: existing.notes || "",
        price: "",
        currency: "LRD",
        paid: "all"
      });
      return;
    }
    const wanted = params.get("type");
    setForm({
      eventType: ANIMAL_EVENTS.some((item) => item.value === wanted) ? wanted : "",
      quantity: "",
      eventDate: todayInputValue(),
      cause: "",
      maleCount: "",
      femaleCount: "",
      notes: "",
      price: "",
      currency: "LRD",
      paid: "all"
    });
  }, [editing, existing, params, form]);

  if (!form || !production) {
    if (!loading && (!production || (editing && !existing))) {
      return (
        <div>
          <PageHeader title="Not found" backTo="/app/farms" />
          <p className="text-sm text-ink-soft">This record is not on this phone.</p>
        </div>
      );
    }
    return <PageLoading label="Opening…" />;
  }

  const set = (field) => (value) => {
    setError("");
    setForm((current) => ({ ...current, [field]: value ?? "" }));
  };
  const meta = optionFor(ANIMAL_EVENTS, form.eventType);
  const others = eventsFor(production, records.animalEvents).filter((item) => item.clientId !== existing?.clientId);
  const before = animalCount(production, others);
  const qty = Math.round(Number(form.quantity || 0));
  const adds = ANIMAL_ADD_EVENTS.includes(form.eventType);
  const after = form.eventType ? (adds ? before + qty : before - qty) : before;
  const withMoney = !editing && form.eventType === "sold";
  const backTo = `/app/productions/${encodeURIComponent(production.clientId)}`;

  async function save() {
    if (!form.eventType) return setError("Choose what happened.");
    if (!(qty > 0)) return setError("Enter how many.");
    if (after < 0) {
      return setError(before > 0 ? `Only ${before} ${production.name} in this group.` : `No ${production.name} left in this group.`);
    }
    if (form.eventDate > todayInputValue()) return setError("That date is in the future. Choose another day.");
    const male = form.eventType === "born" ? Math.round(Number(form.maleCount || 0)) : 0;
    const female = form.eventType === "born" ? Math.round(Number(form.femaleCount || 0)) : 0;
    if (male + female > qty) return setError(`Male and female cannot be more than the ${qty} born.`);
    const price = Math.round(Number(form.price || 0) * 100) / 100;
    if (withMoney && form.currency === "LRD" && !Number.isInteger(price)) {
      return setError("Liberian dollars have no cents. Remove the decimal point.");
    }
    const payload = {
      eventType: form.eventType,
      quantity: qty,
      eventDate: form.eventDate,
      cause: form.eventType === "died" ? form.cause || "unknown" : null,
      maleCount: form.eventType === "born" && form.maleCount !== "" ? male : null,
      femaleCount: form.eventType === "born" && form.femaleCount !== "" ? female : null,
      notes: form.notes.trim() || null
    };
    setBusy(true);
    try {
      if (editing) await updateRecord(existing, payload);
      else await createRecord("animalEvents", { clientId: newClientId(), productionClientId: production.clientId, ...payload });
      // Selling animals for money also puts the sale, so the money shows.
      if (withMoney && price > 0) {
        const saleClientId = newClientId();
        await createRecord("sales", {
          clientId: saleClientId,
          productionClientId: production.clientId,
          saleDate: form.eventDate,
          crop: production.name,
          quantity: qty,
          unit: BIRDS.includes(production.name) ? "birds" : "pieces",
          unitPrice: null,
          totalAmount: price,
          currency: form.currency
        });
        if (form.paid === "all") {
          await createRecord("payments", {
            clientId: newClientId(),
            saleClientId,
            amount: price,
            paidDate: form.eventDate,
            method: "cash"
          });
        }
      }
      toast.success(`${meta.text}: ${qty}. You have ${after} now. ${online ? "" : WORDS.saved.say}`);
      navigate(backTo, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 lg:mx-auto lg:max-w-4xl">
      <PageHeader
        title={meta ? `${meta.text} · ${production.name}` : productionTitle(production)}
        subtitle={`${WORDS.countNow.text}: ${before}`}
        backTo={backTo}
        say={meta || WORDS.howMany}
      />
      <ErrorBanner message={error} />

      <Section title={{ text: "What happened?", say: "What happened? Touch one." }}>
        <PictureGrid items={ANIMAL_EVENTS} value={form.eventType} onChange={set("eventType")} columns={4} size="sm" />
      </Section>

      <Section title={WORDS.howMany}>
        <QuantityStepper value={form.quantity} onChange={(value) => set("quantity")(value === "" ? "" : String(Math.round(Number(value))))} label="How many" />
        {form.eventType && qty > 0 && (
          <p
            className={`mt-3 rounded-xl px-4 py-2 text-center text-sm font-bold ${after < 0 ? "bg-danger/10 text-danger" : "bg-primary-soft text-primary-dark"}`}
            data-say={after < 0 ? `You only have ${before}.` : `You will have ${after} ${production.name}.`}
          >
            {after < 0 ? `You only have ${before}.` : `${before} → ${after} ${production.name}`}
          </p>
        )}
      </Section>

      {form.eventType === "died" && (
        <Section title={WORDS.whyDied} hint="you can leave it">
          <PictureGrid items={DEATH_CAUSES} value={form.cause} onChange={set("cause")} />
        </Section>
      )}

      {form.eventType === "born" && (
        <Section title={WORDS.maleFemale} hint="you can leave it">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="label" data-say={WORDS.male.say}>{WORDS.male.text}</p>
              <QuantityStepper
                value={form.maleCount}
                onChange={(value) => set("maleCount")(value === "" ? "" : String(Math.round(Number(value))))}
                label="How many male"
              />
            </div>
            <div>
              <p className="label" data-say={WORDS.female.say}>{WORDS.female.text}</p>
              <QuantityStepper
                value={form.femaleCount}
                onChange={(value) => set("femaleCount")(value === "" ? "" : String(Math.round(Number(value))))}
                label="How many female"
              />
            </div>
          </div>
        </Section>
      )}

      <DateChoice value={form.eventDate} onChange={set("eventDate")} />

      {withMoney && (
        <>
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
                      price: item.value === "LRD" ? String(current.price).split(".")[0] : current.price
                    }))
                  }
                >
                  <item.Icon size={18} aria-hidden="true" /> {item.value === "USD" ? "US$" : "L$"}
                </ChoiceButton>
              ))}
            </div>
          </Section>
          <Section title={{ text: "Total price", say: "Amount money for all of them? You can leave it." }} hint="you can leave it">
            <MoneyPad value={form.price} onChange={set("price")} currency={form.currency} />
          </Section>
          {Number(form.price) > 0 && (
            <Section title={{ text: "Did they pay?", say: "Did they pay the money?" }}>
              <div className="grid grid-cols-2 gap-2">
                {YES_NO_PAID.map((item) => (
                  <ChoiceButton key={item.value} words={item} selected={form.paid === item.value} onClick={() => set("paid")(item.value)}>
                    {item.text}
                  </ChoiceButton>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      <Section>
        {writeToggle(showWrite, setShowWrite)}
        {showWrite && (
          <Field label="Things to remember" htmlFor="notes" className="mt-4">
            <Textarea id="notes" value={form.notes} onChange={(event) => set("notes")(event.target.value)} maxLength={1000} />
          </Field>
        )}
      </Section>

      <Button size="lg" className="w-full text-lg" loading={busy} onClick={save} data-say={WORDS.save.say}>
        {WORDS.save.text}
      </Button>

      {existing && (
        <>
          <Button variant="secondary" className="w-full text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Delete
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            title="Delete this?"
            message={
              ANIMAL_ADD_EVENTS.includes(existing.eventType) && before < 0
                ? "Some of these animals were already sold or lost, so this can't be taken out."
                : "The animal count will change back."
            }
            confirmLabel="Delete"
            onConfirm={async () => {
              if (ANIMAL_ADD_EVENTS.includes(existing.eventType) && animalCount(production, others) < 0) {
                setConfirmDelete(false);
                return setError("Some of these animals were already sold or lost, so this can't be taken out.");
              }
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
