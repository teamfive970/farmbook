import { CircleCheck, CircleX, Handshake, LockKeyhole, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { Button, ErrorBanner, Field, PageLoading, TextInput, Textarea } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import { activityMeta, farmMeta, formatFarmSize } from "../lib/labels.js";
import { CropIcon, GradeBadge } from "../components/Choices.jsx";
import { ICONS } from "../lib/icons.js";
import { GRADES, QUALITY_CHECKS, unitText } from "../lib/words.js";

// "Contact this farmer": the buyer leaves their name and number for the
// farmer. The farmer's own number is not shown; the farmer decides whether to
// call back or share it.
function ContactFarmer({ passport }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", organization: "", quantityWanted: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.post(`/api/passport/${encodeURIComponent(passport.code)}/contact`, {
        ...form,
        quantityWanted: form.quantityWanted === "" ? undefined : Number(form.quantityWanted)
      });
      setDone(result.message);
    } catch (requestError) {
      setError(requestError.isNetworkError ? "No internet. Check your connection and try again." : requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-primary/30 bg-primary-soft p-5" role="status">
        <p className="flex items-center gap-2 text-base font-bold text-primary-dark">
          <CircleCheck size={20} aria-hidden="true" /> Request sent to {passport.farmer.firstName}
        </p>
        <p className="mt-1 text-sm text-ink">{done}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Handshake size={20} className="text-primary" aria-hidden="true" /> Want to buy this {passport.crop.toLowerCase()}?
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Leave your number for {passport.farmer.firstName}. The farmer will call you back if interested.
        </p>
        <Button size="lg" className="mt-3 w-full" onClick={() => setOpen(true)}>
          <Handshake size={18} aria-hidden="true" /> Contact this farmer
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="relative space-y-3 rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Handshake size={20} className="text-primary" aria-hidden="true" /> Contact {passport.farmer.firstName}
      </h2>
      <ErrorBanner message={error} />
      <Field label="Your name" htmlFor="buyer-name">
        <TextInput id="buyer-name" value={form.name} onChange={set("name")} autoComplete="name" required minLength={2} maxLength={80} />
      </Field>
      <Field label="Your phone number" htmlFor="buyer-phone" hint="The farmer will call or text this number.">
        <TextInput
          id="buyer-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0770 123 456"
          value={form.phone}
          onChange={set("phone")}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company or market" htmlFor="buyer-org" hint="Optional">
          <TextInput id="buyer-org" value={form.organization} onChange={set("organization")} maxLength={80} />
        </Field>
        <Field label={`How much (${unitText(passport.unit)})`} htmlFor="buyer-qty" hint="Optional">
          <TextInput
            id="buyer-qty"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.quantityWanted}
            onChange={set("quantityWanted")}
          />
        </Field>
      </div>
      <Field label="Message" htmlFor="buyer-message" hint="Optional, e.g. price or when you can collect">
        <Textarea id="buyer-message" rows={3} maxLength={300} value={form.message} onChange={set("message")} />
      </Field>
      {/* Left empty by people; bots fill it in. */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={set("website")}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <p className="flex items-start gap-2 text-xs text-ink-soft">
        <LockKeyhole size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Your name and number go only to this farmer. The farmer's number stays private unless they choose to share it.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" loading={busy}>
          <Send size={16} aria-hidden="true" /> Send to farmer
        </Button>
      </div>
    </form>
  );
}

