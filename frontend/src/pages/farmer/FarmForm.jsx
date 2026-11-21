import { CloudOff, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StepIndicator } from "../../components/FormSteps.jsx";
import {
  Button,
  ErrorBanner,
  Field,
  PageHeader,
  PageLoading,
  Select,
  Textarea,
  TextInput
} from "../../components/ui.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { api } from "../../lib/api.js";
import { newClientId } from "../../lib/format.js";
import { COUNTIES, FARM_TYPES } from "../../lib/labels.js";
import { upsertCachedFarm } from "../../lib/localStore.js";

const EMPTY = {
  farmName: "",
  farmType: "crop_farming",
  county: "",
  district: "",
  community: "",
  mainCropOrLivestock: "",
  description: ""
};

const STEPS = ["Farm basics", "Location", "Crops and notes"];

function toForm(farm) {
  return {
    farmName: farm.farmName || "",
    farmType: farm.farmType || "crop_farming",
    county: farm.county || "",
    district: farm.district || "",
    community: farm.community || "",
    mainCropOrLivestock: farm.mainCropOrLivestock || "",
    description: farm.description || ""
  };
}

export default function FarmForm() {
  const { farmId } = useParams();
  const editing = Boolean(farmId);
  const { user, token } = useAuth();
  const { online, createFarm, updateFarm } = useSync();
  const { farms, farmIdMap, loading } = useFarmerData();
  const navigate = useNavigate();
  const toast = useToast();

  const resolvedFarmId = farmIdMap[farmId] || farmId;

  const [form, setForm] = useState(editing ? null : EMPTY);
  const [step, setStep] = useState(0);
  const [existing, setExisting] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing && resolvedFarmId !== farmId) {
      navigate(`/app/farms/${resolvedFarmId}/edit`, { replace: true });
    }
  }, [editing, resolvedFarmId, farmId, navigate]);

  useEffect(() => {
    if (!editing || form || missing) return;
    const cached = farms.find((farm) => farm.id === resolvedFarmId);
    if (cached) {
      setExisting(cached);
      setForm(toForm(cached));
      return;
    }
    if (token && online) {
      api
        .get(`/api/farms/${resolvedFarmId}`, { token })
        .then(async ({ farm }) => {
          await upsertCachedFarm(user.id, farm);
          setExisting(farm);
          setForm(toForm(farm));
        })
        .catch(() => setMissing(true));
    } else if (!loading) {
      setMissing(true);
    }
  }, [editing, form, missing, farms, resolvedFarmId, token, online, loading, user]);

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  function validateStep(index) {
    if (index === 0 && form.farmName.trim().length < 1) return "Enter a name for your farm.";
    if (index === 1) {
      if (!form.county) return "Choose the county where the farm is.";
      if (!form.district.trim()) return "Enter the district.";
      if (!form.community.trim()) return "Enter the community.";
    }
    return "";
  }

  function goToStep(nextStep) {
    setError("");
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (step < STEPS.length - 1) {
      const message = validateStep(step);
      if (message) return setError(message);
      goToStep(step + 1);
      return;
    }

    for (let index = 0; index < STEPS.length; index += 1) {
      const message = validateStep(index);
      if (message) {
        setError(message);
        setStep(index);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    const payload = {
      farmName: form.farmName.trim(),
      farmType: form.farmType,
      county: form.county,
      district: form.district.trim(),
      community: form.community.trim(),
      mainCropOrLivestock: form.mainCropOrLivestock.trim() || null,
      description: form.description.trim() || null
    };

    setBusy(true);
    try {
      const record = editing
        ? await updateFarm(existing || { id: resolvedFarmId, ...payload }, payload)
        : await createFarm({ ...payload, clientId: newClientId() });
      toast.success(
        online
          ? editing
            ? "Farm details updated."
            : "Farm added."
          : "Saved on this phone. It will sync when you have internet."
      );
      navigate(`/app/farms/${record.id}`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div>
        <PageHeader title="Farm not found" backTo="/app/farms" />
        <p className="text-sm text-ink-soft">This farm is not saved on this phone.</p>
      </div>
    );
  }

  if (!form) {
    return <PageLoading label="Loading farm details…" />;
  }

  return (
    <div>
      <PageHeader
        title={editing ? "Edit farm" : "Add a new farm"}
        subtitle={editing ? "Update your farm details." : "Tell us about the farm you want to track."}
        backTo={editing ? `/app/farms/${resolvedFarmId}` : "/app/farms"}
      />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <StepIndicator step={step} steps={STEPS} />

        {!online && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-800">
            <CloudOff size={17} className="mt-0.5 shrink-0" />
            You are offline. The farm will be saved on this phone and sent to your account when
            you have internet.
          </div>
        )}
        <ErrorBanner message={error} />

        {step === 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <Field label="Farm name" htmlFor="farmName">
              <TextInput
                id="farmName"
                value={form.farmName}
                onChange={update("farmName")}
                placeholder="e.g. Green Valley Farm"
                autoComplete="off"
              />
            </Field>

            <div className="mt-5">
              <p className="label">What do you farm?</p>
              <div className="grid grid-cols-2 gap-2.5">
                {FARM_TYPES.map(({ value, label, description, Icon, tone }) => {
                  const selected = form.farmType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setForm((current) => ({ ...current, farmType: value }))}
                      className={`flex min-h-20 flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-primary bg-primary-soft/70 shadow-sm"
                          : "border-line bg-white hover:border-primary/40"
                      }`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
                        <Icon size={17} />
                      </span>
                      <span className="text-sm font-semibold text-ink">{label}</span>
                      <span className="text-[11px] leading-tight text-ink-soft">{description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <Field label="County" htmlFor="county">
              <div className="relative">
                <MapPin
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
                  aria-hidden="true"
                />
                <Select
                  id="county"
                  value={form.county}
                  onChange={update("county")}
                  className="pl-11 pr-10"
                >
                  <option value="">Choose county</option>
                  {COUNTIES.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>

            <div className="mt-4">
              <Field label="District" htmlFor="district">
                <TextInput
                  id="district"
                  value={form.district}
                  onChange={update("district")}
                  placeholder="e.g. Gbarnga"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Community" htmlFor="community">
                <TextInput
                  id="community"
                  value={form.community}
                  onChange={update("community")}
                  placeholder="e.g. Kpelleh Town"
                />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <Field
              label="Main crop or livestock (optional)"
              htmlFor="mainCropOrLivestock"
              hint="For example: cassava, rice, layer chickens."
            >
              <TextInput
                id="mainCropOrLivestock"
                value={form.mainCropOrLivestock}
                onChange={update("mainCropOrLivestock")}
                placeholder="e.g. Cassava and rice"
              />
            </Field>

            <div className="mt-4">
              <Field label="Notes about this farm (optional)" htmlFor="description">
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={update("description")}
                  placeholder="Anything you want to remember about this farm."
                  maxLength={1000}
                />
              </Field>
            </div>
          </div>
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
            loading={busy}
          >
            {step < STEPS.length - 1
              ? "Continue"
              : editing
                ? "Save changes"
                : "Save farm"}
          </Button>
        </div>
      </form>
    </div>
  );
}
