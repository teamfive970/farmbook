import { CalendarDays, ChevronDown, ChevronUp, MapPin, Minus, PencilLine, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ErrorBanner, Field, Textarea, TextInput } from "./ui.jsx";
import { PictureChip, SpeakButton } from "./Voice.jsx";
import { formatDate, todayInputValue, yesterdayInputValue } from "../lib/format.js";
import { UNITS, activityMeta, activitySummary, farmMeta } from "../lib/labels.js";
import { activityTypesForFarm, farmSupportsActivity, unitsForFarm } from "../lib/farmTypes.js";
import { WORDS, growIcon, inputChoices, phraseChoices } from "../lib/words.js";
import { productionTitle, productionsForFarm } from "../lib/production.js";

// Feeding can use leftovers from a crop; fertilizer can be dung from animals.
// Mixed farms record that link here (the guide's "resource movement").
const SOURCE_KIND = { fertilizer_application: "animal", feeding: "crop" };

// One screen, designed for farmers who read little and type less:
//   1. farm (chosen for them when they have only one)
//   2. a picture tile for the work done
//   3. Today / Yesterday / Pick day
//   4. optional amount with − / + buttons and unit pictures
//   5. what was used and how the work went, as pictures to tap
// Typing is only behind "Write it myself" (for a helper who can write).
// With "Talk to me" on, every picture says its name when touched.

function dateChoice(value) {
  if (!value || value === todayInputValue()) return "today";
  if (value === yesterdayInputValue()) return "yesterday";
  return "pick";
}

function knownUnit(unit) {
  return UNITS.some((item) => item.value === String(unit || "").toLowerCase());
}

