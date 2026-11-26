import { Check, ChevronDown, ChevronUp, CircleHelp, CloudOff, Home, MapPin, PencilLine, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PictureChip } from "../../components/Voice.jsx";
import {
  Button,
  ErrorBanner,
  Field,
  PageHeader,
  PageLoading,
  Textarea,
  TextInput
} from "../../components/ui.jsx";
import FarmLocationPicker from "../../components/FarmLocationPicker.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useSync } from "../../contexts/SyncContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useFarmerData } from "../../hooks/useFarmerData.js";
import { api } from "../../lib/api.js";
import { newClientId } from "../../lib/format.js";
import { farmCrops } from "../../lib/farmCrops.js";
import { FARM_CATEGORY_OPTIONS, farmCategory } from "../../lib/farmTypes.js";
import { COUNTIES } from "../../lib/labels.js";
import { upsertCachedFarm } from "../../lib/localStore.js";
import {
  ANIMALS,
  CROPS,
  SIZE_UNITS,
  WORDS,
  farmNameChoices,
  animalFarmType,
  growChoicesForCategory
} from "../../lib/words.js";
import { ChoiceButton, QuantityStepper } from "../../components/Choices.jsx";

const KNOWN_GROWS = new Set([...CROPS, ...ANIMALS].map((item) => item.value));

// One screen, mostly pictures:
//   what kind of farm → what you grow or raise (pictures) → a suggested name
//   → "same place I live" (filled from the farmer's own registration).
// Typing is only needed for a custom name or a farm in another place.

const EMPTY = {
  farmName: "",
  category: "crop",
  county: "",
  district: "",
  community: "",
  crops: [],
  description: "",
  size: "",
  sizeUnit: "acres",
  location: null,
  showOnMap: false
};