// Public Harvest Passport: what a buyer sees after scanning a batch's QR code.
// No sign-in. Shows where the crop came from, the farm work before harvest and
// the quality grade — never the farmer's phone number or full name.
export default function Passport() {
  const { code } = useParams();
  const [passport, setPassport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/api/passport/${encodeURIComponent(code)}`)
      .then((result) => setPassport(result.passport))
      .catch((requestError) => setError(requestError.message));
  }, [code]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
        <Brand to="/" />
        <ICONS.search size={40} className="mx-auto text-ink-soft" aria-hidden="true" />
        <h1 className="text-xl font-bold text-ink">Passport not available</h1>
        <p className="max-w-sm text-sm text-ink-soft">{error}</p>
        <p className="max-w-sm text-xs text-ink-soft">
          If you just got this link, the farmer may need to turn on "Buyers can see it" and connect to the internet
          once. Then open the link again.
        </p>
      </div>
    );
  }
  if (!passport) return <PageLoading label="Opening the Harvest Passport…" />;

  const grade = passport.quality ? GRADES[passport.quality.grade] : null;
  const farmType = farmMeta(passport.farm.farmType);

  return (
    <div className="min-h-dvh bg-canvas px-5 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <Brand to="/" />
          <span className="rounded-full bg-primary-soft px-3 py-1 font-mono text-xs font-bold text-primary-dark">
            {passport.code}
          </span>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Harvest Passport</p>
          <div className="mt-2 flex items-center gap-4">
            <CropIcon name={passport.crop} size={36} />
            <div>
              <h1 className="text-2xl font-bold text-ink">{passport.crop}</h1>
              <p className="text-sm text-ink-soft">
                {passport.quantity} {unitText(passport.unit)} · harvested {formatDate(passport.harvestDate)}
              </p>
              {passport.quantitySold > 0 && (
                <p className="text-xs text-ink-soft">
                  {passport.quantitySold} {unitText(passport.unit)} already sold
                  {passport.quantityLeft !== undefined ? ` · ${passport.quantityLeft} left` : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {passport.canContact && <ContactFarmer passport={passport} />}

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-sm font-bold text-ink">Where it was grown</h2>
          <p className="mt-2 text-sm text-ink">
            <ICONS.place size={14} className="mr-1 inline" aria-hidden="true" />
            {[passport.farm.community, passport.farm.district, passport.farm.county].filter(Boolean).join(", ")}, Liberia
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {farmType.label}
            {formatFarmSize(passport.farm) ? ` · ${formatFarmSize(passport.farm)}` : ""}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            <ICONS.farmer size={14} className="mr-1 inline" aria-hidden="true" />
            Farmer: {passport.farmer.firstName}
            {passport.farmer.groups.length > 0 ? ` · ${passport.farmer.groups.join(", ")}` : ""}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-sm font-bold text-ink">Quality</h2>
          {grade ? (
            <>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-lg font-bold text-ink">
                <GradeBadge grade={passport.quality.grade} words={grade} size="lg" />
                <span className="text-xs font-normal text-ink-soft">
                  checked {formatDate(passport.quality.checkedOn)}
                  {passport.quality.checkedBy ? ` by ${passport.quality.checkedBy}` : ""}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUALITY_CHECKS.filter((check) => passport.quality.checks[check.value] !== undefined).map((check) => (
                  <span
                    key={check.value}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                      passport.quality.checks[check.value] ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                    }`}
                  >
                    {passport.quality.checks[check.value] ? <CircleCheck size={12} aria-hidden="true" /> : <CircleX size={12} aria-hidden="true" />}{" "}
                    {check.text}
                  </span>
                ))}
              </div>
              {passport.quality.moisturePercent !== null && (
                <p className="mt-2 text-xs text-ink-soft">Moisture: {passport.quality.moisturePercent}%</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Not checked yet.</p>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-sm font-bold text-ink">Farm work in the year before harvest</h2>
          {passport.farmWork.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">No farm work recorded.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {passport.farmWork.map((work, index) => {
                const meta = activityMeta(work.activityType);
                return (
                  <li key={`${work.date}-${index}`} className="flex items-start gap-3 text-sm">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                      <meta.Icon size={16} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{meta.englishLabel || meta.label}</strong> · {formatDate(work.date)}
                      {work.inputUsed && (
                        <span className="block text-xs text-ink-soft">
                          Used: {work.inputUsed}
                          {work.quantity !== null ? ` (${work.quantity} ${work.unit || ""})` : ""}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <p className="text-center text-xs leading-relaxed text-ink-soft">{passport.notice}</p>
      </div>
    </div>
  );
}