function ChoiceChip({ selected, onClick, children, className = "", words }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      data-say={words?.say}
      data-say-key={words?.key}
      className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-bold transition ${
        selected
          ? "border-primary bg-primary-soft text-primary-dark"
          : "border-line bg-white text-ink hover:border-primary/40"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function ProductionChips({ items, selected, onPick }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const Icon = growIcon(item.name);
        const isSelected = selected === item.clientId;
        return (
          <button
            key={item.clientId}
            type="button"
            aria-pressed={isSelected}
            data-say={productionTitle(item)}
            onClick={() => onPick(item.clientId)}
            className={`flex min-h-14 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition ${
              isSelected ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-primary/40"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="line-clamp-2 text-sm font-bold leading-tight text-ink">{productionTitle(item)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ActivityForm({
  farms,
  farmIdMap = {},
  initial = {},
  defaultFarmId = "",
  submitLabel = WORDS.save.text,
  onSubmit,
  submitting = false,
  error = "",
  offline = false,
  productions = [],
  defaultProductionId = ""
}) {
  const initialUnit = initial.unit || "";
  const [form, setForm] = useState({
    farmId: farmIdMap[initial.farmId] || initial.farmId || defaultFarmId || farms[0]?.id || "",
    activityType: initial.activityType || "",
    activityDate: initial.activityDate || todayInputValue(),
    description: initial.description || "",
    inputUsed: initial.inputUsed || "",
    quantity: initial.quantity === null || initial.quantity === undefined ? "" : String(initial.quantity),
    unit: knownUnit(initialUnit) ? initialUnit.toLowerCase() : initialUnit,
    notes: initial.notes || "",
    productionClientId: initial.productionClientId || defaultProductionId || "",
    sourceProductionClientId: initial.sourceProductionClientId || ""
  });
  const [dateMode, setDateMode] = useState(() => dateChoice(initial.activityDate));
  const [otherUnit, setOtherUnit] = useState(Boolean(initialUnit) && !knownUnit(initialUnit));
  const [showWrite, setShowWrite] = useState(Boolean(initial.notes || initial.description));
  const [phrases, setPhrases] = useState([]);
  const [validationError, setValidationError] = useState("");

  // A farm that was saved offline gets a server ID once it syncs, so keep the
  // selected farm pointed at the current ID instead of the temporary one.
  useEffect(() => {
    setForm((current) => {
      if (farms.length === 0) return current;
      const valid = (id) => Boolean(id) && farms.some((farm) => farm.id === id);
      if (valid(current.farmId)) return current;
      const mapped = farmIdMap[current.farmId];
      if (valid(mapped)) return { ...current, farmId: mapped };
      return { ...current, farmId: valid(defaultFarmId) ? defaultFarmId : farms[0].id };
    });
  }, [farms, farmIdMap, defaultFarmId]);

  function set(field, value) {
    setValidationError("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseFarm(farmId) {
    setValidationError("");
    const nextFarm = farms.find((farm) => farm.id === farmId);
    const clearsType =
      Boolean(form.activityType) &&
      Boolean(nextFarm) &&
      !farmSupportsActivity(nextFarm.farmType, form.activityType);
    if (clearsType) {
      setPhrases([]);
      setOtherUnit(false);
    }
    setForm((current) => {
      const allowType =
        !current.activityType ||
        !nextFarm ||
        farmSupportsActivity(nextFarm.farmType, current.activityType);
      const allowUnit =
        !current.unit ||
        !nextFarm ||
        unitsForFarm(nextFarm.farmType).some((item) => item.value === current.unit);
      return {
        ...current,
        farmId,
        productionClientId: farmId === current.farmId ? current.productionClientId : "",
        activityType: allowType ? current.activityType : "",
        inputUsed: allowType ? current.inputUsed : "",
        unit: allowType && allowUnit ? current.unit : ""
      };
    });
  }

  function update(field) {
    return (event) => set(field, event.target.value);
  }

  function changeQuantity(delta) {
    setForm((current) => {
      const now = current.quantity === "" ? 0 : Number(current.quantity) || 0;
      const next = Math.max(0, Math.round((now + delta) * 100) / 100);
      // Going below 1 clears the amount ("no amount") rather than saving 0.
      return { ...current, quantity: delta < 0 && next === 0 ? "" : String(next) };
    });
  }

  function chooseDate(mode) {
    setDateMode(mode);
    if (mode === "today") set("activityDate", todayInputValue());
    if (mode === "yesterday") set("activityDate", yesterdayInputValue());
  }

  function chooseType(value) {
    setValidationError("");
    setForm((current) => {
      const keepInput = inputChoices(value).some((item) => item.value === current.inputUsed);
      const typedInput = !inputChoices(current.activityType).some((item) => item.value === current.inputUsed);
      const category = activityMeta(value).category;
      const chosen = productions.find((item) => item.clientId === current.productionClientId);
      const keepProduction = !chosen || category === "any" || chosen.productionKind === category;
      return {
        ...current,
        activityType: value,
        inputUsed: keepInput || typedInput ? current.inputUsed : "",
        productionClientId: keepProduction ? current.productionClientId : "",
        sourceProductionClientId: SOURCE_KIND[value] ? current.sourceProductionClientId : ""
      };
    });
    const allowed = new Set(phraseChoices(value).map((item) => item.value));
    setPhrases((current) => current.filter((item) => allowed.has(item)));
  }

  function togglePhrase(value) {
    setPhrases((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function chooseInput(value) {
    set("inputUsed", form.inputUsed === value ? "" : value);
  }

  function chooseUnit(value) {
    setOtherUnit(false);
    set("unit", form.unit === value ? "" : value);
  }

  function validate() {
    if (!form.farmId) return "Choose the farm.";
    if (!form.activityType) return "Choose the work you did.";
    if (!form.activityDate) return "Choose the day.";
    if (form.activityDate > todayInputValue()) return "That date is in the future. Choose another day.";
    if (form.quantity !== "" && !(Number(form.quantity) >= 0)) return "The number must be 0 or more.";
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const message = validate();
    if (message) {
      setValidationError(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    await onSubmit({
      farmId: form.farmId,
      activityType: form.activityType,
      activityDate: form.activityDate,
      description: [...phrases, form.description.trim()].filter(Boolean).join(". ") || null,
      inputUsed: form.inputUsed.trim() || null,
      quantity: form.quantity === "" ? null : Number(form.quantity),
      unit: form.quantity === "" ? null : form.unit.trim() || null,
      notes: form.notes.trim() || null,
      productionClientId: pickable.some((item) => item.clientId === form.productionClientId)
        ? form.productionClientId
        : null,
      sourceProductionClientId:
        sourceKind && sources.some((item) => item.clientId === form.sourceProductionClientId)
          ? form.sourceProductionClientId
          : null
    });
  }

  const preview = form.activityType
    ? activitySummary({
        ...form,
        description: [...phrases, form.description.trim()].filter(Boolean).join(". ")
      })
    : "";
  const inputs = inputChoices(form.activityType);
  const sentences = phraseChoices(form.activityType);
  const selectedFarm = farms.find((farm) => farm.id === form.farmId);
  const allowedTypes = activityTypesForFarm(selectedFarm?.farmType);
  const typeChoices =
    form.activityType && !allowedTypes.some((item) => item.value === form.activityType)
      ? [...allowedTypes, activityMeta(form.activityType)]
      : allowedTypes;
  const unitChoices = unitsForFarm(selectedFarm?.farmType);
  const workCategory = form.activityType ? activityMeta(form.activityType).category : "any";
  const pickable = productionsForFarm(selectedFarm, productions).filter(
    (item) =>
      (item.status === "active" || item.clientId === form.productionClientId) &&
      (workCategory === "any" || item.productionKind === workCategory)
  );
  const sourceKind = SOURCE_KIND[form.activityType] || "";
  const sources = sourceKind
    ? productions.filter(
        (item) =>
          item.productionKind === sourceKind &&
          (item.status === "active" || item.clientId === form.sourceProductionClientId)
      )
    : [];
  const sourceWords = sourceKind === "animal" ? WORDS.manureFrom : WORDS.leftoversFrom;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <ErrorBanner message={validationError || error} />

      {/* 1. Farm */}
      <section className="rounded-2xl bg-white p-4 shadow-card">
        <p className="label flex items-center gap-1.5" data-say={WORDS.whichFarm.say}>
          <MapPin size={16} aria-hidden="true" /> {WORDS.whichFarm.text}
        </p>
        {farms.length <= 1 ? (
          <p className="text-base font-bold text-ink" data-say={farms[0]?.farmName}>
            {farms[0]?.farmName || "Farm"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {farms.map((farm) => {
              const meta = farmMeta(farm.farmType);
              const selected = form.farmId === farm.id;
              return (
                <button
                  key={farm.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseFarm(farm.id)}
                  className={`flex min-h-16 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition ${
                    selected ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-primary/40"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                    <meta.Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="line-clamp-2 text-sm font-bold leading-tight text-ink">
                    {farm.farmName}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Work done */}
      <section className="rounded-2xl bg-white p-4 shadow-card">
        <p className="label" data-say={WORDS.whatWork.say}>{WORDS.whatWork.text}</p>
        <div className="grid grid-cols-3 gap-2">
          {typeChoices.map(({ value, shortLabel, Icon, tone, words }) => {
            const selected = form.activityType === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                aria-label={shortLabel}
                data-say={words?.say}
                data-say-key={words?.key}
                onClick={() => chooseType(value)}
                className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 px-1 py-2 text-center transition ${
                  selected
                    ? "border-primary bg-primary-soft shadow-sm"
                    : "border-line bg-white hover:border-primary/40"
                }`}
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone}`}>
                  <Icon size={26} aria-hidden="true" />
                </span>
                <span className="text-xs font-bold leading-tight text-ink">{shortLabel}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2b. Which planting or animal group (only when the farm has them) */}
      {form.activityType && pickable.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <p className="label" data-say={WORDS.forWhich.say}>
            {WORDS.forWhich.text} <span className="font-normal text-ink-soft">(you can leave it)</span>
          </p>
          <ProductionChips
            items={pickable}
            selected={form.productionClientId}
            onPick={(id) => set("productionClientId", form.productionClientId === id ? "" : id)}
          />
        </section>
      )}

      {/* 2c. Dung from my animals / leftovers from my crops */}
      {sources.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <p className="label" data-say={sourceWords.say}>
            {sourceWords.text} <span className="font-normal text-ink-soft">(you can leave it)</span>
          </p>
          <ProductionChips
            items={sources}
            selected={form.sourceProductionClientId}
            onPick={(id) =>
              set("sourceProductionClientId", form.sourceProductionClientId === id ? "" : id)
            }
          />
        </section>
      )}

      {/* 3. Day */}
      <section className="rounded-2xl bg-white p-4 shadow-card">
        <p className="label flex items-center gap-1.5">
          <CalendarDays size={16} aria-hidden="true" /> {WORDS.when.text}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <ChoiceChip words={WORDS.today} selected={dateMode === "today"} onClick={() => chooseDate("today")}>
            {WORDS.today.text}
          </ChoiceChip>
          <ChoiceChip words={WORDS.yesterday} selected={dateMode === "yesterday"} onClick={() => chooseDate("yesterday")}>
            {WORDS.yesterday.text}
          </ChoiceChip>
          <ChoiceChip words={WORDS.otherDay} selected={dateMode === "pick"} onClick={() => chooseDate("pick")}>
            {WORDS.otherDay.text}
          </ChoiceChip>
        </div>
        {dateMode === "pick" && (
          <div className="mt-3">
            <TextInput
              id="activityDate"
              type="date"
              aria-label="Day of the work"
              value={form.activityDate}
              max={todayInputValue()}
              onChange={update("activityDate")}
            />
            <p className="mt-1.5 text-sm font-semibold text-ink-soft">{formatDate(form.activityDate)}</p>
          </div>
        )}
      </section>

      {/* 4. Amount (optional) */}
      <section className="rounded-2xl bg-white p-4 shadow-card">
        <p className="label" data-say={WORDS.howMuch.say}>
          {WORDS.howMuch.text} <span className="font-normal text-ink-soft">(you can leave it)</span>
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => changeQuantity(-1)}
            aria-label={WORDS.less.text}
            data-say={WORDS.less.say}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-line bg-white text-ink active:bg-canvas"
          >
            <Minus size={24} />
          </button>
          <TextInput
            id="quantity"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            aria-label="Amount"
            value={form.quantity}
            onChange={update("quantity")}
            placeholder="–"
            className="h-14 text-center text-2xl font-bold"
          />
          <button
            type="button"
            onClick={() => changeQuantity(1)}
            aria-label={WORDS.more.text}
            data-say={WORDS.more.say}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-primary bg-primary text-white active:bg-primary-dark"
          >
            <Plus size={24} />
          </button>
        </div>

        {form.quantity !== "" && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {unitChoices.map(({ value, label, Icon, words }) => (
              <ChoiceChip
                key={value}
                words={words}
                selected={!otherUnit && form.unit === value}
                onClick={() => chooseUnit(value)}
                className="flex-col gap-1 px-1 py-2 text-xs"
              >
                <Icon size={20} aria-hidden="true" />
                {label}
              </ChoiceChip>
            ))}
            <ChoiceChip
              selected={otherUnit}
              onClick={() => {
                setOtherUnit(true);
                if (knownUnit(form.unit)) set("unit", "");
              }}
              className="flex-col gap-1 px-1 py-2 text-xs"
            >
              <PencilLine size={20} aria-hidden="true" />
              Other
            </ChoiceChip>
          </div>
        )}
        {form.quantity !== "" && otherUnit && (
          <TextInput
            id="unit"
            aria-label="Unit"
            value={form.unit}
            onChange={update("unit")}
            placeholder="e.g. tins, rows"
            maxLength={20}
            className="mt-3"
          />
        )}
      </section>

      {/* 5. What was used, as pictures */}
      {form.activityType && inputs.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <p className="label" data-say={WORDS.whatUsed.say}>
            {WORDS.whatUsed.text} <span className="font-normal text-ink-soft">(you can leave it)</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {inputs.map((item) => (
              <PictureChip
                key={item.key}
                item={item}
                selected={form.inputUsed === item.value}
                onClick={() => chooseInput(item.value)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 6. How the work went, as short sentences to tap */}
      {form.activityType && (
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <p className="label" data-say={WORDS.howItGo.say}>
            {WORDS.howItGo.text} <span className="font-normal text-ink-soft">(you can leave it)</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {sentences.map((item) => (
              <PictureChip
                key={item.key}
                item={item}
                selected={phrases.includes(item.value)}
                onClick={() => togglePhrase(item.value)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Typing only for a helper who can write */}
      <section className="rounded-2xl bg-white p-4 shadow-card">
        <button
          type="button"
          onClick={() => setShowWrite((value) => !value)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={showWrite}
          data-say={WORDS.writeMyself.say}
        >
          <span className="flex items-center gap-2">
            <PencilLine size={20} className="text-ink-soft" aria-hidden="true" />
            <span className="text-sm font-bold text-ink">{WORDS.writeMyself.text}</span>
          </span>
          {showWrite ? <ChevronUp size={20} className="text-ink-soft" /> : <ChevronDown size={20} className="text-ink-soft" />}
        </button>

        {showWrite && (
          <div className="mt-4 space-y-4">
            <Field label="What you used" htmlFor="inputUsed">
              <TextInput
                id="inputUsed"
                value={form.inputUsed}
                onChange={update("inputUsed")}
                placeholder="e.g. cassava sticks, NPK, feed"
                maxLength={120}
              />
            </Field>
            <Field label="Few words" htmlFor="description">
              <Textarea
                id="description"
                value={form.description}
                onChange={update("description")}
                placeholder="e.g. Planted on the lower side."
                maxLength={700}
              />
            </Field>
            <Field label="Other things to remember" htmlFor="notes">
              <Textarea
                id="notes"
                value={form.notes}
                onChange={update("notes")}
                placeholder="Anything else."
                maxLength={1000}
              />
            </Field>
          </div>
        )}
      </section>

      {preview && (
        <div className="flex items-center gap-3 rounded-xl bg-primary-soft px-4 py-3">
          <p className="flex-1 text-center text-sm font-semibold text-primary-dark">
            {preview} · {formatDate(form.activityDate)}
          </p>
          <SpeakButton phrase={{ say: `${preview}. ${formatDate(form.activityDate)}.` }} className="bg-white" />
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full text-lg"
        loading={submitting}
        data-say={WORDS.save.say}
      >
        {submitLabel}
      </Button>
      <p
        className="text-center text-xs leading-relaxed text-ink-soft"
        data-say={offline ? WORDS.noNetwork.say : WORDS.saved.say}
      >
        {offline
          ? "Network not there. No problem. It will stay on your phone and go later."
          : "It will save on your phone first, then go on the internet."}
      </p>
    </form>
  );
}