function toForm(farm) {
  return {
    farmName: farm.farmName || "",
    category: farmCategory(farm.farmType || "crop_farming"),
    county: farm.county || "",
    district: farm.district || "",
    community: farm.community || "",
    crops: farmCrops(farm),
    description: farm.description || "",
    size: farm.size === null || farm.size === undefined ? "" : String(farm.size),
    sizeUnit: farm.sizeUnit || "acres",
    location: farm.location || null,
    showOnMap: Boolean(farm.showOnMap)
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

  const [form, setForm] = useState(
    editing
      ? null
      : {
          ...EMPTY,
          county: user?.county || "",
          district: user?.district || "",
          community: user?.community || ""
        }
  );
  const [nameTouched, setNameTouched] = useState(editing);
  const [ownName, setOwnName] = useState(false);
  const [otherPlace, setOtherPlace] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [otherCrop, setOtherCrop] = useState("");
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

  const grown = form?.crops || [];
  const isHome =
    form &&
    form.county === (user?.county || "") &&
    form.district.trim() === (user?.district || "") &&
    form.community.trim() === (user?.community || "");
  const showPlaceFields = otherPlace || (form && !isHome);

  // Crop farm, animal farm or mixed farm. What can be chosen below follows.
  function chooseCategory(value) {
    setError("");
    setForm((current) => {
      const allowed = new Set(growChoicesForCategory(value).map((item) => item.value));
      // Keep what still fits the new kind of farm, and anything typed by hand.
      const kept = current.crops.filter((item) => allowed.has(item) || !KNOWN_GROWS.has(item));
      const next = { ...current, category: value, crops: kept };
      if (!nameTouched) next.farmName = kept[0] ? `${kept[0]} farm` : "";
      return next;
    });
  }

  function setCrops(nextList) {
    setError("");
    setForm((current) => {
      const next = { ...current, crops: nextList };
      if (!nameTouched) next.farmName = nextList[0] ? `${nextList[0]} farm` : "";
      return next;
    });
  }

  function toggleGrow(value) {
    setCrops(grown.includes(value) ? grown.filter((item) => item !== value) : [...grown, value]);
  }

  function addOtherCrop() {
    const name = otherCrop.trim().replace(/\s+/g, " ");
    if (!name) return;
    const pretty = name[0].toUpperCase() + name.slice(1);
    if (!grown.some((item) => item.toLowerCase() === pretty.toLowerCase())) setCrops([...grown, pretty]);
    setOtherCrop("");
  }

  function chooseName(text) {
    setError("");
    setNameTouched(true);
    setOwnName(false);
    setForm((current) => ({ ...current, farmName: text }));
  }

  function useHome() {
    setOtherPlace(false);
    setForm((current) => ({
      ...current,
      county: user?.county || "",
      district: user?.district || "",
      community: user?.community || ""
    }));
  }

  function validate() {
    if (form.crops.length === 0) return "Choose what you grow or raise. You can choose more than one.";
    if (form.farmName.trim().length < 1) return "Choose a name for the farm.";
    if (!form.county) return "Choose the county where the farm is.";
    if (!form.district.trim()) return "Enter the district.";
    if (!form.community.trim()) return "Enter the town or community.";
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const message = validate();
    if (message) {
      setError(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const payload = {
      farmName: form.farmName.trim(),
      // The saved type: crop farm, mixed farm, or poultry/livestock for animals.
      farmType:
        form.category === "crop"
          ? "crop_farming"
          : form.category === "animal"
            ? animalFarmType(form.crops)
            : "mixed_farming",
      county: form.county,
      district: form.district.trim(),
      community: form.community.trim(),
      crops: form.crops,
      mainCropOrLivestock: form.crops.join(", ").slice(0, 120) || null,
      description: form.description.trim() || null,
      size: form.size === "" ? null : Number(form.size),
      sizeUnit: form.size === "" ? null : form.sizeUnit,
      location: form.location,
      showOnMap: Boolean(form.location && form.showOnMap)
    };

    setBusy(true);
    try {
      const record = editing
        ? await updateFarm(existing || { id: resolvedFarmId, ...payload }, payload)
        : await createFarm({ ...payload, clientId: newClientId() });
      toast.success(
        online
          ? editing
            ? "The farm changed."
            : "Your farm saved."
          : "Your farm is saved on your phone. It will be sent when you are online."
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
        <p className="text-sm text-ink-soft">This farm is not on this phone.</p>
      </div>
    );
  }

  if (!form) {
    return <PageLoading label="Opening the farm…" />;
  }

  const choices = growChoicesForCategory(form.category);
  const growWords =
    form.category === "animal" ? WORDS.whatRaise : form.category === "mixed" ? WORDS.whatGrowBoth : WORDS.whatGrowCrop;
  const names = farmNameChoices(grown[0]);
  const nameIsSuggested = names.some((item) => item.text === form.farmName);

  return (
    <div className="lg:mx-auto lg:max-w-4xl">
      <PageHeader
        title={editing ? "Change farm" : WORDS.farmTitle.text}
        subtitle="Tap the pictures. No typing needed."
        backTo={editing ? `/app/farms/${resolvedFarmId}` : "/app/farms"}
        say={WORDS.farmTitle}
      />

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {!online && (
          <div
            className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-800"
            data-say={WORDS.noNetwork.say}
          >
            <CloudOff size={17} className="mt-0.5 shrink-0" />
            Network not there. No problem. The farm will stay on your phone and go later.
          </div>
        )}
        <ErrorBanner message={error} />

        {/* 1. Kind of farm */}
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <p className="label" data-say={WORDS.whatFarm.say}>{WORDS.whatFarm.text}</p>
          <div className="grid grid-cols-3 gap-2">
            {FARM_CATEGORY_OPTIONS.map(({ value, description, Icon, tone, words }) => {
              const selected = form.category === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseCategory(value)}
                  data-say={words?.say}
                  data-say-key={words?.key}
                  className={`flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-2 text-center transition ${
                    selected ? "border-primary bg-primary-soft shadow-sm" : "border-line bg-white hover:border-primary/40"
                  }`}
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <span className="text-sm font-bold leading-tight text-ink">{words?.text}</span>
                  <span className="text-[11px] leading-tight text-ink-soft">{description}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. What you grow or raise: as many as the farm has */}
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <p className="label" data-say={growWords.say}>
            {growWords.text}
          </p>
          <p
            className="-mt-1 mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-dark"
            data-say="You can touch more than one."
          >
            <Check size={14} aria-hidden="true" /> You can touch more than one
          </p>
          <div className="grid grid-cols-4 gap-2">
            {choices.map((item) => (
              <PictureChip
                key={item.key}
                item={item}
                showCheck
                selected={grown.includes(item.value)}
                onClick={() => toggleGrow(item.value)}
              />
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <TextInput
              aria-label="Something not in the pictures"
              placeholder="Not here? Write it (e.g. Okra)"
              value={otherCrop}
              maxLength={60}
              onChange={(event) => setOtherCrop(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addOtherCrop();
                }
              }}
            />
            <Button variant="secondary" onClick={addOtherCrop} disabled={!otherCrop.trim()} aria-label="Add it">
              <Plus size={18} /> Add
            </Button>
          </div>

          {grown.length > 0 && (
            <div className="mt-3" data-say={`This farm has ${grown.join(", ")}.`}>
              <p className="text-xs font-semibold text-ink-soft">
                This farm has {grown.length} {grown.length === 1 ? "thing" : "things"}:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {grown.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-3 pr-1 text-sm font-semibold text-primary-dark"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => setCrops(grown.filter((item) => item !== name))}
                      aria-label={`Take ${name} off`}
                      data-say={`Take ${name} off.`}
                      className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Size (optional) */}
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <p className="label" data-say={WORDS.farmSize.say}>
            {WORDS.farmSize.text} <span className="font-normal text-ink-soft">(you can leave it)</span>
          </p>
          <QuantityStepper
            value={form.size}
            step={0.5}
            label="Farm size"
            onChange={(next) => setForm((current) => ({ ...current, size: next }))}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {SIZE_UNITS.map((unit) => (
              <ChoiceButton
                key={unit.value}
                words={unit}
                selected={form.size !== "" && form.sizeUnit === unit.value}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    sizeUnit: unit.value,
                    size: current.size === "" ? "1" : current.size
                  }))
                }
              >
                <unit.Icon size={18} aria-hidden="true" /> {unit.text}
              </ChoiceButton>
            ))}
            <ChoiceButton
              words={WORDS.dontKnow}
              selected={form.size === ""}
              onClick={() => setForm((current) => ({ ...current, size: "" }))}
              className="col-span-2"
            >
              <CircleHelp size={18} aria-hidden="true" /> {WORDS.dontKnow.text}
            </ChoiceButton>
          </div>
        </section>

        <FarmLocationPicker
          location={form.location}
          showOnMap={form.showOnMap}
          onChange={(next) => setForm((current) => ({ ...current, ...next }))}
        />

        {/* 3. Name */}
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <p className="label" data-say={WORDS.farmName.say}>{WORDS.farmName.text}</p>
          <div className="grid grid-cols-2 gap-2">
            {names.map((item) => {
              const selected = form.farmName === item.text && !ownName;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseName(item.text)}
                  data-say={item.say}
                  data-say-key={item.key}
                  className={`flex min-h-14 items-center justify-between gap-2 rounded-xl border-2 px-3 text-left text-sm font-bold transition ${
                    selected ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-white text-ink"
                  }`}
                >
                  {item.text}
                  {selected && <Check size={18} aria-hidden="true" />}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={ownName || (!nameIsSuggested && Boolean(form.farmName))}
              onClick={() => {
                setOwnName(true);
                setNameTouched(true);
              }}
              data-say={WORDS.ownName.say}
              className={`flex min-h-14 items-center gap-2 rounded-xl border-2 px-3 text-left text-sm font-bold ${
                ownName || (!nameIsSuggested && form.farmName)
                  ? "border-primary bg-primary-soft text-primary-dark"
                  : "border-line bg-white text-ink"
              }`}
            >
              <PencilLine size={18} aria-hidden="true" /> {WORDS.ownName.text}
            </button>
          </div>
          {(ownName || (!nameIsSuggested && form.farmName)) && (
            <TextInput
              id="farmName"
              aria-label="Farm name"
              value={form.farmName}
              onChange={(event) => {
                setNameTouched(true);
                update("farmName")(event);
              }}
              placeholder="e.g. Green Valley Farm"
              autoComplete="off"
              className="mt-3"
            />
          )}
        </section>

        {/* 4. Where */}
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <p className="label" data-say={WORDS.where.say}>{WORDS.where.text}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={!showPlaceFields}
              onClick={useHome}
              data-say={`${WORDS.samePlace.say} ${user?.community || ""}, ${user?.district || ""}.`}
              className={`flex min-h-16 flex-col items-start justify-center rounded-xl border-2 px-3 py-2 text-left ${
                !showPlaceFields ? "border-primary bg-primary-soft" : "border-line bg-white"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <Home size={18} aria-hidden="true" /> {WORDS.samePlace.text}
              </span>
              <span className="text-xs text-ink-soft">
                {[user?.community, user?.district].filter(Boolean).join(", ")}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={showPlaceFields}
              onClick={() => setOtherPlace(true)}
              data-say={WORDS.otherPlace.say}
              className={`flex min-h-16 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold text-ink ${
                showPlaceFields ? "border-primary bg-primary-soft" : "border-line bg-white"
              }`}
            >
              <MapPin size={18} aria-hidden="true" /> {WORDS.otherPlace.text}
            </button>
          </div>

          {showPlaceFields && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="label">County</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {COUNTIES.map((county) => (
                    <button
                      key={county}
                      type="button"
                      aria-pressed={form.county === county}
                      onClick={() => setForm((current) => ({ ...current, county }))}
                      className={`min-h-12 rounded-lg border-2 px-1 text-xs font-bold ${
                        form.county === county
                          ? "border-primary bg-primary-soft text-primary-dark"
                          : "border-line bg-white text-ink"
                      }`}
                    >
                      {county}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="District" htmlFor="district">
                <TextInput id="district" value={form.district} onChange={update("district")} placeholder="e.g. Gbarnga" />
              </Field>
              <Field label="Town or community" htmlFor="community">
                <TextInput id="community" value={form.community} onChange={update("community")} placeholder="e.g. Kpelleh Town" />
              </Field>
            </div>
          )}
        </section>

        {/* Notes, only for a helper who can write */}
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <button
            type="button"
            onClick={() => setShowNotes((value) => !value)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={showNotes}
            data-say={WORDS.writeMyself.say}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-ink">
              <PencilLine size={20} className="text-ink-soft" aria-hidden="true" /> {WORDS.writeMyself.text}
            </span>
            {showNotes ? <ChevronUp size={20} className="text-ink-soft" /> : <ChevronDown size={20} className="text-ink-soft" />}
          </button>
          {showNotes && (
            <div className="mt-4">
              <Field label="Things to remember about this farm" htmlFor="description">
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={update("description")}
                  maxLength={1000}
                />
              </Field>
            </div>
          )}
        </section>

        <Button type="submit" size="lg" className="w-full text-lg" loading={busy} data-say={WORDS.saveFarm.say}>
          {editing ? "Save" : WORDS.saveFarm.text}
        </Button>
      </form>
    </div>
  );
}
