import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { StepIndicator } from "./FormSteps.jsx";
import { Button, ErrorBanner, Field, Select, Textarea, TextInput } from "./ui.jsx";
import { formatDate, todayInputValue } from "../lib/format.js";
import { ACTIVITY_TYPES } from "../lib/labels.js";

const STEPS = ["Farm and activity", "What happened"];

export default function ActivityForm({
  farms,
  farmIdMap = {},
  initial = {},
  defaultFarmId = "",
  submitLabel = "Save record",
  onSubmit,
  submitting = false,
  error = "",
  offline = false
}) {
  const [form, setForm] = useState({
    farmId: farmIdMap[initial.farmId] || initial.farmId || defaultFarmId || farms[0]?.id || "",
    activityType: initial.activityType || "planting",
    activityDate: initial.activityDate || todayInputValue(),
    description: initial.description || "",
    inputUsed: initial.inputUsed || "",
    quantity: initial.quantity === null || initial.quantity === undefined ? "" : String(initial.quantity),
    unit: initial.unit || "",
    notes: initial.notes || ""
  });
  const [showDetails, setShowDetails] = useState(
    Boolean(initial.inputUsed || initial.quantity || initial.unit || initial.notes)
  );
  const [step, setStep] = useState(0);
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
      if (!current.farmId) {
        return { ...current, farmId: valid(defaultFarmId) ? defaultFarmId : farms[0].id };
      }
      return current;
    });
  }, [farms, farmIdMap, defaultFarmId]);

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  function validateStep(index) {
    if (index === 0) {
      if (!form.farmId) return "Choose the farm for this activity.";
      if (!form.activityType) return "Choose the type of activity.";
      if (!form.activityDate) return "Choose the date of the activity.";
    } else {
      if (form.description.trim().length === 0) {
        return "Describe what you did on the farm.";
      }
      if (form.quantity !== "" && Number(form.quantity) < 0) {
        return "Quantity cannot be negative.";
      }
    }
    return "";
  }

  function goToStep(nextStep) {
    setValidationError("");
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setValidationError("");

    if (step < STEPS.length - 1) {
      const message = validateStep(step);
      if (message) return setValidationError(message);
      goToStep(step + 1);
      return;
    }

    for (let index = 0; index < STEPS.length; index += 1) {
      const message = validateStep(index);
      if (message) {
        setValidationError(message);
        setStep(index);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    await onSubmit({
      farmId: form.farmId,
      activityType: form.activityType,
      activityDate: form.activityDate,
      description: form.description.trim(),
      inputUsed: form.inputUsed.trim() || null,
      quantity: form.quantity === "" ? null : Number(form.quantity),
      unit: form.unit.trim() || null,
      notes: form.notes.trim() || null
    });
  }

  const selectedFarm = farms.find((farm) => farm.id === form.farmId);
  const selectedType = ACTIVITY_TYPES.find((type) => type.value === form.activityType);

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <StepIndicator step={step} steps={STEPS} />
      <ErrorBanner message={validationError || error} />

      {step === 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <Field label="Farm" htmlFor="farmId">
            <div className="relative">
              <MapPin
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
                aria-hidden="true"
              />
              <Select
                id="farmId"
                value={form.farmId}
                onChange={update("farmId")}
                className="pl-11 pr-10"
              >
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.farmName}
                  </option>
                ))}
              </Select>
            </div>
          </Field>

          <div className="mt-5">
            <p className="label">What did you do?</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {ACTIVITY_TYPES.map(({ value, shortLabel, Icon, tone }) => {
                const selected = form.activityType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setForm((current) => ({ ...current, activityType: value }))}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-center transition ${
                      selected
                        ? "border-primary bg-primary-soft/70 shadow-sm"
                        : "border-line bg-white hover:border-primary/40"
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
                      <Icon size={17} />
                    </span>
                    <span className="text-[11px] font-semibold leading-tight text-ink">
                      {shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <Field label="Date" htmlFor="activityDate">
              <TextInput
                id="activityDate"
                type="date"
                value={form.activityDate}
                max={todayInputValue()}
                onChange={update("activityDate")}
              />
            </Field>
          </div>
        </div>
      )}

      {step === 1 && (
        <>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-white px-4 py-3 text-xs text-ink-soft shadow-card">
            <span className="font-semibold text-ink">{selectedFarm?.farmName || "Farm"}</span>
            <span aria-hidden="true">·</span>
            <span>{selectedType?.label || "Activity"}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(form.activityDate)}</span>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-card">
            <Field
              label="What happened?"
              htmlFor="description"
              hint="For example: Planted 40 cassava stems on the lower field."
            >
              <Textarea
                id="description"
                value={form.description}
                onChange={update("description")}
                placeholder="Describe the work you did."
                maxLength={1000}
                required
              />
            </Field>

            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              className="mt-5 flex w-full items-center justify-between rounded-xl bg-canvas px-4 py-3 text-left"
              aria-expanded={showDetails}
            >
              <span>
                <span className="block text-sm font-semibold text-ink">Add more details</span>
                <span className="text-xs text-ink-soft">Inputs, quantity, unit or notes (optional)</span>
              </span>
              {showDetails ? (
                <ChevronUp size={18} className="text-ink-soft" />
              ) : (
                <ChevronDown size={18} className="text-ink-soft" />
              )}
            </button>

            {showDetails && (
              <div className="mt-4 space-y-4">
                <Field label="Input or material used" htmlFor="inputUsed">
                  <TextInput
                    id="inputUsed"
                    value={form.inputUsed}
                    onChange={update("inputUsed")}
                    placeholder="e.g. NPK fertilizer or cassava cuttings"
                    maxLength={120}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity" htmlFor="quantity">
                    <TextInput
                      id="quantity"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={form.quantity}
                      onChange={update("quantity")}
                      placeholder="e.g. 40"
                    />
                  </Field>
                  <Field label="Unit" htmlFor="unit">
                    <TextInput
                      id="unit"
                      value={form.unit}
                      onChange={update("unit")}
                      placeholder="e.g. kg, stems, bags"
                      maxLength={20}
                    />
                  </Field>
                </div>
                <Field label="Notes" htmlFor="notes">
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={update("notes")}
                    placeholder="Anything else you want to remember."
                    maxLength={1000}
                  />
                </Field>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={() => goToStep(step - 1)}
          >
            Back
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          className={step > 0 ? "flex-1" : "w-full"}
          loading={submitting}
        >
          {step < STEPS.length - 1 ? "Continue" : submitLabel}
        </Button>
      </div>
      <p className="text-center text-xs leading-relaxed text-ink-soft">
        {offline
          ? "You are offline. The record is saved on this phone and will sync later."
          : "Your record is saved on this phone first, then sent to your account."}
      </p>
    </form>
  );
}
